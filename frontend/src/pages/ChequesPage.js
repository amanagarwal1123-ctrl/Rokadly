import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Money, StatusBadge, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["all", "pending", "passed", "bounced", "paid_returned"];
const LABELS = { all: "All", pending: "Pending", passed: "Passed", bounced: "Bounced", paid_returned: "Paid/Returned" };

export default function ChequesPage() {
  const { user, today } = useApp();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [cheques, setCheques] = useState([]);
  const [target, setTarget] = useState(null);
  const [newStatus, setNewStatus] = useState("passed");
  const [statusDate, setStatusDate] = useState(today);
  const [remark, setRemark] = useState("");

  const canManage = (c) => user.role === "admin" ||
    (user.role === "manager" && user.manager_permissions?.[c.store_id]?.manage_cheques);

  const load = useCallback(() => {
    api.get("/cheques", { params: { status, search: search || undefined } })
      .then((r) => setCheques(r.data.cheques)).catch((e) => toast.error(errMsg(e)));
  }, [status, search]);
  useEffect(() => { load(); }, [load]);

  const applyStatus = async () => {
    if (newStatus !== "pending" && !statusDate) { toast.error("Date required"); return; }
    if (newStatus === "paid_returned" && !remark.trim()) {
      toast.error("A remark is compulsory for Paid/Returned"); return;
    }
    try {
      await api.patch(`/cheques/${target.id}/status`, {
        status: newStatus, status_date: statusDate, remark: remark || null,
      });
      toast.success(`Cheque marked ${LABELS[newStatus]}`);
      setTarget(null); setRemark("");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">Cheque ledger</h1>
          <p className="text-sm text-muted-foreground">Bounced cheques are recorded here only — receivables stay in MMI</p>
        </div>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cheque no / name / bill…" className="h-9 w-[240px]" data-testid="cheque-search-input" />
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          {STATUSES.map((s) => <TabsTrigger key={s} value={s} data-testid={`cheque-filter-${s}`}>{LABELS[s]}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <Card className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="table-compact">
            <TableHeader><TableRow>
              <TableHead>Cheque No</TableHead><TableHead>Name</TableHead><TableHead>Bill</TableHead>
              <TableHead>Received</TableHead><TableHead className="text-right">Amount</TableHead>
              <TableHead>Age</TableHead><TableHead>Status</TableHead><TableHead className="w-[90px]"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cheques.length === 0 && <TableRow><TableCell colSpan={8}><EmptyState icon={BookOpen} title="No cheques" /></TableCell></TableRow>}
              {cheques.map((c) => (
                <TableRow key={c.id} className={c.status === "bounced" ? "bg-[hsl(var(--danger))]/8" : ""} data-testid={`cheque-row-${c.cheque_no}`}>
                  <TableCell className="font-mono-num font-semibold">{c.cheque_no}</TableCell>
                  <TableCell>{c.name_on_cheque || "—"}<span className="block text-[11px] text-muted-foreground">{c.cashier_name}</span></TableCell>
                  <TableCell className="font-mono-num text-xs">{c.bill_no}</TableCell>
                  <TableCell className="font-mono-num text-xs">{c.received_date}</TableCell>
                  <TableCell className="amount-cell"><Money paise={c.amount_paise} /></TableCell>
                  <TableCell className="text-xs">{c.age_days != null ? `${c.age_days}d` : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                    {c.status_remark && <span className="block text-[10px] text-muted-foreground mt-0.5 max-w-[180px] truncate">{c.status_remark}</span>}
                  </TableCell>
                  <TableCell>
                    {canManage(c) && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setTarget(c); setNewStatus(c.status === "pending" ? "passed" : c.status); setStatusDate(today); setRemark(c.status_remark || ""); }}
                        data-testid={`cheque-status-button-${c.cheque_no}`}>Status</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cheque {target?.cheque_no} — update status</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="cheque-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
                  <SelectItem value="paid_returned">Paid/Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newStatus !== "pending" && (
              <div className="space-y-1.5">
                <Label>{newStatus === "passed" ? "Passing date" : newStatus === "bounced" ? "Bounce date" : "Return date"}</Label>
                <Input type="date" value={statusDate} onChange={(e) => setStatusDate(e.target.value)} data-testid="cheque-status-date" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Remark {newStatus === "paid_returned" ? <span className="text-[hsl(var(--danger))]">* compulsory</span> : "(optional)"}</Label>
              <Textarea value={remark} onChange={(e) => setRemark(e.target.value)}
                placeholder={newStatus === "paid_returned" ? "Explain how payment was handled and that cheque was returned" : "Remark"}
                data-testid="cheque-status-remark" />
            </div>
            {newStatus === "bounced" && (
              <p className="text-[11px] text-muted-foreground">Bouncing is report-only in Rokadly. No receivable is created and the bill is not reopened — MMI handles recovery.</p>
            )}
          </div>
          <DialogFooter><Button onClick={applyStatus} data-testid="cheque-status-apply">Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
