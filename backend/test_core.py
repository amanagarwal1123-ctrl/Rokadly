"""Rokadly Phase-1 POC test: core business logic via API.
Run: python test_core.py  (requires seeded db + running server)
"""
import sys
import uuid
import requests
from concurrent.futures import ThreadPoolExecutor

BASE = "http://localhost:8001/api"
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
    banks = {b["name"]: b for b in boot["banks"]}
    main_id = stores["MAIN"]["id"]
    br1_id = stores["BR1"]["id"]
    br2_id = stores["BR2"]["id"]

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
    # loser re-saves with new number, keeping every field
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

    print("=== 6. Non-cash serials: Card -> Cheque -> SBI -> HDFC -> ICICI -> Other ===")
    r = requests.get(f"{BASE}/recon/items",
                     params={"store_id": main_id, "business_date": today},
                     headers=H(acc_t)).json()
    labels = [g["group_label"] for g in r["groups"]]
    order_ref = ["Card", "Cheque", "SBI", "HDFC", "ICICI", "Other"]
    positions = [order_ref.index(l) for l in labels if l in order_ref]
    check("groups in configured order", positions == sorted(positions), str(labels))
    serials = [it["serial"] for g in r["groups"] for it in g["items"]]
    check("serials continuous 1..N", serials == list(range(1, len(serials) + 1)), str(serials))

    print("=== 7. Cross-store: Main bill in Rohini's HDFC keeps Main ownership ===")
    r = requests.get(f"{BASE}/reports/cross-store",
                     params={"date_from": today, "date_to": today}, headers=H(admin_t)).json()
    hdfc = next((g for g in r["groups"] if g["bank_name"] == "HDFC"), None)
    check("HDFC group exists with home store Rohini", hdfc and hdfc["home_store_name"] == "Rohini Branch",
          str(hdfc)[:150] if hdfc else "missing")
    cross = [i for i in (hdfc["items"] if hdfc else []) if i.get("cross_store")]
    check("cross-store item flagged (Main bill in HDFC)",
          any(i["selling_store_name"] == "Main Jewellers" for i in cross), str(cross)[:200])
    mb = requests.get(f"{BASE}/bills", params={"store_id": main_id, "business_date": today},
                      headers=H(admin_t)).json()["bills"]
    check("bill M-1006 owned by Main store", any(b["bill_no"] == "M-1006" for b in mb))

    print("=== 8. RBAC boundaries ===")
    r = requests.get(f"{BASE}/bills", params={"store_id": main_id, "business_date": today},
                     headers=H(c3_t))
    check("cashier3 (BR1) blocked from Main bills", r.status_code == 403)
    r = requests.get(f"{BASE}/bills", params={"store_id": main_id, "business_date": today},
                     headers=H(c1_t)).json()["bills"]
    check("cashier1 sees only own bills", all(b["cashier_id"] == c1_u["id"] for b in r))
    # manager2 has view_recon on BR2 but not reconcile
    items = requests.get(f"{BASE}/recon/items",
                         params={"store_id": br2_id, "business_date": today},
                         headers=H(m2_t)).json()
    check("manager2 can view BR2 recon", "groups" in items)
    first = items["groups"][0]["items"][0]
    r = requests.patch(f"{BASE}/recon/item", json={
        "source": first["source"], "ref_id": first["ref_id"],
        "payment_index": first["payment_index"], "status": "matched"}, headers=H(m2_t))
    check("manager2 cannot mark matched (perm off)", r.status_code == 403, r.text[:150])
    r = requests.get(f"{BASE}/recon/items",
                     params={"store_id": br1_id, "business_date": today}, headers=H(m2_t))
    check("manager2 blocked from BR1 entirely", r.status_code == 403)
    r = requests.post(f"{BASE}/finalize", json={"store_id": br2_id, "business_date": today},
                      headers=H(m2_t))
    check("manager2 cannot finalize BR2 (perm off)", r.status_code == 403, r.text[:150])

    print("=== 9. Zero allocation valid + unallocated math ===")
    c4_t, c4_u = login("cashier4", "cashier123")
    r = requests.put(f"{BASE}/allocations", json={
        "store_id": br2_id, "business_date": today, "amount_paise": 0}, headers=H(c4_t))
    check("zero allocation accepted", r.status_code == 200, r.text[:150])
    s = r.json()
    check("unallocated equals full opening", s["unallocated_paise"] == s["effective_opening_paise"],
          str({k: s[k] for k in ('unallocated_paise', 'effective_opening_paise')}))
    requests.put(f"{BASE}/allocations", json={
        "store_id": br2_id, "business_date": today,
        "amount_paise": s["effective_opening_paise"]}, headers=H(c4_t))

    print("=== 10. Cash count variance requires note + creates discrepancy ===")
    exp = requests.get(f"{BASE}/cash-counts/expected",
                       params={"store_id": br2_id, "business_date": today},
                       headers=H(c4_t)).json()["summary"]["expected_cash_paise"]
    r = requests.post(f"{BASE}/cash-counts", json={
        "store_id": br2_id, "business_date": today, "counted_paise": exp - 50000},
        headers=H(c4_t))
    check("variance without note rejected", r.status_code == 400
          and r.json()["detail"].get("code") == "NOTE_REQUIRED", r.text[:150])
    r = requests.post(f"{BASE}/cash-counts", json={
        "store_id": br2_id, "business_date": today, "counted_paise": exp - 50000,
        "note": "Rs 500 short at closing"}, headers=H(c4_t))
    check("count with note accepted, variance -50000", r.status_code == 200
          and r.json()["variance_paise"] == -50000, r.text[:200])
    d = requests.get(f"{BASE}/discrepancies",
                     params={"store_id": br2_id, "business_date": today},
                     headers=H(admin_t)).json()["discrepancies"]
    check("discrepancy auto-created", any(x["amount_paise"] == 50000 and x["type"] == "shortage" for x in d))

    print("=== 11. Shared discrepancy 50/50 + later settlement links back ===")
    d = requests.get(f"{BASE}/discrepancies", params={"store_id": main_id},
                     headers=H(admin_t)).json()["discrepancies"]
    shared = next((x for x in d if len(x["allocations"]) == 2), None)
    check("shared discrepancy split between two cashiers",
          shared is not None and shared["allocations"][0]["amount_paise"] == 50000)
    check("later settlement recorded on today with link",
          shared and shared["settlements"] and shared["settlements"][0]["date"] == today
          and shared["status"] == "partially_adjusted")

    print("=== 12. Finalization gating: Main blocked by pending recon ===")
    r = requests.get(f"{BASE}/finalize/readiness",
                     params={"store_id": main_id, "business_date": today},
                     headers=H(admin_t)).json()
    recon_check = next(c for c in r["checks"] if c["key"] == "recon_complete")
    check("recon check failing (pending exists)", recon_check["pass"] is False)
    r = requests.post(f"{BASE}/finalize", json={"store_id": main_id, "business_date": today},
                      headers=H(admin_t))
    check("finalize blocked with NOT_READY", r.status_code == 400
          and r.json()["detail"].get("code") == "NOT_READY", r.text[:200])

    print("=== 13. Full finalize flow on BR1 by manager1, then lock + reopen ===")
    items = requests.get(f"{BASE}/recon/items",
                         params={"store_id": br1_id, "business_date": today},
                         headers=H(acc_t)).json()
    for g in items["groups"]:
        for it in g["items"]:
            if it["recon_status"] in ("unreviewed", "pending"):
                rr = requests.patch(f"{BASE}/recon/item", json={
                    "source": it["source"], "ref_id": it["ref_id"],
                    "payment_index": it["payment_index"], "status": "cleared",
                    "note": "POC clear"}, headers=H(acc_t))
                assert rr.status_code == 200, rr.text
        rr = requests.post(f"{BASE}/recon/tally", json={
            "store_id": br1_id, "business_date": today,
            "group_key": g["group_key"], "tallied": True}, headers=H(m1_t))
        check(f"manager1 tallies {g['group_label']}", rr.status_code == 200, rr.text[:150])
    r = requests.post(f"{BASE}/finalize", json={"store_id": br1_id, "business_date": today,
                                                "note": "POC finalize"}, headers=H(m1_t))
    check("manager1 finalizes BR1", r.status_code == 200, r.text[:300])
    closing = r.json().get("closing_actual_paise")
    # locked now
    r = requests.post(f"{BASE}/bills", json={
        "bill_no": "LOCKED-1", "amount_paise": 1000,
        "payments": [{"type": "cash", "amount_paise": 1000}]}, headers=H(c3_t))
    check("cashier3 blocked after finalize (423)", r.status_code == 423, f"{r.status_code}")
    # register shows finalized with green tick data
    reg = requests.get(f"{BASE}/reports/register",
                       params={"date_from": today, "date_to": today, "store_id": br1_id},
                       headers=H(admin_t)).json()["rows"]
    check("register row finalized w/ closing carried", reg and reg[0]["status"] == "finalized"
          and reg[0]["actual_cash_paise"] == closing, str(reg)[:200])
    # reopen requires reason
    r = requests.post(f"{BASE}/finalize/reopen", json={
        "store_id": br1_id, "business_date": today, "reason": ""}, headers=H(admin_t))
    check("reopen without reason rejected", r.status_code == 400)
    r = requests.post(f"{BASE}/finalize/reopen", json={
        "store_id": br1_id, "business_date": today, "reason": "POC reopen test"},
        headers=H(admin_t))
    check("admin reopen with reason works", r.status_code == 200, r.text[:150])

    print("=== 14. Cheques: auto-created, bounced is report-only ===")
    ch = requests.get(f"{BASE}/cheques", params={"status": "bounced"}, headers=H(admin_t)).json()["cheques"]
    check("bounced cheque in ledger", any(c["cheque_no"] == "778899" for c in ch))
    bills = requests.get(f"{BASE}/bills", params={"store_id": br2_id, "business_date": today},
                         headers=H(admin_t)).json()["bills"]
    b = next(x for x in bills if x["bill_no"] == "L-3001")
    check("bounced cheque bill unchanged (report-only)", b["status"] == "active"
          and b["amount_paise"] == 1100000)
    # manager2 (manage_cheques=True) can pass a cheque in BR2
    pend = requests.get(f"{BASE}/cheques", params={"status": "pending", "store_id": br2_id},
                        headers=H(m2_t)).json()["cheques"]
    if pend:
        r = requests.patch(f"{BASE}/cheques/{pend[0]['id']}/status", json={
            "status": "passed", "status_date": today}, headers=H(m2_t))
        check("manager2 manages cheque status (perm on)", r.status_code == 200, r.text[:150])
    # paid_returned requires remark
    ch_all = requests.get(f"{BASE}/cheques", params={"store_id": main_id}, headers=H(admin_t)).json()["cheques"]
    target = next((c for c in ch_all if c["status"] == "pending"), None)
    if target:
        r = requests.patch(f"{BASE}/cheques/{target['id']}/status", json={
            "status": "paid_returned", "status_date": today}, headers=H(admin_t))
        check("paid_returned without remark rejected", r.status_code == 400)

    print("=== 15. Void requires reason; never hard delete ===")
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
    # cashier2 cannot void cashier1's bill
    own = requests.get(f"{BASE}/bills", params={"store_id": main_id, "business_date": today},
                       headers=H(c1_t)).json()["bills"]
    r = requests.post(f"{BASE}/bills/{own[0]['id']}/void", json={"reason": "x"}, headers=H(c2_t))
    check("cashier2 cannot void cashier1's bill", r.status_code == 403)

    print("=== 16. Audit log populated ===")
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
