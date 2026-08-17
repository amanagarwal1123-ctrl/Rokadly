import React, { useState } from "react";
import { api, errMsg, toPaise, PAYMENT_LABELS } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useAsyncData, useStoreDayLock } from "@/hooks/useAsyncData";
import { Money, MoneyInput, StatusBadge, StoreDatePicker, EmptyState, DayLockBanner, LoadErrorState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilePlus2, Ban, Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdjustmentsPage() {
  const { user, banks, today, storeId, date } = useApp();
  const effStore = user.role === "cashier" ? user.store_id : storeId;
  const effDate = user.role === "cashier" ? today : date;
  const [heads, setHeads] = useState([]);
  const [newHead, setNewHead] = useState("");
  const [form, setForm] = useState({ kind: "receipt", description: "", amount: "", payment_type: "cash", bank_id: "", other_label: "", head_id: "", related_bill_no: "" });
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState("");

  const { storeDay, locked, refresh: refreshLock } = useStoreDayLock(effStore, effDate);

  const q = useAsyncData(
    async () => {
      if (!effStore || !effDate) return null;
      const [adj, hd] = await Promise.all([
        api.get("/adjustments", { params: { store_id: effStore, business_date: effDate } }).then((r) => r.data.adjustments),
        api.get("/heads", { params: { kind: "adjustment", store_id: effStore } }).then((r) => r.data.heads).catch(() => []),
      ]);
      setHeads(hd);
      return adj;
    },
    [effStore, effDate]
  );
  const items = q.data || [];
  const load = () => { q.refresh(); refreshLock(); };

  const addHead = async () => {
    if (!newHead.trim()) return;
    try {
      const { data } = await api.post("/heads", { kind: "adjustment", name: newHead });
      setNewHead("");
      setHeads((h) => data.existing ? h : [...h, data.head]);
      setForm((f) => ({ ...f, head_id: data.head.id }));
      toast.success("Head ready");
    } catch (e) { toast.error(errMsg(e)); }
  };

  const save = async () => {
    if (locked) { toast.error("This business date is finalized and locked"); return; }
    if (!form.description.trim()) { toast.error("Description is compulsory"); return; }
    if (!toPaise(form.amount)) { toast.error("Amount required"); return; }
    const body = {
      kind: form.kind, description: form.description, amount_paise: toPaise(form.amount),
      payment_type: form.payment_type,
      bank_id: form.payment_type === "bank" ? form.bank_id : null,
      other_label: form.payment_type === "other" ? form.other_label : null,
      head_id: form.head_id || null, related_bill_no: form.related_bill_no || null,
    };
    if (user.role === "admin") { body.store_id = effStore; body.business_date = effDate; }
    try {
      await api.post("/adjustments", body);
      toast.success("Adjustment saved");
      setForm({ kind: "receipt", description: "", amount: "", payment_type: "cash", bank_id: "", other_label: "", head_id: "", related_bill_no: "" });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const doVoid = async () => {
    if (!voidReason.trim()) { toast.error("Reason compulsory"); return; }
    try {
      await api.post(`/adjustments/${voidTarget.id}/void`, { reason: voidReason });
      toast.success("Voided"); setVoidTarget(null); setVoidReason(""); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold arch-underline">Other receipts &amp; adjustments</h1>
          <p className="text-sm text-muted-foreground">Tax, hallmarking, cashback, standalone Less Taken and deductions</p>
        </div>
        <StoreDatePicker />
      </div>

      <DayLockBanner storeDay={storeDay} />

      {!locked && (
      <Card className="rounded-lg">
        <CardContent className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
              <SelectTrigger data-testid="adjustment-kind-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receipt">Receipt (money in)</SelectItem>
                <SelectItem value="deduction">Deduction (money out)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₹) *</Label>
            <MoneyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} testId="adjustment-amount-input" />
          </div>
          <div className="space-y-1.5">
            <Label>Payment</Label>
            <Select value={form.payment_type} onValueChange={(v) => setForm({ ...form, payment_type: v })}>
              <SelectTrigger data-testid="adjustment-payment-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.payment_type === "bank" && (
            <div className="space-y-1.5">
              <Label>Bank *</Label>
              <Select value={form.bank_id} onValueChange={(v) => setForm({ ...form, bank_id: v })}>
                <SelectTrigger data-testid="adjustment-bank-select"><SelectValue placeholder="Bank" /></SelectTrigger>
                <SelectContent>{banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {form.payment_type === "other" && (
            <div className="space-y-1.5">
              <Label>Label *</Label>
              <Input value={form.other_label} onChange={(e) => setForm({ ...form, other_label: e.target.value })} data-testid="adjustment-other-label" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Head</Label>
            <Select value={form.head_id} onValueChange={(v) => setForm({ ...form, head_id: v })}>
              <SelectTrigger data-testid="adjustment-head-select"><SelectValue placeholder="Head" /></SelectTrigger>
              <SelectContent>{heads.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-1.5">
              <Input value={newHead} onChange={(e) => setNewHead(e.target.value)} placeholder="New head…" className="h-8 text-xs" data-testid="adjustment-new-head-input" />
              <Button variant="outline" size="sm" className="h-8" onClick={addHead} aria-label="Add new head" title="Add new head" data-testid="adjustment-add-head-button"><Plus className="h-3 w-3" /></Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Related bill no <span className="text-[11px] text-muted-foreground">(optional)</span></Label>
            <Input value={form.related_bill_no} onChange={(e) => setForm({ ...form, related_bill_no: e.target.value })} className="font-mono-num" data-testid="adjustment-bill-no-input" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description *</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="adjustment-description-input" />
          </div>
          <div className="flex items-end">
            <Button onClick={save} className="bg-primary hover:bg-[hsl(var(--sapphire-2))]" data-testid="adjustment-save-button">Save</Button>
          </div>
        </CardContent>
      </Card>
      )}

      {q.error ? (
        <LoadErrorState error={q.error} onRetry={q.reload} title="Could not load adjustments" />
      ) : q.loading ? (
        <Card className="rounded-lg"><CardContent className="p-4"><LoadingState /></CardContent></Card>
      ) : (
      <Card className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="table-compact">
            <TableHeader><TableRow>
              <TableHead>Description</TableHead><TableHead>Kind</TableHead><TableHead>Pay</TableHead>
              <TableHead>Head</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-[60px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={6}><EmptyState icon={FilePlus2} title="No adjustments today" /></TableCell></TableRow>}
              {items.map((a) => (
                <TableRow key={a.id} className={a.status === "void" ? "opacity-50" : ""}>
                  <TableCell>{a.description}
                    <span className="block text-[11px] text-muted-foreground">{a.cashier_name}{a.related_bill_no ? ` · bill ${a.related_bill_no}` : ""}{a.linked_discrepancy_id ? " · linked to discrepancy" : ""}</span>
                  </TableCell>
                  <TableCell><StatusBadge status={a.kind === "receipt" ? "active" : "open"} label={a.kind === "receipt" ? "Receipt" : "Deduction"} /></TableCell>
                  <TableCell className="text-xs uppercase">{a.payment_type}{a.bank_name ? ` · ${a.bank_name}` : ""}</TableCell>
                  <TableCell className="text-xs">{a.head_name || "—"}</TableCell>
                  <TableCell className="amount-cell"><Money paise={a.kind === "deduction" ? -a.amount_paise : a.amount_paise} colored /></TableCell>
                  <TableCell>
                    {a.status === "active" && !locked && (a.cashier_id === user.id || user.role === "admin") && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[hsl(var(--danger))]" onClick={() => setVoidTarget(a)}
                        aria-label="Void adjustment" title="Void adjustment" data-testid={`adjustment-void-${a.id.slice(0, 6)}`}><Ban className="h-3.5 w-3.5" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      )}

      <Dialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void adjustment</DialogTitle></DialogHeader>
          <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason (compulsory)" data-testid="adjustment-void-reason" />
          <DialogFooter><Button onClick={doVoid} className="bg-[hsl(var(--danger))] hover:bg-[hsl(var(--danger))]/90" data-testid="adjustment-void-confirm">Void</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
