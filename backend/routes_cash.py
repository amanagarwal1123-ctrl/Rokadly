"""Opening allocations, cash counts, discrepancy ledger + later settlements."""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import (db, new_id, now_utc, today_ist, clean, audit, get_current_user,
                  require_store_access, ensure_day_open, ensure_cashier_today,
                  get_store_day, cashier_cash_summary, store_cashiers,
                  day_participant_cashiers)

router = APIRouter()


# ---------------- Store-day status (shared day-lock source) ----------------

@router.get("/store-day")
async def store_day_status(store_id: str, business_date: str,
                           user: dict = Depends(get_current_user)):
    """Lightweight authorized store-day status for the frontend day-lock hook."""
    require_store_access(user, store_id)
    sd = await get_store_day(store_id, business_date)
    return {"store_day": sd}


# ---------------- Opening allocations ----------------

class AllocationIn(BaseModel):
    store_id: str
    business_date: str
    amount_paise: int = Field(ge=0)
    cashier_id: Optional[str] = None  # admin may set for others


@router.put("/allocations")
async def set_allocation(payload: AllocationIn, user: dict = Depends(get_current_user)):
    require_store_access(user, payload.store_id)
    await ensure_day_open(payload.store_id, payload.business_date)
    if user["role"] == "cashier":
        ensure_cashier_today(user, payload.business_date)
        cashier_id = user["id"]
        cashier = user
    elif user["role"] == "admin":
        cashier_id = payload.cashier_id or user["id"]
        cashier = await db.users.find_one({"id": cashier_id}, {"_id": 0, "password_hash": 0}) or user
    else:
        raise HTTPException(403, "Only cashiers and admin can set allocations")
    existing = await db.allocations.find_one(
        {"store_id": payload.store_id, "business_date": payload.business_date,
         "cashier_id": cashier_id}, {"_id": 0})
    entry = {"amount_paise": payload.amount_paise, "set_by": user["id"],
             "set_by_name": user["name"], "at": now_utc()}
    if existing:
        await db.allocations.update_one({"id": existing["id"]}, {
            "$set": {"amount_paise": payload.amount_paise, "updated_at": now_utc()},
            "$push": {"history": entry}})
        await audit(user, "allocation.update", "allocation", existing["id"],
                    payload.store_id, payload.business_date, before=existing,
                    after={**existing, "amount_paise": payload.amount_paise})
    else:
        alloc = {"id": new_id(), "store_id": payload.store_id,
                 "business_date": payload.business_date, "cashier_id": cashier_id,
                 "cashier_name": cashier.get("name"), "amount_paise": payload.amount_paise,
                 "history": [entry], "created_at": now_utc(), "updated_at": now_utc()}
        await db.allocations.insert_one(dict(alloc))
        await audit(user, "allocation.create", "allocation", alloc["id"],
                    payload.store_id, payload.business_date, after=alloc)
    return await allocation_summary(payload.store_id, payload.business_date, user)


