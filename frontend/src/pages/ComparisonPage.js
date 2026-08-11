import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Money, StatusBadge, VerifiedTick } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const METRICS = [
  { key: "opening_paise", label: "Opening Cash" },
  { key: "bill_total_paise", label: "Bill Total" },
  { key: "cash_receipts_paise", label: "Cash" },
  { key: "bank_paise", label: "Bank" },
  { key: "card_paise", label: "Card" },
  { key: "cheque_paise", label: "Cheque" },
  { key: "other_paise", label: "Other" },
  { key: "cash_expenses_paise", label: "Cash Expenses" },
  { key: "less_taken_paise", label: "Less Taken" },
  { key: "cash_refunds_paise", label: "Cash Refunds" },
  { key: "expected_cash_paise", label: "Expected Cash", strong: true },
  { key: "actual_cash_paise", label: "Actual Cash", strong: true },
  { key: "variance_paise", label: "Variance", colored: true },
];

export default function ComparisonPage() {
  const { today, setStoreId } = useApp();
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState(null);

  const load = useCallback(() => {
    if (!date) return;
    api.get("/reports/comparison", { params: { business_date: date } })
      .then((r) => setRows(r.data.rows)).catch((e) => toast.error(errMsg(e)));
  }, [date]);
  useEffect(() => { setDate(today); }, [today]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">Store comparison</h1>
          <p className="text-sm text-muted-foreground">Main and branch stores side by side — click a store to drill in</p>
        </div>
        <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="h-9 w-[150px]" data-testid="comparison-date-input" />
      </div>

      <Card className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="table-compact">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Metric</TableHead>
                {rows?.map((r) => (
                  <TableHead key={r.store_id} className="text-right min-w-[130px]">
                    <Link to="/" onClick={() => setStoreId(r.store_id)}
                      className="hover:text-[hsl(var(--brass))] transition-colors duration-150"
                      data-testid={`comparison-store-link-${r.store_name?.replace(/\s+/g, "-").toLowerCase()}`}>
                      {r.store_name}
                    </Link>
                    <span className="block text-[10px] font-normal text-muted-foreground normal-case">{r.store_type === "main" ? "Main" : "Branch"}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {METRICS.map((m) => (
                <TableRow key={m.key} className={m.strong ? "bg-secondary/40" : ""}>
                  <TableCell className={`${m.strong ? "font-semibold" : ""}`}>{m.label}</TableCell>
                  {rows?.map((r) => (
                    <TableCell key={r.store_id} className="amount-cell" data-testid={`comparison-${m.key}-${r.store_name?.replace(/\s+/g, "-").toLowerCase()}`}>
                      <Money paise={r[m.key]} colored={m.colored} signed={m.colored} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">Pending items</TableCell>
                {rows?.map((r) => (
                  <TableCell key={r.store_id} className="text-right">
                    {r.pending_count > 0 ? <StatusBadge status="pending" label={`${r.pending_count} Pending`} /> : <span className="text-xs text-muted-foreground">None</span>}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Status</TableCell>
                {rows?.map((r) => (
                  <TableCell key={r.store_id} className="text-right">
                    <span className="inline-flex items-center gap-1.5 justify-end">
                      <VerifiedTick finalized={r.status === "finalized"} />
                      <StatusBadge status={r.status === "finalized" ? "finalized" : "open-day"} />
                    </span>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
