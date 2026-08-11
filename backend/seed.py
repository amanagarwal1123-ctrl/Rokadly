"""Seed realistic demo data for Rokadly. Run: python seed.py"""
import asyncio
from datetime import datetime, timedelta, timezone

from core import (db, new_id, now_utc, today_ist, hash_password, normalize_bill_no,
                  normalize_name, IST, cashier_cash_summary)

SYSTEM = {"id": "system", "name": "Seed Script", "role": "admin"}


def paise(rupees):
    return int(round(rupees * 100))


async def main():
    # wipe
    for coll in ["users", "stores", "banks", "bank_requests", "bills", "drafts", "heads",
                 "adjustments", "expenses", "allocations", "cash_counts", "discrepancies",
                 "cheques", "account_tallies", "store_days", "audit_log", "settings"]:
        await db[coll].delete_many({})

    today = today_ist()
    yesterday = (datetime.now(IST) - timedelta(days=1)).strftime('%Y-%m-%d')

    # ---------- stores ----------
    main_id, br1_id, br2_id = new_id(), new_id(), new_id()
    await db.stores.insert_many([
        {"id": main_id, "name": "Main Jewellers", "code": "MAIN", "type": "main", "active": True, "created_at": now_utc()},
        {"id": br1_id, "name": "Rohini Branch", "code": "BR1", "type": "branch", "active": True, "created_at": now_utc()},
        {"id": br2_id, "name": "Lajpat Branch", "code": "BR2", "type": "branch", "active": True, "created_at": now_utc()},
    ])

    # ---------- users ----------
    ALL_PERMS = {"view_recon": True, "reconcile": True, "mark_status": True,
                 "clear_matched": True, "final_tally": True, "manage_cheques": True,
                 "finalize_rokad": True}
    LIMITED_PERMS = {"view_recon": True, "reconcile": False, "mark_status": False,
                     "clear_matched": False, "final_tally": False, "manage_cheques": True,
                     "finalize_rokad": False}
    users = [
        {"id": new_id(), "username": "admin", "password_hash": hash_password("admin123"),
         "name": "Rajesh Soni", "role": "admin", "store_id": None, "store_ids": [],
         "manager_permissions": {}, "active": True, "assignment_history": [], "created_at": now_utc()},
        {"id": new_id(), "username": "manager1", "password_hash": hash_password("manager123"),
         "name": "Vikram Mehta", "role": "manager", "store_id": None, "store_ids": [br1_id],
         "manager_permissions": {br1_id: ALL_PERMS}, "active": True, "assignment_history": [], "created_at": now_utc()},
        {"id": new_id(), "username": "manager2", "password_hash": hash_password("manager123"),
         "name": "Sunita Rao", "role": "manager", "store_id": None, "store_ids": [br2_id],
         "manager_permissions": {br2_id: LIMITED_PERMS}, "active": True, "assignment_history": [], "created_at": now_utc()},
        {"id": new_id(), "username": "accountant1", "password_hash": hash_password("account123"),
         "name": "Priya Sharma", "role": "accountant", "store_id": None,
         "store_ids": [main_id, br1_id, br2_id], "manager_permissions": {}, "active": True,
         "assignment_history": [], "created_at": now_utc()},
        {"id": new_id(), "username": "cashier1", "password_hash": hash_password("cashier123"),
         "name": "Amit Kumar", "role": "cashier", "store_id": main_id, "store_ids": [],
         "manager_permissions": {}, "active": True, "assignment_history": [], "created_at": now_utc()},
        {"id": new_id(), "username": "cashier2", "password_hash": hash_password("cashier123"),
         "name": "Neha Gupta", "role": "cashier", "store_id": main_id, "store_ids": [],
         "manager_permissions": {}, "active": True, "assignment_history": [], "created_at": now_utc()},
        {"id": new_id(), "username": "cashier3", "password_hash": hash_password("cashier123"),
         "name": "Ravi Verma", "role": "cashier", "store_id": br1_id, "store_ids": [],
         "manager_permissions": {}, "active": True, "assignment_history": [], "created_at": now_utc()},
        {"id": new_id(), "username": "cashier4", "password_hash": hash_password("cashier123"),
         "name": "Pooja Singh", "role": "cashier", "store_id": br2_id, "store_ids": [],
         "manager_permissions": {}, "active": True, "assignment_history": [], "created_at": now_utc()},
    ]
    await db.users.insert_many(users)
    U = {u["username"]: u for u in users}

    # ---------- banks ----------
    sbi_id, hdfc_id, icici_id = new_id(), new_id(), new_id()
    await db.banks.insert_many([
        {"id": sbi_id, "name": "SBI", "normalized_name": "sbi", "home_store_id": main_id,
         "account_label": "SBI CA 3301 - Main", "display_order": 1, "active": True, "created_at": now_utc()},
        {"id": hdfc_id, "name": "HDFC", "normalized_name": "hdfc", "home_store_id": br1_id,
         "account_label": "HDFC CA 8802 - Rohini", "display_order": 2, "active": True, "created_at": now_utc()},
        {"id": icici_id, "name": "ICICI", "normalized_name": "icici", "home_store_id": main_id,
         "account_label": "ICICI CA 5501 - Main", "display_order": 3, "active": True, "created_at": now_utc()},
    ])

    # ---------- heads ----------
    heads = []
    for name in ["Supplier Payment", "Electricity", "Courier", "Tea & Refreshments", "Staff Welfare"]:
        heads.append({"id": new_id(), "kind": "expense", "name": name,
                      "norm_name": normalize_name(name), "scope": "global", "store_id": None,
                      "created_by": U["admin"]["id"], "active": True, "created_at": now_utc()})
    for name in ["Hallmarking Charges", "Tax Collected", "Cashback", "Less Taken Adjustment", "Discrepancy Settlement"]:
        heads.append({"id": new_id(), "kind": "adjustment", "name": name,
                      "norm_name": normalize_name(name), "scope": "global", "store_id": None,
                      "created_by": U["admin"]["id"], "active": True, "created_at": now_utc()})
    await db.heads.insert_many(heads)
    H = {h["name"]: h for h in heads}

    await db.settings.insert_one({"key": "global", "allow_manager_finalize_main": False})

    # ---------- yesterday: finalized store days (carry-forward source) ----------
    for sid, closing, opener in [(main_id, paise(50000), paise(45000)),
                                 (br1_id, paise(20000), paise(18000)),
                                 (br2_id, paise(15000), paise(14000))]:
        await db.store_days.insert_one({
            "id": new_id(), "store_id": sid, "business_date": yesterday,
            "opening_paise": opener, "opening_source": "initial", "opening_adjustment": None,
            "status": "finalized", "finalized_by": U["admin"]["id"], "finalized_by_name": "Rajesh Soni",
            "finalized_at": now_utc(), "finalize_note": "Seeded prior day",
            "closing_actual_paise": closing, "reopen_history": [], "needs_revalidation": False,
            "created_at": now_utc()})

    # shared discrepancy from yesterday (mixed shortage split 50/50)
    shared_disc_id = new_id()
    await db.discrepancies.insert_one({
        "id": shared_disc_id, "store_id": main_id, "business_date": yesterday,
        "type": "shortage", "amount_paise": paise(1000),
        "note": "Evening tally shortage at shared counter",
        "source_count_id": None,
        "allocations": [
            {"cashier_id": U["cashier1"]["id"], "cashier_name": "Amit Kumar", "amount_paise": paise(500)},
            {"cashier_id": U["cashier2"]["id"], "cashier_name": "Neha Gupta", "amount_paise": paise(500)}],
        "allocation_note": "Equal split - both worked the counter",
        "status": "open", "settlements": [], "settled_paise": 0,
        "original": {"expected_paise": paise(51000), "counted_paise": paise(50000),
                     "variance_paise": -paise(1000)},
        "created_at": now_utc()})

    # ---------- today: store days ----------
    for sid, opening in [(main_id, paise(50000)), (br1_id, paise(20000)), (br2_id, paise(15000))]:
        await db.store_days.insert_one({
            "id": new_id(), "store_id": sid, "business_date": today,
            "opening_paise": opening, "opening_source": "carry", "opening_adjustment": None,
            "status": "open", "finalized_by": None, "finalized_by_name": None,
            "finalized_at": None, "finalize_note": None, "closing_actual_paise": None,
            "reopen_history": [], "needs_revalidation": False, "created_at": now_utc()})

    # ---------- allocations today ----------
    for sid, uname, amt in [(main_id, "cashier1", paise(30000)), (main_id, "cashier2", paise(20000)),
                            (br1_id, "cashier3", paise(20000)), (br2_id, "cashier4", paise(15000))]:
        await db.allocations.insert_one({
            "id": new_id(), "store_id": sid, "business_date": today,
            "cashier_id": U[uname]["id"], "cashier_name": U[uname]["name"],
            "amount_paise": amt,
            "history": [{"amount_paise": amt, "set_by": U[uname]["id"],
                         "set_by_name": U[uname]["name"], "at": now_utc()}],
            "created_at": now_utc(), "updated_at": now_utc()})

    # ---------- bills today ----------
    seq = {"n": 0}

    def ts():
        seq["n"] += 1
        return (datetime.now(timezone.utc) + timedelta(seconds=seq["n"])).isoformat()

    async def mk_bill(store_id, cashier, bill_no, amount, payments, customer=None,
                      phone=None, excess=None, less_reason=None):
        rows = []
        for p in payments:
            row = {"type": p["type"], "amount_paise": p["amount"],
                   "recon_status": p.get("recon_status", "unreviewed") if p["type"] != "cash" else None}
            if p["type"] == "bank":
                row["bank_id"] = p["bank_id"]
                bank = await db.banks.find_one({"id": p["bank_id"]}, {"_id": 0})
                row["bank_name"] = bank["name"]
                row["bank_home_store_id"] = bank.get("home_store_id")
            if p["type"] == "cheque":
                row["cheque_no"] = p["cheque_no"]
                row["cheque_name"] = p.get("cheque_name") or customer
                row["cheque_due_date"] = p.get("due_date")
            if p["type"] == "other":
                row["other_label"] = p["other_label"]
            rows.append(row)
        paid = sum(r["amount_paise"] for r in rows)
        less = max(0, amount - paid)
        ex = None
        if excess:
            ex = {"amount_paise": paid - amount, "return_mode": excess["mode"]}
            if excess["mode"] == "bank":
                bank = await db.banks.find_one({"id": excess["bank_id"]}, {"_id": 0})
                ex["bank_id"] = bank["id"]
                ex["bank_name"] = bank["name"]
        bill = {"id": new_id(), "store_id": store_id, "business_date": today,
                "bill_no": bill_no, "bill_no_norm": normalize_bill_no(bill_no),
                "cashier_id": U[cashier]["id"], "cashier_name": U[cashier]["name"],
                "amount_paise": amount, "customer_name": customer, "customer_phone": phone,
                "country_code": "+91", "payments": rows, "less_taken_paise": less,
                "less_taken_reason": less_reason if less else None, "excess": ex,
                "gross_paise": paid, "net_paise": paid - (ex["amount_paise"] if ex else 0),
                "status": "active", "void_reason": None, "version": 1, "client_key": None,
                "created_at": ts(), "updated_at": now_utc(), "annotations": []}
        await db.bills.insert_one(dict(bill))
        for idx, r in enumerate(rows):
            if r["type"] == "cheque":
                await db.cheques.insert_one({
                    "id": new_id(), "store_id": store_id, "business_date": today,
                    "bill_id": bill["id"], "payment_index": idx, "bill_no": bill_no,
                    "cashier_id": U[cashier]["id"], "cashier_name": U[cashier]["name"],
                    "cheque_no": r["cheque_no"], "amount_paise": r["amount_paise"],
                    "name_on_cheque": r.get("cheque_name") or customer,
                    "received_date": today, "due_date": r.get("cheque_due_date"),
                    "notes": None, "status": "pending", "status_date": None,
                    "status_remark": None, "active": True, "history": [], "created_at": now_utc()})
        return bill

    # Main store - cashier1
    await mk_bill(main_id, "cashier1", "M-1001", paise(25000),
                  [{"type": "cash", "amount": paise(25000)}], "Ramesh Agarwal", "9810012345")
    await mk_bill(main_id, "cashier1", "M-1002", paise(18500),
                  [{"type": "card", "amount": paise(10000), "recon_status": "matched"},
                   {"type": "bank", "amount": paise(8500), "bank_id": sbi_id, "recon_status": "matched"}],
                  "Sneha Kapoor", "9810098765")
    await mk_bill(main_id, "cashier1", "M-1004", paise(1000),
                  [{"type": "cash", "amount": paise(800)}], "Walk-in",
                  less_reason="Round-off discount by owner")
    await mk_bill(main_id, "cashier1", "M-1005", paise(10000),
                  [{"type": "cash", "amount": paise(10500)}], "Deepak Jain",
                  excess={"mode": "cash"})
    await mk_bill(main_id, "cashier1", "M-1006", paise(22000),
                  [{"type": "bank", "amount": paise(22000), "bank_id": hdfc_id,
                    "recon_status": "matched"}],
                  "Kiran Devi", "9910011223")  # cross-store: HDFC home = Rohini
    await mk_bill(main_id, "cashier1", "M-1008", paise(5000),
                  [{"type": "bank", "amount": paise(5000), "bank_id": sbi_id,
                    "recon_status": "pending"}], "Mohit Bansal")  # PENDING red row

    # Main store - cashier2
    await mk_bill(main_id, "cashier2", "M-1007", paise(15000),
                  [{"type": "cheque", "amount": paise(15000), "cheque_no": "000451",
                    "cheque_name": "Suresh Chandra"}], "Suresh Chandra")
    await mk_bill(main_id, "cashier2", "M-1009", paise(8000),
                  [{"type": "other", "amount": paise(8000), "other_label": "Gift Voucher"}],
                  "Anita Rani")
    await mk_bill(main_id, "cashier2", "M-1010", paise(12500),
                  [{"type": "cash", "amount": paise(12500)}], "Gopal Das")

    # Branch 1 (Rohini) - cashier3
    await mk_bill(br1_id, "cashier3", "R-2001", paise(30000),
                  [{"type": "bank", "amount": paise(30000), "bank_id": hdfc_id,
                    "recon_status": "matched"}], "Lakshmi Traders")
    b_r2002 = await mk_bill(br1_id, "cashier3", "R-2002", paise(9000),
                            [{"type": "cheque", "amount": paise(9000), "cheque_no": "112233",
                              "cheque_name": "Harish Oberoi", "recon_status": "matched"}],
                            "Harish Oberoi")
    await mk_bill(br1_id, "cashier3", "R-2003", paise(7500),
                  [{"type": "cash", "amount": paise(7500)}], "Walk-in")

    # Branch 2 (Lajpat) - cashier4
    b_l3001 = await mk_bill(br2_id, "cashier4", "L-3001", paise(11000),
                            [{"type": "cheque", "amount": paise(11000), "cheque_no": "778899",
                              "cheque_name": "Prakash Yadav"}], "Prakash Yadav")
    b_l3002 = await mk_bill(br2_id, "cashier4", "L-3002", paise(6000),
                            [{"type": "cheque", "amount": paise(6000), "cheque_no": "445566",
                              "cheque_name": "Meena Kumari"}], "Meena Kumari")
    await mk_bill(br2_id, "cashier4", "L-3003", paise(14000),
                  [{"type": "cash", "amount": paise(4000)},
                   {"type": "bank", "amount": paise(10000), "bank_id": icici_id}],
                  "Farhan Ali", "9911223344")

    # cheque status updates
    ch = await db.cheques.find_one({"bill_id": b_r2002["id"]}, {"_id": 0})
    await db.cheques.update_one({"id": ch["id"]}, {"$set": {
        "status": "passed", "status_date": today, "status_remark": None},
        "$push": {"history": {"from": "pending", "to": "passed", "date": today,
                              "by": U["admin"]["id"], "by_name": "Rajesh Soni", "at": now_utc()}}})
    ch = await db.cheques.find_one({"bill_id": b_l3001["id"]}, {"_id": 0})
    await db.cheques.update_one({"id": ch["id"]}, {"$set": {
        "status": "bounced", "status_date": today, "status_remark": "Insufficient funds"},
        "$push": {"history": {"from": "pending", "to": "bounced", "date": today,
                              "remark": "Insufficient funds",
                              "by": U["admin"]["id"], "by_name": "Rajesh Soni", "at": now_utc()}}})
    ch = await db.cheques.find_one({"bill_id": b_l3002["id"]}, {"_id": 0})
    await db.cheques.update_one({"id": ch["id"]}, {"$set": {
        "status": "paid_returned", "status_date": today,
        "status_remark": "Customer paid in cash at counter; cheque returned to customer"},
        "$push": {"history": {"from": "pending", "to": "paid_returned", "date": today,
                              "remark": "Customer paid in cash at counter; cheque returned",
                              "by": U["admin"]["id"], "by_name": "Rajesh Soni", "at": now_utc()}}})

    # ---------- expenses today (Main, cashier1) ----------
    for amt, nature, vs, vno, head, desc in [
            (paise(5000), "business_payment", "with_voucher", "V-101", "Supplier Payment",
             "Supplier payment - Kundan Traders"),
            (paise(1200), "operating", "with_voucher", "V-102", "Electricity",
             "Electricity bill - BSES"),
            (paise(300), "operating", "without_voucher", None, "Tea & Refreshments",
             "Tea and snacks for staff")]:
        await db.expenses.insert_one({
            "id": new_id(), "store_id": main_id, "business_date": today,
            "cashier_id": U["cashier1"]["id"], "cashier_name": "Amit Kumar",
            "amount_paise": amt, "nature": nature, "voucher_status": vs, "voucher_no": vno,
            "head_id": H[head]["id"], "head_name": head, "description": desc,
            "payment_type": "cash", "status": "active", "void_reason": None,
            "review_status": "unreviewed", "reviewed_by": None, "finalized_by": None,
            "version": 1, "created_at": ts(), "updated_at": now_utc()})

    # ---------- adjustments today (Main) ----------
    await db.adjustments.insert_one({
        "id": new_id(), "store_id": main_id, "business_date": today,
        "cashier_id": U["cashier1"]["id"], "cashier_name": "Amit Kumar",
        "kind": "receipt", "description": "Hallmarking charges collected",
        "amount_paise": paise(500), "payment_type": "cash",
        "head_id": H["Hallmarking Charges"]["id"], "head_name": "Hallmarking Charges",
        "related_bill_no": "M-1001", "other_label": None, "linked_discrepancy_id": None,
        "recon_status": None, "status": "active", "void_reason": None, "version": 1,
        "created_at": ts()})
    await db.adjustments.insert_one({
        "id": new_id(), "store_id": main_id, "business_date": today,
        "cashier_id": U["cashier2"]["id"], "cashier_name": "Neha Gupta",
        "kind": "receipt", "description": "Tax collected on repair job",
        "amount_paise": paise(1180), "payment_type": "bank", "bank_id": sbi_id,
        "bank_name": "SBI", "head_id": H["Tax Collected"]["id"], "head_name": "Tax Collected",
        "related_bill_no": None, "other_label": None, "linked_discrepancy_id": None,
        "recon_status": "unreviewed", "status": "active", "void_reason": None, "version": 1,
        "created_at": ts()})

    # later settlement (today) of yesterday's shared discrepancy - Rs 400 received
    settle_adj_id = new_id()
    await db.adjustments.insert_one({
        "id": settle_adj_id, "store_id": main_id, "business_date": today,
        "cashier_id": U["cashier1"]["id"], "cashier_name": "Amit Kumar",
        "kind": "receipt",
        "description": f"Settlement of shortage dated {yesterday} - customer returned excess change",
        "amount_paise": paise(400), "payment_type": "cash",
        "head_id": H["Discrepancy Settlement"]["id"], "head_name": "Discrepancy Settlement",
        "related_bill_no": None, "other_label": None,
        "linked_discrepancy_id": shared_disc_id, "recon_status": None,
        "status": "active", "void_reason": None, "version": 1, "created_at": ts()})
    await db.discrepancies.update_one({"id": shared_disc_id}, {
        "$push": {"settlements": {"date": today, "amount_paise": paise(400), "mode": "cash",
                                  "bank_id": None, "bank_name": None,
                                  "adjustment_id": settle_adj_id,
                                  "note": "Customer returned excess change",
                                  "by": U["cashier1"]["id"], "by_name": "Amit Kumar",
                                  "related_bill_no": None, "at": now_utc()}},
        "$set": {"settled_paise": paise(400), "status": "partially_adjusted"}})

    # ---------- cash counts today ----------
    # cashier1: Rs 500 shortage; cashier2: Rs 200 excess; cashier3: exact; cashier4: none yet
    async def submit_count(store_id, uname, delta, note):
        cid = U[uname]["id"]
        summary = await cashier_cash_summary(store_id, today, cid)
        expected = summary["expected_cash_paise"]
        counted = expected + delta
        variance = delta
        count_id = new_id()
        await db.cash_counts.insert_one({
            "id": count_id, "store_id": store_id, "business_date": today,
            "cashier_id": cid, "cashier_name": U[uname]["name"],
            "counted_paise": counted, "expected_paise": expected, "variance_paise": variance,
            "note": note, "summary": summary, "submitted_at": now_utc(),
            "submitted_by": cid, "history": []})
        if variance != 0:
            await db.discrepancies.insert_one({
                "id": new_id(), "store_id": store_id, "business_date": today,
                "type": "shortage" if variance < 0 else "excess",
                "amount_paise": abs(variance), "note": note, "source_count_id": count_id,
                "allocations": [{"cashier_id": cid, "cashier_name": U[uname]["name"],
                                 "amount_paise": abs(variance)}],
                "status": "open", "settlements": [], "settled_paise": 0,
                "original": {"expected_paise": expected, "counted_paise": counted,
                             "variance_paise": variance},
                "created_at": now_utc()})

    await submit_count(main_id, "cashier1", -paise(500), "Rs 500 short - possibly change error")
    await submit_count(main_id, "cashier2", paise(200), "Rs 200 extra found in drawer")
    await submit_count(br1_id, "cashier3", 0, None)

    # ---------- bank request pending ----------
    await db.bank_requests.insert_one({
        "id": new_id(), "name": "Kotak", "normalized_name": "kotak",
        "note": "Customer wants to transfer to Kotak account",
        "requested_by": U["cashier1"]["id"], "requested_by_name": "Amit Kumar",
        "store_id": main_id, "status": "pending", "resolved_bank_id": None,
        "created_at": now_utc()})

    print("Seed complete.")
    print(f"Today: {today}  Yesterday: {yesterday}")
    print("Credentials: admin/admin123, manager1/manager123 (Rohini, full perms),")
    print("manager2/manager123 (Lajpat, view+cheques only), accountant1/account123,")
    print("cashier1..4/cashier123")


if __name__ == "__main__":
    asyncio.run(main())
