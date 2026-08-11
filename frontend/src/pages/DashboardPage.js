import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Money, StatusBadge, StoreDatePicker, SectionTitle, VerifiedTick } from "@/components/shared";
import FinalizePanel from "@/components/FinalizePanel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReceiptText, Wallet, Calculator, GitCompareArrows, FileText, ArrowRight } from "lucide-react";

const Stat = ({ label, paise, colored, testId, sub }) => (
  <Card className="rounded-lg">
    <CardContent className="p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg mt-0.5"><Money paise={paise} colored={colored} signed={colored} data-testid={testId} /></p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </CardContent>
  </Card>
);

const CashierDash = () => {
  const { user, today, storeId } = useApp();
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/reports/today").then((r) => setData(r.data)).catch(() => {});
  }, []);
  if (!data) return <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>;
  const s = data.summary;
  const count = data.count;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">Namaste, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Business date <span className="font-mono-num">{today}</span></p>
        </div>
        <div className="flex gap-2">
          <Button asChild className="bg-[hsl(var(--ruby))] hover:bg-[hsl(var(--ruby))]/90" data-testid="dash-new-bill-button">
            <Link to="/bills"><ReceiptText className="h-4 w-4 mr-1.5" />New Bill</Link>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <Stat label="Bill Total" paise={s.bill_total_paise} testId="stat-bill-total" />
        <Stat label="Cash Received" paise={s.cash_from_bills_paise - s.cash_excess_returned_paise + s.adj_cash_receipts_paise} />
        <Stat label="Non-Cash" paise={s.noncash_from_bills_paise} />
        <Stat label="Less Taken" paise={s.less_taken_paise} />
        <Stat label="Expenses (cash)" paise={s.cash_expenses_paise} />
      </div>
      <Card className="rounded-lg">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Expected cash with you</p>
            <p className="text-2xl font-semibold"><Money paise={s.expected_cash_paise} /></p>
            <p className="text-[11px] text-muted-foreground">Opening <Money paise={s.opening_allocation_paise} /></p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Counted</p>
            {count ? (
              <>
                <p className="text-2xl font-semibold"><Money paise={count.counted_paise} /></p>
                <p className="text-sm"><Money paise={count.variance_paise} colored signed />{" "}
                  <span className="text-[11px] text-muted-foreground">{count.variance_paise < 0 ? "shortage" : count.variance_paise > 0 ? "excess" : "balanced"}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Not submitted yet</p>
            )}
          </div>
          <div className="flex sm:justify-end">
            <Button asChild variant="outline" data-testid="dash-cash-count-button">
              <Link to="/cash-count"><Calculator className="h-4 w-4 mr-1.5" />{count ? "Update count" : "Submit closing count"}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { to: "/allocation", label: "Opening Allocation", icon: Wallet },
          { to: "/adjustments", label: "Other Receipts", icon: FileText },
          { to: "/expenses", label: "Expenses", icon: FileText },
          { to: "/discrepancies", label: "Discrepancies", icon: GitCompareArrows },
        ].map((q) => (
          <Link key={q.to} to={q.to} className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm font-medium hover:border-[hsl(var(--brass))] transition-colors duration-150" data-testid={`quick-${q.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
            <q.icon className="h-4 w-4 text-muted-foreground" />{q.label}
          </Link>
        ))}
      </div>
    </div>
  );
};

