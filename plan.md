# Rokadly — plan.md (Updated)

## 1) Objectives
- Deliver a **production-quality V1** for daily Rokad (cash/payment reconciliation) with correct integer-paise math, strict server-enforced RBAC, full auditability, print/PDF outputs, and store-day finalization locking.
- Provide an end-to-end workflow covering: bill entry (split payments, Less Taken, Excess Returned), opening allocation, expenses/adjustments, cash count → discrepancy ledger, numbered non-cash reconciliation, account tally checklist, non-cash reconciliation, and finalization readiness gating.
- Ship with realistic seeded demo data + credentials for all roles and prove acceptance scenarios via automated tests.
- **Current status:** Phases 1–4 (functional V1) are complete and tested. **Phase 5 (full Mughal jewel-tone redesign) is now complete and verified** with frontend regression tests.

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
1. **Full React frontend shipped** with shadcn/ui + Tailwind:
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
2. **Seed data** created for demo realism:
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

### Phase 5 — Mughal Jewel-Tone UI Redesign (Visual overhaul; NO logic changes)
**Goal:** Replace the initial Shadcn styling with a **single dark jewel-tone theme** (sapphire/ruby/emerald + brass), **NO white backgrounds anywhere (including textboxes)**, plus **curves-only Mughal ornamentation** (ogee/scallops/paisley/fish-scale) with subtle lighting play—while keeping dense finance data readable.

✅ **Completed and Verified**

**Non-negotiables / constraints (met)**
- No backend/API/business logic changes.
- `data-testid` attributes preserved.
- Operational semantics preserved with high contrast:
  - Ruby = pending/shortage/negative
  - Emerald = verified/matched/finalized/positive
  - Sapphire = neutral/base/primary action
  - Brass = borders/focus rings/hairlines (zardozi accent)
- No white surfaces in the app UI, including **inputs/textboxes**.
- Textures are **CSS-only**, inline SVG data-URIs.
- Gradients limited to ≤20% viewport and kept away from text-heavy surfaces.
- Print: `@media print` remains white paper/black text.

#### Phase 5A — Theme foundation + 1-page approval (Dashboard first)
✅ **Completed**
1. **Theme tokens (global)**
   - Rewrote `/app/frontend/src/index.css` `:root` HSL variables to dark jewel-tone tokens.
   - Added custom tokens (`--ink`, `--surface`, `--surface-2`, `--brass-dim`, `--focus`, `--shadow`, `--sapphire`, etc.).
   - Implemented layered jewel “lighting play” in background (sapphire chandelier glow + ruby/emerald corner warmth).
   - Replaced geometric lattice with **curves-only ogee trellis** texture.
2. **Textures + lighting play**
   - Rebuilt `/app/frontend/src/App.css`:
     - Curved ogee shell texture + grain overlays.
     - Animated brass/sapphire sheen on shell.
     - `card-zardozi` brass glint + **fish-scale curved lattice**.
     - `arch-underline` scalloped underline.
     - `surface-2` sticky table headers.
     - Jewel selection + scrollbar styling.
3. **Dark matte inputs everywhere**
   - Updated shadcn primitives:
     - `/app/frontend/src/components/ui/input.jsx`
     - `/app/frontend/src/components/ui/textarea.jsx`
     - `/app/frontend/src/components/ui/select.jsx`
   - All textboxes/inputs are dark matte using `--input` token (no white/transparent fields).
4. **Fixes for dark theme clashes**
   - Updated warning/open-day label color usage to token-driven `--warning`.
   - Updated Card radius/shadows and removed light-mode assumptions.
   - Ensured dialogs use `bg-card` surfaces and deep shadows.
5. **Dashboard approval snapshot**
   - Dashboard polished and validated across cashier/accountant/manager/admin.

#### Phase 5B — Full rollout after approval
✅ **Completed**
1. **Applied theme across all pages and UI primitives**
   - Curved motif enforced (no geometric diamonds); scalloped arch underline applied across **all 19 page titles**.
   - Verified cards, tables, dropdowns, dialogs, and forms render dark and consistent.
2. **Extra ornate login page (“front door”)**
   - Implemented grand **9-lobed cusped Mughal arch** with hanging jhoomar pendant framing the hero headline.
   - Added paisley + ogee overlays.
   - Added niche arch crowning the sign-in card.
   - Ruby glow CTA preserved.
3. **On-screen print previews**
   - Implemented parchment/champagne **on-screen** print preview via `.print-preview`.
   - Preserved `@media print` white-paper output.
   - Added `!important` to `.print-preview` to override body’s global dark background.
4. **App-wide screenshot + regression checks**
   - Visual sweep performed across roles/routes.

✅ **Phase 5 result (definition of done):** Entire app adheres to the Mughal jewel-tone dark theme with **curves-only textures**, no white surfaces (including inputs), readable dense finance tables, preserved operational semantics, and verified via screenshots + frontend regression testing.

## 3) Next Actions
1. **Release readiness (optional):** lock design tokens and document “no-white” rule for future contributors.
2. **Enhancement Phase (future, optional):**
   - CSV/XLSX bank statement upload.
   - Many-to-many matching UI (one statement row ↔ multiple receipts and vice versa).
   - Match suggestions and exception workflows at statement-line granularity.
   - Expense attachment uploads.
   - Deeper drill-down from Comparison metrics into underlying bills/expenses/recon items.

## 4) Success Criteria
✅ **Achieved (Phases 1–5)**
- Core system correctness: money math, RBAC, auditability, locking/finalization, print outputs.
- Visual redesign requirements met:
  - Dark jewel-tone theme across entire app
  - No white backgrounds anywhere in the app UI, including form fields
  - Curves-only Mughal ornamentation (ogee/scallops/paisley/fish-scale)
  - Lighting play and premium “couture craftsmanship” feel
  - Extra ornate login page
  - Parchment on-screen print previews with white-paper print output
- Testing:
  - Prior baseline: backend **34/34** passing.
  - Visual-redesign regression: **frontend 100% pass** across roles/routes; no functionality regressions; all `data-testid`s preserved (see `/app/test_reports/iteration_2.json`).