@router.get("/allocations/summary")
async def allocation_summary(store_id: str, business_date: str,
                             user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    sd = await get_store_day(store_id, business_date)
    allocations = await db.allocations.find(
        {"store_id": store_id, "business_date": business_date}, {"_id": 0}).to_list(100)
    allocated = sum(a["amount_paise"] for a in allocations)
    opening = sd["opening_paise"]
    adj = sd.get("opening_adjustment") or {}
    effective_opening = opening + (adj.get("amount_paise") or 0)
    cashiers = await store_cashiers(store_id)
    return {
        "store_day": sd, "opening_paise": opening,
        "opening_adjustment": sd.get("opening_adjustment"),
        "effective_opening_paise": effective_opening,
        "allocated_paise": allocated,
        "unallocated_paise": effective_opening - allocated,
        "allocations": allocations,
        "cashiers": [{"id": c["id"], "name": c["name"]} for c in cashiers],
    }


class OpeningAdjIn(BaseModel):
    store_id: str
    business_date: str
    amount_paise: int
    reason: str


@router.post("/allocations/opening-adjustment")
async def opening_adjustment(payload: OpeningAdjIn, user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Only admin can approve opening adjustments")
    if not payload.reason.strip():
        raise HTTPException(400, "Reason is compulsory")
    if payload.amount_paise == 0:
        raise HTTPException(400, "Adjustment cannot be zero")
    sd = await ensure_day_open(payload.store_id, payload.business_date)
    if sd["opening_paise"] + payload.amount_paise < 0:
        raise HTTPException(400, "Adjustment would make the effective opening negative")
    adj = {"amount_paise": payload.amount_paise, "reason": payload.reason.strip(),
           "approved_by": user["id"], "approved_by_name": user["name"], "at": now_utc()}
    await db.store_days.update_one({"id": sd["id"]}, {"$set": {"opening_adjustment": adj}})
    await audit(user, "opening.adjustment", "store_day", sd["id"], payload.store_id,
                payload.business_date, after=adj, reason=payload.reason)
    return {"ok": True, "opening_adjustment": adj}


# ---------------- Cash counts ----------------

class CashCountIn(BaseModel):
    store_id: str
    business_date: str
    counted_paise: int = Field(ge=0)
    note: Optional[str] = None
    cashier_id: Optional[str] = None  # admin only


@router.post("/cash-counts")
async def submit_cash_count(payload: CashCountIn, user: dict = Depends(get_current_user)):
    require_store_access(user, payload.store_id)
    await ensure_day_open(payload.store_id, payload.business_date)
    if user["role"] == "cashier":
        ensure_cashier_today(user, payload.business_date)
        cashier_id = user["id"]
        cashier_name = user["name"]
    elif user["role"] == "admin":
        cashier_id = payload.cashier_id or user["id"]
        c = await db.users.find_one({"id": cashier_id}, {"_id": 0})
        cashier_name = c["name"] if c else user["name"]
    else:
        raise HTTPException(403, "Only cashiers and admin can submit counts")

    summary = await cashier_cash_summary(payload.store_id, payload.business_date, cashier_id)
    expected = summary["expected_cash_paise"]
    variance = payload.counted_paise - expected
    if variance != 0 and not (payload.note and payload.note.strip()):
        raise HTTPException(400, {
            "code": "NOTE_REQUIRED",
            "message": f"Variance of \u20b9{variance / 100:,.2f} detected. A reason/note is compulsory.",
            "expected_paise": expected, "variance_paise": variance})

    existing = await db.cash_counts.find_one(
        {"store_id": payload.store_id, "business_date": payload.business_date,
         "cashier_id": cashier_id}, {"_id": 0})
    doc = {"counted_paise": payload.counted_paise, "expected_paise": expected,
           "variance_paise": variance, "note": (payload.note or None),
           "summary": summary, "submitted_at": now_utc(),
           "submitted_by": user["id"]}
    if existing:
        await db.cash_counts.update_one({"id": existing["id"]},
                                        {"$set": doc, "$push": {"history": clean(existing)}})
        count_id = existing["id"]
    else:
        doc.update({"id": new_id(), "store_id": payload.store_id,
                    "business_date": payload.business_date, "cashier_id": cashier_id,
                    "cashier_name": cashier_name, "history": []})
        await db.cash_counts.insert_one(dict(doc))
        count_id = doc["id"]

    # auto-create / update linked discrepancy for non-zero variance
    disc = await db.discrepancies.find_one(
        {"source_count_id": count_id}, {"_id": 0})
    if variance != 0:
        dtype = "shortage" if variance < 0 else "excess"
        if disc:
            upd = {
                "amount_paise": abs(variance), "type": dtype, "note": payload.note,
                "original": {"expected_paise": expected, "counted_paise": payload.counted_paise,
                             "variance_paise": variance}}
            # a variance re-appearing on resubmission reopens an auto-closed discrepancy
            if disc.get("status") == "closed_unexplained" and not disc.get("settlements"):
                upd["status"] = "open"
            await db.discrepancies.update_one({"id": disc["id"]}, {"$set": upd})
        else:
            d = {"id": new_id(), "store_id": payload.store_id,
                 "business_date": payload.business_date, "type": dtype,
                 "amount_paise": abs(variance), "note": payload.note,
                 "source_count_id": count_id,
                 "allocations": [{"cashier_id": cashier_id, "cashier_name": cashier_name,
                                  "amount_paise": abs(variance)}],
                 "status": "open", "settlements": [], "settled_paise": 0,
                 "original": {"expected_paise": expected, "counted_paise": payload.counted_paise,
                              "variance_paise": variance},
                 "created_at": now_utc()}
            await db.discrepancies.insert_one(dict(d))
            await audit(user, "discrepancy.create", "discrepancy", d["id"],
                        payload.store_id, payload.business_date, after=d)
    elif disc and disc["status"] == "open" and not disc.get("settlements"):
        await db.discrepancies.update_one({"id": disc["id"]},
                                          {"$set": {"status": "closed_unexplained", "amount_paise": 0}})

    await audit(user, "cash_count.submit", "cash_count", count_id,
                payload.store_id, payload.business_date,
                after={"counted_paise": payload.counted_paise, "expected_paise": expected,
                       "variance_paise": variance, "note": payload.note})
    return {"expected_paise": expected, "counted_paise": payload.counted_paise,
            "variance_paise": variance, "summary": summary}


@router.get("/cash-counts/expected")
async def get_expected(store_id: str, business_date: str, cashier_id: Optional[str] = None,
                       user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    cid = user["id"] if user["role"] == "cashier" else (cashier_id or user["id"])
    summary = await cashier_cash_summary(store_id, business_date, cid)
    count = await db.cash_counts.find_one(
        {"store_id": store_id, "business_date": business_date, "cashier_id": cid}, {"_id": 0})
    return {"summary": summary, "count": count}


@router.get("/cash-counts")
async def list_counts(store_id: str, business_date: str,
                      user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    counts = await db.cash_counts.find(
        {"store_id": store_id, "business_date": business_date}, {"_id": 0}).to_list(100)
    participants = await day_participant_cashiers(store_id, business_date)
    submitted = {c["cashier_id"] for c in counts}
    missing = []
    for cid in participants:
        if cid not in submitted:
            u = await db.users.find_one({"id": cid}, {"_id": 0, "name": 1})
            missing.append({"cashier_id": cid, "name": (u or {}).get("name", "?")})
    return {"counts": counts, "missing": missing}


# ---------------- Discrepancy ledger ----------------

class DiscAllocIn(BaseModel):
    allocations: List[Dict[str, Any]]  # [{cashier_id, amount_paise}] or [{cashier_id, percent}]
    equal_split: Optional[List[str]] = None  # cashier ids -> equal split
    note: Optional[str] = None


@router.get("/discrepancies")
async def list_discrepancies(store_id: Optional[str] = None, status: Optional[str] = None,
                             business_date: Optional[str] = None,
                             user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if user["role"] == "cashier":
        q["$or"] = [{"allocations.cashier_id": user["id"]}, {"store_id": user["store_id"]}]
    elif user["role"] in ("accountant", "manager"):
        q["store_id"] = {"$in": user.get("store_ids") or []}
    if store_id:
        if user["role"] != "cashier":
            require_store_access(user, store_id)
        q["store_id"] = store_id
    if status:
        q["status"] = status
    if business_date:
        q["business_date"] = business_date
    items = await db.discrepancies.find(q, {"_id": 0}).sort("business_date", -1).to_list(500)
    today = today_ist()
    for d in items:
        try:
            from datetime import date as _date
            y1, m1, d1 = map(int, d["business_date"].split("-"))
            y2, m2, d2 = map(int, today.split("-"))
            d["age_days"] = (_date(y2, m2, d2) - _date(y1, m1, d1)).days
        except Exception:
            d["age_days"] = None
    return {"discrepancies": items}


@router.patch("/discrepancies/{disc_id}/allocate")
async def allocate_discrepancy(disc_id: str, payload: DiscAllocIn,
                               user: dict = Depends(get_current_user)):
    if user["role"] not in ("admin", "manager", "accountant"):
        raise HTTPException(403, "Not permitted")
    disc = await db.discrepancies.find_one({"id": disc_id}, {"_id": 0})
    if not disc:
        raise HTTPException(404, "Not found")
    require_store_access(user, disc["store_id"])
    total = disc["amount_paise"]
    allocations = []
    if payload.equal_split:
        n = len(payload.equal_split)
        base = total // n
        rem = total - base * n
        for i, cid in enumerate(payload.equal_split):
            u = await db.users.find_one({"id": cid}, {"_id": 0, "name": 1})
            allocations.append({"cashier_id": cid, "cashier_name": (u or {}).get("name", "?"),
                                "amount_paise": base + (1 if i < rem else 0)})
    else:
        has_pct = any("percent" in a for a in payload.allocations)
        for a in payload.allocations:
            cid = a.get("cashier_id")
            u = await db.users.find_one({"id": cid}, {"_id": 0, "name": 1})
            amt = round(total * float(a["percent"]) / 100.0) if has_pct else int(a["amount_paise"])
            allocations.append({"cashier_id": cid, "cashier_name": (u or {}).get("name", "?"),
                                "amount_paise": amt})
        if allocations and sum(x["amount_paise"] for x in allocations) != total:
            raise HTTPException(400, f"Allocations must sum to {total} paise (got {sum(x['amount_paise'] for x in allocations)})")
    await db.discrepancies.update_one({"id": disc_id}, {"$set": {
        "allocations": allocations,
        "allocation_note": payload.note,
        "allocated_by": user["id"], "allocated_at": now_utc()}})
    await audit(user, "discrepancy.allocate", "discrepancy", disc_id, disc["store_id"],
                disc["business_date"], before=disc, after={"allocations": allocations})
    return {"allocations": allocations}


class SettlementIn(BaseModel):
    amount_paise: int = Field(gt=0)
    mode: str  # cash | bank
    bank_id: Optional[str] = None
    note: Optional[str] = None
    related_bill_no: Optional[str] = None


@router.post("/discrepancies/{disc_id}/settle")
async def settle_discrepancy(disc_id: str, payload: SettlementIn,
                             user: dict = Depends(get_current_user)):
    """Later-date settlement: physical money moves TODAY, linked back to old discrepancy."""
    if user["role"] not in ("admin", "manager", "accountant", "cashier"):
        raise HTTPException(403, "Not permitted")
    disc = await db.discrepancies.find_one({"id": disc_id}, {"_id": 0})
    if not disc:
        raise HTTPException(404, "Not found")
    require_store_access(user, disc["store_id"])
    settle_date = today_ist()
    await ensure_day_open(disc["store_id"], settle_date)

    # money direction: shortage settled -> money comes IN (receipt); excess repaid -> OUT (deduction)
    kind = "receipt" if disc["type"] == "shortage" else "deduction"
    adj = {
        "id": new_id(), "store_id": disc["store_id"], "business_date": settle_date,
        "cashier_id": user["id"], "cashier_name": user["name"],
        "kind": kind,
        "description": f"Settlement of {disc['type']} dated {disc['business_date']}" + (f" - {payload.note}" if payload.note else ""),
        "amount_paise": payload.amount_paise, "payment_type": payload.mode,
        "head_id": None, "head_name": "Discrepancy Settlement",
        "related_bill_no": payload.related_bill_no,
        "linked_discrepancy_id": disc_id,
        "recon_status": "unreviewed" if payload.mode != "cash" else None,
        "status": "active", "version": 1, "created_at": now_utc(),
    }
    if payload.mode == "bank":
        if not payload.bank_id:
            raise HTTPException(400, "Bank settlement requires a bank")
        bank = await db.banks.find_one({"id": payload.bank_id, "active": True}, {"_id": 0})
        if not bank:
            raise HTTPException(400, "Unknown bank")
        adj["bank_id"] = bank["id"]
        adj["bank_name"] = bank["name"]
    elif payload.mode != "cash":
        raise HTTPException(400, "Settlement mode must be cash or bank")
    await db.adjustments.insert_one(dict(adj))

    settled = disc.get("settled_paise", 0) + payload.amount_paise
    status = "adjusted" if settled >= disc["amount_paise"] else "partially_adjusted"
    settlement = {"date": settle_date, "amount_paise": payload.amount_paise,
                  "mode": payload.mode, "bank_id": adj.get("bank_id"),
                  "bank_name": adj.get("bank_name"), "adjustment_id": adj["id"],
                  "note": payload.note, "by": user["id"], "by_name": user["name"],
                  "related_bill_no": payload.related_bill_no, "at": now_utc()}
    await db.discrepancies.update_one({"id": disc_id}, {
        "$push": {"settlements": settlement},
        "$set": {"settled_paise": settled, "status": status}})

    # annotate original bill if referenced
    if payload.related_bill_no:
        await db.bills.update_many(
            {"store_id": disc["store_id"], "bill_no_norm": payload.related_bill_no.strip().upper().replace(" ", "")},
            {"$push": {"annotations": {
                "type": "discrepancy_settlement", "discrepancy_id": disc_id,
                "date": settle_date, "amount_paise": payload.amount_paise,
                "note": payload.note, "at": now_utc()}}})
    await audit(user, "discrepancy.settle", "discrepancy", disc_id, disc["store_id"],
                disc["business_date"], after=settlement, reason=payload.note)
    return {"settlement": settlement, "status": status, "adjustment_id": adj["id"]}


class DiscStatusIn(BaseModel):
    status: str
    note: Optional[str] = None


@router.patch("/discrepancies/{disc_id}/status")
async def set_discrepancy_status(disc_id: str, payload: DiscStatusIn,
                                 user: dict = Depends(get_current_user)):
    if user["role"] not in ("admin", "manager"):
        raise HTTPException(403, "Not permitted")
    if payload.status not in ("open", "partially_adjusted", "adjusted", "closed_unexplained"):
        raise HTTPException(400, "Invalid status")
    disc = await db.discrepancies.find_one({"id": disc_id}, {"_id": 0})
    if not disc:
        raise HTTPException(404, "Not found")
    require_store_access(user, disc["store_id"])
    await db.discrepancies.update_one({"id": disc_id}, {"$set": {
        "status": payload.status, "status_note": payload.note}})
    await audit(user, "discrepancy.status", "discrepancy", disc_id, disc["store_id"],
                disc["business_date"], before=disc,
                after={"status": payload.status}, reason=payload.note)
    return {"ok": True}
