# Rokadly — plan.md (Updated)

## 1) Objectives
- Deliver a **production-quality V1** for daily Rokad (cash/payment reconciliation) with correct integer-paise math, strict server-enforced RBAC, full auditability, print/PDF outputs, and store-day finalization locking.
- Provide an end-to-end workflow covering: bill entry (split payments, Less Taken, Excess Returned), opening allocation, expenses/adjustments, cash count → discrepancy ledger, numbered non-cash reconciliation, account tally checklist, and finalization readiness gating.
- Ship with realistic seeded demo data + credentials for all roles and prove the 15 acceptance scenarios via automated tests.
- **Current status:** Phases 1 & 2 are complete, system is delivered and tested. Future work is optional enhancements (e.g., CSV statement upload and many-to-many matching UI).

## 2) Implementation Steps

### Phase 1 — Core POC (isolation, fix-until-works)
**Goal:** validate the hardest logic with minimal UI/API before building the full app.

✅ **Completed (implemented and verified)**
1. Built modular FastAPI + MongoDB backend with core invariants:
   - Money as **integer paise** everywhere.
   - Asia/Kolkata business date handling.
   - Atomic uniqueness for bills: unique index on `(store_id, business_date, bill_no_norm)` (active bills only).
   - Optimistic concurrency via `version` on editable docs.
   - Idempotent bill creation via `client_key`.
   - Append-only audit log capturing actor/timestamps/before-after/reason.
2. Implemented core domain routes/modules:
   - `core.py`: db, JWT auth, RBAC helpers, audit, expected-cash math, non-cash serial builder.
   - `routes_entry.py`: bills (Less Taken, Excess enforcement), drafts, adjustments, expenses, heads.
   - `routes_cash.py`: opening allocations (+history), admin opening adjustment, cash counts (+variance note), discrepancy ledger (+equal split/%/amount allocation), later-date settlements.
   - `routes_recon.py`: reconciliation items grouped + continuous serials, recon status enforcement, account tallies, finalization readiness checklist, finalize/reopen.
   - `routes_admin.py`: auth/bootstrap, users + manager permission matrix, stores, banks + reorder, bank requests, settings, audit log.
   - `routes_reports.py`: cashier today summary, store-day overview, register, comparison, cross-store receipts, expenses 3-section report, print data.
3. Added MongoDB indexes for integrity and performance, including:
   - Unique bill constraint `(store_id, business_date, bill_no_norm)` (partial for active).
   - Unique `client_key` via partial index (string-only) to support idempotency.
   - Store-day uniqueness `(store_id, business_date)`.
4. Wrote `test_core.py` exercising key acceptance scenarios including:
   - Concurrent duplicate-bill race (first-save-wins, loser gets 409 with existing summary).
   - Less Taken and Excess return correctness.
   - Serial ordering Card → Cheque → Banks(display order) → Other.
   - Cross-store bank receipt ownership.
   - RBAC and manager permission gating.
   - Finalize/lock/reopen cycle with audit.

✅ **Phase 1 result:** `test_core.py` passes **46/46**.

**Phase 1 user stories (done)**
1. Cashier can save bills and is prevented from duplicating bill number per store/date.
2. Duplicate race loser retains the draft and re-saves with only bill number changed.
3. Accountant gets a numbered non-cash list in exact print order.
4. Manager/Admin cannot finalize unless blockers cleared (checklist gating).
5. Admin sees cross-store receipts by receiving bank account without transferring ownership.

---

### Phase 2 — V1 App Development (full stack MVP around proven core)
**Goal:** working end-to-end app (React + FastAPI) with premium ledger design and print flows.

✅ **Completed**
1. **Design system + UI direction implemented** (per design_agent guidelines):
   - Ruby/emerald/graphite/brass palette.
   - Refined woven/fabric texture used only on shell (nav/login/headers).
   - Strong filled-red Pending rows; green verified/finalized cues.
   - Dense, compact tables for desktop; mobile-first forms; ≤8px radius.
   - Indian number formatting (₹, en-IN grouping), IST date conventions.
