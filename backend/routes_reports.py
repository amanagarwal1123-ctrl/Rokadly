"""Reports: today summary, store-day, register, comparison, cross-store, expenses, print data."""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException

from core import (db, today_ist, get_current_user, require_store_access, get_store_day,
                  cashier_cash_summary, day_participant_cashiers, build_noncash_items,
                  manager_perm)

router = APIRouter()


async def store_day_aggregate(store_id: str, business_date: str) -> dict:
    """Full store-level aggregate for one store+date. All paise."""
    sd = await get_store_day(store_id, business_date)
    adj = sd.get("opening_adjustment") or {}
    opening = sd["opening_paise"] + (adj.get("amount_paise") or 0)

    bill_total = cash_receipts = noncash = less_taken = cash_refunds = bank_refunds = 0
    card_total = cheque_total = bank_total = other_total = 0
    bill_count = 0
    async for b in db.bills.find({"store_id": store_id, "business_date": business_date,
                                  "status": "active"}, {"_id": 0}):
        bill_count += 1
        bill_total += b["amount_paise"]
        less_taken += b.get("less_taken_paise", 0)
        for p in b.get("payments", []):
            t = p["type"]
            if t == "cash":
                cash_receipts += p["amount_paise"]
            else:
                noncash += p["amount_paise"]
                if t == "card":
                    card_total += p["amount_paise"]
                elif t == "cheque":
                    cheque_total += p["amount_paise"]
                elif t == "bank":
                    bank_total += p["amount_paise"]
                else:
                    other_total += p["amount_paise"]
        ex = b.get("excess")
        if ex:
            if ex.get("return_mode") == "cash":
                cash_refunds += ex["amount_paise"]
            else:
                bank_refunds += ex["amount_paise"]

    adj_cash_in = adj_cash_out = adj_noncash_in = 0
    async for a in db.adjustments.find({"store_id": store_id, "business_date": business_date,
                                        "status": "active"}, {"_id": 0}):
        if a["payment_type"] == "cash":
            if a["kind"] == "receipt":
                adj_cash_in += a["amount_paise"]
            else:
                adj_cash_out += a["amount_paise"]
        elif a["kind"] == "receipt":
            adj_noncash_in += a["amount_paise"]

    cash_expenses = bank_expenses = 0
    async for e in db.expenses.find({"store_id": store_id, "business_date": business_date,
                                     "status": "active"}, {"_id": 0}):
        if e["payment_type"] == "cash":
            cash_expenses += e["amount_paise"]
        else:
            bank_expenses += e["amount_paise"]

    expected = (opening + cash_receipts - cash_refunds + adj_cash_in
                - adj_cash_out - cash_expenses)

    counts = await db.cash_counts.find(
        {"store_id": store_id, "business_date": business_date}, {"_id": 0}).to_list(100)
    actual = sum(c["counted_paise"] for c in counts) if counts else None
    variance = (actual - expected) if actual is not None else None

    unresolved = 0
    async for d in db.discrepancies.find({"store_id": store_id, "business_date": business_date,
                                          "status": {"$in": ["open", "partially_adjusted"]}}, {"_id": 0}):
        unresolved += max(0, d["amount_paise"] - d.get("settled_paise", 0))

    items = await build_noncash_items(store_id, business_date)
    pending_count = sum(1 for i in items if i["recon_status"] in ("pending",))
    unreviewed_count = sum(1 for i in items if i["recon_status"] == "unreviewed")

    return {
        "store_id": store_id, "business_date": business_date, "store_day": sd,
        "opening_paise": opening, "bill_count": bill_count, "bill_total_paise": bill_total,
        "cash_receipts_paise": cash_receipts, "noncash_receipts_paise": noncash,
        "card_paise": card_total, "cheque_paise": cheque_total,
        "bank_paise": bank_total, "other_paise": other_total,
        "less_taken_paise": less_taken, "cash_refunds_paise": cash_refunds + adj_cash_out,
        "bank_refunds_paise": bank_refunds,
        "adj_cash_receipts_paise": adj_cash_in, "adj_noncash_receipts_paise": adj_noncash_in,
        "cash_expenses_paise": cash_expenses, "bank_expenses_paise": bank_expenses,
        "expected_cash_paise": expected, "actual_cash_paise": actual,
        "variance_paise": variance, "unresolved_discrepancy_paise": unresolved,
        "pending_count": pending_count, "unreviewed_count": unreviewed_count,
        "status": sd["status"], "finalized_by_name": sd.get("finalized_by_name"),
        "finalized_at": sd.get("finalized_at"), "needs_revalidation": sd.get("needs_revalidation"),
    }


@router.get("/reports/today")
async def today_report(store_id: Optional[str] = None, business_date: Optional[str] = None,
                       user: dict = Depends(get_current_user)):
    """Cashier's own daily summary."""
    sid = store_id or user.get("store_id")
    if not sid:
        raise HTTPException(400, "store_id required")
    require_store_access(user, sid)
    bd = business_date or today_ist()
    summary = await cashier_cash_summary(sid, bd, user["id"])
    count = await db.cash_counts.find_one(
        {"store_id": sid, "business_date": bd, "cashier_id": user["id"]}, {"_id": 0})
    expenses = 0
    async for e in db.expenses.find({"store_id": sid, "business_date": bd,
                                     "cashier_id": user["id"], "status": "active"}, {"_id": 0}):
        expenses += e["amount_paise"]
    sd = await get_store_day(sid, bd)
    return {"summary": summary, "count": count, "total_expenses_paise": expenses,
            "store_day": sd}


