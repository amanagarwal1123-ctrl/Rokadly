import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useAsyncData } from "@/hooks/useAsyncData";
import { Money, StatusBadge, EmptyState, LoadErrorState, LoadingState } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export default function CrossStorePage() {
  const { today } = useApp();
  const [range, setRange] = useState({ from: today, to: today });

  const q = useAsyncData(
    () => {
      if (!range.from || !range.to) return Promise.resolve(null);
      return api.get("/reports/cross-store", { params: { date_from: range.from, date_to: range.to } })
        .then((r) => r.data.groups);
    },
    [range.from, range.to]
  );
  const groups = q.data;
  const load = q.reload;
  useEffect(() => { setRange({ from: today, to: today }); }, [today]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold arch-underline">Account-centric cross-store receipts</h1>
          <p className="text-sm text-muted-foreground">Every store's receipts appearing in the same physical bank statement. Ownership never moves.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1"><Label className="text-xs">From</Label>
            <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9 w-[145px]" data-testid="cross-store-from" /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label>
            <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9 w-[145px]" data-testid="cross-store-to" /></div>
          <Button onClick={load} className="h-9" data-testid="cross-store-run">Run</Button>
        </div>
      </div>

      {q.error && <LoadErrorState error={q.error} onRetry={q.reload} title="Could not load cross-store receipts" />}
      {q.loading && <LoadingState />}
      {groups?.length === 0 && <EmptyState icon={Building2} title="No bank receipts in range" />}

      {groups?.map((g) => (
        <Card key={g.bank_id} className="rounded-lg overflow-hidden" data-testid={`cross-store-group-${g.bank_name}`}>
          <div className="px-4 py-2.5 border-b bg-secondary/50 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-display font-semibold text-sm">{g.bank_name}
                <span className="font-normal text-muted-foreground text-xs ml-2">home: {g.home_store_name || "—"}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {g.cross_store_count > 0 && (
                <span className="text-xs font-semibold text-[hsl(var(--brass))]">{g.cross_store_count} cross-store receipt(s)</span>
              )}
              <Money paise={g.total_paise} className="font-semibold" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="table-compact">
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Bill</TableHead><TableHead>Selling store</TableHead>
                <TableHead>Party</TableHead><TableHead>Cashier</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead>Recon</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {g.items.map((it, i) => (
                  <TableRow key={i} className={it.cross_store ? "border-l-2 border-[hsl(var(--brass))] bg-[hsl(var(--brass))]/5" : ""}
                    data-testid={it.cross_store ? `cross-store-item-${it.bill_no}` : undefined}>
                    <TableCell className="font-mono-num text-xs">{it.business_date}</TableCell>
                    <TableCell className="font-mono-num">{it.bill_no || "—"}</TableCell>
                    <TableCell>
                      {it.selling_store_name}
                      {it.cross_store && <span className="ml-1.5 text-[10px] font-bold text-[hsl(var(--brass))] uppercase">cross-store</span>}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">{it.customer_name || "—"}</TableCell>
                    <TableCell className="text-xs">{it.cashier_name}</TableCell>
                    <TableCell className="amount-cell"><Money paise={it.amount_paise} /></TableCell>
                    <TableCell><StatusBadge status={it.recon_status || "unreviewed"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ))}
    </div>
  );
}
