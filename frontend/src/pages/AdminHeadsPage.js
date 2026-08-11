import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "@/lib/api";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export default function AdminHeadsPage() {
  const [kind, setKind] = useState("expense");
  const [heads, setHeads] = useState([]);
  const [name, setName] = useState("");

  const load = useCallback(() => {
    api.get("/heads", { params: { kind, include_inactive: true } })
      .then((r) => setHeads(r.data.heads)).catch((e) => toast.error(errMsg(e)));
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    try {
      await api.post("/heads", { kind, name, scope: "global" });
      toast.success("Head created (business-wide)");
      setName("");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const toggle = async (h) => {
    try {
      await api.patch(`/heads/${h.id}?active=${!h.active}`);
      toast.success(h.active ? "Deactivated — history untouched" : "Activated");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Heads</h1>
        <p className="text-sm text-muted-foreground">Expense and adjustment heads — deactivation never damages history</p>
      </div>
      <Tabs value={kind} onValueChange={setKind}>
        <TabsList>
          <TabsTrigger value="expense" data-testid="heads-tab-expense">Expense heads</TabsTrigger>
          <TabsTrigger value="adjustment" data-testid="heads-tab-adjustment">Adjustment heads</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex gap-2 max-w-md">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${kind} head (business-wide)`} data-testid="new-head-name" />
        <Button onClick={add} data-testid="new-head-add"><Plus className="h-4 w-4 mr-1" />Add</Button>
      </div>
      <Card className="rounded-lg overflow-hidden">
        <Table className="table-compact">
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Scope</TableHead><TableHead>Status</TableHead><TableHead className="w-[110px]"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {heads.map((h) => (
              <TableRow key={h.id} className={!h.active ? "opacity-50" : ""} data-testid={`head-row-${h.name.replace(/\s+/g, "-").toLowerCase()}`}>
                <TableCell className="font-medium">{h.name}</TableCell>
                <TableCell className="text-xs">{h.scope === "global" ? "Business-wide" : "Store"}</TableCell>
                <TableCell><StatusBadge status={h.active ? "active" : "void"} label={h.active ? "Active" : "Inactive"} /></TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toggle(h)} data-testid={`head-toggle-${h.name.replace(/\s+/g, "-").toLowerCase()}`}>
                    {h.active ? "Deactivate" : "Activate"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
