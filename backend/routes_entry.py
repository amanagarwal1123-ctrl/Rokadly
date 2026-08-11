"""Bills (with drafts, duplicate protection), adjustments (other receipts), expenses, heads."""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from core import (db, new_id, now_utc, today_ist, clean, audit, get_current_user,
                  normalize_bill_no, normalize_name, require_store_access, ensure_day_open,
                  ensure_cashier_today, can_access_store)

router = APIRouter()

PAYMENT_TYPES = {"cash", "card", "cheque", "bank", "other"}


class PaymentRow(BaseModel):
    type: str
    amount_paise: int = Field(ge=0)
    bank_id: Optional[str] = None
    other_label: Optional[str] = None
    cheque_no: Optional[str] = None
    cheque_name: Optional[str] = None
    cheque_due_date: Optional[str] = None


class ExcessReturn(BaseModel):
    amount_paise: int = Field(ge=0)
    return_mode: str  # cash | bank
    bank_id: Optional[str] = None


class BillIn(BaseModel):
    bill_no: str
    amount_paise: int = Field(gt=0)
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    country_code: Optional[str] = "+91"
    payments: List[PaymentRow]
    less_taken_reason: Optional[str] = None
    excess: Optional[ExcessReturn] = None
    client_key: Optional[str] = None
    store_id: Optional[str] = None      # admin only override
    business_date: Optional[str] = None  # admin only override


class BillUpdate(BillIn):
    version: int


async def _resolve_bank(bank_id: str) -> dict:
    bank = await db.banks.find_one({"id": bank_id, "active": True}, {"_id": 0})
    if not bank:
        raise HTTPException(400, "Unknown or inactive bank. Request it from the Banks tab.")
    return bank


async def _validate_bill(payload: BillIn) -> dict:
    """Validate + compute less_taken / excess. Returns computed fields."""
    if not payload.bill_no or not normalize_bill_no(payload.bill_no):
        raise HTTPException(400, "MMI bill number is required")
    if payload.customer_phone:
        digits = ''.join(ch for ch in payload.customer_phone if ch.isdigit())
        if (payload.country_code or "+91") == "+91" and len(digits) != 10:
            raise HTTPException(400, "Customer phone must be exactly 10 digits")
        payload.customer_phone = digits
    if not payload.payments:
        raise HTTPException(400, "At least one payment row is required")

    payments = []
    for p in payload.payments:
        if p.type not in PAYMENT_TYPES:
            raise HTTPException(400, f"Invalid payment type {p.type}")
        row = {"type": p.type, "amount_paise": p.amount_paise,
               "recon_status": "unreviewed" if p.type != "cash" else None}
        if p.type == "bank":
            if not p.bank_id:
                raise HTTPException(400, "Bank payment requires a bank name")
            bank = await _resolve_bank(p.bank_id)
            row["bank_id"] = bank["id"]
            row["bank_name"] = bank["name"]
            row["bank_home_store_id"] = bank.get("home_store_id")
        elif p.type == "cheque":
            if not p.cheque_no:
                raise HTTPException(400, "Cheque payment requires a cheque number")
            row["cheque_no"] = p.cheque_no
            row["cheque_name"] = p.cheque_name
            row["cheque_due_date"] = p.cheque_due_date
        elif p.type == "other":
            if not p.other_label:
                raise HTTPException(400, "Other payment requires a label")
            row["other_label"] = p.other_label
        payments.append(row)

    paid = sum(p["amount_paise"] for p in payments)
    less_taken = 0
    excess = None
    if paid < payload.amount_paise:
        less_taken = payload.amount_paise - paid
    elif paid > payload.amount_paise:
        diff = paid - payload.amount_paise
        if not payload.excess:
            raise HTTPException(400, {
                "code": "EXCESS_REQUIRED",
                "message": f"Payments exceed bill amount by \u20b9{diff / 100:,.2f}. Record how the excess was returned (Cash or Bank).",
                "excess_paise": diff})
        if payload.excess.amount_paise != diff:
            raise HTTPException(400, {
                "code": "EXCESS_MISMATCH",
                "message": f"Excess return must be exactly \u20b9{diff / 100:,.2f}",
                "excess_paise": diff})
        if payload.excess.return_mode not in ("cash", "bank"):
            raise HTTPException(400, "Excess return mode must be cash or bank")
        excess = {"amount_paise": diff, "return_mode": payload.excess.return_mode}
        if payload.excess.return_mode == "bank":
            if not payload.excess.bank_id:
                raise HTTPException(400, "Bank excess return requires a bank name")
            bank = await _resolve_bank(payload.excess.bank_id)
            excess["bank_id"] = bank["id"]
            excess["bank_name"] = bank["name"]
    return {"payments": payments, "less_taken_paise": less_taken, "excess": excess,
            "gross_paise": paid, "net_paise": paid - (excess["amount_paise"] if excess else 0)}


