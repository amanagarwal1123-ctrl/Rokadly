import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg, toPaise } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Money, MoneyInput, StoreDatePicker } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const Line = ({ label, paise, neg, strong }) => (
  <div className={`flex justify-between text-sm ${strong ? "font-semibold border-t pt-1.5 mt-1" : ""}`}>
    <span className={neg ? "text-muted-foreground" : ""}>{label}</span>
    <Money paise={neg ? -paise : paise} signed={neg} colored={neg && paise > 0} />
  </div>
);

export default function CashCountPage() {
  const { user, today, storeId, date } = useApp();
  const isAdmin = user.role === "admin";
  const effStore = isAdmin ? storeId : user.store_id;
  const effDate = isAdmin ? date : today;
  const [cashierId, setCashierId] = useState(user.role === "cashier" ? user.id : "");
  const [cashiers, setCashiers] = useState([]);
  const [data, setData] = useState(null);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [allCounts, setAllCounts] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAdmin && effStore) {
      api.get("/allocations/summary", { params: { store_id: effStore, business_date: effDate } })
        .then((r) => {
          setCashiers(r.data.cashiers);
          if (r.data.cashiers.length && !r.data.cashiers.find((c) => c.id === cashierId))
            setCashierId(r.data.cashiers[0].id);
        }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, effStore, effDate]);

  const load = useCallback(() => {
    if (!effStore || !effDate) return;
    const cid = user.role === "cashier" ? user.id : cashierId;
    if (!cid) return;
    api.get("/cash-counts/expected", { params: { store_id: effStore, business_date: effDate, cashier_id: cid } })
      .then((r) => {
        setData(r.data);
        if (r.data.count) {
          setCounted(String(r.data.count.counted_paise / 100));
          setNote(r.data.count.note || "");
        } else { setCounted(""); setNote(""); }
      }).catch((e) => toast.error(errMsg(e)));
    if (user.role !== "cashier") {
      api.get("/cash-counts", { params: { store_id: effStore, business_date: effDate } })
        .then((r) => setAllCounts(r.data)).catch(() => {});
    }
  }, [effStore, effDate, cashierId, user]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>;
  const s = data.summary;
  const countedP = toPaise(counted);
  const variance = counted === "" ? null : countedP - s.expected_cash_paise;

  const submit = async () => {
    if (variance !== 0 && variance !== null && !note.trim()) {
      toast.error("Variance detected — a reason/note is compulsory");
      return;
    }
    setBusy(true);
    try {
      const body = { store_id: effStore, business_date: effDate, counted_paise: countedP, note: note || null };
      if (isAdmin) body.cashier_id = cashierId;
      const { data: res } = await api.post("/cash-counts", body);
      toast.success(`Count submitted — variance ${res.variance_paise === 0 ? "nil" : (res.variance_paise / 100).toFixed(2)}`);
      load();
    } catch (e) { toast.error(errMsg(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">Closing cash count</h1>
          <p className="text-sm text-muted-foreground">Count the physical cash with you and submit</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <StoreDatePicker />}
          {isAdmin && (
            <Select value={cashierId} onValueChange={setCashierId}>
              <SelectTrigger className="h-9 w-[160px]" data-testid="count-cashier-select"><SelectValue placeholder="Cashier" /></SelectTrigger>
              <SelectContent>
                {cashiers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Card className="rounded-lg">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Expected cash build-up</p>
            <Line label="Opening allocation" paise={s.opening_allocation_paise} />
            <Line label="Cash received on bills" paise={s.cash_from_bills_paise} />
            <Line label="Excess returned in cash" paise={s.cash_excess_returned_paise} neg />
            <Line label="Other cash receipts" paise={s.adj_cash_receipts_paise} />
            <Line label="Cash deductions" paise={s.adj_cash_deductions_paise} neg />
            <Line label="Cash expenses / business payments" paise={s.cash_expenses_paise} neg />
            <Line label="Expected cash" paise={s.expected_cash_paise} strong />
            <p className="text-[11px] text-muted-foreground mt-2">Less Taken is reported separately and never subtracted from cash — only actual cash movements count here.</p>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardContent className="p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Actual physical cash</p>
            <MoneyInput value={counted} onChange={setCounted} className="h-12 text-lg" testId="cash-count-input" />
            {variance !== null && (
              <div className={`rounded p-2.5 text-sm font-semibold ${variance === 0 ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" : "bg-[hsl(var(--danger))]/10 text-[hsl(var(--danger))]"}`} data-testid="variance-preview">
                {variance === 0 ? "Balanced — no variance" : variance < 0
                  ? <>Shortage <Money paise={variance} signed /></>
                  : <>Excess <Money paise={variance} signed /></>}
              </div>
            )}
            {variance !== null && variance !== 0 && (
              <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Reason / note (compulsory for variance)" data-testid="cash-count-note-input" />
            )}
            <Button onClick={submit} disabled={busy || counted === ""}
              className="w-full h-11 bg-[hsl(var(--primary))]" data-testid="cash-count-submit-button">
              {data.count ? "Resubmit count" : "Submit count"}
            </Button>
            {data.count && (
              <p className="text-[11px] text-muted-foreground">
                Submitted: <Money paise={data.count.counted_paise} /> (variance <Money paise={data.count.variance_paise} signed />) — resubmitting keeps history
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {allCounts && (
        <Card className="rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b"><p className="font-display font-semibold text-sm">All cashier counts — {effDate}</p></div>
          <Table className="table-compact">
            <TableHeader><TableRow>
              <TableHead>Cashier</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Counted</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead>Note</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {allCounts.counts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.cashier_name}</TableCell>
                  <TableCell className="amount-cell"><Money paise={c.expected_paise} /></TableCell>
                  <TableCell className="amount-cell"><Money paise={c.counted_paise} /></TableCell>
                  <TableCell className="amount-cell"><Money paise={c.variance_paise} colored signed /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.note || "—"}</TableCell>
                </TableRow>
              ))}
              {allCounts.missing.map((m) => (
                <TableRow key={m.cashier_id} className="bg-[hsl(var(--warning))]/8">
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell colSpan={4} className="text-xs text-[hsl(28_80%_30%)] font-semibold">Count not submitted yet</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
