"""Rokadly core: db, auth, money, dates, audit, RBAC helpers."""
import os
import uuid
import re
from datetime import datetime, timezone, date, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from typing import Optional, List, Dict, Any

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.hash import pbkdf2_sha256
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'rokadly-dev-secret')
JWT_ALGO = 'HS256'
IST = ZoneInfo('Asia/Kolkata')

MANAGER_PERMS = [
    "view_recon", "reconcile", "mark_status", "clear_matched",
    "final_tally", "manage_cheques", "finalize_rokad",
]

security = HTTPBearer(auto_error=False)


def new_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def today_ist() -> str:
    return datetime.now(IST).strftime('%Y-%m-%d')


def normalize_bill_no(s: str) -> str:
    return re.sub(r'\s+', '', (s or '').strip().upper())


def normalize_name(s: str) -> str:
    return re.sub(r'[^a-z0-9]', '', (s or '').strip().lower())


def hash_password(p: str) -> str:
    return pbkdf2_sha256.hash(p)


def verify_password(p: str, h: str) -> bool:
    try:
        return pbkdf2_sha256.verify(p, h)
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def clean(doc):
    """Strip Mongo _id recursively."""
    if isinstance(doc, list):
        return [clean(d) for d in doc]
    if isinstance(doc, dict):
        return {k: clean(v) for k, v in doc.items() if k != '_id'}
    return doc


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user or not user.get("active", True):
        raise HTTPException(401, "User not found or deactivated")
    return user


def require_role(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, f"Requires role: {', '.join(roles)}")
        return user
    return dep


def can_access_store(user: dict, store_id: str) -> bool:
    if user["role"] == "admin":
        return True
    if user["role"] == "cashier":
        return user.get("store_id") == store_id
    return store_id in (user.get("store_ids") or [])


def require_store_access(user: dict, store_id: str):
    if not can_access_store(user, store_id):
        raise HTTPException(403, "No access to this store")


def manager_perm(user: dict, store_id: str, perm: str) -> bool:
    if user["role"] == "admin":
        return True
    if user["role"] != "manager":
        return False
    perms = (user.get("manager_permissions") or {}).get(store_id) or {}
    return bool(perms.get(perm))


async def audit(actor: dict, action: str, entity: str, entity_id: str,
                store_id: Optional[str] = None, business_date: Optional[str] = None,
                before: Any = None, after: Any = None, reason: Optional[str] = None,
                meta: Any = None):
    await db.audit_log.insert_one({
        "id": new_id(), "ts": now_utc(),
        "actor_id": actor.get("id"), "actor_name": actor.get("name"), "actor_role": actor.get("role"),
        "action": action, "entity": entity, "entity_id": entity_id,
        "store_id": store_id, "business_date": business_date,
        "before": clean(before) if before else None, "after": clean(after) if after else None,
        "reason": reason, "meta": meta,
    })


async def get_store_day(store_id: str, business_date: str, create: bool = True) -> Optional[dict]:
    sd = await db.store_days.find_one({"store_id": store_id, "business_date": business_date}, {"_id": 0})
    if sd:
        return sd
    if not create:
        return None
    prev = await db.store_days.find(
        {"store_id": store_id, "business_date": {"$lt": business_date}, "status": "finalized"},
        {"_id": 0}).sort("business_date", -1).to_list(1)
    opening = prev[0].get("closing_actual_paise", 0) if prev else 0
    sd = {
        "id": new_id(), "store_id": store_id, "business_date": business_date,
        "opening_paise": opening, "opening_source": "carry" if prev else "initial",
        "opening_adjustment": None, "status": "open",
        "finalized_by": None, "finalized_by_name": None, "finalized_at": None, "finalize_note": None,
        "closing_actual_paise": None, "reopen_history": [], "needs_revalidation": False,
        "created_at": now_utc(),
    }
    try:
        await db.store_days.insert_one(dict(sd))
    except Exception:
        sd = await db.store_days.find_one({"store_id": store_id, "business_date": business_date}, {"_id": 0})
    return clean(sd)


async def ensure_day_open(store_id: str, business_date: str):
    sd = await get_store_day(store_id, business_date)
    if sd["status"] == "finalized":
        raise HTTPException(423, "This business date is finalized and locked. Admin must reopen it first.")
    return sd