async def _sync_cheques(bill: dict, actor: dict):
    """Create/refresh cheque ledger records for cheque payment rows (idempotent)."""
    active_idx = set()
    for idx, p in enumerate(bill.get("payments", [])):
        if p["type"] != "cheque":
            continue
        active_idx.add(idx)
        existing = await db.cheques.find_one({"bill_id": bill["id"], "payment_index": idx}, {"_id": 0})
        if existing:
            await db.cheques.update_one(
                {"id": existing["id"]},
                {"$set": {"cheque_no": p.get("cheque_no"), "amount_paise": p["amount_paise"],
                          "name_on_cheque": p.get("cheque_name") or bill.get("customer_name"),
                          "due_date": p.get("cheque_due_date"), "active": True}})
        else:
            await db.cheques.insert_one({
                "id": new_id(), "store_id": bill["store_id"], "business_date": bill["business_date"],
                "bill_id": bill["id"], "payment_index": idx, "bill_no": bill["bill_no"],
                "cashier_id": bill["cashier_id"], "cashier_name": bill.get("cashier_name"),
                "cheque_no": p.get("cheque_no"), "amount_paise": p["amount_paise"],
                "name_on_cheque": p.get("cheque_name") or bill.get("customer_name"),
                "received_date": bill["business_date"], "due_date": p.get("cheque_due_date"),
                "notes": None, "status": "pending", "status_date": None, "status_remark": None,
                "active": True, "history": [], "created_at": now_utc()})
    # deactivate cheque records whose rows were removed or whose bill is voided
    if bill["status"] != "active":
        await db.cheques.update_many({"bill_id": bill["id"]}, {"$set": {"active": False}})
    else:
        await db.cheques.update_many(
            {"bill_id": bill["id"], "payment_index": {"$nin": list(active_idx)}},
            {"$set": {"active": False}})
        await db.cheques.update_many(
            {"bill_id": bill["id"], "payment_index": {"$in": list(active_idx)}},
            {"$set": {"active": True}})