@router.get("/reports/store-day")
async def store_day_report(store_id: str, business_date: str,
                           user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    agg = await store_day_aggregate(store_id, business_date)
    cashier_rows = []
    for cid in await day_participant_cashiers(store_id, business_date):
        s = await cashier_cash_summary(store_id, business_date, cid)
        u = await db.users.find_one({"id": cid}, {"_id": 0, "name": 1})
        count = await db.cash_counts.find_one(
            {"store_id": store_id, "business_date": business_date, "cashier_id": cid}, {"_id": 0})
        s["cashier_name"] = (u or {}).get("name", "?")
        s["counted_paise"] = count["counted_paise"] if count else None
        s["variance_paise"] = (count["counted_paise"] - s["expected_cash_paise"]) if count else None
        s["count_note"] = count.get("note") if count else None
        cashier_rows.append(s)
    discrepancies = await db.discrepancies.find(
        {"store_id": store_id, "business_date": business_date}, {"_id": 0}).to_list(100)
    return {"aggregate": agg, "cashiers": cashier_rows, "discrepancies": discrepancies}


@router.get("/reports/register")
async def register(date_from: str, date_to: str, store_id: Optional[str] = None,
                   user: dict = Depends(get_current_user)):
    if user["role"] == "cashier":
        store_ids = [user["store_id"]]
    elif user["role"] in ("accountant", "manager"):
        store_ids = user.get("store_ids") or []
    else:
        store_ids = [s["id"] for s in await db.stores.find({}, {"_id": 0}).to_list(50)]
    if store_id:
        require_store_access(user, store_id)
        store_ids = [store_id]
    stores = {s["id"]: s for s in await db.stores.find({}, {"_id": 0}).to_list(50)}
    # dates that actually have data (store_days) in range
    rows = []
    async for sd in db.store_days.find(
            {"store_id": {"$in": store_ids},
             "business_date": {"$gte": date_from, "$lte": date_to}},
            {"_id": 0}).sort([("business_date", -1)]):
        agg = await store_day_aggregate(sd["store_id"], sd["business_date"])
        agg["store_name"] = stores.get(sd["store_id"], {}).get("name", "?")
        agg["store_type"] = stores.get(sd["store_id"], {}).get("type")
        agg.pop("store_day", None)
        rows.append(agg)
    return {"rows": rows}


@router.get("/reports/comparison")
async def comparison(business_date: str, user: dict = Depends(get_current_user)):
    if user["role"] == "admin":
        stores = await db.stores.find({"active": True}, {"_id": 0}).to_list(50)
    elif user["role"] in ("manager", "accountant"):
        stores = await db.stores.find({"id": {"$in": user.get("store_ids") or []}}, {"_id": 0}).to_list(50)
    else:
        stores = await db.stores.find({"id": user.get("store_id")}, {"_id": 0}).to_list(1)
    rows = []
    for s in sorted(stores, key=lambda x: (x["type"] != "main", x["name"])):
        agg = await store_day_aggregate(s["id"], business_date)
        agg["store_name"] = s["name"]
        agg["store_type"] = s["type"]
        agg.pop("store_day", None)
        rows.append(agg)
    return {"rows": rows}


@router.get("/reports/cross-store")
async def cross_store(date_from: str, date_to: str,
                      user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    banks = {b["id"]: b for b in await db.banks.find({}, {"_id": 0}).to_list(200)}
    stores = {s["id"]: s for s in await db.stores.find({}, {"_id": 0}).to_list(50)}
    groups: Dict[str, dict] = {}

    def add_item(bank_id, item):
        b = banks.get(bank_id) or {}
        g = groups.setdefault(bank_id, {
            "bank_id": bank_id, "bank_name": b.get("name", "?"),
            "home_store_id": b.get("home_store_id"),
            "home_store_name": stores.get(b.get("home_store_id"), {}).get("name"),
            "items": [], "total_paise": 0, "cross_store_count": 0})
        g["items"].append(item)
        g["total_paise"] += item["amount_paise"]
        if item["selling_store_id"] != g["home_store_id"] and g["home_store_id"]:
            g["cross_store_count"] += 1
            item["cross_store"] = True

    async for b in db.bills.find({"business_date": {"$gte": date_from, "$lte": date_to},
                                  "status": "active"}, {"_id": 0}):
        for idx, p in enumerate(b.get("payments", [])):
            if p["type"] == "bank" and p.get("bank_id"):
                add_item(p["bank_id"], {
                    "business_date": b["business_date"], "bill_no": b["bill_no"],
                    "amount_paise": p["amount_paise"],
                    "selling_store_id": b["store_id"],
                    "selling_store_name": stores.get(b["store_id"], {}).get("name"),
                    "cashier_name": b.get("cashier_name"),
                    "customer_name": b.get("customer_name"),
                    "recon_status": p.get("recon_status"), "cross_store": False,
                    "source": "bill"})
    async for a in db.adjustments.find({"business_date": {"$gte": date_from, "$lte": date_to},
                                        "status": "active", "payment_type": "bank",
                                        "kind": "receipt"}, {"_id": 0}):
        if a.get("bank_id"):
            add_item(a["bank_id"], {
                "business_date": a["business_date"], "bill_no": a.get("related_bill_no"),
                "amount_paise": a["amount_paise"],
                "selling_store_id": a["store_id"],
                "selling_store_name": stores.get(a["store_id"], {}).get("name"),
                "cashier_name": a.get("cashier_name"),
                "customer_name": a.get("description"),
                "recon_status": a.get("recon_status"), "cross_store": False,
                "source": "adjustment"})
    out = sorted(groups.values(), key=lambda g: (banks.get(g["bank_id"], {}).get("display_order", 999)))
    return {"groups": out}


@router.get("/reports/expenses")
async def expense_report(date_from: str, date_to: str, store_id: Optional[str] = None,
                         user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {"business_date": {"$gte": date_from, "$lte": date_to},
                         "status": "active"}
    if user["role"] == "cashier":
        q["store_id"] = user["store_id"]
        q["cashier_id"] = user["id"]
    elif user["role"] in ("accountant", "manager"):
        q["store_id"] = {"$in": user.get("store_ids") or []}
    if store_id:
        require_store_access(user, store_id)
        q["store_id"] = store_id
    expenses = await db.expenses.find(q, {"_id": 0}).sort("business_date", -1).to_list(2000)
    sections = {"business_payments": [], "with_voucher": [], "without_voucher": []}
    for e in expenses:
        if e["nature"] == "business_payment":
            sections["business_payments"].append(e)
        elif e["voucher_status"] == "with_voucher":
            sections["with_voucher"].append(e)
        else:
            sections["without_voucher"].append(e)
    totals = {k: sum(e["amount_paise"] for e in v) for k, v in sections.items()}
    return {"sections": sections, "totals": totals}


# ---------------- Print data ----------------

@router.get("/print/noncash")
async def print_noncash(store_id: str, business_date: str,
                        user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    items = await build_noncash_items(store_id, business_date)
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    groups = []
    seen = {}
    for it in items:
        gk = it["group_key"]
        if gk not in seen:
            seen[gk] = {"group_key": gk, "group_label": it["group_label"],
                        "items": [], "total_paise": 0}
            groups.append(seen[gk])
        seen[gk]["items"].append(it)
        seen[gk]["total_paise"] += it["amount_paise"]
    return {"store": store, "business_date": business_date, "groups": groups,
            "total_paise": sum(i["amount_paise"] for i in items),
            "total_items": len(items)}


@router.get("/print/cash")
async def print_cash(store_id: str, business_date: str,
                     user: dict = Depends(get_current_user)):
    require_store_access(user, store_id)
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    rows = []
    async for b in db.bills.find({"store_id": store_id, "business_date": business_date,
                                  "status": "active"}, {"_id": 0}).sort("created_at", 1):
        cash = sum(p["amount_paise"] for p in b.get("payments", []) if p["type"] == "cash")
        ex = b.get("excess")
        cash_returned = ex["amount_paise"] if ex and ex.get("return_mode") == "cash" else 0
        if cash or cash_returned:
            rows.append({"kind": "bill", "bill_no": b["bill_no"],
                         "customer_name": b.get("customer_name"),
                         "cashier_name": b.get("cashier_name"),
                         "cash_in_paise": cash, "cash_out_paise": cash_returned})
    async for a in db.adjustments.find({"store_id": store_id, "business_date": business_date,
                                        "status": "active", "payment_type": "cash"},
                                       {"_id": 0}).sort("created_at", 1):
        rows.append({"kind": f"adjustment_{a['kind']}", "bill_no": a.get("related_bill_no"),
                     "customer_name": a.get("description"), "cashier_name": a.get("cashier_name"),
                     "cash_in_paise": a["amount_paise"] if a["kind"] == "receipt" else 0,
                     "cash_out_paise": a["amount_paise"] if a["kind"] == "deduction" else 0})
    async for e in db.expenses.find({"store_id": store_id, "business_date": business_date,
                                     "status": "active", "payment_type": "cash"},
                                    {"_id": 0}).sort("created_at", 1):
        rows.append({"kind": "expense", "bill_no": e.get("voucher_no"),
                     "customer_name": e["description"], "cashier_name": e.get("cashier_name"),
                     "cash_in_paise": 0, "cash_out_paise": e["amount_paise"]})
    sd = await get_store_day(store_id, business_date)
    return {"store": store, "business_date": business_date, "rows": rows,
            "opening_paise": sd["opening_paise"],
            "total_in_paise": sum(r["cash_in_paise"] for r in rows),
            "total_out_paise": sum(r["cash_out_paise"] for r in rows)}
