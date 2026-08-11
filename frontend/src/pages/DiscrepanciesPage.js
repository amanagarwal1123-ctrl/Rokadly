import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg, toPaise, fromPaise } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Money, MoneyInput, StatusBadge, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, SplitSquareHorizontal } from "lucide-react";
import { toast } from "sonner";

export default function DiscrepanciesPage() {
  const { user, banks, storeId } = useApp();
  const [status, setStatus] = useState("all");
  const [items, setItems] = useState([]);
  const [allocTarget, setAllocTarget] = useState(null);
  const [allocRows, setAllocRows] = useState([]);
  const [allocNote, setAllocNote] = useState("");
  const [settleTarget, setSettleTarget] = useState(null);
  const [settle, setSettle] = useState({ amount: "", mode: "cash", bank_id: "", note: "", related_bill_no: "" });
  const [cashiers, setCashiers] = useState([]);

  const load = useCallback(() => {
    const params = {};
    if (status !== "all") params.status = status;
    if (user.role !== "cashier" && storeId) params.store_id = storeId;
    api.get("/discrepancies", { params }).then((r) => setItems(r.data.discrepancies)).catch((e) => toast.error(errMsg(e)));
  }, [status, storeId, user.role]);
  useEffect(() => { load(); }, [load]);

  const openAlloc = async (d) => {
    setAllocTarget(d);
    setAllocNote(d.allocation_note || "");
    try {
      const { data } = await api.get("/allocations/summary", { params: { store_id: d.store_id, business_date: d.business_date } });
      setCashiers(data.cashiers);
      const rows = data.cashiers.map((c) => {
        const ex = (d.allocations || []).find((a) => a.cashier_id === c.id);
        return { cashier_id: c.id, name: c.name, amount: ex ? fromPaise(ex.amount_paise) : "" };
      });
      (d.allocations || []).forEach((a) => {
        if (!rows.find((r) => r.cashier_id === a.cashier_id))
          rows.push({ cashier_id: a.cashier_id, name: a.cashier_name, amount: fromPaise(a.amount_paise) });
      });
      setAllocRows(rows);
    } catch (e) { toast.error(errMsg(e)); }
  };

  const equalSplit = () => {
    const ids = allocRows.map((r) => r.cashier_id);
    if (!ids.length) return;
    api.patch(`/discrepancies/${allocTarget.id}/allocate`, { allocations: [], equal_split: ids, note: allocNote || "Equal split" })
      .then(() => { toast.success("Split equally"); setAllocTarget(null); load(); })
      .catch((e) => toast.error(errMsg(e)));
  };

  const saveAlloc = () => {
    const allocations = allocRows.filter((r) => toPaise(r.amount) > 0)
      .map((r) => ({ cashier_id: r.cashier_id, amount_paise: toPaise(r.amount) }));
    api.patch(`/discrepancies/${allocTarget.id}/allocate`, { allocations, note: allocNote })
      .then(() => { toast.success("Responsibility allocated"); setAllocTarget(null); load(); })
      .catch((e) => toast.error(errMsg(e)));
  };

  const doSettle = () => {
    if (!toPaise(settle.amount)) { toast.error("Amount required"); return; }
    api.post(`/discrepancies/${settleTarget.id}/settle`, {
      amount_paise: toPaise(settle.amount), mode: settle.mode,
      bank_id: settle.mode === "bank" ? settle.bank_id : null,
      note: settle.note || null, related_bill_no: settle.related_bill_no || null,
    }).then(() => {
      toast.success("Settlement recorded on today's date, linked to the original discrepancy");
      setSettleTarget(null); setSettle({ amount: "", mode: "cash", bank_id: "", note: "", related_bill_no: "" });
      load();
    }).catch((e) => toast.error(errMsg(e)));
  };

  const canManage = ["admin", "manager", "accountant"].includes(user.role);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold arch-underline">Discrepancy ledger</h1>
          <p className="text-sm text-muted-foreground">Shortages &amp; excesses with responsibility allocation and later settlements</p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[190px]" data-testid="discrepancy-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="partially_adjusted">Partially Adjusted</SelectItem>
            <SelectItem value="adjusted">Adjusted</SelectItem>
            <SelectItem value="closed_unexplained">Closed Unexplained</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="table-compact">
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Settled</TableHead>
              <TableHead>Responsibility</TableHead><TableHead>Age</TableHead>
              <TableHead>Status</TableHead><TableHead className="w-[150px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.length === 0 && <TableRow><TableCell colSpan={8}><EmptyState icon={AlertTriangle} title="No discrepancies" /></TableCell></TableRow>}
              {items.map((d) => (
                <TableRow key={d.id} data-testid={`discrepancy-row-${d.id.slice(0, 6)}`}>
                  <TableCell className="font-mono-num text-xs">{d.business_date}</TableCell>
                  <TableCell>
                    <StatusBadge status={d.type === "shortage" ? "pending" : "matched"} label={d.type === "shortage" ? "Shortage" : "Excess"} />
                  </TableCell>
                  <TableCell className="amount-cell"><Money paise={d.type === "shortage" ? -d.amount_paise : d.amount_paise} colored /></TableCell>
                  <TableCell className="amount-cell"><Money paise={d.settled_paise || 0} /></TableCell>
                  <TableCell className="text-xs">
                    {(d.allocations || []).map((a) => (
                      <span key={a.cashier_id} className="inline-block mr-2">{a.cashier_name}: <Money paise={a.amount_paise} className="text-muted-foreground" /></span>
                    ))}
                    {d.note && <span className="block text-[10px] text-muted-foreground truncate max-w-[220px]">{d.note}</span>}
                    {(d.settlements || []).length > 0 && (
                      <span className="block text-[10px] text-[hsl(var(--info))]">{d.settlements.length} settlement(s), last on {d.settlements[d.settlements.length - 1].date}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{d.age_days != null ? `${d.age_days}d` : "—"}</TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell>
                    {canManage && d.status !== "adjusted" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openAlloc(d)} data-testid={`discrepancy-allocate-${d.id.slice(0, 6)}`}>Allocate</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSettleTarget(d); setSettle((s) => ({ ...s, amount: fromPaise(d.amount_paise - (d.settled_paise || 0)) })); }} data-testid={`discrepancy-settle-${d.id.slice(0, 6)}`}>Settle</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Allocation dialog */}
      <Dialog open={!!allocTarget} onOpenChange={(o) => !o && setAllocTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Allocate responsibility — <Money paise={allocTarget?.amount_paise} /></DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">This is a responsibility note and audit record — not a payroll deduction. Amounts must sum to the discrepancy.</p>
          <div className="space-y-2">
            {allocRows.map((r, i) => (
              <div key={r.cashier_id} className="flex items-center gap-2">
                <span className="text-sm flex-1">{r.name}</span>
                <MoneyInput value={r.amount} onChange={(v) => setAllocRows(allocRows.map((x, j) => j === i ? { ...x, amount: v } : x))}
                  className="h-9 w-[140px]" testId={`alloc-amount-${i}`} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={equalSplit} className="w-full" data-testid="equal-split-button">
              <SplitSquareHorizontal className="h-3.5 w-3.5 mr-1.5" />Equal split among all listed cashiers
            </Button>
            <Textarea value={allocNote} onChange={(e) => setAllocNote(e.target.value)} placeholder="Allocation note" data-testid="alloc-note-input" />
          </div>
          <DialogFooter><Button onClick={saveAlloc} data-testid="alloc-save-button">Save allocation</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle dialog */}
      <Dialog open={!!settleTarget} onOpenChange={(o) => !o && setSettleTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record later settlement</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Money moves <b>today</b> — the entry posts on today's date and links back to the discrepancy of {settleTarget?.business_date}. The old Rokad is annotated, not altered.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Amount (₹)</Label>
              <MoneyInput value={settle.amount} onChange={(v) => setSettle({ ...settle, amount: v })} testId="settle-amount-input" /></div>
            <div className="flex gap-2">
              <Select value={settle.mode} onValueChange={(v) => setSettle({ ...settle, mode: v })}>
                <SelectTrigger className="w-[130px]" data-testid="settle-mode-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
              {settle.mode === "bank" && (
                <Select value={settle.bank_id} onValueChange={(v) => setSettle({ ...settle, bank_id: v })}>
                  <SelectTrigger className="flex-1" data-testid="settle-bank-select"><SelectValue placeholder="Bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5"><Label>Original bill no (optional)</Label>
              <Input value={settle.related_bill_no} onChange={(e) => setSettle({ ...settle, related_bill_no: e.target.value })} className="font-mono-num" data-testid="settle-bill-input" /></div>
            <Textarea value={settle.note} onChange={(e) => setSettle({ ...settle, note: e.target.value })} placeholder="Note" data-testid="settle-note-input" />
          </div>
          <DialogFooter><Button onClick={doSettle} data-testid="settle-save-button">Record settlement</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
