# Rokadly — plan.md (Updated)

## 1) Objectives
- Deliver a **production-quality V1** for daily Rokad (cash/payment reconciliation) with correct integer-paise math, strict server-enforced RBAC, full auditability, print/PDF outputs, and store-day finalization locking.
- Provide an end-to-end workflow covering: bill entry (split payments, Less Taken, Excess Returned), opening allocation, expenses/adjustments, cash count → discrepancy ledger, numbered non-cash reconciliation, account tally checklist, non-cash reconciliation, and finalization readiness gating.
- Ship with realistic seeded demo data + credentials for all roles and prove acceptance scenarios via automated tests.
- **Non-negotiable:** preserve existing DB model, seeded demo accounts, RBAC rules, calculations, audit history, and all proven workflows. This is a correction pass—**not a rewrite**.

**Current status:**
- ✅ Phases 1–5 complete (core system + Mughal jewel-tone theme).
- ✅ **Phase 6 (Correction Pass) complete and verified** (day-lock UI, store/date sync, error/retry, duplicate edit warnings, signed opening adjustments, accessibility/mobile/data-quality fixes, and test repairs).

---

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
3. Added MongoDB indexes for integrity and performance.
4. Wrote `test_core.py` acceptance-style coverage.

✅ **Phase 1 result:** backend harness is stable.

---

### Phase 2 — V1 App Development (full stack MVP around proven core)
**Goal:** working end-to-end app (React + FastAPI) with premium ledger UI and print flows.

✅ **Completed**
- Full React frontend shipped with shadcn/ui + Tailwind across all workflows.
- Seeded demo data + demo credentials.

---

### Phase 3 — Add Auth + Locking + Reopen/Propagation (production-hardening)
**Goal:** harden auth/locking/reopen and operational controls.

✅ **Completed / included in delivered V1**
- JWT auth, strict RBAC, finalized-day lock, audited reopen, discrepancy later settlements, cheque lifecycle.

---

### Phase 4 — Reporting polish + PDF quality + operational controls
**Goal:** accountant-grade printouts/reports and complete admin controls.

✅ **Completed**
- Print/PDF flows, admin bank/head controls, register exports.

---

### Phase 5 — Mughal Jewel-Tone UI Redesign (Visual overhaul; NO logic changes)
**Goal:** single dark jewel-tone theme with Mughal ornamentation and no white surfaces.

✅ **Completed and verified**
- Dark jewel tokens + curved ornamentation + ornate login + parchment on-screen print preview.
- Frontend regression (visual) passed.

---

### Phase 6 — Correction Pass (user-reported issues; preserve all working behavior)
**Goal:** fix production correctness issues in UI behavior + data fetching + tests **without changing the accounting rules**.

✅ **Completed and verified (P0/P1/P2)**

#### Phase 6A (P0) — Finalized days must be visibly and completely read-only
✅ **Delivered**
1. **Shared day-lock source**
   - Added authorized endpoint `GET /api/store-day?store_id=&business_date=` returning store_day with status + finalized_by_name + finalized_at + closing_actual_paise.
   - Implemented `useStoreDayLock(storeId, businessDate)` backed by that endpoint.
2. **DayLockBanner**
   - Banner shows `Finalized and locked` with finalizer, timestamp, closing actual cash.
   - Explicitly states drafts remain preserved but cannot be submitted to a locked day.
3. **Pre-request UI locking**
   - Bills, Opening Cash, Cash Count, Expenses, Adjustments, Reconciliation now disable/hide mutation controls when locked (fieldsets disabled, buttons show “Day locked”).
4. **Do NOT freeze later-life workflows**
   - Cheque status updates and discrepancy settlements remain available (they operate on their own later dates/audit trails).
5. **Admin reopen UX correction**
   - Reopen confirm action is disabled until reason has non-whitespace content (server validation remains).
6. **Backend enforcement remains ultimate**
   - `ensure_day_open` remains the ultimate enforcement.
   - Added missing day-lock enforcement to the expense review endpoint.

#### Phase 6B (P0) — Store/Date filter synchronization + stale response race fixes
✅ **Delivered**
- Added `useAsyncData(fetchFn, deps)` with:
  - **sequence guard** to prevent late responses overwriting newer selections
  - **stale-data clearing** on dependency change
  - consistent `loading | error | empty | success` state handling
- Converted operational pages to use it for store/date driven requests.
- Print/export links now derive from the same committed store/date state.
- Verified live: date picker changes refetch all headings/tables/links and never shows stale financial data.

