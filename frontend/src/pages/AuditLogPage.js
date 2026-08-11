import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg, fmtDateTime } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { EmptyState } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollText, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export default function AuditLogPage() {
  const { stores } = useApp();
  const [logs, setLogs] = useState([]);
  const [entity, setEntity] = useState("all");
  const [storeF, setStoreF] = useState("all");
  const [dateF, setDateF] = useState("");
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(() => {
    const params = { limit: 300 };
    if (entity !== "all") params.entity = entity;
    if (storeF !== "all") params.store_id = storeF;
    if (dateF) params.business_date = dateF;
    api.get("/audit-log", { params }).then((r) => setLogs(r.data.logs)).catch((e) => toast.error(errMsg(e)));
  }, [entity, storeF, dateF]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold arch-underline">Audit log</h1>
          <p className="text-sm text-muted-foreground">Append-only history of every change with actor, before/after and reason</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger className="h-9 w-[150px]" data-testid="audit-entity-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {["bill", "expense", "adjustment", "allocation", "cash_count", "discrepancy", "cheque", "store_day", "user", "bank", "bank_request", "head", "account_tally"].map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={storeF} onValueChange={setStoreF}>
            <SelectTrigger className="h-9 w-[150px]" data-testid="audit-store-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dateF} onChange={(e) => setDateF(e.target.value)} className="h-9 w-[150px]" data-testid="audit-date-filter" />
        </div>
      </div>

      <Card className="rounded-lg overflow-hidden">
        <Table className="table-compact">
          <TableHeader><TableRow>
            <TableHead className="w-[140px]">When</TableHead><TableHead>Actor</TableHead>
            <TableHead>Action</TableHead><TableHead>Entity</TableHead>
            <TableHead>Reason</TableHead><TableHead className="w-[40px]"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {logs.length === 0 && <TableRow><TableCell colSpan={6}><EmptyState icon={ScrollText} title="No audit entries" /></TableCell></TableRow>}
            {logs.map((l) => (
              <React.Fragment key={l.id}>
                <TableRow className="cursor-pointer" onClick={() => setExpanded(expanded === l.id ? null : l.id)} data-testid={`audit-row-${l.action}`}>
                  <TableCell className="text-xs font-mono-num whitespace-nowrap">{fmtDateTime(l.ts)}</TableCell>
                  <TableCell className="text-xs">{l.actor_name}<span className="block text-[10px] text-muted-foreground capitalize">{l.actor_role}</span></TableCell>
                  <TableCell className="font-mono-num text-xs font-semibold">{l.action}</TableCell>
                  <TableCell className="text-xs">{l.entity}{l.business_date ? <span className="block text-[10px] text-muted-foreground">{l.business_date}</span> : null}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">{l.reason || "—"}</TableCell>
                  <TableCell>{expanded === l.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</TableCell>
                </TableRow>
                {expanded === l.id && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-secondary/40">
                      <div className="grid sm:grid-cols-2 gap-3 p-2 text-[11px] font-mono-num">
                        <div>
                          <p className="font-semibold mb-1 font-sans">Before</p>
                          <pre className="whitespace-pre-wrap break-all max-h-56 overflow-y-auto bg-card border rounded p-2">{l.before ? JSON.stringify(l.before, null, 1) : "—"}</pre>
                        </div>
                        <div>
                          <p className="font-semibold mb-1 font-sans">After</p>
                          <pre className="whitespace-pre-wrap break-all max-h-56 overflow-y-auto bg-card border rounded p-2">{l.after ? JSON.stringify(l.after, null, 1) : "—"}</pre>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