def ensure_cashier_today(user: dict, business_date: str):
    """Cashiers may only mutate the current business date."""
    if user["role"] == "cashier" and business_date != today_ist():
        raise HTTPException(403, "Cashiers can only enter the current business date")


async def cashier_cash_summary(store_id: str, business_date: str, cashier_id: str) -> dict:
    """Expected cash math for one cashier. All values integer paise."""
    alloc = await db.allocations.find_one(
        {"store_id": store_id, "business_date": business_date, "cashier_id": cashier_id}, {"_id": 0})
    opening = alloc["amount_paise"] if alloc else 0

    cash_from_bills = 0
    cash_excess_returned = 0
    bill_total = 0
    less_taken = 0
    noncash_from_bills = 0
    async for b in db.bills.find({"store_id": store_id, "business_date": business_date,
                                  "cashier_id": cashier_id, "status": "active"}, {"_id": 0}):
        bill_total += b["amount_paise"]
        less_taken += b.get("less_taken_paise", 0)
        for p in b.get("payments", []):
            if p["type"] == "cash":
                cash_from_bills += p["amount_paise"]
            else:
                noncash_from_bills += p["amount_paise"]
        ex = b.get("excess")
        if ex and ex.get("return_mode") == "cash":
            cash_excess_returned += ex["amount_paise"]

    adj_cash_receipts = 0
    adj_cash_deductions = 0
    async for a in db.adjustments.find({"store_id": store_id, "business_date": business_date,
                                        "cashier_id": cashier_id, "status": "active"}, {"_id": 0}):
        if a.get("payment_type") == "cash":
            if a["kind"] == "receipt":
                adj_cash_receipts += a["amount_paise"]
            else:
                adj_cash_deductions += a["amount_paise"]

    cash_expenses = 0
    async for e in db.expenses.find({"store_id": store_id, "business_date": business_date,
                                     "cashier_id": cashier_id, "status": "active",
                                     "payment_type": "cash"}, {"_id": 0}):
        cash_expenses += e["amount_paise"]

    expected = (opening + cash_from_bills - cash_excess_returned
                + adj_cash_receipts - adj_cash_deductions - cash_expenses)
    return {
        "cashier_id": cashier_id,
        "opening_allocation_paise": opening,
        "bill_total_paise": bill_total,
        "cash_from_bills_paise": cash_from_bills,
        "cash_excess_returned_paise": cash_excess_returned,
        "noncash_from_bills_paise": noncash_from_bills,
        "less_taken_paise": less_taken,
        "adj_cash_receipts_paise": adj_cash_receipts,
        "adj_cash_deductions_paise": adj_cash_deductions,
        "cash_expenses_paise": cash_expenses,
        "expected_cash_paise": expected,
    }


async def store_cashiers(store_id: str) -> List[dict]:
    """Active cashiers currently assigned to a store."""
    return await db.users.find({"role": "cashier", "store_id": store_id, "active": True},
                               {"_id": 0, "password_hash": 0}).to_list(100)


async def day_participant_cashiers(store_id: str, business_date: str) -> List[str]:
    """Cashier ids with any activity (bills/expenses/adjustments/allocations/counts) that day,
    plus currently-assigned active cashiers."""
    ids = set()
    for coll in (db.bills, db.expenses, db.adjustments, db.allocations, db.cash_counts):
        for cid in await coll.distinct("cashier_id", {"store_id": store_id, "business_date": business_date}):
            if cid:
                ids.add(cid)
    for c in await store_cashiers(store_id):
        ids.add(c["id"])
    return list(ids)