const AccountantDash = () => {
  const { allowedStores, date } = useApp();
  const [queues, setQueues] = useState([]);
  useEffect(() => {
    (async () => {
      const rows = [];
      for (const s of allowedStores) {
        try {
          const [recon, exp] = await Promise.all([
            api.get("/recon/items", { params: { store_id: s.id, business_date: date } }),
            api.get("/expenses", { params: { store_id: s.id, business_date: date } }),
          ]);
          const expPending = exp.data.expenses.filter((e) => e.status === "active" && e.review_status === "unreviewed").length;
          rows.push({ store: s, pending: recon.data.status_counts?.pending || 0, unreviewed: recon.data.status_counts?.unreviewed || 0, total: recon.data.total_items, expPending });
        } catch {}
      }
      setQueues(rows);
    })();
  }, [allowedStores, date]);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-xl font-semibold">Reconciliation work queue</h1>
        <StoreDatePicker hideStore />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {queues.map((q) => (
          <Card key={q.store.id} className="rounded-lg" data-testid={`queue-card-${q.store.code}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{q.store.name}</p>
                {q.pending > 0 && <StatusBadge status="pending" label={`${q.pending} Pending`} />}
              </div>
              <p className="text-sm text-muted-foreground">{q.total} non-cash entries · {q.unreviewed} unreviewed · {q.expPending} expenses to review</p>
              <div className="flex gap-2 pt-1">
                <Button asChild size="sm" variant="outline"><Link to="/reconciliation">Reconcile <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link></Button>
                <Button asChild size="sm" variant="ghost"><Link to="/expenses">Expenses</Link></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

const ManagerAdminDash = () => {
  const { user, storeId, date } = useApp();
  const [report, setReport] = useState(null);
  const load = useCallback(() => {
    if (!storeId || !date) return;
    api.get("/reports/store-day", { params: { store_id: storeId, business_date: date } })
      .then((r) => setReport(r.data)).catch(() => setReport(null));
  }, [storeId, date]);
  useEffect(() => { load(); }, [load]);
  const a = report?.aggregate;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-xl font-semibold">{user.role === "admin" ? "Store overview" : "Store readiness"}</h1>
        <div className="flex items-center gap-2">
          <StoreDatePicker />
          {user.role === "admin" && (
            <Button asChild variant="outline" size="sm" data-testid="go-comparison-button">
              <Link to="/comparison">Compare stores</Link>
            </Button>
          )}
        </div>
      </div>
      {a && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            <Stat label="Opening" paise={a.opening_paise} />
            <Stat label="Cash Receipts" paise={a.cash_receipts_paise + a.adj_cash_receipts_paise} />
            <Stat label="Non-Cash" paise={a.noncash_receipts_paise} />
            <Stat label="Cash Expenses" paise={-a.cash_expenses_paise} colored />
            <Stat label="Expected Cash" paise={a.expected_cash_paise} />
            <Stat label="Variance" paise={a.variance_paise} colored />
          </div>
          <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
            <Card className="rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b flex items-center justify-between">
                <p className="font-display font-semibold text-sm">Cashier-wise cash position</p>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <VerifiedTick finalized={a.status === "finalized"} />
                  <StatusBadge status={a.status === "finalized" ? "finalized" : "open-day"} />
                </span>
              </div>
              <div className="overflow-x-auto">
                <Table className="table-compact">
                  <TableHeader><TableRow>
                    <TableHead>Cashier</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Cash In</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Counted</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {report.cashiers.map((c) => (
                      <TableRow key={c.cashier_id} data-testid={`cashier-row-${c.cashier_name?.replace(/\s+/g, "-").toLowerCase()}`}>
                        <TableCell className="font-medium">{c.cashier_name}</TableCell>
                        <TableCell className="amount-cell"><Money paise={c.opening_allocation_paise} /></TableCell>
                        <TableCell className="amount-cell"><Money paise={c.cash_from_bills_paise - c.cash_excess_returned_paise + c.adj_cash_receipts_paise} /></TableCell>
                        <TableCell className="amount-cell"><Money paise={c.expected_cash_paise} /></TableCell>
                        <TableCell className="amount-cell"><Money paise={c.counted_paise} /></TableCell>
                        <TableCell className="amount-cell"><Money paise={c.variance_paise} colored signed /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
            <FinalizePanel storeId={storeId} businessDate={date} onChanged={load} />
          </div>
        </>
      )}
    </div>
  );
};

export default function DashboardPage() {
  const { user } = useApp();
  if (!user) return null;
  if (user.role === "cashier") return <CashierDash />;
  if (user.role === "accountant") return <AccountantDash />;
  return <ManagerAdminDash />;
}
