import React, { useEffect, useState } from "react";
import { api, errMsg, fromPaise, toPaise } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useAsyncData, useStoreDayLock } from "@/hooks/useAsyncData";
import { Money, MoneyInput, StoreDatePicker, EmptyState, DayLockBanner, LoadErrorState, LoadingState } from "@/components/shared";
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
  const [inputs, setInputs] = useState({});
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");

  const { storeDay, refresh: refreshLock } = useStoreDayLock(effStore, effDate);

  const q = useAsyncData(
    () => {
      if (!effStore || !effDate) return Promise.resolve(null);
      return api.get("/allocations/summary", { params: { store_id: effStore, business_date: effDate } })
        .then((r) => r.data);
    },
    [effStore, effDate]
  );
  const data = q.data;

  useEffect(() => {
    if (!data) { setInputs({}); return; }
    const map = {};
    data.allocations.forEach((a) => { map[a.cashier_id] = fromPaise(a.amount_paise); });
    setInputs(map);
  }, [data]);

  const header = (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h1 className="font-display text-xl font-semibold arch-underline">Opening cash allocation</h1>
        <p className="text-sm text-muted-foreground">Distribute the store opening among cashiers — zero is valid</p>
      </div>
      <StoreDatePicker />
    </div>
  );

  if (q.error) return <div className="space-y-5">{header}<LoadErrorState error={q.error} onRetry={q.reload} title="Could not load opening allocations" /></div>;
  if (q.loading) return <div className="space-y-5">{header}<LoadingState /></div>;
  if (!data) return <div className="space-y-5">{header}<EmptyState icon={Wallet} title="Select a store and date" /></div>;

  const dayFinalized = data.store_day.status === "finalized";

  const canEdit = (cid) =>
    !dayFinalized &&
    ((user.role === "cashier" && cid === user.id && effDate === today) || user.role === "admin");

  const saveAlloc = async (cid) => {
    try {
      const body = { store_id: effStore, business_date: effDate, amount_paise: toPaise(inputs[cid] || 0) };
      if (user.role === "admin") body.cashier_id = cid;
      await api.put("/allocations", body);
      toast.success("Allocation saved");
      q.refresh(); refreshLock();
    } catch (e) { toast.error(errMsg(e)); }
  };

  // Signed opening adjustment (admin): preview the resulting effective opening
  const adjPaise = toPaise(adjAmount);
  const previewOpening = data.opening_paise !== undefined
    ? (data.opening_paise ?? 0) + adjPaise
    : null;

  const saveAdj = async () => {
    if (!adjReason.trim()) { toast.error("Reason is compulsory"); return; }
    if (!adjPaise) { toast.error("Enter a non-zero amount (negative allowed)"); return; }
    try {
      await api.post("/allocations/opening-adjustment", {
        store_id: effStore, business_date: effDate,
        amount_paise: adjPaise, reason: adjReason,
      });
      toast.success("Opening adjustment approved");
      setAdjOpen(false); setAdjAmount(""); setAdjReason("");
      q.refresh(); refreshLock();
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
      {header}

      <DayLockBanner storeDay={storeDay || data.store_day} />

      <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-2.5">
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

      {user.role === "admin" && !dayFinalized && (
        <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="opening-adjustment-button">Admin: opening adjustment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Approved opening adjustment</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Enter a positive amount to add to the carried opening, or a negative amount (e.g. <span className="font-mono-num">-500</span>) to reduce it.
              A reason is compulsory and the change is audited.
            </p>
            <MoneyInput value={adjAmount} onChange={setAdjAmount} allowNegative testId="opening-adjustment-amount" placeholder="e.g. 500 or -500" />
            {adjAmount !== "" && adjAmount !== "-" && (
              <p className="text-xs" data-testid="opening-adjustment-preview">
                Carried opening <Money paise={data.opening_paise} /> {adjPaise >= 0 ? "+" : "−"} <Money paise={Math.abs(adjPaise)} />
                {" "}→ effective opening{" "}
                <Money paise={previewOpening} className={previewOpening < 0 ? "money-neg" : "font-semibold"} />
                {previewOpening < 0 && <span className="text-[hsl(var(--danger))] ml-1">cannot go below zero</span>}
              </p>
            )}
            <Textarea value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Reason (compulsory)" data-testid="opening-adjustment-reason" />
            <DialogFooter>
              <Button onClick={saveAdj} disabled={!adjReason.trim() || !adjPaise || previewOpening < 0} data-testid="opening-adjustment-save">Approve</Button>
            </DialogFooter>
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
