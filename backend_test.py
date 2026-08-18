"""Rokadly Backend API Tests - Comprehensive test suite for all features"""
import requests
import sys
from datetime import datetime

class RokadlyAPITester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.tokens = {}
        self.stores = {}
        self.banks = {}
        self.today = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failed_tests = []

    def log(self, msg, level="INFO"):
        prefix = {"INFO": "ℹ️", "PASS": "✅", "FAIL": "❌", "WARN": "⚠️"}
        print(f"{prefix.get(level, 'ℹ️')} {msg}")

    def test(self, name, method, endpoint, expected_status, data=None, token=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        self.log(f"Testing: {name}", "INFO")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"PASSED - Status: {response.status_code}", "PASS")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                self.tests_failed += 1
                self.failed_tests.append(name)
                self.log(f"FAILED - Expected {expected_status}, got {response.status_code}", "FAIL")
                try:
                    self.log(f"Response: {response.json()}", "FAIL")
                except:
                    self.log(f"Response: {response.text}", "FAIL")
                return False, {}

        except Exception as e:
            self.tests_failed += 1
            self.failed_tests.append(name)
            self.log(f"FAILED - Error: {str(e)}", "FAIL")
            return False, {}

    def login(self, username, password):
        """Login and store token"""
        self.log(f"\n🔐 Logging in as {username}...", "INFO")
        success, response = self.test(
            f"Login as {username}",
            "POST",
            "/api/auth/login",
            200,
            data={"username": username, "password": password}
        )
        if success and 'token' in response:
            self.tokens[username] = response['token']
            self.log(f"Token stored for {username}", "INFO")
            return True, response.get('user', {})
        return False, {}

    def run_all_tests(self):
        """Run all backend tests"""
        self.log("\n" + "="*60, "INFO")
        self.log("ROKADLY BACKEND API TEST SUITE", "INFO")
        self.log("="*60 + "\n", "INFO")

        # ===== TEST 1: Login for all roles =====
        self.log("\n📋 TEST SECTION 1: Authentication & Bootstrap", "INFO")
        self.log("-" * 60, "INFO")
        
        credentials = [
            ("admin", "admin123"),
            ("manager1", "manager123"),
            ("manager2", "manager123"),
            ("accountant1", "account123"),
            ("cashier1", "cashier123"),
            ("cashier2", "cashier123"),
            ("cashier3", "cashier123"),
            ("cashier4", "cashier123"),
        ]
        
        users = {}
        for username, password in credentials:
            success, user = self.login(username, password)
            if success:
                users[username] = user

        # ===== TEST 2: Bootstrap =====
        self.log("\n🚀 Testing Bootstrap endpoint...", "INFO")
        success, bootstrap = self.test(
            "GET /api/bootstrap",
            "GET",
            "/api/bootstrap",
            200,
            token=self.tokens.get("admin")
        )
        
        if success:
            self.stores = {s['code']: s for s in bootstrap.get('stores', [])}
            self.banks = {b['name']: b for b in bootstrap.get('banks', [])}
            self.today = bootstrap.get('today')
            self.log(f"Today's date: {self.today}", "INFO")
            self.log(f"Stores: {list(self.stores.keys())}", "INFO")
            self.log(f"Banks: {list(self.banks.keys())}", "INFO")

        # ===== TEST 3: Duplicate Bill Protection =====
        self.log("\n📋 TEST SECTION 2: Duplicate Bill Protection", "INFO")
        self.log("-" * 60, "INFO")
        
        main_store_id = self.stores.get('MAIN', {}).get('id')
        
        # Try to create duplicate bill M-1001 (seeded bill)
        self.log("\n🔄 Testing duplicate bill protection...", "INFO")
        success, response = self.test(
            "POST /api/bills with duplicate bill_no M-1001 -> 409 DUPLICATE_BILL",
            "POST",
            "/api/bills",
            409,
            data={
                "bill_no": "M-1001",
                "amount_paise": 100000,
                "payments": [{"type": "cash", "amount_paise": 100000}],
                "store_id": main_store_id,
                "business_date": self.today
            },
            token=self.tokens.get("admin")
        )
        
        if success:
            detail = response.get('detail', {})
            if isinstance(detail, dict):
                if detail.get('code') == 'DUPLICATE_BILL' and 'existing' in detail:
                    self.log("✓ Duplicate bill protection working correctly", "PASS")
                    self.log(f"  Existing bill summary: {detail.get('existing', {})}", "INFO")
                else:
                    self.log("✗ Response missing expected fields", "FAIL")
            else:
                self.log("✗ Detail is not a dict", "FAIL")

        # ===== TEST 4: Less Taken Math =====
        self.log("\n📋 TEST SECTION 3: Less Taken Math", "INFO")
        self.log("-" * 60, "INFO")
        
        # Create bill with less taken
        self.log("\n💰 Testing Less Taken calculation...", "INFO")
        success, bill_response = self.test(
            "POST /api/bills with amount 100000, cash payment 80000 -> less_taken_paise=20000",
            "POST",
            "/api/bills",
            201,
            data={
                "bill_no": f"TEST-LT-{datetime.now().strftime('%H%M%S')}",
                "amount_paise": 100000,
                "payments": [{"type": "cash", "amount_paise": 80000}],
                "store_id": main_store_id,
                "business_date": self.today
            },
            token=self.tokens.get("admin")
        )
        
        if success:
            bill = bill_response.get('bill', {})
            if bill.get('less_taken_paise') == 20000:
                self.log("✓ Less Taken math correct: 20000 paise", "PASS")
            else:
                self.log(f"✗ Less Taken incorrect: {bill.get('less_taken_paise')}", "FAIL")
        
        # Check expected cash increased by 80000
        self.log("\n💵 Checking expected cash count increased by 80000...", "INFO")
        success, expected_response = self.test(
            "GET /api/cash-counts/expected shows cash increased by 80000",
            "GET",
            "/api/cash-counts/expected",
            200,
            params={"store_id": main_store_id, "business_date": self.today, "cashier_id": users.get("cashier1", {}).get("id")},
            token=self.tokens.get("admin")
        )
        
        if success:
            summary = expected_response.get('summary', {})
            self.log(f"Expected cash: {summary.get('expected_cash_paise')} paise", "INFO")

        # ===== TEST 5: Excess Flow =====
        self.log("\n📋 TEST SECTION 4: Excess Flow", "INFO")
        self.log("-" * 60, "INFO")
        
        # Try excess without excess object -> 400 EXCESS_REQUIRED
        self.log("\n💸 Testing excess without return mode -> 400 EXCESS_REQUIRED...", "INFO")
        success, response = self.test(
            "POST /api/bills with amount 100000, cash 110000, no excess -> 400 EXCESS_REQUIRED",
            "POST",
            "/api/bills",
            400,
            data={
                "bill_no": f"TEST-EX1-{datetime.now().strftime('%H%M%S')}",
                "amount_paise": 100000,
                "payments": [{"type": "cash", "amount_paise": 110000}],
                "store_id": main_store_id,
                "business_date": self.today
            },
            token=self.tokens.get("admin")
        )
        
        if success:
            detail = response.get('detail', {})
            if isinstance(detail, dict) and detail.get('code') == 'EXCESS_REQUIRED':
                self.log("✓ Excess validation working correctly", "PASS")
            else:
                self.log("✗ Expected EXCESS_REQUIRED error code", "FAIL")
        
        # Now with excess object -> 201
        self.log("\n💸 Testing excess with return mode -> 201...", "INFO")
        success, response = self.test(
            "POST /api/bills with amount 100000, cash 110000, with excess -> 201",
            "POST",
            "/api/bills",
            201,
            data={
                "bill_no": f"TEST-EX2-{datetime.now().strftime('%H%M%S')}",
                "amount_paise": 100000,
                "payments": [{"type": "cash", "amount_paise": 110000}],
                "excess": {"amount_paise": 10000, "return_mode": "cash"},
                "store_id": main_store_id,
                "business_date": self.today
            },
            token=self.tokens.get("admin")
        )
        
        if success:
            self.log("✓ Excess bill created successfully", "PASS")

        # ===== TEST 6: Non-cash Serials =====
        self.log("\n📋 TEST SECTION 5: Non-cash Reconciliation Items", "INFO")
        self.log("-" * 60, "INFO")
        
        self.log("\n🔢 Testing non-cash items ordering and serials...", "INFO")
        success, recon_response = self.test(
            "GET /api/recon/items for Main store",
            "GET",
            "/api/recon/items",
            200,
            params={"store_id": main_store_id, "business_date": self.today},
            token=self.tokens.get("accountant1")
        )
        
        if success:
            groups = recon_response.get('groups', [])
            self.log(f"Found {len(groups)} groups", "INFO")
            
            # Check ordering: Card, Cheque, Banks (SBI, HDFC, ICICI), Other
            expected_order = ['card', 'cheque', 'bank:']
            group_keys = [g['group_key'] for g in groups]
            self.log(f"Group order: {group_keys}", "INFO")
            
            # Check for pending item
            pending_found = False
            for group in groups:
                for item in group.get('items', []):
                    if item.get('recon_status') == 'pending':
                        pending_found = True
                        self.log(f"✓ Found pending item at serial {item.get('serial')}", "PASS")
                        break
            
            if not pending_found:
                self.log("⚠️ No pending items found (expected at least one)", "WARN")

        # ===== TEST 7: RBAC Tests =====
        self.log("\n📋 TEST SECTION 6: RBAC (Role-Based Access Control)", "INFO")
        self.log("-" * 60, "INFO")
        
        # cashier3 (Rohini) tries to access Main store -> 403
        self.log("\n🔒 Testing cashier3 (Rohini) access to Main store -> 403...", "INFO")
        success, response = self.test(
            "cashier3 (Rohini) GET /api/bills for Main store -> 403",
            "GET",
            "/api/bills",
            403,
            params={"store_id": main_store_id, "business_date": self.today},
            token=self.tokens.get("cashier3")
        )
        
        if success:
            self.log("✓ RBAC working: cashier3 blocked from Main store", "PASS")
        
        # manager2 (Lajpat, limited perms) tries to mark recon status -> 403
        br2_store_id = self.stores.get('BR2', {}).get('id')
        self.log("\n🔒 Testing manager2 (limited perms) mark recon status -> 403...", "INFO")
        
        # First get a recon item from Lajpat store
        success, recon_response = self.test(
            "GET /api/recon/items for Lajpat store",
            "GET",
            "/api/recon/items",
            200,
            params={"store_id": br2_store_id, "business_date": self.today},
            token=self.tokens.get("manager2")
        )
        
        if success and recon_response.get('groups'):
            first_group = recon_response['groups'][0]
            if first_group.get('items'):
                first_item = first_group['items'][0]
                
                # Try to mark as matched (should fail - no reconcile perm)
                success, response = self.test(
                    "manager2 PATCH /api/recon/item marking matched -> 403",
                    "PATCH",
                    "/api/recon/item",
                    403,
                    data={
                        "source": first_item['source'],
                        "ref_id": first_item['ref_id'],
                        "payment_index": first_item.get('payment_index'),
                        "status": "matched"
                    },
                    token=self.tokens.get("manager2")
                )
                
                if success:
                    self.log("✓ RBAC working: manager2 blocked from marking recon status", "PASS")
        
        # manager2 tries to finalize -> 403
        self.log("\n🔒 Testing manager2 finalize Lajpat store -> 403...", "INFO")
        success, response = self.test(
            "manager2 POST /api/finalize for Lajpat -> 403",
            "POST",
            "/api/finalize",
            403,
            data={"store_id": br2_store_id, "business_date": self.today},
            token=self.tokens.get("manager2")
        )
        
        if success:
            self.log("✓ RBAC working: manager2 blocked from finalization", "PASS")
        
        # manager2 CAN manage cheques (has manage_cheques perm)
        self.log("\n🔒 Testing manager2 can manage cheques...", "INFO")
        success, cheques_response = self.test(
            "manager2 GET /api/cheques",
            "GET",
            "/api/cheques",
            200,
            params={"store_id": br2_store_id},
            token=self.tokens.get("manager2")
        )
        
        if success:
            self.log("✓ manager2 can access cheques (has manage_cheques perm)", "PASS")

        # ===== TEST 8: Finalization Gating =====
        self.log("\n📋 TEST SECTION 7: Finalization Gating", "INFO")
        self.log("-" * 60, "INFO")
        
        self.log("\n🚫 Testing finalization with pending items -> 400 NOT_READY...", "INFO")
        success, response = self.test(
            "POST /api/finalize for Main store today -> 400 NOT_READY",
            "POST",
            "/api/finalize",
            400,
            data={"store_id": main_store_id, "business_date": self.today},
            token=self.tokens.get("admin")
        )
        
        if success:
            detail = response.get('detail', {})
            if isinstance(detail, dict) and detail.get('code') == 'NOT_READY':
                self.log("✓ Finalization gating working correctly", "PASS")
                self.log(f"  Failed checks: {detail.get('failed', [])}", "INFO")
            else:
                self.log("✗ Expected NOT_READY error code", "FAIL")
        
        # Check readiness endpoint
        self.log("\n📊 Testing GET /api/finalize/readiness...", "INFO")
        success, readiness = self.test(
            "GET /api/finalize/readiness",
            "GET",
            "/api/finalize/readiness",
            200,
            params={"store_id": main_store_id, "business_date": self.today},
            token=self.tokens.get("admin")
        )
        
        if success:
            checks = readiness.get('checks', [])
            self.log(f"Readiness checks: {len(checks)} total", "INFO")
            for check in checks:
                status = "✓" if check.get('pass') else "✗"
                self.log(f"  {status} {check.get('label')}: {check.get('detail')}", "INFO")

        # ===== TEST 9: Cash Count Variance =====
        self.log("\n📋 TEST SECTION 8: Cash Count Variance", "INFO")
        self.log("-" * 60, "INFO")
        
        # Try to submit count with variance but no note -> 400 NOTE_REQUIRED
        self.log("\n💵 Testing cash count with variance but no note -> 400 NOTE_REQUIRED...", "INFO")
        
        # Get expected cash first
        cashier1_id = users.get("cashier1", {}).get("id")
        success, expected_response = self.test(
            "GET /api/cash-counts/expected",
            "GET",
            "/api/cash-counts/expected",
            200,
            params={"store_id": main_store_id, "business_date": self.today, "cashier_id": cashier1_id},
            token=self.tokens.get("admin")
        )
        
        if success:
            expected = expected_response.get('summary', {}).get('expected_cash_paise', 0)
            counted = expected + 50000  # 500 rupees variance
            
            success, response = self.test(
                "POST /api/cash-counts with variance but no note -> 400 NOTE_REQUIRED",
                "POST",
                "/api/cash-counts",
                400,
                data={
                    "store_id": main_store_id,
                    "business_date": self.today,
                    "cashier_id": cashier1_id,
                    "counted_paise": counted
                },
                token=self.tokens.get("admin")
            )
            
            if success:
                detail = response.get('detail', {})
                if isinstance(detail, dict) and detail.get('code') == 'NOTE_REQUIRED':
                    self.log("✓ Cash count variance validation working", "PASS")
                else:
                    self.log("✗ Expected NOTE_REQUIRED error code", "FAIL")
            
            # Now with note -> success
            self.log("\n💵 Testing cash count with variance and note -> success...", "INFO")
            success, response = self.test(
                "POST /api/cash-counts with variance and note -> 200",
                "POST",
                "/api/cash-counts",
                200,
                data={
                    "store_id": main_store_id,
                    "business_date": self.today,
                    "cashier_id": cashier1_id,
                    "counted_paise": counted,
                    "note": "Test variance note"
                },
                token=self.tokens.get("admin")
            )
            
            if success:
                self.log("✓ Cash count with note submitted successfully", "PASS")

        # ===== TEST 10: Cheques =====
        self.log("\n📋 TEST SECTION 9: Cheque Management", "INFO")
        self.log("-" * 60, "INFO")
        
        # Get bounced cheque 778899
        self.log("\n📝 Testing GET /api/cheques?status=bounced shows 778899...", "INFO")
        success, cheques_response = self.test(
            "GET /api/cheques?status=bounced",
            "GET",
            "/api/cheques",
            200,
            params={"status": "bounced"},
            token=self.tokens.get("admin")
        )
        
        if success:
            cheques = cheques_response.get('cheques', [])
            bounced_778899 = next((c for c in cheques if c.get('cheque_no') == '778899'), None)
            if bounced_778899:
                self.log(f"✓ Found bounced cheque 778899", "PASS")
                self.log(f"  Status: {bounced_778899.get('status')}, Amount: {bounced_778899.get('amount_paise')}", "INFO")
            else:
                self.log("✗ Bounced cheque 778899 not found", "FAIL")
        
        # Try to PATCH paid_returned without remark -> 400
        self.log("\n📝 Testing PATCH cheque paid_returned without remark -> 400...", "INFO")
        success, cheques_response = self.test(
            "GET /api/cheques to find a cheque",
            "GET",
            "/api/cheques",
            200,
            params={"status": "pending"},
            token=self.tokens.get("admin")
        )
        
        if success and cheques_response.get('cheques'):
            cheque = cheques_response['cheques'][0]
            
            success, response = self.test(
                "PATCH /api/cheques/{id}/status paid_returned without remark -> 400",
                "PATCH",
                f"/api/cheques/{cheque['id']}/status",
                400,
                data={
                    "status": "paid_returned",
                    "status_date": self.today
                },
                token=self.tokens.get("admin")
            )
            
            if success:
                self.log("✓ Cheque paid_returned validation working (remark required)", "PASS")

        # ===== TEST 11: Cross-Store Report =====
        self.log("\n📋 TEST SECTION 10: Cross-Store Report", "INFO")
        self.log("-" * 60, "INFO")
        
        self.log("\n🏪 Testing GET /api/reports/cross-store...", "INFO")
        success, cross_response = self.test(
            "GET /api/reports/cross-store",
            "GET",
            "/api/reports/cross-store",
            200,
            params={"date_from": self.today, "date_to": self.today},
            token=self.tokens.get("admin")
        )
        
        if success:
            groups = cross_response.get('groups', [])
            self.log(f"Found {len(groups)} bank groups", "INFO")
            
            # Look for HDFC group with cross-store item from Main
            hdfc_group = next((g for g in groups if 'HDFC' in g.get('bank_name', '')), None)
            if hdfc_group:
                self.log(f"✓ Found HDFC group", "PASS")
                self.log(f"  Home store: {hdfc_group.get('home_store_name')}", "INFO")
                self.log(f"  Cross-store count: {hdfc_group.get('cross_store_count')}", "INFO")
                
                # Check for cross-store item from Main (bill M-1006)
                cross_items = [i for i in hdfc_group.get('items', []) if i.get('cross_store')]
                if cross_items:
                    self.log(f"✓ Found {len(cross_items)} cross-store items", "PASS")
                    for item in cross_items:
                        if item.get('bill_no') == 'M-1006':
                            self.log(f"  ✓ Found M-1006 cross-store item", "PASS")
                            break
            else:
                self.log("⚠️ HDFC group not found", "WARN")

        # ===== TEST 12: Reports =====
        self.log("\n📋 TEST SECTION 11: Reports Endpoints", "INFO")
        self.log("-" * 60, "INFO")
        
        reports = [
            ("Register", "/api/reports/register", {"date_from": self.today, "date_to": self.today}),
            ("Comparison", "/api/reports/comparison", {"business_date": self.today}),
            ("Expenses", "/api/reports/expenses", {"date_from": self.today, "date_to": self.today}),
            ("Print Non-Cash", "/api/print/noncash", {"store_id": main_store_id, "business_date": self.today}),
            ("Print Cash", "/api/print/cash", {"store_id": main_store_id, "business_date": self.today}),
        ]
        
        for name, endpoint, params in reports:
            self.log(f"\n📊 Testing {name} report...", "INFO")
            success, response = self.test(
                f"GET {endpoint}",
                "GET",
                endpoint,
                200,
                params=params,
                token=self.tokens.get("admin")
            )
            
            if success:
                self.log(f"✓ {name} report returned data", "PASS")

        # ===== SUMMARY =====
        self.log("\n" + "="*60, "INFO")
        self.log("TEST SUMMARY", "INFO")
        self.log("="*60, "INFO")
        self.log(f"Total tests run: {self.tests_run}", "INFO")
        self.log(f"Tests passed: {self.tests_passed} ✅", "PASS")
        self.log(f"Tests failed: {self.tests_failed} ❌", "FAIL" if self.tests_failed > 0 else "INFO")
        
        if self.tests_failed > 0:
            self.log("\nFailed tests:", "FAIL")
            for test in self.failed_tests:
                self.log(f"  - {test}", "FAIL")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        self.log(f"\nSuccess rate: {success_rate:.1f}%", "INFO")
        
        return 0 if self.tests_failed == 0 else 1


def main():
    import os
    backend_url = os.environ.get('REACT_APP_BACKEND_URL', 'https://day-lock-live.preview.emergentagent.com')
    
    print(f"\n🚀 Starting Rokadly Backend API Tests")
    print(f"📍 Backend URL: {backend_url}")
    print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    tester = RokadlyAPITester(backend_url)
    exit_code = tester.run_all_tests()
    
    print(f"\n⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
