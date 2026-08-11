import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { Money, VerifiedTick } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Lock, Unlock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function FinalizePanel({ storeId, businessDate, onChanged }) {
  const { user } = useApp();
  const [data, setData] = useState(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);

  const load = useCallback(async () => {
    if (!storeId || !businessDate) return;
    try {
      const { data } = await api.get("/finalize/readiness", { params: { store_id: storeId, business_date: businessDate } });
      setData(data);
    } catch (e) {
      setData(null);
    }
  }, [storeId, businessDate]);

  useEffect(() => { load(); }, [load]);

  if (!data) return null;
  const sd = data.store_day;
  const finalized = sd.status === "finalized";
  const canFinalize = user.role === "admin" ||
    (user.role === "manager" && user.manager_permissions?.[storeId]?.finalize_rokad);

  const doFinalize = async () => {
    setBusy(true);
    try {
      await api.post("/finalize", { store_id: storeId, business_date: businessDate, note });
      toast.success("Rokad finalized and locked");
      await load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const doReopen = async () => {
    if (!reason.trim()) { toast.error("Reason is compulsory"); return; }
    setBusy(true);
    try {
      await api.post("/finalize/reopen", { store_id: storeId, business_date: businessDate, reason });
      toast.success("Day reopened — later days flagged for revalidation");
      setReopenOpen(false);
      setReason("");
      await load();
      onChanged && onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-lg" data-testid="finalize-panel">
      <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
        <CardTitle className="font-display text-base flex items-center gap-2">
          {finalized ? <Lock className="h-4 w-4 text-[hsl(var(--success))]" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
          Finalization {finalized && <VerifiedTick finalized />}
        </CardTitle>
        {sd.needs_revalidation && (
          <span className="text-[11px] font-semibold text-[hsl(var(--warning))] flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Needs revalidation
          </span>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {finalized ? (
          <div className="text-sm space-y-1" data-testid="finalized-info">
            <p className="text-[hsl(var(--success))] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Finalized by {sd.finalized_by_name}
            </p>
            <p className="text-muted-foreground text-xs">
              Closing actual cash: <Money paise={sd.closing_actual_paise} className="text-foreground" /> — carried to next day
            </p>
            {user.role === "admin" && (
              <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-2 border-[hsl(var(--danger))]/40 text-[hsl(var(--danger))]" data-testid="reopen-day-button">
                    Reopen (audited)
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Reopen finalized day</DialogTitle></DialogHeader>
                  <p className="text-sm text-muted-foreground">A compulsory reason will be recorded in the audit history. Later days will be flagged for revalidation.</p>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for reopening (compulsory)" data-testid="reopen-reason-input" />
                  <DialogFooter>
                    <Button onClick={doReopen} disabled={busy} className="bg-[hsl(var(--danger))] hover:bg-[hsl(var(--danger))]/90" data-testid="reopen-confirm-button">Reopen day</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        ) : (
          <>
            <ul className="space-y-1.5" data-testid="readiness-checklist">
              {data.checks.map((c) => (
                <li key={c.key} className="flex items-start gap-2 text-sm" data-testid={`readiness-check-${c.key}`}>
                  {c.pass
                    ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))] mt-0.5 shrink-0" />
                    : <XCircle className="h-4 w-4 text-[hsl(var(--danger))] mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <span className={c.pass ? "" : "font-semibold text-[hsl(var(--danger))]"}>{c.label}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">{c.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
            {canFinalize && (
              <div className="pt-2 space-y-2">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Finalization note (optional)" className="h-16" data-testid="finalize-note-input" />
                <Button onClick={doFinalize} disabled={!data.ready || busy}
                  className="w-full bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white"
                  data-testid="finalize-day-button">
                  <Lock className="h-4 w-4 mr-1.5" /> Finalize store Rokad
                </Button>
                {!data.ready && <p className="text-[11px] text-muted-foreground text-center">Resolve every red item above to enable finalization</p>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
