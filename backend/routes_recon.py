"""Reconciliation (numbered non-cash), account tallies, cheque ledger, finalize/reopen."""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import (db, new_id, now_utc, today_ist, clean, audit, get_current_user,
                  require_store_access, ensure_day_open, get_store_day, manager_perm,
                  build_noncash_items, day_participant_cashiers, cashier_cash_summary)

router = APIRouter()

RECON_STATUSES = {"unreviewed", "matched", "pending", "cleared", "exception_approved", "finally_tallied"}


def _can_view_recon(user, store_id):
    if user["role"] in ("admin", "accountant"):
        return True
    if user["role"] == "manager":
        return manager_perm(user, store_id, "view_recon") or manager_perm(user, store_id, "reconcile")
    return False


@router.get("/recon/items")
async def recon_items(store_id: str, business_date: str,
                      user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    if not _can_view_recon(user, store_id):
        raise HTTPException(403, "No reconciliation access")
    items = await build_noncash_items(store_id, business_date)
    tallies = {t["group_key"]: t for t in await db.account_tallies.find(
        {"store_id": store_id, "business_date": business_date}, {"_id": 0}).to_list(100)}
    groups = []
    seen = {}
    for it in items:
        gk = it["group_key"]
        if gk not in seen:
            seen[gk] = {"group_key": gk, "group_label": it["group_label"], "items": [],
                        "total_paise": 0, "tallied": bool(tallies.get(gk, {}).get("tallied")),
                        "tallied_by_name": tallies.get(gk, {}).get("tallied_by_name"),
                        "serial_from": it["serial"], "serial_to": it["serial"]}
            groups.append(seen[gk])
        g = seen[gk]
        g["items"].append(it)
        g["total_paise"] += it["amount_paise"]
        g["serial_to"] = it["serial"]
    status_counts: Dict[str, int] = {}
    for it in items:
        status_counts[it["recon_status"]] = status_counts.get(it["recon_status"], 0) + 1
    return {"groups": groups, "total_items": len(items),
            "total_paise": sum(i["amount_paise"] for i in items),
            "status_counts": status_counts,
            "pending_count": status_counts.get("pending", 0) + status_counts.get("unreviewed", 0)}


class ReconMarkIn(BaseModel):
    source: str  # bill | adjustment
    ref_id: str
    payment_index: Optional[int] = None
    status: str
    note: Optional[str] = None


@router.patch("/recon/item")
async def mark_recon(payload: ReconMarkIn, user: dict = Depends(get_current_user)):
    if payload.status not in RECON_STATUSES:
        raise HTTPException(400, "Invalid status")
    if payload.source == "bill":
        doc = await db.bills.find_one({"id": payload.ref_id}, {"_id": 0})
    else:
        doc = await db.adjustments.find_one({"id": payload.ref_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Entry not found")
    store_id, business_date = doc["store_id"], doc["business_date"]
    require_store_access(user, store_id)

    # permission matrix
    allowed = False
    if user["role"] == "admin":
        allowed = True
    elif user["role"] == "accountant":
        allowed = payload.status in ("unreviewed", "matched", "pending", "cleared")
    elif user["role"] == "manager":
        if payload.status in ("matched", "pending", "unreviewed"):
            allowed = manager_perm(user, store_id, "reconcile") or manager_perm(user, store_id, "mark_status")
        elif payload.status == "cleared":
            allowed = manager_perm(user, store_id, "clear_matched")
        elif payload.status == "finally_tallied":
            allowed = manager_perm(user, store_id, "final_tally")
    if payload.status == "exception_approved" and user["role"] != "admin":
        allowed = False
    if not allowed:
        raise HTTPException(403, "You do not have permission to set this reconciliation status")

    sd = await get_store_day(store_id, business_date)
    if sd["status"] == "finalized":
        raise HTTPException(423, "Day finalized - reopen required")

    upd = {"recon_status": payload.status, "recon_note": payload.note,
           "recon_by": user["id"], "recon_by_name": user["name"], "recon_at": now_utc()}
    if payload.source == "bill":
        if payload.payment_index is None:
            raise HTTPException(400, "payment_index required for bill rows")
        sets = {f"payments.{payload.payment_index}.{k}": v for k, v in upd.items()}
        await db.bills.update_one({"id": payload.ref_id}, {"$set": sets})
    else:
        await db.adjustments.update_one({"id": payload.ref_id}, {"$set": upd})
    await audit(user, "recon.mark", payload.source, payload.ref_id, store_id, business_date,
                after={"status": payload.status, "payment_index": payload.payment_index},
                reason=payload.note)
    return {"ok": True}


class TallyIn(BaseModel):
    store_id: str
    business_date: str
    group_key: str
    tallied: bool


@router.post("/recon/tally")
async def set_tally(payload: TallyIn, user: dict = Depends(get_current_user)):
    require_store_access(user, payload.store_id)
    if not (user["role"] == "admin" or manager_perm(user, payload.store_id, "final_tally")):
        raise HTTPException(403, "Final physical-statement tally requires admin or a permitted manager")
    sd = await get_store_day(payload.store_id, payload.business_date)
    if sd["status"] == "finalized":
        raise HTTPException(423, "Day finalized")
    await db.account_tallies.update_one(
        {"store_id": payload.store_id, "business_date": payload.business_date,
         "group_key": payload.group_key},
        {"$set": {"tallied": payload.tallied, "tallied_by": user["id"],
                  "tallied_by_name": user["name"], "tallied_at": now_utc()},
         "$setOnInsert": {"id": new_id()}},
        upsert=True)
    await audit(user, "recon.tally", "account_tally", payload.group_key,
                payload.store_id, payload.business_date,
                after={"group_key": payload.group_key, "tallied": payload.tallied})
    return {"ok": True}


# ---------------- Cheque ledger ----------------

@router.get("/cheques")
async def list_cheques(status: Optional[str] = None, store_id: Optional[str] = None,
                       date_from: Optional[str] = None, date_to: Optional[str] = None,
                       search: Optional[str] = None,
                       user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {"active": True}
    if user["role"] == "cashier":
        q["store_id"] = user["store_id"]
    elif user["role"] in ("accountant", "manager"):
        q["store_id"] = {"$in": user.get("store_ids") or []}
    if store_id:
        require_store_access(user, store_id)
        q["store_id"] = store_id
    if status and status != "all":
        q["status"] = status
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to
        q["business_date"] = rng
    if search:
        q["$or"] = [{"cheque_no": {"$regex": search, "$options": "i"}},
                    {"name_on_cheque": {"$regex": search, "$options": "i"}},
                    {"bill_no": {"$regex": search, "$options": "i"}}]
    cheques = await db.cheques.find(q, {"_id": 0}).sort("business_date", -1).to_list(1000)
    today = today_ist()
    from datetime import date as _date
    for c in cheques:
        try:
            y1, m1, d1 = map(int, c["received_date"].split("-"))
            y2, m2, d2 = map(int, today.split("-"))
            c["age_days"] = (_date(y2, m2, d2) - _date(y1, m1, d1)).days
        except Exception:
            c["age_days"] = None
    return {"cheques": cheques}


class ChequeStatusIn(BaseModel):
    status: str  # pending | passed | bounced | paid_returned
    status_date: Optional[str] = None
    remark: Optional[str] = None


@router.patch("/cheques/{cheque_id}/status")
async def set_cheque_status(cheque_id: str, payload: ChequeStatusIn,
                            user: dict = Depends(get_current_user)):
    ch = await db.cheques.find_one({"id": cheque_id}, {"_id": 0})
    if not ch:
        raise HTTPException(404, "Cheque not found")
    require_store_access(user, ch["store_id"])
    if not (user["role"] == "admin" or manager_perm(user, ch["store_id"], "manage_cheques")):
        raise HTTPException(403, "Cheque status management requires admin or a permitted manager")
    if payload.status not in ("pending", "passed", "bounced", "paid_returned"):
        raise HTTPException(400, "Invalid cheque status")
    if payload.status in ("passed", "bounced", "paid_returned") and not payload.status_date:
        raise HTTPException(400, "Status date is required")
    if payload.status == "paid_returned" and not (payload.remark and payload.remark.strip()):
        raise HTTPException(400, "A remark is compulsory for Paid/Returned (explain how payment was handled)")
    hist = {"from": ch["status"], "to": payload.status, "date": payload.status_date,
            "remark": payload.remark, "by": user["id"], "by_name": user["name"], "at": now_utc()}
    await db.cheques.update_one({"id": cheque_id}, {
        "$set": {"status": payload.status, "status_date": payload.status_date,
                 "status_remark": payload.remark},
        "$push": {"history": hist}})
    await audit(user, "cheque.status", "cheque", cheque_id, ch["store_id"],
                ch["business_date"], before=ch, after=hist, reason=payload.remark)
    return {"ok": True}


# ---------------- Finalization ----------------

async def compute_readiness(store_id: str, business_date: str) -> dict:
    sd = await get_store_day(store_id, business_date)
    checks = []

    # 1. opening allocation
    allocations = await db.allocations.find(
        {"store_id": store_id, "business_date": business_date}, {"_id": 0}).to_list(100)
    allocated = sum(a["amount_paise"] for a in allocations)
    adj = sd.get("opening_adjustment") or {}
    effective_opening = sd["opening_paise"] + (adj.get("amount_paise") or 0)
    checks.append({
        "key": "opening_allocated", "label": "Opening cash fully allocated",
        "pass": allocated == effective_opening,
        "detail": f"Allocated \u20b9{allocated / 100:,.0f} of \u20b9{effective_opening / 100:,.0f}" +
                  (" (incl. approved adjustment)" if adj else "")})

    # 2. cash counts
    counts = await db.cash_counts.find(
        {"store_id": store_id, "business_date": business_date}, {"_id": 0}).to_list(100)
    participants = await day_participant_cashiers(store_id, business_date)
    submitted = {c["cashier_id"] for c in counts}
    missing = [p for p in participants if p not in submitted]
    missing_names = []
    for cid in missing:
        u = await db.users.find_one({"id": cid}, {"_id": 0, "name": 1})
        missing_names.append((u or {}).get("name", cid))
    checks.append({
        "key": "counts_submitted", "label": "Every cashier submitted actual cash count",
        "pass": len(missing) == 0,
        "detail": "All submitted" if not missing else f"Missing: {', '.join(missing_names)}"})

    # 3. discrepancies noted
    bad_disc = 0
    async for d in db.discrepancies.find({"store_id": store_id, "business_date": business_date,
                                          "amount_paise": {"$gt": 0}}, {"_id": 0}):
        if not (d.get("note") or d.get("allocation_note") or d.get("status_note")):
            bad_disc += 1
    checks.append({
        "key": "discrepancies_noted", "label": "Every non-zero discrepancy has a note",
        "pass": bad_disc == 0,
        "detail": "OK" if bad_disc == 0 else f"{bad_disc} discrepancy(ies) missing notes"})

    # 4. expenses finalized
    open_exp = await db.expenses.count_documents(
        {"store_id": store_id, "business_date": business_date, "status": "active",
         "review_status": {"$ne": "finalized"}})
    checks.append({
        "key": "expenses_finalized", "label": "Expenses reviewed and finalized by admin",
        "pass": open_exp == 0,
        "detail": "All finalized" if open_exp == 0 else f"{open_exp} expense(s) not finalized"})

    # 5. reconciliation complete
    items = await build_noncash_items(store_id, business_date)
    blocking = [i for i in items if i["recon_status"] in ("unreviewed", "pending")]
    pending_serials = [i["serial"] for i in blocking]
    checks.append({
        "key": "recon_complete", "label": "All non-cash entries reconciled (no Pending/Unreviewed)",
        "pass": len(blocking) == 0,
        "detail": "Complete" if not blocking else f"Serials blocking: {pending_serials}"})

    # 6. accounts tallied
    group_keys = []
    group_labels = {}
    for i in items:
        if i["group_key"] not in group_keys:
            group_keys.append(i["group_key"])
            group_labels[i["group_key"]] = i["group_label"]
    tallies = {t["group_key"]: t for t in await db.account_tallies.find(
        {"store_id": store_id, "business_date": business_date}, {"_id": 0}).to_list(100)}
    untallied = [group_labels.get(gk, gk) for gk in group_keys if not tallies.get(gk, {}).get("tallied")]
    checks.append({
        "key": "accounts_tallied", "label": "Every account's physical-statement checklist tallied",
        "pass": len(untallied) == 0,
        "detail": "All tallied" if not untallied else f"Untallied: {', '.join(untallied)}"})

    return {"store_day": sd, "checks": checks,
            "ready": all(c["pass"] for c in checks),
            "counts": counts, "allocated_paise": allocated,
            "effective_opening_paise": effective_opening}


@router.get("/finalize/readiness")
async def readiness(store_id: str, business_date: str,
                    user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    return await compute_readiness(store_id, business_date)


class FinalizeIn(BaseModel):
    store_id: str
    business_date: str
    note: Optional[str] = None


async def _can_finalize(user: dict, store_id: str) -> bool:
    if user["role"] == "admin":
        return True
    if user["role"] != "manager" or not manager_perm(user, store_id, "finalize_rokad"):
        return False
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    if store and store.get("type") == "main":
        settings = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
        return bool(settings.get("allow_manager_finalize_main"))
    return True


@router.post("/finalize")
async def finalize_day(payload: FinalizeIn, user: dict = Depends(get_current_user)):
    require_store_access(user, payload.store_id)
    if not await _can_finalize(user, payload.store_id):
        raise HTTPException(403, "You are not permitted to finalize this store's Rokad")
    r = await compute_readiness(payload.store_id, payload.business_date)
    if r["store_day"]["status"] == "finalized":
        raise HTTPException(400, "Already finalized")
    if not r["ready"]:
        failed = [c["label"] for c in r["checks"] if not c["pass"]]
        raise HTTPException(400, {"code": "NOT_READY",
                                  "message": "Finalization blocked", "failed": failed})
    closing = sum(c["counted_paise"] for c in r["counts"])
    await db.store_days.update_one({"id": r["store_day"]["id"]}, {"$set": {
        "status": "finalized", "finalized_by": user["id"], "finalized_by_name": user["name"],
        "finalized_at": now_utc(), "finalize_note": payload.note,
        "closing_actual_paise": closing, "needs_revalidation": False}})
    # mark all recon items finally tallied
    items = await build_noncash_items(payload.store_id, payload.business_date)
    for it in items:
        if it["source"] == "bill":
            await db.bills.update_one({"id": it["ref_id"]}, {"$set": {
                f"payments.{it['payment_index']}.recon_status": "finally_tallied"}})
        else:
            await db.adjustments.update_one({"id": it["ref_id"]},
                                            {"$set": {"recon_status": "finally_tallied"}})
    await audit(user, "day.finalize", "store_day", r["store_day"]["id"],
                payload.store_id, payload.business_date,
                after={"closing_actual_paise": closing}, reason=payload.note)
    return {"ok": True, "closing_actual_paise": closing}


class ReopenIn(BaseModel):
    store_id: str
    business_date: str
    reason: str


@router.post("/finalize/reopen")
async def reopen_day(payload: ReopenIn, user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Only admin can reopen a finalized day")
    if not payload.reason.strip():
        raise HTTPException(400, "A reason is compulsory to reopen")
    sd = await get_store_day(payload.store_id, payload.business_date, create=False)
    if not sd or sd["status"] != "finalized":
        raise HTTPException(400, "Day is not finalized")
    await db.store_days.update_one({"id": sd["id"]}, {
        "$set": {"status": "open"},
        "$push": {"reopen_history": {"by": user["id"], "by_name": user["name"],
                                     "reason": payload.reason.strip(), "at": now_utc(),
                                     "previous_closing_paise": sd.get("closing_actual_paise")}}})
    # flag later days for revalidation
    await db.store_days.update_many(
        {"store_id": payload.store_id, "business_date": {"$gt": payload.business_date}},
        {"$set": {"needs_revalidation": True}})
    await audit(user, "day.reopen", "store_day", sd["id"], payload.store_id,
                payload.business_date, before=sd, reason=payload.reason)
    return {"ok": True}