2. **Full React frontend shipped** with shadcn/ui + Tailwind:
   - `/login` with demo quick-login buttons.
   - Role dashboards:
     - Cashier: today totals + expected vs counted + variance.
     - Accountant: work queue by store/date.
     - Manager/Admin: store overview + readiness + FinalizePanel.
   - Bills workspace:
     - Multiple draft tabs (localStorage + server drafts), duplicate pre-check + conflict banner preserving values,
     - Payment rows for Cash/Card/Cheque/Bank/Other,
     - Auto Less Taken and Excess sections,
     - Phone input with country code not in tab sequence.
   - Opening allocation (real-time allocated/unallocated).
   - Cash count (expected breakdown, variance preview, note enforcement).
   - Expenses (entry, review/finalize, report in 3 sections).
   - Adjustments (other receipts/deductions) + heads.
   - Reconciliation (grouped serial list, filled-red pending rows, pending-only filter, tally checkbox, mark status dropdown).
   - Cheque ledger (filters + status rules).
   - Discrepancy ledger (allocate/equal-split/settle dialogs).
   - Daily Rokad Register (green verified tick, CSV export).
   - Admin: Comparison, Cross-store receipts, Banks + requests resolve, Users + permission matrix, Heads, Audit log.
   - Print pages: `/print/noncash`, `/print/cash` with A4 print CSS.
3. **Seed data** created for demo realism:
   - Main + 2 branches, multiple cashiers, accountant, managers with differing permission sets, admin.
   - SBI/HDFC/ICICI banks with display order.
   - Cross-store receipt (Main sale received into Rohini’s HDFC).
   - Less Taken and Excess examples.
   - Expenses across all three reporting sections.
   - Cheques pending/passed/bounced/paid-returned.
   - Pending bank recon item blocking finalization.
   - Shortage/excess discrepancies including shared split and later settlement.

✅ **Phase 2 result:** End-to-end UI is complete and operational with print workflows.

**Phase 2 user stories (done)**
1. Cashier enters bills quickly with split payments; Less Taken/Excess computed correctly.
2. Cashier maintains multiple drafts and switches without losing values.
3. Accountant prints numbered non-cash list and marks Pending items that block finalization.
4. Manager sees blockers and can only act within configured permissions.
5. Admin compares stores side-by-side and reviews cross-store receipts.

---

### Phase 3 — Add Auth + Locking + Reopen/Propagation (production-hardening)
**Goal:** harden auth/locking/reopen and operational controls.

✅ **Completed / already included in delivered V1**
1. Username/password + JWT auth with seeded demo credentials.
2. Finalization locking: all mutations blocked post-finalization except audited reopen.
3. Admin reopen with compulsory reason + audit trail; later store-days flagged `needs_revalidation`.
4. Cheque ledger with permissioned status changes; bounced stays report-only.
5. Discrepancy ledger with allocation + later-date settlements.

**Phase 3 user stories (done)**
1. Users log in and only see permitted stores/actions.
2. Post-finalization: cashier view-only, cannot modify.
3. Admin reopen is audited and visible.
4. Manager cheque management only if explicitly granted.
5. Accountant can track unresolved discrepancies and later settlements without rewriting history.

---

### Phase 4 — Reporting polish + PDF quality + operational controls
**Goal:** accountant-grade printouts/reports and complete admin controls.

✅ **Completed in delivered V1**
1. Print/PDF-ready pages:
   - Stable ordering, group totals, A4 print styles, headers.
2. Admin operational modules:
   - Bank requests approve/merge/reject.
   - Bank reorder controls (serial order follows display order).
   - Head management (activate/deactivate) without breaking history.
3. Account-centric cross-store receipts report.
4. Basic exports (Register CSV) + Indian number formatting throughout.

**Phase 4 user stories (done)**
1. Accountant prints lists matching on-screen order with totals.
2. Admin can merge/approve bank names without breaking history.
3. Admin can deactivate heads safely.
4. Manager finalizes branch days using readiness checklist.
5. Owner reviews month-to-date register with Indian formats.

---

## 3) Next Actions
1. **Maintenance/cleanup:** keep seed script authoritative (`python /app/backend/seed.py`) and reseed before demos.
2. **Enhancement Phase (future, optional):**
   - CSV/XLSX bank statement upload.
   - Many-to-many matching UI (one statement row ↔ multiple receipts and vice versa).
   - Match suggestions and exception workflows at statement-line granularity.
   - Expense attachment uploads.
   - Deeper drill-down from Comparison metrics into underlying bills/expenses/recon items.
3. **Operational readiness:** add pagination for very large registers, background exports, and performance tuning if needed.

## 4) Success Criteria
✅ **Achieved**
- Phase 1: POC script passes consistently (46/46), including duplicate race, serial ordering, cash math, finalization gating, cross-store receipts.
- Phase 2: Full app supports cashier → accountant → manager/admin → finalize loop with locking + print views.
- Phase 3/4: JWT + RBAC enforced; finalize/reopen audited; manager permission matrix enforced; discrepancies and cheques functional.
- Testing: `testing_agent_v3` reported backend **34/34** and frontend **47/48** with the single issue verified as a false positive.
- All 15 acceptance scenarios are covered via seed + automation, with mobile/tablet/desktop usability and Indian formatting.
