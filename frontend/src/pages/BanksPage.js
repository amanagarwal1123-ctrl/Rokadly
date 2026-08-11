import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { StatusBadge, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Landmark, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { toast } from "sonner";

export default function BanksPage() {
  const { user, stores, refreshBoot } = useApp();
  const isAdmin = user.role === "admin";
  const [banks, setBanks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reqName, setReqName] = useState("");
  const [reqNote, setReqNote] = useState("");
  const [newBank, setNewBank] = useState({ name: "", home_store_id: "", account_label: "" });
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolve, setResolve] = useState({ action: "approve", corrected_name: "", home_store_id: "", merge_bank_id: "", note: "" });

  const load = useCallback(() => {
    api.get("/banks", { params: { include_inactive: isAdmin } }).then((r) => setBanks(r.data.banks)).catch(() => {});
    api.get("/bank-requests").then((r) => setRequests(r.data.requests)).catch(() => {});
  }, [isAdmin]);
  useEffect(() => { load(); }, [load]);

  const submitRequest = async () => {
    if (!reqName.trim()) { toast.error("Bank name required"); return; }
    try {
      const { data } = await api.post("/bank-requests", { name: reqName, note: reqNote || null });
      if (data.existing_bank) toast.info(data.message);
      else toast.success("Request sent to admin — your bill draft is untouched");
      setReqName(""); setReqNote("");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const addBank = async () => {
    if (!newBank.name.trim()) { toast.error("Name required"); return; }
    try {
      await api.post("/banks", { name: newBank.name, home_store_id: newBank.home_store_id || null, account_label: newBank.account_label || null });
      toast.success("Bank added");
      setNewBank({ name: "", home_store_id: "", account_label: "" });
      load(); refreshBoot();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const move = async (idx, dir) => {
    const next = [...banks];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setBanks(next);
    try {
      await api.post("/banks/reorder", { ordered_ids: next.map((b) => b.id) });
      toast.success("Display order updated — serials follow this order");
      refreshBoot();
    } catch (e) { toast.error(errMsg(e)); load(); }
  };

  const doResolve = async () => {
    try {
      await api.post(`/bank-requests/${resolveTarget.id}/resolve`, {
        action: resolve.action,
        corrected_name: resolve.corrected_name || undefined,
        home_store_id: resolve.home_store_id || undefined,
        merge_bank_id: resolve.merge_bank_id || undefined,
        note: resolve.note || undefined,
      });
      toast.success(`Request ${resolve.action}d`);
      setResolveTarget(null);
      load(); refreshBoot();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const toggleActive = async (b) => {
    try {
      await api.patch(`/banks/${b.id}`, { active: !b.active });
      load(); refreshBoot();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold arch-underline">Banks</h1>
        <p className="text-sm text-muted-foreground">Bank master with home store — request a missing bank without losing your draft</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-secondary/50"><p className="font-display font-semibold text-sm">Bank master (display order = serial order)</p></div>
          <Table className="table-compact">
            <TableHeader><TableRow>
              <TableHead className="w-[50px]">#</TableHead><TableHead>Name</TableHead>
              <TableHead>Home store</TableHead><TableHead>Account</TableHead>
              {isAdmin && <TableHead className="w-[140px]">Actions</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {banks.map((b, i) => (
                <TableRow key={b.id} className={!b.active ? "opacity-50" : ""} data-testid={`bank-row-${b.name}`}>
                  <TableCell className="font-mono-num">{b.display_order}</TableCell>
                  <TableCell className="font-semibold">{b.name}{!b.active && <StatusBadge status="void" label="Inactive" />}</TableCell>
                  <TableCell className="text-xs">{stores.find((s) => s.id === b.home_store_id)?.name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{b.account_label || "—"}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, -1)} data-testid={`bank-up-${b.name}`}><ArrowUp className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, 1)} data-testid={`bank-down-${b.name}`}><ArrowDown className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toggleActive(b)} data-testid={`bank-toggle-${b.name}`}>{b.active ? "Deactivate" : "Activate"}</Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {isAdmin && (
            <div className="border-t p-3 grid sm:grid-cols-4 gap-2">
              <Input placeholder="Bank name" value={newBank.name} onChange={(e) => setNewBank({ ...newBank, name: e.target.value })} className="h-9" data-testid="new-bank-name" />
              <Select value={newBank.home_store_id} onValueChange={(v) => setNewBank({ ...newBank, home_store_id: v })}>
                <SelectTrigger className="h-9" data-testid="new-bank-store"><SelectValue placeholder="Home store" /></SelectTrigger>
                <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Account label" value={newBank.account_label} onChange={(e) => setNewBank({ ...newBank, account_label: e.target.value })} className="h-9" data-testid="new-bank-label" />
              <Button onClick={addBank} className="h-9" data-testid="new-bank-add"><Plus className="h-4 w-4 mr-1" />Add bank</Button>
            </div>
          )}
        </Card>

        <Card className="rounded-lg">
          <CardContent className="p-4 space-y-3">
            <p className="font-display font-semibold text-sm">Request a missing bank</p>
            <Input placeholder="Bank name e.g. Kotak" value={reqName} onChange={(e) => setReqName(e.target.value)} data-testid="bank-request-name" />
            <Textarea placeholder="Note (optional)" value={reqNote} onChange={(e) => setReqNote(e.target.value)} className="h-16" data-testid="bank-request-note" />
            <Button onClick={submitRequest} className="w-full" data-testid="bank-request-submit">Send request</Button>
            <p className="text-[11px] text-muted-foreground">Admin will approve, merge or correct the name to avoid duplicates like HDFC vs HDFC Bank.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b bg-secondary/50"><p className="font-display font-semibold text-sm">{isAdmin ? "All bank requests" : "My requests"}</p></div>
        <Table className="table-compact">
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Requested by</TableHead><TableHead>Note</TableHead>
            <TableHead>Status</TableHead>{isAdmin && <TableHead className="w-[100px]"></TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {requests.length === 0 && <TableRow><TableCell colSpan={5}><EmptyState icon={Landmark} title="No requests" /></TableCell></TableRow>}
            {requests.map((r) => (
              <TableRow key={r.id} data-testid={`bank-request-row-${r.name}`}>
                <TableCell className="font-semibold">{r.name}</TableCell>
                <TableCell className="text-xs">{r.requested_by_name}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">{r.note || "—"}</TableCell>
                <TableCell><StatusBadge status={r.status === "pending" ? "unreviewed" : r.status === "approved" ? "matched" : r.status === "merged" ? "cleared" : "void"} label={r.status} /></TableCell>
                {isAdmin && (
                  <TableCell>
                    {r.status === "pending" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setResolveTarget(r); setResolve({ action: "approve", corrected_name: r.name, home_store_id: "", merge_bank_id: "", note: "" }); }}
                        data-testid={`bank-request-resolve-${r.name}`}>Resolve</Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!resolveTarget} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolve request: {resolveTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={resolve.action} onValueChange={(v) => setResolve({ ...resolve, action: v })}>
              <SelectTrigger data-testid="resolve-action-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approve">Approve (create bank)</SelectItem>
                <SelectItem value="merge">Merge into existing bank</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
              </SelectContent>
            </Select>
            {resolve.action === "approve" && (
              <>
                <div className="space-y-1.5"><Label>Corrected name</Label>
                  <Input value={resolve.corrected_name} onChange={(e) => setResolve({ ...resolve, corrected_name: e.target.value })} data-testid="resolve-corrected-name" /></div>
                <div className="space-y-1.5"><Label>Home store</Label>
                  <Select value={resolve.home_store_id} onValueChange={(v) => setResolve({ ...resolve, home_store_id: v })}>
                    <SelectTrigger data-testid="resolve-home-store"><SelectValue placeholder="Home store" /></SelectTrigger>
                    <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select></div>
              </>
            )}
            {resolve.action === "merge" && (
              <div className="space-y-1.5"><Label>Merge into</Label>
                <Select value={resolve.merge_bank_id} onValueChange={(v) => setResolve({ ...resolve, merge_bank_id: v })}>
                  <SelectTrigger data-testid="resolve-merge-bank"><SelectValue placeholder="Existing bank" /></SelectTrigger>
                  <SelectContent>{banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select></div>
            )}
            <Textarea value={resolve.note} onChange={(e) => setResolve({ ...resolve, note: e.target.value })} placeholder="Note (optional)" data-testid="resolve-note" />
          </div>
          <DialogFooter><Button onClick={doResolve} data-testid="resolve-confirm">Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