async def build_noncash_items(store_id: str, business_date: str) -> List[dict]:
    """Continuous-serial non-cash list: Card -> Cheque -> Banks (display order) -> Other."""
    banks = {b["id"]: b for b in await db.banks.find({}, {"_id": 0}).to_list(500)}
    items = []
    async for b in db.bills.find({"store_id": store_id, "business_date": business_date,
                                  "status": "active"}, {"_id": 0}):
        for idx, p in enumerate(b.get("payments", [])):
            if p["type"] == "cash":
                continue
            items.append({
                "source": "bill", "ref_id": b["id"], "payment_index": idx,
                "type": p["type"], "amount_paise": p["amount_paise"],
                "bank_id": p.get("bank_id"), "bank_name": p.get("bank_name"),
                "other_label": p.get("other_label"), "cheque_no": p.get("cheque_no"),
                "bill_no": b["bill_no"], "customer_name": b.get("customer_name"),
                "cashier_id": b["cashier_id"], "cashier_name": b.get("cashier_name"),
                "recon_status": p.get("recon_status", "unreviewed"),
                "recon_note": p.get("recon_note"),
                "created_at": b.get("created_at"),
            })
    async for a in db.adjustments.find({"store_id": store_id, "business_date": business_date,
                                        "status": "active", "kind": "receipt",
                                        "payment_type": {"$ne": "cash"}}, {"_id": 0}):
        items.append({
            "source": "adjustment", "ref_id": a["id"], "payment_index": None,
            "type": a["payment_type"], "amount_paise": a["amount_paise"],
            "bank_id": a.get("bank_id"), "bank_name": a.get("bank_name"),
            "other_label": a.get("other_label"), "cheque_no": None,
            "bill_no": a.get("related_bill_no"), "customer_name": a.get("description"),
            "cashier_id": a["cashier_id"], "cashier_name": a.get("cashier_name"),
            "recon_status": a.get("recon_status", "unreviewed"),
            "recon_note": a.get("recon_note"),
            "created_at": a.get("created_at"),
        })

    def sort_key(it):
        if it["type"] == "card":
            return (0, 0, it.get("created_at") or "")
        if it["type"] == "cheque":
            return (1, 0, it.get("created_at") or "")
        if it["type"] == "bank":
            bank = banks.get(it.get("bank_id")) or {}
            return (2, bank.get("display_order", 9999), it.get("created_at") or "")
        return (3, 0, it.get("created_at") or "")

    items.sort(key=sort_key)
    for i, it in enumerate(items):
        it["serial"] = i + 1
        if it["type"] == "card":
            it["group_key"] = "card"
            it["group_label"] = "Card"
        elif it["type"] == "cheque":
            it["group_key"] = "cheque"
            it["group_label"] = "Cheque"
        elif it["type"] == "bank":
            it["group_key"] = f"bank:{it.get('bank_id')}"
            it["group_label"] = it.get("bank_name") or "Bank"
        else:
            it["group_key"] = "other"
            it["group_label"] = "Other"
    return items


async def ensure_indexes():
    await db.users.create_index("id", unique=True)
    await db.users.create_index("username", unique=True)
    await db.stores.create_index("id", unique=True)
    await db.banks.create_index("id", unique=True)
    await db.banks.create_index("normalized_name", unique=True)
    await db.bills.create_index("id", unique=True)
    await db.bills.create_index(
        [("store_id", 1), ("business_date", 1), ("bill_no_norm", 1)],
        unique=True, partialFilterExpression={"status": "active"},
        name="uniq_active_bill")
    await db.bills.create_index("client_key", unique=True,
                                partialFilterExpression={"client_key": {"$type": "string"}},
                                name="uniq_client_key")
    await db.bills.create_index([("store_id", 1), ("business_date", 1), ("cashier_id", 1)])
    await db.store_days.create_index([("store_id", 1), ("business_date", 1)], unique=True)
    await db.allocations.create_index([("store_id", 1), ("business_date", 1), ("cashier_id", 1)], unique=True)
    await db.cash_counts.create_index([("store_id", 1), ("business_date", 1), ("cashier_id", 1)], unique=True)
    await db.expenses.create_index([("store_id", 1), ("business_date", 1)])
    await db.adjustments.create_index([("store_id", 1), ("business_date", 1)])
    await db.cheques.create_index([("bill_id", 1), ("payment_index", 1)], unique=True, sparse=True)
    await db.discrepancies.create_index([("store_id", 1), ("business_date", 1)])
    await db.account_tallies.create_index(
        [("store_id", 1), ("business_date", 1), ("group_key", 1)], unique=True)
    await db.audit_log.create_index([("ts", -1)])
    await db.drafts.create_index([("cashier_id", 1), ("draft_key", 1)], unique=True)
