import React, { useEffect, useState, useRef } from "react";
import { api, errMsg, fmtINR, toPaise, fromPaise, PAYMENT_LABELS } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useAsyncData, useStoreDayLock } from "@/hooks/useAsyncData";
import { Money, MoneyInput, StatusBadge, StoreDatePicker, SectionTitle, EmptyState, DayLockBanner, LoadErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, X, ReceiptText, AlertTriangle, Pencil, Ban } from "lucide-react";
import { toast } from "sonner";

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

const newDraft = () => ({
  key: uuid(), bill_no: "", amount: "", customer_name: "", customer_phone: "",
  country_code: "+91", payments: [{ type: "cash", amount: "" }],
  less_reason: "", excess_mode: "cash", excess_bank_id: "", editing: null, conflict: null,
});

const draftLabel = (d, i) => d.bill_no?.trim() ? d.bill_no : `Draft ${i + 1}`;

export default function BillsPage() {
  const { user, banks, today, storeId, date } = useApp();
  const isAdmin = user.role === "admin";
  const effStore = isAdmin ? storeId : user.store_id;
  const effDate = isAdmin ? date : today;
  const storageKey = `rokadly_drafts_${user.id}`;

  const [drafts, setDrafts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return saved.length ? saved : [newDraft()];
    } catch { return [newDraft()]; }
  });
  const [activeKey, setActiveKey] = useState(drafts[0]?.key);
  const [dupWarn, setDupWarn] = useState(null); // { ...existing, forKey } — scoped to one draft
  const [busy, setBusy] = useState(false);
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const syncTimer = useRef(null);

  const active = drafts.find((d) => d.key === activeKey) || drafts[0];
  const { storeDay, locked, refresh: refreshLock } = useStoreDayLock(effStore, effDate);

  // Duplicate warnings never leak between drafts / edit contexts
  useEffect(() => { setDupWarn(null); }, [activeKey]);

  const billsQ = useAsyncData(
    () => {
      if (!effStore || !effDate) return Promise.resolve(null);
      return api.get("/bills", { params: { store_id: effStore, business_date: effDate, include_void: true } })
        .then((r) => r.data.bills);
    },
    [effStore, effDate]
  );
  const bills = billsQ.data || [];
  const loadBills = () => { billsQ.refresh(); refreshLock(); };

  const persist = (next) => {
    setDrafts(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    // fire-and-forget server sync of active draft
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const d = next.find((x) => x.key === activeKey);
      if (d) api.put("/drafts", { draft_key: d.key, payload: d }).catch(() => {});
    }, 900);
  };

  const patchActive = (patch) => {
    persist(drafts.map((d) => (d.key === active.key ? { ...d, ...patch } : d)));
  };

  // ---- computations ----
  const amountP = toPaise(active?.amount);
  const paidP = (active?.payments || []).reduce((s, p) => s + toPaise(p.amount), 0);
  const lessP = Math.max(0, amountP - paidP);
  const excessP = Math.max(0, paidP - amountP);

  const addRow = (type = "cash") =>
    patchActive({ payments: [...active.payments, { type, amount: "" }] });
  const setRow = (i, patch) =>
    patchActive({ payments: active.payments.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const removeRow = (i) =>
    patchActive({ payments: active.payments.filter((_, j) => j !== i) });

  const checkDup = async () => {
    if (!active.bill_no?.trim() || !effStore) return;
    try {
      const params = { store_id: effStore, business_date: effDate, bill_no: active.bill_no };
      if (active.editing) params.exclude_bill_id = active.editing.id; // never conflict with itself
      const { data } = await api.get("/bills/check-duplicate", { params });
      if (data.duplicate) setDupWarn({ ...data.existing, forKey: active.key });
      else setDupWarn(null);
    } catch {}
  };

  const save = async () => {
    if (locked) { toast.error("This business date is finalized and locked"); return; }
    if (!active.bill_no?.trim()) { toast.error("MMI bill number is required"); return; }
    if (!amountP) { toast.error("Bill amount is required"); return; }
    if (active.customer_phone && active.country_code === "+91" && active.customer_phone.replace(/\D/g, "").length !== 10) {
      toast.error("Phone must be exactly 10 digits"); return;
    }
    const payments = active.payments
      .filter((p) => toPaise(p.amount) > 0)
      .map((p) => ({
        type: p.type, amount_paise: toPaise(p.amount),
        bank_id: p.type === "bank" ? p.bank_id : undefined,
        cheque_no: p.type === "cheque" ? p.cheque_no : undefined,
        cheque_name: p.type === "cheque" ? p.cheque_name : undefined,
        cheque_due_date: p.type === "cheque" ? p.cheque_due_date : undefined,
        other_label: p.type === "other" ? p.other_label : undefined,
      }));
    if (!payments.length) { toast.error("Enter at least one payment amount"); return; }
    const payload = {
      bill_no: active.bill_no.trim(), amount_paise: amountP,
      customer_name: active.customer_name || null,
      customer_phone: active.customer_phone || null,
      country_code: active.country_code,
      payments,
      less_taken_reason: lessP > 0 ? active.less_reason || null : null,
      excess: excessP > 0 ? {
        amount_paise: excessP, return_mode: active.excess_mode,
        bank_id: active.excess_mode === "bank" ? active.excess_bank_id : undefined,
      } : null,
    };
    if (isAdmin) { payload.store_id = effStore; payload.business_date = effDate; }
    setBusy(true);
    try {
      if (active.editing) {
        await api.put(`/bills/${active.editing.id}`, { ...payload, version: active.editing.version });
        toast.success(`Bill ${payload.bill_no} updated`);
      } else {
        payload.client_key = active.key;
        await api.post("/bills", payload);
        toast.success(`Bill ${payload.bill_no} saved`);
      }
      const remaining = drafts.filter((d) => d.key !== active.key);
      const next = remaining.length ? remaining : [newDraft()];
      persist(next);
      setActiveKey(next[0].key);
      setDupWarn(null);
      api.delete(`/drafts/${active.key}`).catch(() => {});
      loadBills();
    } catch (e) {
      const d = e?.response?.data?.detail;
      if (e?.response?.status === 409 && d?.code === "DUPLICATE_BILL") {
        patchActive({ conflict: d });
        toast.error("Duplicate bill number — your draft is preserved", { duration: 5000 });
      } else {
        toast.error(errMsg(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (b) => {
    const d = {
      ...newDraft(),
      bill_no: b.bill_no, amount: fromPaise(b.amount_paise),
      customer_name: b.customer_name || "", customer_phone: b.customer_phone || "",
      country_code: b.country_code || "+91",
      payments: b.payments.map((p) => ({
        type: p.type, amount: fromPaise(p.amount_paise), bank_id: p.bank_id,
        cheque_no: p.cheque_no, cheque_name: p.cheque_name, cheque_due_date: p.cheque_due_date,
        other_label: p.other_label,
      })),
      less_reason: b.less_taken_reason || "",
      excess_mode: b.excess?.return_mode || "cash", excess_bank_id: b.excess?.bank_id || "",
      editing: { id: b.id, version: b.version },
    };
    persist([...drafts, d]);
    setActiveKey(d.key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const doVoid = async () => {
    if (!voidReason.trim()) { toast.error("A reason is compulsory to void"); return; }
    try {
      await api.post(`/bills/${voidTarget.id}/void`, { reason: voidReason });
      toast.success(`Bill ${voidTarget.bill_no} voided`);
      setVoidTarget(null); setVoidReason("");
      loadBills();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const closeDraft = (key) => {
    const remaining = drafts.filter((d) => d.key !== key);
    const next = remaining.length ? remaining : [newDraft()];
    persist(next);
    if (activeKey === key) setActiveKey(next[0].key);
    api.delete(`/drafts/${key}`).catch(() => {});
  };

  if (!active) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold arch-underline">Bill entry</h1>
          <p className="text-sm text-muted-foreground">MMI bill number + payment breakup</p>
        </div>
        {isAdmin && <StoreDatePicker />}
      </div>

      <DayLockBanner storeDay={storeDay} showDraftNote />

      {/* Draft tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" data-testid="cashier-draft-tabs">
        {drafts.map((d, i) => (
          <div key={d.key}
            className={`flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap transition-colors duration-150 ${
              d.key === active.key ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-[hsl(var(--brass))]"
            } ${d.conflict ? "ring-2 ring-[hsl(var(--danger))]" : ""}`}
            onClick={() => setActiveKey(d.key)} data-testid={`draft-tab-${i}`}>
            {d.editing && <Pencil className="h-3 w-3" />}
            {draftLabel(d, i)}
            {drafts.length > 0 && (
              <button onClick={(e) => { e.stopPropagation(); closeDraft(d.key); }}
                className="ml-1 opacity-60 hover:opacity-100" aria-label={`Close ${draftLabel(d, i)}`} title="Close draft" data-testid={`draft-close-${i}`}>
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" className="h-8 shrink-0"
          onClick={() => { const d = newDraft(); persist([...drafts, d]); setActiveKey(d.key); }}
          data-testid="new-draft-button">
          <Plus className="h-3.5 w-3.5 mr-1" />Draft
        </Button>
      </div>

      {/* Conflict banner */}
      {active.conflict && (
        <Alert className="border-0 bg-[hsl(var(--danger))] text-white" data-testid="duplicate-conflict-banner">
          <AlertTriangle className="h-4 w-4 !text-white" />
          <AlertTitle>Duplicate bill number</AlertTitle>
          <AlertDescription className="text-white/90">
            {active.conflict.existing ? (
              <>Bill <b>{active.conflict.existing.bill_no}</b> already saved by <b>{active.conflict.existing.cashier_name}</b> for {fmtINR(active.conflict.existing.amount_paise)}. Your entire draft is preserved — just change the bill number below and save again.</>
            ) : active.conflict.message}
          </AlertDescription>
        </Alert>
      )}
      {dupWarn && dupWarn.forKey === active.key && !active.conflict && (
        <Alert className="border-[hsl(var(--warning))] bg-[hsl(var(--warning))]/10" data-testid="duplicate-warning-banner">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
          <AlertDescription className="text-sm">
            Bill <b>{dupWarn.bill_no}</b> already exists ({fmtINR(dupWarn.amount_paise)}, by {dupWarn.cashier_name}). Saving will be blocked unless you change the number.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <fieldset disabled={locked} className="space-y-4 border-0 p-0 m-0 min-w-0 disabled:opacity-60">
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>MMI Bill No <span className="text-[hsl(var(--danger))]">*</span></Label>
                <Input value={active.bill_no}
                  onChange={(e) => { patchActive({ bill_no: e.target.value, conflict: null }); }}
                  onBlur={checkDup} placeholder="e.g. M-1024" autoFocus
                  className="h-11 font-mono-num uppercase" data-testid="bill-entry-mmi-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Bill Amount (₹) <span className="text-[hsl(var(--danger))]">*</span></Label>
                <MoneyInput value={active.amount} onChange={(v) => patchActive({ amount: v })}
                  className="h-11 text-base" testId="bill-entry-amount-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer name <span className="text-muted-foreground text-[11px]">(optional)</span></Label>
                <Input value={active.customer_name} onChange={(e) => patchActive({ customer_name: e.target.value })}
                  className="h-11" data-testid="bill-entry-customer-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone <span className="text-muted-foreground text-[11px]">(optional, 10 digits)</span></Label>
                <div className="flex gap-1.5 w-full">
                  <select value={active.country_code} tabIndex={-1}
                    onChange={(e) => patchActive({ country_code: e.target.value })}
                    className="h-11 rounded-md border border-input bg-background px-2 text-sm w-[72px] shrink-0"
                    aria-label="Country code"
                    data-testid="bill-entry-country-code">
                    {["+91", "+971", "+1", "+44", "+65"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <Input value={active.customer_phone} inputMode="numeric"
                    onChange={(e) => patchActive({ customer_phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                    className="h-11 font-mono-num flex-1 min-w-0" data-testid="bill-entry-phone-input" />
                </div>
              </div>
            </div>

            {/* Payment rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Payment breakup</Label>
                <Button variant="outline" size="sm" onClick={() => addRow()} className="h-8" data-testid="payment-row-add-button">
                  <Plus className="h-3.5 w-3.5 mr-1" />Add payment
                </Button>
              </div>
              {active.payments.map((p, i) => (
                <div key={i} className="rounded border bg-secondary/40 p-2.5 space-y-2" data-testid={`payment-row-${i}`}>
                  <div className="flex gap-2">
                    <Select value={p.type} onValueChange={(v) => setRow(i, { type: v, bank_id: undefined, cheque_no: undefined, other_label: undefined })}>
                      <SelectTrigger className="h-10 w-[120px]" data-testid={`payment-type-select-${i}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k} data-testid={`payment-type-${k}-${i}`}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <MoneyInput value={p.amount} onChange={(v) => setRow(i, { amount: v })}
                      className="h-10 flex-1" testId={`payment-amount-input-${i}`} />
                    {active.payments.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeRow(i)} className="h-10 w-10 text-muted-foreground"
                        aria-label="Remove payment row" title="Remove payment row" data-testid={`payment-row-remove-${i}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {p.type === "bank" && (
                    <Select value={p.bank_id || ""} onValueChange={(v) => setRow(i, { bank_id: v })}>
                      <SelectTrigger className="h-10" data-testid={`payment-bank-select-${i}`}>
                        <SelectValue placeholder="Select bank…" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((b) => (
                          <SelectItem key={b.id} value={b.id} data-testid={`bank-option-${b.name}-${i}`}>{b.name}{b.account_label ? ` — ${b.account_label}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {p.type === "cheque" && (
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Cheque no *" value={p.cheque_no || ""} onChange={(e) => setRow(i, { cheque_no: e.target.value })} className="h-10 font-mono-num" data-testid={`cheque-no-input-${i}`} />
                      <Input placeholder="Name on cheque" value={p.cheque_name || ""} onChange={(e) => setRow(i, { cheque_name: e.target.value })} className="h-10" data-testid={`cheque-name-input-${i}`} />
                      <Input type="date" value={p.cheque_due_date || ""} onChange={(e) => setRow(i, { cheque_due_date: e.target.value })} className="h-10" data-testid={`cheque-due-input-${i}`} />
                    </div>
                  )}
                  {p.type === "other" && (
                    <Input placeholder="Label e.g. Gift Voucher *" value={p.other_label || ""} onChange={(e) => setRow(i, { other_label: e.target.value })} className="h-10" data-testid={`other-label-input-${i}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Less taken */}
            {amountP > 0 && lessP > 0 && (
              <div className="rounded border border-[hsl(var(--warning))]/50 bg-[hsl(var(--warning))]/8 p-3 space-y-2" data-testid="less-taken-section">
                <p className="text-sm font-semibold">Less Taken: <Money paise={lessP} className="text-[hsl(var(--warning))]" /></p>
                <Input value={active.less_reason} onChange={(e) => patchActive({ less_reason: e.target.value })}
                  placeholder="Reason (optional — can skip)" className="h-10" data-testid="less-taken-reason-input" />
              </div>
            )}

            {/* Excess */}
            {amountP > 0 && excessP > 0 && (
              <div className="rounded border-2 border-[hsl(var(--danger))]/60 bg-[hsl(var(--danger))]/5 p-3 space-y-2" data-testid="excess-section">
                <p className="text-sm font-semibold text-[hsl(var(--danger))]">
                  Excess received: <Money paise={excessP} /> — record how it was returned
                </p>
                <div className="flex gap-2">
                  <Select value={active.excess_mode} onValueChange={(v) => patchActive({ excess_mode: v })}>
                    <SelectTrigger className="h-10 w-[130px]" data-testid="excess-mode-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash return</SelectItem>
                      <SelectItem value="bank">Bank return</SelectItem>
                    </SelectContent>
                  </Select>
                  {active.excess_mode === "bank" && (
                    <Select value={active.excess_bank_id || ""} onValueChange={(v) => patchActive({ excess_bank_id: v })}>
                      <SelectTrigger className="h-10 flex-1" data-testid="excess-bank-select">
                        <SelectValue placeholder="Bank for return *" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}
            </fieldset>
          </CardContent>
        </Card>

        {/* Summary side */}
        <Card className="rounded-lg lg:sticky lg:top-4">
          <CardContent className="p-4 space-y-2" data-testid="bill-summary-panel">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Settlement summary</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Bill amount</span><Money paise={amountP} /></div>
              <div className="flex justify-between"><span>Gross received</span><Money paise={paidP} /></div>
              {lessP > 0 && <div className="flex justify-between text-[hsl(var(--warning))]"><span>Less Taken</span><Money paise={lessP} /></div>}
              {excessP > 0 && <div className="flex justify-between text-[hsl(var(--danger))]"><span>Excess to return</span><Money paise={excessP} /></div>}
              <div className="flex justify-between font-semibold border-t pt-1.5">
                <span>Money received</span><Money paise={Math.min(paidP, amountP)} />
              </div>
              {lessP > 0 && (
                <p className="text-[10px] text-muted-foreground">Bill settles in full; Less Taken is tracked separately.</p>
              )}
            </div>
            <Button onClick={save} disabled={busy || locked}
              className="w-full h-11 mt-2 bg-primary hover:bg-[hsl(var(--sapphire-2))] text-primary-foreground font-semibold"
              data-testid="bill-save-button">
              {locked ? "Day locked" : busy ? "Saving…" : active.editing ? "Update bill" : "Save bill"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              {locked ? "Drafts stay preserved — this date needs an audited reopen before saving." : "Drafts auto-save. Switch tabs freely."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Today's bills */}
      <div>
        <SectionTitle>Bills — {effDate}</SectionTitle>
        {billsQ.error ? (
          <LoadErrorState error={billsQ.error} onRetry={billsQ.reload} title="Could not load bills" />
        ) : billsQ.loading ? (
          <Card className="rounded-lg"><CardContent className="p-4"><LoadingState /></CardContent></Card>
        ) : (
        <Card className="rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="table-compact">
              <TableHeader><TableRow>
                <TableHead>Bill No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Payments</TableHead>
                <TableHead className="text-right">Less Taken</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bills.length === 0 && (
                  <TableRow><TableCell colSpan={7}><EmptyState icon={ReceiptText} title="No bills yet" sub="Saved bills appear here" /></TableCell></TableRow>
                )}
                {bills.map((b) => (
                  <TableRow key={b.id} className={b.status === "void" ? "opacity-50" : ""} data-testid={`bill-row-${b.bill_no}`}>
                    <TableCell className="font-mono-num font-semibold">{b.bill_no}</TableCell>
                    <TableCell>{b.customer_name || <span className="text-muted-foreground">—</span>}
                      <span className="block text-[11px] text-muted-foreground">{b.cashier_name}</span>
                    </TableCell>
                    <TableCell className="amount-cell"><Money paise={b.amount_paise} /></TableCell>
                    <TableCell className="text-xs">
                      {b.payments.map((p, i) => (
                        <span key={i} className="inline-block mr-1.5">
                          {PAYMENT_LABELS[p.type]}{p.bank_name ? `·${p.bank_name}` : ""} <Money paise={p.amount_paise} className="text-muted-foreground" />
                        </span>
                      ))}
                      {b.excess && <span className="text-[hsl(var(--danger))] text-[11px]">↩ {fmtINR(b.excess.amount_paise)} {b.excess.return_mode}</span>}
                    </TableCell>
                    <TableCell className="amount-cell">{b.less_taken_paise ? <Money paise={b.less_taken_paise} /> : "—"}</TableCell>
                    <TableCell><StatusBadge status={b.status} /></TableCell>
                    <TableCell>
                    {b.status === "active" && !locked && (b.cashier_id === user.id || isAdmin) && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(b)}
                          aria-label={`Edit bill ${b.bill_no}`} title="Edit bill" data-testid={`bill-edit-${b.bill_no}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[hsl(var(--danger))]" onClick={() => setVoidTarget(b)}
                          aria-label={`Void bill ${b.bill_no}`} title="Void bill" data-testid={`bill-void-${b.bill_no}`}>
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
        )}
      </div>

      {/* Void dialog */}
      <Dialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void bill {voidTarget?.bill_no}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">The bill is never deleted — it stays in history marked void. A reason is compulsory.</p>
          <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason (compulsory)" data-testid="void-reason-input" />
          <DialogFooter>
            <Button onClick={doVoid} className="bg-[hsl(var(--danger))] hover:bg-[hsl(var(--danger))]/90" data-testid="void-confirm-button">Void bill</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