@router.get("/bills/check-duplicate")
async def check_duplicate(store_id: str, business_date: str, bill_no: str,
                          user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    norm = normalize_bill_no(bill_no)
    existing = await db.bills.find_one(
        {"store_id": store_id, "business_date": business_date, "bill_no_norm": norm,
         "status": "active"}, {"_id": 0})
    if existing:
        return {"duplicate": True, "existing": {
            "bill_no": existing["bill_no"], "amount_paise": existing["amount_paise"],
            "cashier_name": existing.get("cashier_name"), "created_at": existing.get("created_at"),
            "customer_name": existing.get("customer_name")}}
    return {"duplicate": False}


@router.post("/bills", status_code=201)
async def create_bill(payload: BillIn, user: dict = Depends(get_current_user)):
    if user["role"] == "cashier":
        store_id = user["store_id"]
        business_date = today_ist()
    elif user["role"] == "admin":
        store_id = payload.store_id
        business_date = payload.business_date or today_ist()
        if not store_id:
            raise HTTPException(400, "store_id required for admin bill entry")
    else:
        raise HTTPException(403, "Only cashiers and admin can enter bills")
    require_store_access(user, store_id)
    await ensure_day_open(store_id, business_date)

    # idempotency
    if payload.client_key:
        existing = await db.bills.find_one({"client_key": payload.client_key}, {"_id": 0})
        if existing:
            return {"bill": existing, "idempotent": True}

    computed = await _validate_bill(payload)
    bill = {
        "id": new_id(), "store_id": store_id, "business_date": business_date,
        "bill_no": payload.bill_no.strip(), "bill_no_norm": normalize_bill_no(payload.bill_no),
        "cashier_id": user["id"], "cashier_name": user["name"],
        "amount_paise": payload.amount_paise,
        "customer_name": (payload.customer_name or None),
        "customer_phone": (payload.customer_phone or None),
        "country_code": payload.country_code or "+91",
        "payments": computed["payments"],
        "less_taken_paise": computed["less_taken_paise"],
        "less_taken_reason": payload.less_taken_reason if computed["less_taken_paise"] else None,
        "excess": computed["excess"],
        "gross_paise": computed["gross_paise"], "net_paise": computed["net_paise"],
        "status": "active", "void_reason": None, "version": 1,
        "client_key": payload.client_key,
        "created_at": now_utc(), "updated_at": now_utc(),
        "annotations": [],
    }
    try:
        await db.bills.insert_one(dict(bill))
    except DuplicateKeyError:
        existing = await db.bills.find_one(
            {"store_id": store_id, "business_date": business_date,
             "bill_no_norm": bill["bill_no_norm"], "status": "active"}, {"_id": 0})
        detail = {"code": "DUPLICATE_BILL",
                  "message": f"Bill {payload.bill_no} already exists for this store and date. Your draft is preserved - change only the bill number and save again."}
        if existing:
            detail["existing"] = {"id": existing["id"], "bill_no": existing["bill_no"],
                                  "amount_paise": existing["amount_paise"],
                                  "cashier_name": existing.get("cashier_name"),
                                  "created_at": existing.get("created_at")}
        raise HTTPException(409, detail)
    await _sync_cheques(bill, user)
    await audit(user, "bill.create", "bill", bill["id"], store_id, business_date, after=bill)
    return {"bill": clean(bill), "idempotent": False}


@router.get("/bills")
async def list_bills(store_id: str, business_date: str,
                     cashier_id: Optional[str] = None,
                     include_void: bool = False,
                     user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    q: Dict[str, Any] = {"store_id": store_id, "business_date": business_date}
    if user["role"] == "cashier":
        q["cashier_id"] = user["id"]
    elif cashier_id:
        q["cashier_id"] = cashier_id
    if not include_void:
        q["status"] = "active"
    bills = await db.bills.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"bills": bills}


@router.get("/bills/{bill_id}")
async def get_bill(bill_id: str, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(404, "Bill not found")
    require_store_access(user, bill["store_id"])
    if user["role"] == "cashier" and bill["cashier_id"] != user["id"]:
        raise HTTPException(403, "You can only view your own bills")
    return {"bill": bill}


@router.put("/bills/{bill_id}")
async def update_bill(bill_id: str, payload: BillUpdate, user: dict = Depends(get_current_user)):
    bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(404, "Bill not found")
    require_store_access(user, bill["store_id"])
    if user["role"] == "cashier":
        if bill["cashier_id"] != user["id"]:
            raise HTTPException(403, "You can only edit your own bills")
        ensure_cashier_today(user, bill["business_date"])
    elif user["role"] != "admin":
        raise HTTPException(403, "Only the owning cashier or admin can edit bills")
    await ensure_day_open(bill["store_id"], bill["business_date"])
    if bill["status"] != "active":
        raise HTTPException(400, "Cannot edit a voided bill")

    computed = await _validate_bill(payload)
    # preserve recon status where a row is unchanged (match by type+amount+bank/cheque)
    old_rows = list(bill.get("payments", []))
    for np in computed["payments"]:
        for op in old_rows:
            if (op["type"] == np["type"] and op["amount_paise"] == np["amount_paise"]
                    and op.get("bank_id") == np.get("bank_id")
                    and op.get("cheque_no") == np.get("cheque_no")
                    and op.get("recon_status")):
                np["recon_status"] = op["recon_status"]
                np["recon_note"] = op.get("recon_note")
                old_rows.remove(op)
                break

    update = {
        "bill_no": payload.bill_no.strip(), "bill_no_norm": normalize_bill_no(payload.bill_no),
        "amount_paise": payload.amount_paise,
        "customer_name": payload.customer_name or None,
        "customer_phone": payload.customer_phone or None,
        "country_code": payload.country_code or "+91",
        "payments": computed["payments"],
        "less_taken_paise": computed["less_taken_paise"],
        "less_taken_reason": payload.less_taken_reason if computed["less_taken_paise"] else None,
        "excess": computed["excess"],
        "gross_paise": computed["gross_paise"], "net_paise": computed["net_paise"],
        "updated_at": now_utc(),
    }
    try:
        res = await db.bills.update_one(
            {"id": bill_id, "version": payload.version},
            {"$set": update, "$inc": {"version": 1}})
    except DuplicateKeyError:
        raise HTTPException(409, {"code": "DUPLICATE_BILL",
                                  "message": "Another active bill already uses this number for this store and date."})
    if res.matched_count == 0:
        raise HTTPException(409, {"code": "VERSION_CONFLICT",
                                  "message": "This bill was changed by someone else. Reload and retry."})
    updated = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    await _sync_cheques(updated, user)
    await audit(user, "bill.update", "bill", bill_id, bill["store_id"], bill["business_date"],
                before=bill, after=updated)
    return {"bill": updated}


class VoidIn(BaseModel):
    reason: str
    version: Optional[int] = None


@router.post("/bills/{bill_id}/void")
async def void_bill(bill_id: str, payload: VoidIn, user: dict = Depends(get_current_user)):
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(400, "A reason is compulsory to void a bill")
    bill = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    if not bill:
        raise HTTPException(404, "Bill not found")
    require_store_access(user, bill["store_id"])
    if user["role"] == "cashier":
        if bill["cashier_id"] != user["id"]:
            raise HTTPException(403, "You can only void your own bills")
        ensure_cashier_today(user, bill["business_date"])
    elif user["role"] != "admin":
        raise HTTPException(403, "Only the owning cashier or admin can void bills")
    await ensure_day_open(bill["store_id"], bill["business_date"])
    await db.bills.update_one({"id": bill_id}, {"$set": {
        "status": "void", "void_reason": payload.reason.strip(),
        "voided_by": user["id"], "voided_at": now_utc()}, "$inc": {"version": 1}})
    updated = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    await _sync_cheques(updated, user)
    await audit(user, "bill.void", "bill", bill_id, bill["store_id"], bill["business_date"],
                before=bill, after=updated, reason=payload.reason)
    return {"bill": updated}


# ---------------- Drafts (server-side persistence) ----------------

class DraftIn(BaseModel):
    draft_key: str
    payload: Dict[str, Any]


@router.put("/drafts")
async def save_draft(d: DraftIn, user: dict = Depends(get_current_user)):
    await db.drafts.update_one(
        {"cashier_id": user["id"], "draft_key": d.draft_key},
        {"$set": {"payload": d.payload, "updated_at": now_utc(),
                  "store_id": user.get("store_id")},
         "$setOnInsert": {"id": new_id()}},
        upsert=True)
    return {"ok": True}


@router.get("/drafts")
async def list_drafts(user: dict = Depends(get_current_user)):
    drafts = await db.drafts.find({"cashier_id": user["id"]}, {"_id": 0}).to_list(50)
    return {"drafts": drafts}


@router.delete("/drafts/{draft_key}")
async def delete_draft(draft_key: str, user: dict = Depends(get_current_user)):
    await db.drafts.delete_one({"cashier_id": user["id"], "draft_key": draft_key})
    return {"ok": True}


# ---------------- Heads ----------------

class HeadIn(BaseModel):
    kind: str  # expense | adjustment
    name: str
    scope: Optional[str] = None  # admin can pass 'global'


@router.get("/heads")
async def list_heads(kind: str, store_id: Optional[str] = None, include_inactive: bool = False,
                     user: dict = Depends(get_current_user)):
    sid = store_id or user.get("store_id")
    q: Dict[str, Any] = {"kind": kind,
                         "$or": [{"scope": "global"}, {"store_id": sid}]}
    if not include_inactive:
        q["active"] = True
    heads = await db.heads.find(q, {"_id": 0}).sort("name", 1).to_list(200)
    return {"heads": heads}


@router.post("/heads", status_code=201)
async def create_head(payload: HeadIn, user: dict = Depends(get_current_user)):
    if user["role"] not in ("cashier", "admin"):
        raise HTTPException(403, "Only cashiers and admin can create heads")
    if payload.kind not in ("expense", "adjustment"):
        raise HTTPException(400, "kind must be expense or adjustment")
    scope = "global" if (user["role"] == "admin" and payload.scope == "global") else "store"
    store_id = None if scope == "global" else (user.get("store_id") or payload.scope)
    if scope == "store" and not store_id:
        raise HTTPException(400, "store head requires a store")
    norm = normalize_name(payload.name)
    dup = await db.heads.find_one({"kind": payload.kind, "norm_name": norm,
                                   "$or": [{"scope": "global"}, {"store_id": store_id}]}, {"_id": 0})
    if dup:
        return {"head": dup, "existing": True}
    head = {"id": new_id(), "kind": payload.kind, "name": payload.name.strip(),
            "norm_name": norm, "scope": scope, "store_id": store_id,
            "created_by": user["id"], "active": True, "created_at": now_utc()}
    await db.heads.insert_one(dict(head))
    await audit(user, "head.create", "head", head["id"], store_id, after=head)
    return {"head": clean(head), "existing": False}


@router.patch("/heads/{head_id}")
async def toggle_head(head_id: str, active: bool, user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Only admin can deactivate heads")
    head = await db.heads.find_one({"id": head_id}, {"_id": 0})
    if not head:
        raise HTTPException(404, "Head not found")
    await db.heads.update_one({"id": head_id}, {"$set": {"active": active}})
    await audit(user, "head.toggle", "head", head_id, head.get("store_id"),
                before=head, after={**head, "active": active})
    return {"ok": True}


# ---------------- Adjustments (other receipts / standalone deductions) ----------------

class AdjustmentIn(BaseModel):
    kind: str  # receipt | deduction
    description: str
    amount_paise: int = Field(gt=0)
    payment_type: str  # cash | card | cheque | bank | other
    bank_id: Optional[str] = None
    other_label: Optional[str] = None
    head_id: Optional[str] = None
    related_bill_no: Optional[str] = None
    store_id: Optional[str] = None
    business_date: Optional[str] = None
    linked_discrepancy_id: Optional[str] = None


@router.post("/adjustments", status_code=201)
async def create_adjustment(payload: AdjustmentIn, user: dict = Depends(get_current_user)):
    if user["role"] == "cashier":
        store_id, business_date = user["store_id"], today_ist()
    elif user["role"] == "admin":
        store_id = payload.store_id
        business_date = payload.business_date or today_ist()
        if not store_id:
            raise HTTPException(400, "store_id required")
    else:
        raise HTTPException(403, "Only cashiers and admin can enter adjustments")
    require_store_access(user, store_id)
    await ensure_day_open(store_id, business_date)
    if payload.kind not in ("receipt", "deduction"):
        raise HTTPException(400, "kind must be receipt or deduction")
    if not payload.description.strip():
        raise HTTPException(400, "Description is compulsory")
    if payload.payment_type not in PAYMENT_TYPES:
        raise HTTPException(400, "Invalid payment type")
    adj = {
        "id": new_id(), "store_id": store_id, "business_date": business_date,
        "cashier_id": user["id"], "cashier_name": user["name"],
        "kind": payload.kind, "description": payload.description.strip(),
        "amount_paise": payload.amount_paise, "payment_type": payload.payment_type,
        "head_id": payload.head_id, "related_bill_no": payload.related_bill_no,
        "other_label": payload.other_label,
        "linked_discrepancy_id": payload.linked_discrepancy_id,
        "recon_status": "unreviewed" if payload.payment_type != "cash" else None,
        "status": "active", "void_reason": None, "version": 1, "created_at": now_utc(),
    }
    if payload.payment_type == "bank":
        if not payload.bank_id:
            raise HTTPException(400, "Bank adjustment requires a bank")
        bank = await _resolve_bank(payload.bank_id)
        adj["bank_id"] = bank["id"]
        adj["bank_name"] = bank["name"]
    if payload.head_id:
        head = await db.heads.find_one({"id": payload.head_id}, {"_id": 0})
        adj["head_name"] = head["name"] if head else None
    await db.adjustments.insert_one(dict(adj))
    await audit(user, "adjustment.create", "adjustment", adj["id"], store_id, business_date, after=adj)
    return {"adjustment": clean(adj)}


@router.get("/adjustments")
async def list_adjustments(store_id: str, business_date: str,
                           user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    q: Dict[str, Any] = {"store_id": store_id, "business_date": business_date}
    if user["role"] == "cashier":
        q["cashier_id"] = user["id"]
    adjustments = await db.adjustments.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"adjustments": adjustments}


@router.post("/adjustments/{adj_id}/void")
async def void_adjustment(adj_id: str, payload: VoidIn, user: dict = Depends(get_current_user)):
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(400, "A reason is compulsory")
    adj = await db.adjustments.find_one({"id": adj_id}, {"_id": 0})
    if not adj:
        raise HTTPException(404, "Not found")
    require_store_access(user, adj["store_id"])
    if user["role"] == "cashier" and adj["cashier_id"] != user["id"]:
        raise HTTPException(403, "You can only void your own entries")
    if user["role"] not in ("cashier", "admin"):
        raise HTTPException(403, "Not permitted")
    await ensure_day_open(adj["store_id"], adj["business_date"])
    await db.adjustments.update_one({"id": adj_id}, {"$set": {
        "status": "void", "void_reason": payload.reason.strip(),
        "voided_by": user["id"], "voided_at": now_utc()}})
    await audit(user, "adjustment.void", "adjustment", adj_id, adj["store_id"],
                adj["business_date"], before=adj, reason=payload.reason)
    return {"ok": True}


# ---------------- Expenses ----------------

class ExpenseIn(BaseModel):
    amount_paise: int = Field(gt=0)
    nature: str  # business_payment | operating
    voucher_status: str  # with_voucher | without_voucher
    head_id: Optional[str] = None
    description: str
    payment_type: str  # cash | bank
    bank_id: Optional[str] = None
    voucher_no: Optional[str] = None
    store_id: Optional[str] = None
    business_date: Optional[str] = None


class ExpenseUpdate(ExpenseIn):
    version: int


@router.post("/expenses", status_code=201)
async def create_expense(payload: ExpenseIn, user: dict = Depends(get_current_user)):
    if user["role"] == "cashier":
        store_id, business_date = user["store_id"], today_ist()
    elif user["role"] == "admin":
        store_id = payload.store_id
        business_date = payload.business_date or today_ist()
        if not store_id:
            raise HTTPException(400, "store_id required")
    else:
        raise HTTPException(403, "Only cashiers and admin can enter expenses")
    require_store_access(user, store_id)
    await ensure_day_open(store_id, business_date)
    if payload.nature not in ("business_payment", "operating"):
        raise HTTPException(400, "nature must be business_payment or operating")
    if payload.voucher_status not in ("with_voucher", "without_voucher"):
        raise HTTPException(400, "voucher_status invalid")
    if payload.payment_type not in ("cash", "bank"):
        raise HTTPException(400, "Expense payment must be cash or bank")
    if not payload.description.strip():
        raise HTTPException(400, "Description is required")
    exp = {
        "id": new_id(), "store_id": store_id, "business_date": business_date,
        "cashier_id": user["id"], "cashier_name": user["name"],
        "amount_paise": payload.amount_paise, "nature": payload.nature,
        "voucher_status": payload.voucher_status, "voucher_no": payload.voucher_no,
        "head_id": payload.head_id, "description": payload.description.strip(),
        "payment_type": payload.payment_type,
        "status": "active", "void_reason": None,
        "review_status": "unreviewed", "reviewed_by": None, "finalized_by": None,
        "version": 1, "created_at": now_utc(), "updated_at": now_utc(),
    }
    if payload.payment_type == "bank":
        if not payload.bank_id:
            raise HTTPException(400, "Bank expense requires a bank")
        bank = await _resolve_bank(payload.bank_id)
        exp["bank_id"] = bank["id"]
        exp["bank_name"] = bank["name"]
    if payload.head_id:
        head = await db.heads.find_one({"id": payload.head_id}, {"_id": 0})
        exp["head_name"] = head["name"] if head else None
    await db.expenses.insert_one(dict(exp))
    await audit(user, "expense.create", "expense", exp["id"], store_id, business_date, after=exp)
    return {"expense": clean(exp)}


@router.get("/expenses")
async def list_expenses(store_id: str, business_date: str,
                        user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    q: Dict[str, Any] = {"store_id": store_id, "business_date": business_date}
    if user["role"] == "cashier":
        q["cashier_id"] = user["id"]
    expenses = await db.expenses.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"expenses": expenses}


@router.put("/expenses/{exp_id}")
async def update_expense(exp_id: str, payload: ExpenseUpdate, user: dict = Depends(get_current_user)):
    exp = await db.expenses.find_one({"id": exp_id}, {"_id": 0})
    if not exp:
        raise HTTPException(404, "Expense not found")
    require_store_access(user, exp["store_id"])
    if exp["review_status"] == "finalized" and user["role"] != "admin":
        raise HTTPException(423, "Expense finalized by admin - view only")
    if user["role"] == "cashier":
        if exp["cashier_id"] != user["id"]:
            raise HTTPException(403, "You can only edit your own expenses")
        ensure_cashier_today(user, exp["business_date"])
    elif user["role"] != "admin":
        raise HTTPException(403, "Not permitted")
    await ensure_day_open(exp["store_id"], exp["business_date"])
    update = {"amount_paise": payload.amount_paise, "nature": payload.nature,
              "voucher_status": payload.voucher_status, "voucher_no": payload.voucher_no,
              "head_id": payload.head_id, "description": payload.description.strip(),
              "payment_type": payload.payment_type, "updated_at": now_utc()}
    if payload.payment_type == "bank":
        if not payload.bank_id:
            raise HTTPException(400, "Bank expense requires a bank")
        bank = await _resolve_bank(payload.bank_id)
        update["bank_id"] = bank["id"]
        update["bank_name"] = bank["name"]
    else:
        update["bank_id"] = None
        update["bank_name"] = None
    res = await db.expenses.update_one({"id": exp_id, "version": payload.version},
                                       {"$set": update, "$inc": {"version": 1}})
    if res.matched_count == 0:
        raise HTTPException(409, {"code": "VERSION_CONFLICT", "message": "Expense changed by someone else"})
    updated = await db.expenses.find_one({"id": exp_id}, {"_id": 0})
    await audit(user, "expense.update", "expense", exp_id, exp["store_id"], exp["business_date"],
                before=exp, after=updated)
    return {"expense": updated}


@router.post("/expenses/{exp_id}/void")
async def void_expense(exp_id: str, payload: VoidIn, user: dict = Depends(get_current_user)):
    if not payload.reason or not payload.reason.strip():
        raise HTTPException(400, "A reason is compulsory")
    exp = await db.expenses.find_one({"id": exp_id}, {"_id": 0})
    if not exp:
        raise HTTPException(404, "Not found")
    require_store_access(user, exp["store_id"])
    if exp["review_status"] == "finalized" and user["role"] != "admin":
        raise HTTPException(423, "Expense finalized - view only")
    if user["role"] == "cashier" and exp["cashier_id"] != user["id"]:
        raise HTTPException(403, "You can only void your own expenses")
    if user["role"] not in ("cashier", "admin"):
        raise HTTPException(403, "Not permitted")
    await ensure_day_open(exp["store_id"], exp["business_date"])
    await db.expenses.update_one({"id": exp_id}, {"$set": {
        "status": "void", "void_reason": payload.reason.strip(),
        "voided_by": user["id"], "voided_at": now_utc()}})
    await audit(user, "expense.void", "expense", exp_id, exp["store_id"], exp["business_date"],
                before=exp, reason=payload.reason)
    return {"ok": True}


class ReviewIn(BaseModel):
    action: str  # review | finalize | unreview


@router.post("/expenses/{exp_id}/review")
async def review_expense(exp_id: str, payload: ReviewIn, user: dict = Depends(get_current_user)):
    exp = await db.expenses.find_one({"id": exp_id}, {"_id": 0})
    if not exp:
        raise HTTPException(404, "Not found")
    require_store_access(user, exp["store_id"])
    if payload.action == "review":
        if user["role"] not in ("accountant", "admin"):
            raise HTTPException(403, "Only accountant or admin can review expenses")
        upd = {"review_status": "reviewed", "reviewed_by": user["id"], "reviewed_at": now_utc()}
    elif payload.action == "finalize":
        if user["role"] != "admin":
            raise HTTPException(403, "Only admin finalizes expenses")
        upd = {"review_status": "finalized", "finalized_by": user["id"], "finalized_at": now_utc()}
    elif payload.action == "unreview":
        if user["role"] != "admin":
            raise HTTPException(403, "Only admin can revert review status")
        upd = {"review_status": "unreviewed"}
    else:
        raise HTTPException(400, "Invalid action")
    await db.expenses.update_one({"id": exp_id}, {"$set": upd})
    await audit(user, f"expense.{payload.action}", "expense", exp_id,
                exp["store_id"], exp["business_date"], before=exp)
    return {"ok": True}