**Acceptance reference verified live** (Main Jewellers on 2026-08-11):
- Opening ₹50,000
- Cash In ₹49,700
- Non-Cash ₹68,500
- Cash Expenses ₹6,500
- Less Taken ₹200
- Refunds ₹500
- Expected ₹92,700
- Actual ₹92,400
- Variance shortage ₹300

#### Phase 6C (P0) — Replace infinite loading with recoverable error + Retry states
✅ **Delivered**
- Added `LoadErrorState`, `LoadingState`, `EmptyState` patterns.
- Operational pages now show concise error + `Retry` and never remain stuck on infinite `Loading...`.

#### Phase 6D (P1) — Remove false duplicate warning during bill editing
✅ **Delivered**
- Duplicate-warning state is draft-scoped (no page-global leakage).
- Backend duplicate-check now supports `exclude_bill_id`.
- Frontend uses `exclude_bill_id` when editing; editing never self-conflicts.

#### Phase 6E (P1) — Allow signed Admin opening adjustments
✅ **Delivered**
- `MoneyInput` gained `allowNegative` (used only for admin opening adjustment).
- Signed preview of effective opening added.
- Backend now rejects:
  - zero adjustment
  - any adjustment that makes effective opening negative

#### Phase 6F (P2) — Data-quality + accessibility fixes
✅ **Delivered**
1. Expense voucher consistency:
   - Voucher No visible only when `With Voucher`.
   - Switching to `Without Voucher` clears voucher_no; backend normalizes it to `null`.
2. Icon-only controls:
   - Added `aria-label` + `title` tooltips to key icon-only buttons (logout/menu/close draft/edit/void/add-head, etc.).
   - Preserved all existing `data-testid` attributes.
3. Settlement wording:
   - Bills panel label updated to **“Money received”** (calculations unchanged).

#### Phase 6G — Mobile-first corrections
✅ **Delivered and verified**
- Bills: Customer name and Phone stack under 480px; phone input takes full remaining width.
- Reconciliation: sticky Action column on narrow screens so amount/status/action remain reachable.
- Verified at 360×800 and 390×844.

#### Phase 6H — Visual refinements (not a redesign)
✅ **Delivered**
- Ruby reserved for pending/shortage/bounced/conflict/destructive/negative.
- Routine primary actions (Save/Submit/Sign in) use sapphire primary.
- Slight contrast bump for muted text + borders.
- Reduced body background pattern/lighting behind dense operational surfaces while keeping login/nav richer.
- Maintained ≤8px radius.

#### Phase 6I — Repair and expand automated tests
✅ **Delivered**
- `backend/test_core.py` rewritten to:
  - be seed-date aware (`SEED_DATE=2026-08-11`)
  - never assume historical seed bills exist on `today`
  - create isolated fixtures dynamically
  - finalize flow rerunnable (reopen if needed, overwrite allocations/counts)
  - add new coverage for: exclude self duplicate-check, signed adjustments, 423 enforcement breadth, reopen validation, voucher normalization, discrepancy reopening on resubmission variance
- Results: **68/68 passed twice** (rerunnable).
- Frontend testing agent report: **11/11 scenarios passed** (`/app/test_reports/iteration_3.json`).

**Notes / known limitation:**
- The backend test suite intentionally creates a small BR1 bill as part of its finalize/lock/reopen flow; it is void-cleaned where easy. No migrations were needed.

---

## 3) Next Actions
1. **No further P0 work outstanding.**
2. Optional polish (post-V1):
   - Bank statement upload + match suggestions (P1+).
   - More comprehensive Playwright visual-regression snapshots per role.
   - Fine-grained skeleton loaders per table section.

---

## 4) Success Criteria
✅ **Achieved (Phases 1–6)**
- Core system correctness: money math, RBAC, auditability, locking/finalization, print outputs.
- Mughal jewel-tone visual identity delivered.
- Finalized days are fully read-only in UI (pre-request) with accurate lock banner.
- Store/date selection is authoritative; no stale financial data under a new date.
- Recoverable error states with Retry replace infinite loading.
- Duplicate warning during edit fixed (exclude self).
- Signed opening adjustments supported with server validation.
- Mobile and accessibility fixes delivered.
- Tests repaired and rerunnable; backend suite green; frontend suite verified.
- **Testing requirement satisfied:** `testing_agent` confirmed acceptance scenarios against the deployed preview (`/app/test_reports/iteration_3.json`).
