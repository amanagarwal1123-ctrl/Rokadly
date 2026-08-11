import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg, fromPaise, toPaise } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Money, MoneyInput, StoreDatePicker, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

export default function AllocationPage() {
  const { user, today, storeId, date } = useApp();
  const effStore = user.role === "cashier" ? user.store_id : storeId;
  const effDate = user.role === "cashier" ? today : date;
  const [data, setData] = useState(null);
  const [inputs, setInputs] = useState({});
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");

  const load = useCallback(() => {
    if (!effStore || !effDate) return;
    api.get("/allocations/summary", { params: { store_id: effStore, business_date: effDate } })
      .then((r) => {
        setData(r.data);
        const map = {};
        r.data.allocations.forEach((a) => { map[a.cashier_id] = fromPaise(a.amount_paise); });
        setInputs(map);
      }).catch((e) => toast.error(errMsg(e)));
  }, [effStore, effDate]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>;

  const canEdit = (cid) =>
    data.store_day.status !== "finalized" &&
    ((user.role === "cashier" && cid === user.id && effDate === today) || user.role === "admin");

  const saveAlloc = async (cid) => {
    try {
      const body = { store_id: effStore, business_date: effDate, amount_paise: toPaise(inputs[cid] || 0) };
      if (user.role === "admin") body.cashier_id = cid;
      await api.put("/allocations", body);
      toast.success("Allocation saved");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const saveAdj = async () => {
    if (!adjReason.trim()) { toast.error("Reason is compulsory"); return; }
    try {
      await api.post("/allocations/opening-adjustment", {
        store_id: effStore, business_date: effDate,
        amount_paise: toPaise(adjAmount), reason: adjReason,
      });
      toast.success("Opening adjustment approved");
      setAdjOpen(false); setAdjAmount(""); setAdjReason("");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const cashierRows = data.cashiers.map((c) => ({
    ...c,
    alloc: data.allocations.find((a) => a.cashier_id === c.id),
  }));
  // include allocations of cashiers no longer assigned
  data.allocations.forEach((a) => {
    if (!cashierRows.find((c) => c.id === a.cashier_id))
      cashierRows.push({ id: a.cashier_id, name: a.cashier_name, alloc: a });
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">Opening cash allocation</h1>
          <p className="text-sm text-muted-foreground">Distribute the store opening among cashiers — zero is valid</p>
        </div>
        <StoreDatePicker />
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Card className="rounded-lg"><CardContent className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Store opening</p>
          <p className="text-lg font-semibold"><Money paise={data.effective_opening_paise} /></p>
          {data.opening_adjustment && (
            <p className="text-[11px] text-[hsl(var(--info))]">incl. adjustment <Money paise={data.opening_adjustment.amount_paise} signed /></p>
          )}
        </CardContent></Card>
        <Card className="rounded-lg"><CardContent className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Allocated</p>
          <p className="text-lg font-semibold" data-testid="allocated-amount"><Money paise={data.allocated_paise} /></p>
        </CardContent></Card>
        <Card className={`rounded-lg ${data.unallocated_paise !== 0 ? "border-[hsl(var(--danger))]/50" : "border-[hsl(var(--success))]/50"}`}><CardContent className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Unallocated</p>
          <p className="text-lg" data-testid="unallocated-amount"><Money paise={data.unallocated_paise} colored={data.unallocated_paise !== 0} /></p>
        </CardContent></Card>
      </div>

      {user.role === "admin" && data.store_day.status !== "finalized" && (
        <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="opening-adjustment-button">Admin: opening adjustment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Approved opening adjustment</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Adds/subtracts from the carried opening (use negative via minus in amount? Enter positive amount; use reason to explain). This is audited.</p>
            <MoneyInput value={adjAmount} onChange={setAdjAmount} testId="opening-adjustment-amount" />
            <Textarea value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Reason (compulsory)" data-testid="opening-adjustment-reason" />
            <DialogFooter><Button onClick={saveAdj} data-testid="opening-adjustment-save">Approve</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Card className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="table-compact">
            <TableHeader><TableRow>
              <TableHead>Cashier</TableHead>
              <TableHead className="text-right w-[200px]">Allocation (₹)</TableHead>
              <TableHead>Last changed by</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cashierRows.length === 0 && (
                <TableRow><TableCell colSpan={4}><EmptyState icon={Wallet} title="No cashiers assigned" /></TableCell></TableRow>
              )}
              {cashierRows.map((c) => (
                <TableRow key={c.id} data-testid={`allocation-row-${c.name?.replace(/\s+/g, "-").toLowerCase()}`}>
                  <TableCell className="font-medium">{c.name}{c.id === user.id && <span className="text-[11px] text-[hsl(var(--brass))] ml-1">(you)</span>}</TableCell>
                  <TableCell className="text-right">
                    {canEdit(c.id) ? (
                      <MoneyInput value={inputs[c.id] ?? ""} onChange={(v) => setInputs({ ...inputs, [c.id]: v })}
                        className="h-9 w-[160px] ml-auto" testId={`allocation-input-${c.name?.replace(/\s+/g, "-").toLowerCase()}`} />
                    ) : (
                      <Money paise={c.alloc?.amount_paise ?? null} />
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.alloc?.history?.length ? `${c.alloc.history[c.alloc.history.length - 1].set_by_name}` : "—"}
                  </TableCell>
                  <TableCell>
                    {canEdit(c.id) && (
                      <Button size="sm" className="h-8" onClick={() => saveAlloc(c.id)} data-testid={`allocation-save-${c.name?.replace(/\s+/g, "-").toLowerCase()}`}>Save</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
