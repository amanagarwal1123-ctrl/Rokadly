import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, errMsg, RECON_LABELS } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Money, StatusBadge, StoreDatePicker, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { GitCompareArrows, Printer, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export default function ReconciliationPage() {
  const { user, storeId, date } = useApp();
  const [data, setData] = useState(null);
  const [pendingOnly, setPendingOnly] = useState(false);

  const perms = user.manager_permissions?.[storeId] || {};
  const canMark = user.role === "admin" || user.role === "accountant" ||
    (user.role === "manager" && (perms.reconcile || perms.mark_status));
  const canClear = user.role === "admin" || user.role === "accountant" ||
    (user.role === "manager" && perms.clear_matched);
  const canTally = user.role === "admin" || (user.role === "manager" && perms.final_tally);
  const canException = user.role === "admin";

  const load = useCallback(() => {
    if (!storeId || !date) return;
    api.get("/recon/items", { params: { store_id: storeId, business_date: date } })
      .then((r) => setData(r.data))
      .catch((e) => { setData(null); toast.error(errMsg(e)); });
  }, [storeId, date]);
  useEffect(() => { load(); }, [load]);

  const mark = async (item, status, note) => {
    try {
      await api.patch("/recon/item", {
        source: item.source, ref_id: item.ref_id, payment_index: item.payment_index,
        status, note: note || null,
      });
      toast.success(`Marked ${RECON_LABELS[status]}`);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const tally = async (group, val) => {
    try {
      await api.post("/recon/tally", { store_id: storeId, business_date: date, group_key: group.group_key, tallied: val });
      toast.success(val ? `${group.group_label} tallied against physical statement` : "Tally removed");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (!data) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="font-display text-xl font-semibold">Reconciliation</h1><StoreDatePicker /></div>
      <EmptyState icon={GitCompareArrows} title="No reconciliation access or no data" />
    </div>
  );

  const sc = data.status_counts || {};

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">Non-cash reconciliation</h1>
          <p className="text-sm text-muted-foreground">Continuous serials — Card, Cheque, Banks in configured order, Other</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StoreDatePicker />
          <Button asChild variant="outline" size="sm" data-testid="print-noncash-button">
            <Link to={`/print/noncash?store_id=${storeId}&business_date=${date}`}><Printer className="h-4 w-4 mr-1" />Non-cash list</Link>
          </Button>
          <Button asChild variant="outline" size="sm" data-testid="print-cash-button">
            <Link to={`/print/cash?store_id=${storeId}&business_date=${date}`}><Printer className="h-4 w-4 mr-1" />Cash list</Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap text-xs" data-testid="recon-status-summary">
          <StatusBadge status="unreviewed" label={`Unreviewed ${sc.unreviewed || 0}`} />
          <StatusBadge status="pending" label={`Pending ${sc.pending || 0}`} />
          <StatusBadge status="matched" label={`Matched ${sc.matched || 0}`} />
          <StatusBadge status="cleared" label={`Cleared ${sc.cleared || 0}`} />
          {sc.exception_approved ? <StatusBadge status="exception_approved" label={`Exception ${sc.exception_approved}`} /> : null}
          {sc.finally_tallied ? <StatusBadge status="finally_tallied" label={`Tallied ${sc.finally_tallied}`} /> : null}
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={pendingOnly} onCheckedChange={setPendingOnly} id="pending-only" data-testid="reconciliation-pending-only-toggle" />
          <Label htmlFor="pending-only" className="text-sm">Pending only</Label>
        </div>
      </div>

      {data.groups.length === 0 && <EmptyState icon={GitCompareArrows} title="No non-cash entries for this date" />}

      {data.groups.map((g) => {
        const items = pendingOnly ? g.items.filter((i) => i.recon_status === "pending") : g.items;
        if (pendingOnly && items.length === 0) return null;
        return (
          <Card key={g.group_key} className="rounded-lg overflow-hidden" data-testid={`recon-group-${g.group_key}`}>
            <div className="px-4 py-2.5 border-b flex items-center justify-between flex-wrap gap-2 bg-secondary/50">
              <div className="flex items-center gap-2">
                <p className="font-display font-semibold text-sm">{g.group_label}</p>
                <span className="text-[11px] text-muted-foreground font-mono-num">Serials {g.serial_from}–{g.serial_to}</span>
                <Money paise={g.total_paise} className="text-sm font-semibold" />
              </div>
              {canTally && (
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer" data-testid={`tally-checkbox-${g.group_key}`}>
                  <Checkbox checked={g.tallied} onCheckedChange={(v) => tally(g, !!v)} />
                  Physical statement tallied {g.tallied_by_name ? `(${g.tallied_by_name})` : ""}
                </label>
              )}
              {!canTally && g.tallied && <StatusBadge status="finalized" label="Tallied" />}
            </div>
            <div className="overflow-x-auto">
              <Table className="table-compact">
                <TableHeader><TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Bill / Ref</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  {canMark && <TableHead className="w-[110px]">Action</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={`${it.ref_id}-${it.payment_index}`}
                      className={it.recon_status === "pending" ? "pending-row" : ["matched", "cleared", "finally_tallied"].includes(it.recon_status) ? "matched-row" : ""}
                      data-testid={`reconciliation-row-serial-${it.serial}`}>
                      <TableCell className="font-mono-num font-bold">{it.serial}</TableCell>
                      <TableCell className="font-mono-num">{it.bill_no || "—"}{it.cheque_no ? <span className="block text-[11px] opacity-70">chq {it.cheque_no}</span> : null}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{it.customer_name || "—"}{it.other_label ? <span className="block text-[11px] opacity-70">{it.other_label}</span> : null}</TableCell>
                      <TableCell className="text-xs">{it.cashier_name}</TableCell>
                      <TableCell className="amount-cell"><Money paise={it.amount_paise} /></TableCell>
                      <TableCell><StatusBadge status={it.recon_status} />{it.recon_note && <span className="block text-[10px] opacity-70 mt-0.5">{it.recon_note}</span>}</TableCell>
                      {canMark && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant={it.recon_status === "pending" ? "secondary" : "outline"} className="h-7 text-xs" data-testid={`recon-action-serial-${it.serial}`}>
                                Mark <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => mark(it, "matched")} data-testid={`mark-matched-${it.serial}`}>Matched</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => mark(it, "pending")} className="text-[hsl(var(--danger))]" data-testid={`mark-pending-${it.serial}`}>Pending (not found)</DropdownMenuItem>
                              {canClear && <DropdownMenuItem onClick={() => mark(it, "cleared")} data-testid={`mark-cleared-${it.serial}`}>Cleared</DropdownMenuItem>}
                              {canException && <DropdownMenuItem onClick={() => mark(it, "exception_approved", "Approved by admin")} data-testid={`mark-exception-${it.serial}`}>Approve exception</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => mark(it, "unreviewed")}>Reset to Unreviewed</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        );
      })}

      <p className="text-[11px] text-muted-foreground">
        Total {data.total_items} entries · <Money paise={data.total_paise} /> · Pending items block finalization until cleared or approved.
      </p>
    </div>
  );
}
