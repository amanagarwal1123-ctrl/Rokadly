import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg, toPaise, fromPaise } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Money, MoneyInput, StatusBadge, StoreDatePicker, EmptyState, SectionTitle } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Ban, Plus } from "lucide-react";
import { toast } from "sonner";

const NATURE = { business_payment: "Business Payment", operating: "Operating Expense" };

export default function ExpensesPage() {
  const { user, banks, today, storeId, date } = useApp();
  const canEnter = ["cashier", "admin"].includes(user.role);
  const effStore = user.role === "cashier" ? user.store_id : storeId;
  const effDate = user.role === "cashier" ? today : date;

  const [expenses, setExpenses] = useState([]);
  const [heads, setHeads] = useState([]);
  const [form, setForm] = useState({ amount: "", nature: "operating", voucher_status: "without_voucher", head_id: "", description: "", payment_type: "cash", bank_id: "", voucher_no: "", editing: null });
  const [newHead, setNewHead] = useState("");
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [report, setReport] = useState(null);
  const [range, setRange] = useState({ from: effDate, to: effDate });

  const load = useCallback(() => {
    if (!effStore || !effDate) return;
    api.get("/expenses", { params: { store_id: effStore, business_date: effDate } })
      .then((r) => setExpenses(r.data.expenses)).catch(() => {});
    api.get("/heads", { params: { kind: "expense", store_id: effStore } })
      .then((r) => setHeads(r.data.heads)).catch(() => {});
  }, [effStore, effDate]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setRange({ from: effDate, to: effDate }); }, [effDate]);

  const save = async () => {
    if (!form.description.trim()) { toast.error("Description is required"); return; }
    if (!toPaise(form.amount)) { toast.error("Amount is required"); return; }
    const body = {
      amount_paise: toPaise(form.amount), nature: form.nature,
      voucher_status: form.voucher_status, head_id: form.head_id || null,
      description: form.description, payment_type: form.payment_type,
      bank_id: form.payment_type === "bank" ? form.bank_id : null,
      voucher_no: form.voucher_no || null,
    };
    if (user.role === "admin") { body.store_id = effStore; body.business_date = effDate; }
    try {
      if (form.editing) {
        await api.put(`/expenses/${form.editing.id}`, { ...body, version: form.editing.version });
        toast.success("Expense updated");
      } else {
        await api.post("/expenses", body);
        toast.success("Expense saved");
      }
      setForm({ amount: "", nature: "operating", voucher_status: "without_voucher", head_id: "", description: "", payment_type: "cash", bank_id: "", voucher_no: "", editing: null });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const addHead = async () => {
    if (!newHead.trim()) return;
    try {
      const { data } = await api.post("/heads", { kind: "expense", name: newHead });
      toast.success(data.existing ? "Head already exists — selected" : "Head created");
      setNewHead("");
      setHeads((h) => data.existing ? h : [...h, data.head]);
      setForm((f) => ({ ...f, head_id: data.head.id }));
    } catch (e) { toast.error(errMsg(e)); }
  };

  const review = async (id, action) => {
    try {
      await api.post(`/expenses/${id}/review`, { action });
      toast.success(action === "finalize" ? "Expense finalized" : "Expense reviewed");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const doVoid = async () => {
    if (!voidReason.trim()) { toast.error("Reason compulsory"); return; }
    try {
      await api.post(`/expenses/${voidTarget.id}/void`, { reason: voidReason });
      toast.success("Expense voided"); setVoidTarget(null); setVoidReason(""); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const startEdit = (x) => setForm({
    amount: fromPaise(x.amount_paise), nature: x.nature, voucher_status: x.voucher_status,
    head_id: x.head_id || "", description: x.description, payment_type: x.payment_type,
    bank_id: x.bank_id || "", voucher_no: x.voucher_no || "", editing: { id: x.id, version: x.version },
  });

  const loadReport = () => {
    api.get("/reports/expenses", { params: { date_from: range.from, date_to: range.to, store_id: effStore } })
      .then((r) => setReport(r.data)).catch((e) => toast.error(errMsg(e)));
  };

  const Section = ({ title, items, total }) => (
    <Card className="rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b flex justify-between items-center bg-secondary/50">
        <p className="font-semibold text-sm">{title}</p>
        <Money paise={total} className="font-semibold" />
      </div>
      <Table className="table-compact">
        <TableHeader><TableRow>
          <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Head</TableHead>
          <TableHead>Pay</TableHead><TableHead>Voucher</TableHead><TableHead className="text-right">Amount</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">None</TableCell></TableRow>}
          {items.map((x) => (
            <TableRow key={x.id}>
              <TableCell className="font-mono-num text-xs">{x.business_date}</TableCell>
              <TableCell>{x.description}<span className="block text-[11px] text-muted-foreground">{x.cashier_name}</span></TableCell>
              <TableCell className="text-xs">{x.head_name || "—"}</TableCell>
              <TableCell className="text-xs uppercase">{x.payment_type}{x.bank_name ? ` · ${x.bank_name}` : ""}</TableCell>
              <TableCell className="text-xs">{x.voucher_no || "—"}</TableCell>
              <TableCell className="amount-cell"><Money paise={x.amount_paise} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold arch-underline">Expenses</h1>
          <p className="text-sm text-muted-foreground">Business payments &amp; operating expenses — with or without voucher</p>
        </div>
        <StoreDatePicker />
      </div>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries" data-testid="expenses-tab-entries">Entries</TabsTrigger>
          <TabsTrigger value="report" data-testid="expenses-tab-report">Report (3 sections)</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4 mt-4">
          {canEnter && (
            <Card className="rounded-lg">
              <CardContent className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label>Amount (₹) *</Label>
                  <MoneyInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} testId="expense-amount-input" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nature</Label>
                  <Select value={form.nature} onValueChange={(v) => setForm({ ...form, nature: v })}>
                    <SelectTrigger data-testid="expense-nature-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business_payment">Business / Supplier Payment</SelectItem>
                      <SelectItem value="operating">Operating Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Voucher</Label>
                  <Select value={form.voucher_status} onValueChange={(v) => setForm({ ...form, voucher_status: v })}>
                    <SelectTrigger data-testid="expense-voucher-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="with_voucher">With Voucher</SelectItem>
                      <SelectItem value="without_voucher">Without Voucher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Voucher No</Label>
                  <Input value={form.voucher_no} onChange={(e) => setForm({ ...form, voucher_no: e.target.value })} data-testid="expense-voucher-no-input" />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment</Label>
                  <Select value={form.payment_type} onValueChange={(v) => setForm({ ...form, payment_type: v })}>
                    <SelectTrigger data-testid="expense-payment-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.payment_type === "bank" && (
                  <div className="space-y-1.5">
                    <Label>Bank *</Label>
                    <Select value={form.bank_id} onValueChange={(v) => setForm({ ...form, bank_id: v })}>
                      <SelectTrigger data-testid="expense-bank-select"><SelectValue placeholder="Select bank" /></SelectTrigger>
                      <SelectContent>{banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Head</Label>
                  <Select value={form.head_id} onValueChange={(v) => setForm({ ...form, head_id: v })}>
                    <SelectTrigger data-testid="expense-head-select"><SelectValue placeholder="Select head" /></SelectTrigger>
                    <SelectContent>{heads.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex gap-1.5">
                    <Input value={newHead} onChange={(e) => setNewHead(e.target.value)} placeholder="New head…" className="h-8 text-xs" data-testid="expense-new-head-input" />
                    <Button variant="outline" size="sm" className="h-8" onClick={addHead} data-testid="expense-add-head-button"><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Description *</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="expense-description-input" />
                </div>
                <div className="flex items-end sm:col-span-2 lg:col-span-4">
                  <Button onClick={save} className="bg-[hsl(var(--ruby))] hover:bg-[hsl(var(--ruby))]/90" data-testid="expense-save-button">
                    {form.editing ? "Update expense" : "Save expense"}
                  </Button>
                  {form.editing && (
                    <Button variant="ghost" className="ml-2" onClick={() => setForm({ amount: "", nature: "operating", voucher_status: "without_voucher", head_id: "", description: "", payment_type: "cash", bank_id: "", voucher_no: "", editing: null })}>Cancel edit</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="table-compact">
                <TableHeader><TableRow>
                  <TableHead>Description</TableHead><TableHead>Nature</TableHead><TableHead>Voucher</TableHead>
                  <TableHead>Pay</TableHead><TableHead className="text-right">Amount</TableHead>
                  <TableHead>Review</TableHead><TableHead className="w-[190px]"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {expenses.length === 0 && <TableRow><TableCell colSpan={7}><EmptyState icon={FileText} title="No expenses today" /></TableCell></TableRow>}
                  {expenses.map((x) => (
                    <TableRow key={x.id} className={x.status === "void" ? "opacity-50" : ""} data-testid={`expense-row-${x.id.slice(0, 6)}`}>
                      <TableCell>{x.description}<span className="block text-[11px] text-muted-foreground">{x.cashier_name} · {x.head_name || "no head"}</span></TableCell>
                      <TableCell className="text-xs">{NATURE[x.nature]}</TableCell>
                      <TableCell className="text-xs">{x.voucher_status === "with_voucher" ? (x.voucher_no || "With") : "Without"}</TableCell>
                      <TableCell className="text-xs uppercase">{x.payment_type}{x.bank_name ? ` · ${x.bank_name}` : ""}</TableCell>
                      <TableCell className="amount-cell"><Money paise={x.amount_paise} /></TableCell>
                      <TableCell>{x.status === "void" ? <StatusBadge status="void" /> : <StatusBadge status={x.review_status === "finalized" ? "finalized" : x.review_status === "reviewed" ? "reviewed" : "unreviewed"} label={x.review_status === "unreviewed" ? "Unreviewed" : undefined} />}</TableCell>
                      <TableCell>
                        {x.status === "active" && (
                          <div className="flex gap-1 justify-end">
                            {["accountant", "admin"].includes(user.role) && x.review_status === "unreviewed" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => review(x.id, "review")} data-testid={`expense-review-${x.id.slice(0, 6)}`}>Review</Button>
                            )}
                            {user.role === "admin" && x.review_status !== "finalized" && (
                              <Button size="sm" className="h-7 text-xs bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90" onClick={() => review(x.id, "finalize")} data-testid={`expense-finalize-${x.id.slice(0, 6)}`}>Finalize</Button>
                            )}
                            {x.review_status !== "finalized" && (x.cashier_id === user.id || user.role === "admin") && (
                              <>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startEdit(x)}>Edit</Button>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[hsl(var(--danger))]" onClick={() => setVoidTarget(x)} data-testid={`expense-void-${x.id.slice(0, 6)}`}><Ban className="h-3.5 w-3.5" /></Button>
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="space-y-4 mt-4">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1"><Label className="text-xs">From</Label>
              <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9" data-testid="expense-report-from" /></div>
            <div className="space-y-1"><Label className="text-xs">To</Label>
              <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9" data-testid="expense-report-to" /></div>
            <Button onClick={loadReport} className="h-9" data-testid="expense-report-run">Run report</Button>
          </div>
          {report && (
            <div className="space-y-4">
              <Section title="Business Payments" items={report.sections.business_payments} total={report.totals.business_payments} />
              <Section title="Expenses With Voucher" items={report.sections.with_voucher} total={report.totals.with_voucher} />
              <Section title="Expenses Without Voucher" items={report.sections.without_voucher} total={report.totals.without_voucher} />
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void expense</DialogTitle></DialogHeader>
          <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason (compulsory)" data-testid="expense-void-reason" />
          <DialogFooter><Button onClick={doVoid} className="bg-[hsl(var(--danger))] hover:bg-[hsl(var(--danger))]/90" data-testid="expense-void-confirm">Void</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
