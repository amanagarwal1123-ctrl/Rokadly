import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg, fmtINR, fmtDateTime } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Money, StatusBadge, VerifiedTick, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookMarked, Download } from "lucide-react";
import { toast } from "sonner";

const dayName = (iso) => {
  try { return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }); } catch { return ""; }
};

export default function RegisterPage() {
  const { user, today, allowedStores } = useApp();
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const [range, setRange] = useState({ from: weekAgo, to: today });
  const [storeFilter, setStoreFilter] = useState("all");
  const [rows, setRows] = useState(null);

  const load = useCallback(() => {
    if (!range.from || !range.to) return;
    const params = { date_from: range.from, date_to: range.to };
    if (storeFilter !== "all") params.store_id = storeFilter;
    api.get("/reports/register", { params }).then((r) => setRows(r.data.rows)).catch((e) => toast.error(errMsg(e)));
  }, [range, storeFilter]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!rows?.length) return;
    const head = ["Date", "Day", "Store", "Opening", "Cash Receipts", "Non-Cash", "Cash Expenses", "Less Taken", "Cash Refunds", "Expected", "Actual", "Variance", "Unresolved Disc.", "Pending", "Status", "Finalized By", "Finalized At"];
    const lines = rows.map((r) => [
      r.business_date, dayName(r.business_date), r.store_name,
      fmtINR(r.opening_paise), fmtINR(r.cash_receipts_paise + r.adj_cash_receipts_paise), fmtINR(r.noncash_receipts_paise),
      fmtINR(r.cash_expenses_paise), fmtINR(r.less_taken_paise), fmtINR(r.cash_refunds_paise),
      fmtINR(r.expected_cash_paise), fmtINR(r.actual_cash_paise), fmtINR(r.variance_paise),
      fmtINR(r.unresolved_discrepancy_paise), r.pending_count, r.status,
      r.finalized_by_name || "", r.finalized_at ? fmtDateTime(r.finalized_at) : "",
    ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","));
    const blob = new Blob(["\ufeff" + [head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rokad-register-${range.from}-to-${range.to}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">Daily Rokad register</h1>
          <p className="text-sm text-muted-foreground">Verified days carry a green tick</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1"><Label className="text-xs">From</Label>
            <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9 w-[145px]" data-testid="register-from-date" /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label>
            <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9 w-[145px]" data-testid="register-to-date" /></div>
          {user.role !== "cashier" && (
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="h-9 w-[160px]" data-testid="register-store-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All my stores</SelectItem>
                {allowedStores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" className="h-9" onClick={exportCsv} data-testid="register-export-csv">
            <Download className="h-4 w-4 mr-1" />CSV
          </Button>
        </div>
      </div>

      <Card className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="table-compact sticky-thead">
            <TableHeader><TableRow>
              <TableHead className="w-[36px]"></TableHead>
              <TableHead>Date</TableHead><TableHead>Store</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Cash In</TableHead>
              <TableHead className="text-right">Non-Cash</TableHead>
              <TableHead className="text-right">Cash Exp.</TableHead>
              <TableHead className="text-right">Less Taken</TableHead>
              <TableHead className="text-right">Refunds</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Short/Excess</TableHead>
              <TableHead className="text-right">Unres. Disc.</TableHead>
              <TableHead>Pending</TableHead>
              <TableHead>Finalized</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {!rows && <TableRow><TableCell colSpan={15} className="text-center py-8 text-sm text-muted-foreground animate-pulse">Loading…</TableCell></TableRow>}
              {rows?.length === 0 && <TableRow><TableCell colSpan={15}><EmptyState icon={BookMarked} title="No Rokad entries in range" /></TableCell></TableRow>}
              {rows?.map((r) => (
                <TableRow key={`${r.store_id}-${r.business_date}`} data-testid={`register-row-${r.business_date}-${r.store_name?.replace(/\s+/g, "-").toLowerCase()}`}>
                  <TableCell><VerifiedTick finalized={r.status === "finalized"} /></TableCell>
                  <TableCell className="font-mono-num text-xs whitespace-nowrap">{r.business_date}<span className="block text-[10px] text-muted-foreground">{dayName(r.business_date)}</span></TableCell>
                  <TableCell className="font-medium">{r.store_name}{r.needs_revalidation && <span className="block text-[10px] text-[hsl(var(--warning))] font-semibold">needs revalidation</span>}</TableCell>
                  <TableCell className="amount-cell"><Money paise={r.opening_paise} /></TableCell>
                  <TableCell className="amount-cell"><Money paise={r.cash_receipts_paise + r.adj_cash_receipts_paise} /></TableCell>
                  <TableCell className="amount-cell"><Money paise={r.noncash_receipts_paise} /></TableCell>
                  <TableCell className="amount-cell"><Money paise={r.cash_expenses_paise} /></TableCell>
                  <TableCell className="amount-cell"><Money paise={r.less_taken_paise} /></TableCell>
                  <TableCell className="amount-cell"><Money paise={r.cash_refunds_paise} /></TableCell>
                  <TableCell className="amount-cell"><Money paise={r.expected_cash_paise} /></TableCell>
                  <TableCell className="amount-cell"><Money paise={r.actual_cash_paise} /></TableCell>
                  <TableCell className="amount-cell"><Money paise={r.variance_paise} colored signed /></TableCell>
                  <TableCell className="amount-cell">{r.unresolved_discrepancy_paise ? <Money paise={r.unresolved_discrepancy_paise} className="money-neg" /> : "—"}</TableCell>
                  <TableCell>{r.pending_count > 0 ? <StatusBadge status="pending" label={`${r.pending_count}`} /> : <span className="text-xs text-muted-foreground">0</span>}</TableCell>
                  <TableCell className="text-xs">
                    {r.status === "finalized"
                      ? <>{r.finalized_by_name}<span className="block text-[10px] text-muted-foreground">{fmtDateTime(r.finalized_at)}</span></>
                      : <StatusBadge status="open-day" />}
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
