"""Rokadly core business-logic test suite (API level).

Run: python test_core.py  (requires seeded db + running server)

Design rules:
- Never assume historical seed bills exist on *today*.
- Seed-specific checks (serial order, cross-store, shared discrepancy,
  pending-recon gating) query the actual seeded date (ROKADLY_SEED_DATE,
  default 2026-08-11) instead of today.
- Dynamic tests create their own unique fixtures and are rerunnable:
  the finalize-flow section reopens the day if a previous run left it
  finalized, overwrites allocations, and resubmits counts.
"""
import os
import sys
import uuid
import requests
from concurrent.futures import ThreadPoolExecutor

BASE = "http://localhost:8001/api"
SEED_DATE = os.environ.get("ROKADLY_SEED_DATE", "2026-08-11")
PASS, FAIL = [], []


def check(name, cond, detail=""):
    if cond:
        PASS.append(name)
        print(f"  PASS: {name}")
    else:
        FAIL.append(name)
        print(f"  FAIL: {name} {detail}")


def login(u, p):
    r = requests.post(f"{BASE}/auth/login", json={"username": u, "password": p})
    r.raise_for_status()
    d = r.json()
    return d["token"], d["user"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


def main():
    print("=== 1. Auth: all roles login ===")
    admin_t, admin_u = login("admin", "admin123")
    c1_t, c1_u = login("cashier1", "cashier123")
    c2_t, c2_u = login("cashier2", "cashier123")
    c3_t, c3_u = login("cashier3", "cashier123")
    acc_t, acc_u = login("accountant1", "account123")
    m1_t, m1_u = login("manager1", "manager123")
    m2_t, m2_u = login("manager2", "manager123")
    check("all roles can login", True)

    boot = requests.get(f"{BASE}/bootstrap", headers=H(admin_t)).json()
    today = boot["today"]
    stores = {s["code"]: s for s in boot["stores"]}
    main_id = stores["MAIN"]["id"]
    br1_id = stores["BR1"]["id"]
    br2_id = stores["BR2"]["id"]
    print(f"  today={today}  seed_date={SEED_DATE}")

    print("=== 2. Duplicate bill race: first wins, second gets 409 + summary ===")
    bill_no = f"RACE-{uuid.uuid4().hex[:6].upper()}"
    payload1 = {"bill_no": bill_no, "amount_paise": 500000,
                "payments": [{"type": "cash", "amount_paise": 500000}]}
    payload2 = {"bill_no": bill_no, "amount_paise": 700000,
                "payments": [{"type": "cash", "amount_paise": 700000}]}

    def post(args):
        t, p = args
        return requests.post(f"{BASE}/bills", json=p, headers=H(t))

    with ThreadPoolExecutor(2) as ex:
        r1, r2 = list(ex.map(post, [(c1_t, payload1), (c2_t, payload2)]))
    codes = sorted([r1.status_code, r2.status_code])
    check("one 201 and one 409", codes == [201, 409], f"got {codes}")
    loser = r1 if r1.status_code == 409 else r2
    det = loser.json().get("detail", {})
    check("conflict has existing-bill summary", isinstance(det, dict) and det.get("existing") is not None, str(det)[:200])
    # loser re-saves with new number, keeping every field (draft preserved)
    loser_payload = payload2 if r2.status_code == 409 else payload1
    loser_token = c2_t if r2.status_code == 409 else c1_t
    loser_payload["bill_no"] = bill_no + "-B"
    r3 = requests.post(f"{BASE}/bills", json=loser_payload, headers=H(loser_token))
    check("loser re-saves with only number changed", r3.status_code == 201, r3.text[:200])

    print("=== 3. Idempotency: same client_key returns same bill ===")
    ck = uuid.uuid4().hex
    p = {"bill_no": f"IDEM-{ck[:5].upper()}", "amount_paise": 100000,
         "payments": [{"type": "cash", "amount_paise": 100000}], "client_key": ck}
    ra = requests.post(f"{BASE}/bills", json=p, headers=H(c1_t))
    rb = requests.post(f"{BASE}/bills", json=p, headers=H(c1_t))
    check("idempotent double-tap", ra.status_code == 201 and rb.status_code == 201
          and rb.json().get("idempotent") is True
          and ra.json()["bill"]["id"] == rb.json()["bill"]["id"])

    print("=== 4. Less Taken math: Rs1000 bill, Rs800 cash -> expected +Rs800 only ===")
    before = requests.get(f"{BASE}/cash-counts/expected",
                          params={"store_id": main_id, "business_date": today},
                          headers=H(c1_t)).json()["summary"]["expected_cash_paise"]
    r = requests.post(f"{BASE}/bills", json={
        "bill_no": f"LT-{uuid.uuid4().hex[:5].upper()}", "amount_paise": 100000,
        "payments": [{"type": "cash", "amount_paise": 80000}],
    }, headers=H(c1_t))
    check("less taken bill created", r.status_code == 201, r.text[:200])
    check("less_taken = 20000 paise", r.json()["bill"]["less_taken_paise"] == 20000)
    after = requests.get(f"{BASE}/cash-counts/expected",
                         params={"store_id": main_id, "business_date": today},
                         headers=H(c1_t)).json()["summary"]["expected_cash_paise"]
    check("expected cash rose by exactly 80000 paise", after - before == 80000,
          f"delta={after - before}")

    print("=== 5. Excess: Rs1000 bill, Rs1100 paid -> must record Rs100 return ===")
    r = requests.post(f"{BASE}/bills", json={
        "bill_no": f"EX-{uuid.uuid4().hex[:5].upper()}", "amount_paise": 100000,
        "payments": [{"type": "cash", "amount_paise": 110000}],
    }, headers=H(c1_t))
    det = r.json().get("detail", {})
    check("excess blocked without return", r.status_code == 400 and det.get("code") == "EXCESS_REQUIRED",
          r.text[:200])
    before = requests.get(f"{BASE}/cash-counts/expected",
                          params={"store_id": main_id, "business_date": today},
                          headers=H(c1_t)).json()["summary"]["expected_cash_paise"]
    r = requests.post(f"{BASE}/bills", json={
        "bill_no": f"EX-{uuid.uuid4().hex[:5].upper()}", "amount_paise": 100000,
        "payments": [{"type": "cash", "amount_paise": 110000}],
        "excess": {"amount_paise": 10000, "return_mode": "cash"},
    }, headers=H(c1_t))
    check("excess cash return accepted", r.status_code == 201, r.text[:200])
    after = requests.get(f"{BASE}/cash-counts/expected",
                         params={"store_id": main_id, "business_date": today},
                         headers=H(c1_t)).json()["summary"]["expected_cash_paise"]
    check("net cash +100000 paise (1100 in - 100 back)", after - before == 100000,
          f"delta={after - before}")

    print("=== 6. Editing a bill never conflicts with itself ===")
    edt_no = f"EDT-{uuid.uuid4().hex[:5].upper()}"
    r = requests.post(f"{BASE}/bills", json={
        "bill_no": edt_no, "amount_paise": 50000,
        "payments": [{"type": "cash", "amount_paise": 50000}]}, headers=H(c1_t))
    check("edit-test bill created", r.status_code == 201, r.text[:150])
    edt_id = r.json()["bill"]["id"]
    edt_ver = r.json()["bill"].get("version")
    r = requests.get(f"{BASE}/bills/check-duplicate",
                     params={"store_id": main_id, "business_date": today, "bill_no": edt_no},
                     headers=H(c1_t)).json()
    check("duplicate-check finds the saved bill", r.get("duplicate") is True)
    r = requests.get(f"{BASE}/bills/check-duplicate",
                     params={"store_id": main_id, "business_date": today, "bill_no": edt_no,
                             "exclude_bill_id": edt_id},
                     headers=H(c1_t)).json()
    check("duplicate-check with exclude_bill_id does not flag itself", r.get("duplicate") is False)
    r = requests.put(f"{BASE}/bills/{edt_id}", json={
        "bill_no": edt_no, "amount_paise": 50000, "version": edt_ver,
        "payments": [{"type": "cash", "amount_paise": 50000}]}, headers=H(c1_t))
    check("updating a bill with its own number succeeds", r.status_code == 200, r.text[:150])

    print(f"=== 7. Non-cash serial order on seeded date {SEED_DATE} ===")
    r = requests.get(f"{BASE}/recon/items",
                     params={"store_id": main_id, "business_date": SEED_DATE},
                     headers=H(acc_t)).json()
    labels = [g["group_label"] for g in r["groups"]]
    order_ref = ["Card", "Cheque", "SBI", "HDFC", "ICICI", "Other"]
    positions = [order_ref.index(l) for l in labels if l in order_ref]
    check("seeded groups exist", len(labels) > 0, str(labels))
    check("groups in configured order", positions == sorted(positions), str(labels))
    serials = [it["serial"] for g in r["groups"] for it in g["items"]]
    check("serials continuous 1..N", serials == list(range(1, len(serials) + 1)), str(serials))

    print(f"=== 8. Cross-store on seeded date: Main bill in Rohini's HDFC keeps Main ownership ===")
    r = requests.get(f"{BASE}/reports/cross-store",
                     params={"date_from": SEED_DATE, "date_to": SEED_DATE}, headers=H(admin_t)).json()
    hdfc = next((g for g in r["groups"] if g["bank_name"] == "HDFC"), None)
    check("HDFC group exists with home store Rohini", hdfc is not None and hdfc["home_store_name"] == "Rohini Branch",
          str(hdfc)[:150] if hdfc else "missing")
    cross = [i for i in (hdfc["items"] if hdfc else []) if i.get("cross_store")]
    check("cross-store item flagged (Main bill in HDFC)",
          any(i["selling_store_name"] == "Main Jewellers" for i in cross), str(cross)[:200])
    mb = requests.get(f"{BASE}/bills", params={"store_id": main_id, "business_date": SEED_DATE},
                      headers=H(admin_t)).json()["bills"]
    check("seed bill M-1006 owned by Main store", any(b["bill_no"] == "M-1006" for b in mb))

    print("=== 9. RBAC boundaries ===")
    r = requests.get(f"{BASE}/bills", params={"store_id": main_id, "business_date": today},
                     headers=H(c3_t))
    check("cashier3 (BR1) blocked from Main bills", r.status_code == 403)
    r = requests.get(f"{BASE}/bills", params={"store_id": main_id, "business_date": today},
                     headers=H(c1_t)).json()["bills"]
    check("cashier1 sees only own bills", all(b["cashier_id"] == c1_u["id"] for b in r))
    # manager2 has view_recon on BR2 but not reconcile - use seeded date (has items)
    items = requests.get(f"{BASE}/recon/items",
                         params={"store_id": br2_id, "business_date": SEED_DATE},
                         headers=H(m2_t)).json()
    check("manager2 can view BR2 recon", "groups" in items)
    flat = [it for g in items.get("groups", []) for it in g["items"]]
    if flat:
        first = flat[0]
        r = requests.patch(f"{BASE}/recon/item", json={
            "source": first["source"], "ref_id": first["ref_id"],
            "payment_index": first["payment_index"], "status": "matched"}, headers=H(m2_t))
        check("manager2 cannot mark matched (perm off)", r.status_code == 403, r.text[:150])
    else:
        check("manager2 cannot mark matched (perm off)", False, "no seeded BR2 items found")
    r = requests.get(f"{BASE}/recon/items",
                     params={"store_id": br1_id, "business_date": today}, headers=H(m2_t))
    check("manager2 blocked from BR1 entirely", r.status_code == 403)
    r = requests.post(f"{BASE}/finalize", json={"store_id": br2_id, "business_date": today},
                      headers=H(m2_t))
    check("manager2 cannot finalize BR2 (perm off)", r.status_code == 403, r.text[:150])

    print(f"=== 10. Shared discrepancy 50/50 + later settlement links back (seeded) ===")
    d = requests.get(f"{BASE}/discrepancies", params={"store_id": main_id},
                     headers=H(admin_t)).json()["discrepancies"]
    shared = next((x for x in d if len(x.get("allocations", [])) == 2), None)
    check("shared discrepancy split between two cashiers",
          shared is not None and shared["allocations"][0]["amount_paise"] == 50000)
    check("later settlement recorded and linked (partially adjusted)",
          shared is not None and shared.get("settlements")
          and shared["status"] == "partially_adjusted")

    print(f"=== 11. Finalization gating: Main blocked by pending recon on {SEED_DATE} ===")
    r = requests.get(f"{BASE}/finalize/readiness",
                     params={"store_id": main_id, "business_date": SEED_DATE},
                     headers=H(admin_t)).json()
    recon_check = next(c for c in r["checks"] if c["key"] == "recon_complete")
    check("recon check failing (pending exists)", recon_check["pass"] is False)
    r = requests.post(f"{BASE}/finalize", json={"store_id": main_id, "business_date": SEED_DATE},
                      headers=H(admin_t))
    check("finalize blocked with NOT_READY", r.status_code == 400
          and r.json()["detail"].get("code") == "NOT_READY", r.text[:200])

    print("=== 12. BR1 today: signed opening adjustments (admin) ===")
    # ensure the day is open (a previous run may have left it finalized)
    sd = requests.get(f"{BASE}/store-day",
                      params={"store_id": br1_id, "business_date": today},
                      headers=H(admin_t)).json()["store_day"]
    if sd["status"] == "finalized":
        rr = requests.post(f"{BASE}/finalize/reopen", json={
            "store_id": br1_id, "business_date": today,
            "reason": "test suite rerun setup"}, headers=H(admin_t))
        assert rr.status_code == 200, rr.text

    summ = requests.get(f"{BASE}/allocations/summary",
                        params={"store_id": br1_id, "business_date": today},
                        headers=H(admin_t)).json()
    base_open = summ["opening_paise"]
    r = requests.post(f"{BASE}/allocations/opening-adjustment", json={
        "store_id": br1_id, "business_date": today, "amount_paise": 500000,
        "reason": "test positive adjustment"}, headers=H(admin_t))
    check("positive opening adjustment accepted", r.status_code == 200, r.text[:150])
    summ = requests.get(f"{BASE}/allocations/summary",
                        params={"store_id": br1_id, "business_date": today},
                        headers=H(admin_t)).json()
    check("effective opening = base + 5000", summ["effective_opening_paise"] == base_open + 500000,
          f"base={base_open} eff={summ['effective_opening_paise']}")
    r = requests.post(f"{BASE}/allocations/opening-adjustment", json={
        "store_id": br1_id, "business_date": today, "amount_paise": 0,
        "reason": "zero"}, headers=H(admin_t))
    check("zero adjustment rejected", r.status_code == 400, r.text[:120])
    r = requests.post(f"{BASE}/allocations/opening-adjustment", json={
        "store_id": br1_id, "business_date": today,
        "amount_paise": -(base_open + 10_000_000), "reason": "excessive"}, headers=H(admin_t))
    check("excessive negative adjustment rejected", r.status_code == 400, r.text[:150])
    r = requests.post(f"{BASE}/allocations/opening-adjustment", json={
        "store_id": br1_id, "business_date": today, "amount_paise": -200000,
        "reason": "test negative adjustment"}, headers=H(admin_t))
    check("negative opening adjustment accepted", r.status_code == 200, r.text[:150])
    summ = requests.get(f"{BASE}/allocations/summary",
                        params={"store_id": br1_id, "business_date": today},
                        headers=H(admin_t)).json()
    check("effective opening = base - 2000 (adjustment replaced)",
          summ["effective_opening_paise"] == base_open - 200000,
          f"base={base_open} eff={summ['effective_opening_paise']}")
    eff_open = summ["effective_opening_paise"]

    print("=== 13. BR1 today: zero allocation + variance note + discrepancy ===")
    r = requests.put(f"{BASE}/allocations", json={
        "store_id": br1_id, "business_date": today, "amount_paise": 0}, headers=H(c3_t))
    check("zero allocation accepted", r.status_code == 200, r.text[:150])
    s = r.json()
    check("unallocated equals full effective opening", s["unallocated_paise"] == s["effective_opening_paise"],
          str({k: s[k] for k in ('unallocated_paise', 'effective_opening_paise')}))
    # cashier3 makes a cash bill so he is a day participant
    r = requests.post(f"{BASE}/bills", json={
        "bill_no": f"BR1-{uuid.uuid4().hex[:5].upper()}", "amount_paise": 10000,
        "payments": [{"type": "cash", "amount_paise": 10000}]}, headers=H(c3_t))
    check("cashier3 bill created on BR1 today", r.status_code == 201, r.text[:150])
    # full allocation to cashier3
    r = requests.put(f"{BASE}/allocations", json={
        "store_id": br1_id, "business_date": today,
        "amount_paise": eff_open}, headers=H(c3_t))
    check("full allocation accepted", r.status_code == 200, r.text[:150])
    exp = requests.get(f"{BASE}/cash-counts/expected",
                       params={"store_id": br1_id, "business_date": today},
                       headers=H(c3_t)).json()["summary"]["expected_cash_paise"]
    r = requests.post(f"{BASE}/cash-counts", json={
        "store_id": br1_id, "business_date": today, "counted_paise": exp - 50000},
        headers=H(c3_t))
    check("variance without note rejected", r.status_code == 400
          and r.json()["detail"].get("code") == "NOTE_REQUIRED", r.text[:150])
    r = requests.post(f"{BASE}/cash-counts", json={
        "store_id": br1_id, "business_date": today, "counted_paise": exp - 50000,
        "note": "Rs 500 short at closing"}, headers=H(c3_t))
    check("count with note accepted, variance -50000", r.status_code == 200
          and r.json()["variance_paise"] == -50000, r.text[:200])
    d = requests.get(f"{BASE}/discrepancies",
                     params={"store_id": br1_id, "business_date": today},
                     headers=H(admin_t)).json()["discrepancies"]
    check("discrepancy auto-created", any(x["amount_paise"] == 50000 and x["type"] == "shortage"
                                          and x["status"] == "open" for x in d))
    # balance out: resubmit exact count (history kept, discrepancy auto-closed)
    r = requests.post(f"{BASE}/cash-counts", json={
        "store_id": br1_id, "business_date": today, "counted_paise": exp},
        headers=H(c3_t))
    check("exact resubmit accepted (variance 0)", r.status_code == 200
          and r.json()["variance_paise"] == 0, r.text[:150])

    print("=== 14. BR1 today: full finalize flow, then every ordinary write returns 423 ===")
    # clear + tally any non-cash items (none expected for a cash-only day)
    items = requests.get(f"{BASE}/recon/items",
                         params={"store_id": br1_id, "business_date": today},
                         headers=H(acc_t)).json()
    for g in items["groups"]:
        for it in g["items"]:
            if it["recon_status"] in ("unreviewed", "pending"):
                rr = requests.patch(f"{BASE}/recon/item", json={
                    "source": it["source"], "ref_id": it["ref_id"],
                    "payment_index": it["payment_index"], "status": "cleared",
                    "note": "test clear"}, headers=H(acc_t))
                assert rr.status_code == 200, rr.text
        rr = requests.post(f"{BASE}/recon/tally", json={
            "store_id": br1_id, "business_date": today,
            "group_key": g["group_key"], "tallied": True}, headers=H(m1_t))
        check(f"manager1 tallies {g['group_label']}", rr.status_code == 200, rr.text[:150])
    # submit counts for any other participant cashiers (admin on their behalf)
    cc = requests.get(f"{BASE}/cash-counts",
                      params={"store_id": br1_id, "business_date": today},
                      headers=H(admin_t)).json()
    for m in cc["missing"]:
        e = requests.get(f"{BASE}/cash-counts/expected",
                         params={"store_id": br1_id, "business_date": today,
                                 "cashier_id": m["cashier_id"]},
                         headers=H(admin_t)).json()["summary"]["expected_cash_paise"]
        rr = requests.post(f"{BASE}/cash-counts", json={
            "store_id": br1_id, "business_date": today, "counted_paise": e,
            "cashier_id": m["cashier_id"]}, headers=H(admin_t))
        assert rr.status_code == 200, rr.text
    r = requests.post(f"{BASE}/finalize", json={"store_id": br1_id, "business_date": today,
                                                "note": "test finalize"}, headers=H(m1_t))
    check("manager1 finalizes BR1", r.status_code == 200, r.text[:300])
    closing = r.json().get("closing_actual_paise")

    # --- every ordinary mutation now returns 423 Locked ---
    r = requests.post(f"{BASE}/bills", json={
        "bill_no": "LOCKED-1", "amount_paise": 1000,
        "payments": [{"type": "cash", "amount_paise": 1000}]}, headers=H(c3_t))
    check("bill create blocked (423)", r.status_code == 423, f"{r.status_code}")
    r = requests.put(f"{BASE}/allocations", json={
        "store_id": br1_id, "business_date": today, "amount_paise": 1}, headers=H(c3_t))
    check("allocation blocked (423)", r.status_code == 423, f"{r.status_code}")
    r = requests.post(f"{BASE}/cash-counts", json={
        "store_id": br1_id, "business_date": today, "counted_paise": 1,
        "cashier_id": c3_u["id"]}, headers=H(admin_t))
    check("cash count blocked (423)", r.status_code == 423, f"{r.status_code}")
    r = requests.post(f"{BASE}/expenses", json={
        "store_id": br1_id, "business_date": today, "amount_paise": 1000,
        "nature": "operating", "voucher_status": "without_voucher",
        "description": "locked test", "payment_type": "cash"}, headers=H(admin_t))
    check("expense create blocked (423)", r.status_code == 423, f"{r.status_code}")
    r = requests.post(f"{BASE}/adjustments", json={
        "store_id": br1_id, "business_date": today, "kind": "receipt",
        "description": "locked test", "amount_paise": 1000,
        "payment_type": "cash"}, headers=H(admin_t))
    check("adjustment blocked (423)", r.status_code == 423, f"{r.status_code}")
    r = requests.post(f"{BASE}/allocations/opening-adjustment", json={
        "store_id": br1_id, "business_date": today, "amount_paise": 1000,
        "reason": "locked test"}, headers=H(admin_t))
    check("opening adjustment blocked (423)", r.status_code == 423, f"{r.status_code}")
    r = requests.post(f"{BASE}/recon/tally", json={
        "store_id": br1_id, "business_date": today,
        "group_key": "cash", "tallied": True}, headers=H(admin_t))
    check("recon tally blocked (423)", r.status_code == 423, f"{r.status_code}")

    # register shows finalized with closing carried
    reg = requests.get(f"{BASE}/reports/register",
                       params={"date_from": today, "date_to": today, "store_id": br1_id},
                       headers=H(admin_t)).json()["rows"]
    check("register row finalized w/ closing carried", bool(reg) and reg[0]["status"] == "finalized"
          and reg[0]["actual_cash_paise"] == closing, str(reg)[:200])

    # reopen requires a real reason
    r = requests.post(f"{BASE}/finalize/reopen", json={
        "store_id": br1_id, "business_date": today, "reason": ""}, headers=H(admin_t))
    check("reopen without reason rejected", r.status_code == 400)
    r = requests.post(f"{BASE}/finalize/reopen", json={
        "store_id": br1_id, "business_date": today, "reason": "   "}, headers=H(admin_t))
    check("reopen with whitespace reason rejected", r.status_code == 400)
    r = requests.post(f"{BASE}/finalize/reopen", json={
        "store_id": br1_id, "business_date": today, "reason": "test reopen"},
        headers=H(admin_t))
    check("admin reopen with reason works", r.status_code == 200, r.text[:150])
    r = requests.post(f"{BASE}/bills", json={
        "bill_no": f"REOPEN-{uuid.uuid4().hex[:5].upper()}", "amount_paise": 1000,
        "payments": [{"type": "cash", "amount_paise": 1000}]}, headers=H(c3_t))
    check("writes allowed again after reopen", r.status_code == 201, r.text[:120])
    if r.status_code == 201:
        requests.post(f"{BASE}/bills/{r.json()['bill']['id']}/void",
                      json={"reason": "test cleanup"}, headers=H(c3_t))

    print("=== 15. Cheques: seeded bounced is report-only; later-life updates stay open ===")
    ch = requests.get(f"{BASE}/cheques", params={"status": "bounced"}, headers=H(admin_t)).json()["cheques"]
    check("bounced cheque in ledger", any(c["cheque_no"] == "778899" for c in ch))
    bills = requests.get(f"{BASE}/bills", params={"store_id": br2_id, "business_date": SEED_DATE},
                         headers=H(admin_t)).json()["bills"]
    b = next((x for x in bills if x["bill_no"] == "L-3001"), None)
    check("bounced cheque bill unchanged (report-only)", b is not None and b["status"] == "active"
          and b["amount_paise"] == 1100000)
    # manager2 (manage_cheques=True) can update cheque status in BR2 even for old-days cheques
    pend = requests.get(f"{BASE}/cheques", params={"status": "pending", "store_id": br2_id},
                        headers=H(m2_t)).json()["cheques"]
    if pend:
        r = requests.patch(f"{BASE}/cheques/{pend[0]['id']}/status", json={
            "status": "passed", "status_date": today}, headers=H(m2_t))
        check("manager2 manages cheque status (later-life allowed)", r.status_code == 200, r.text[:150])
    # paid_returned requires remark
    ch_all = requests.get(f"{BASE}/cheques", params={"store_id": main_id}, headers=H(admin_t)).json()["cheques"]
    target = next((c for c in ch_all if c["status"] == "pending"), None)
    if target:
        r = requests.patch(f"{BASE}/cheques/{target['id']}/status", json={
            "status": "paid_returned", "status_date": today}, headers=H(admin_t))
        check("paid_returned without remark rejected", r.status_code == 400)

    print("=== 16. Expense voucher normalization ===")
    r = requests.post(f"{BASE}/expenses", json={
        "store_id": main_id, "business_date": today, "amount_paise": 2500,
        "nature": "operating", "voucher_status": "without_voucher",
        "voucher_no": "SHOULD-BE-DROPPED",
        "description": "voucher normalization test", "payment_type": "cash"}, headers=H(admin_t))
    check("expense created", r.status_code == 200 or r.status_code == 201, r.text[:150])
    exp_doc = r.json().get("expense") or {}
    check("voucher_no normalized to null for without_voucher",
          exp_doc.get("voucher_no") in (None, ""), str(exp_doc.get("voucher_no")))
    if exp_doc.get("id"):
        requests.post(f"{BASE}/expenses/{exp_doc['id']}/void",
                      json={"reason": "test cleanup"}, headers=H(admin_t))

    print("=== 17. Void requires reason; never hard delete ===")
    r = requests.post(f"{BASE}/bills", json={
        "bill_no": f"VOID-{uuid.uuid4().hex[:5].upper()}", "amount_paise": 5000,
        "payments": [{"type": "cash", "amount_paise": 5000}]}, headers=H(c1_t))
    bid = r.json()["bill"]["id"]
    r = requests.post(f"{BASE}/bills/{bid}/void", json={"reason": ""}, headers=H(c1_t))
    check("void without reason rejected", r.status_code == 400)
    r = requests.post(f"{BASE}/bills/{bid}/void", json={"reason": "Wrong entry"}, headers=H(c1_t))
    check("void with reason ok", r.status_code == 200)
    r = requests.get(f"{BASE}/bills", params={"store_id": main_id, "business_date": today,
                                              "include_void": True}, headers=H(admin_t)).json()["bills"]
    check("voided bill still stored", any(b["id"] == bid and b["status"] == "void" for b in r))
    own = requests.get(f"{BASE}/bills", params={"store_id": main_id, "business_date": today},
                       headers=H(c1_t)).json()["bills"]
    r = requests.post(f"{BASE}/bills/{own[0]['id']}/void", json={"reason": "x"}, headers=H(c2_t))
    check("cashier2 cannot void cashier1's bill", r.status_code == 403)

    print("=== 18. Audit log populated ===")
    logs = requests.get(f"{BASE}/audit-log", headers=H(admin_t)).json()["logs"]
    actions = {l["action"] for l in logs}
    check("audit has create/void/finalize/reopen", {"bill.create", "bill.void",
          "day.finalize", "day.reopen"}.issubset(actions), str(actions))

    print(f"\n===== RESULT: {len(PASS)} passed, {len(FAIL)} failed =====")
    if FAIL:
        print("FAILED:", FAIL)
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
