import React, { useEffect, useState, useCallback } from "react";
import { api, errMsg } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const PERM_LABELS = {
  view_recon: "View reconciliation details",
  reconcile: "Reconcile Bank/Card/Cheque/Other entries",
  mark_status: "Mark Matched or Pending",
  clear_matched: "Clear matched entries",
  final_tally: "Perform final physical-statement tally",
  manage_cheques: "Manage cheque statuses",
  finalize_rokad: "Finalize store Rokad",
};

export default function AdminUsersPage() {
  const { stores, boot } = useApp();
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null); // user object being edited
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "cashier", store_id: "", store_ids: [], manager_permissions: {} });

  const load = useCallback(() => {
    api.get("/users").then((r) => setUsers(r.data.users)).catch((e) => toast.error(errMsg(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const createUser = async () => {
    try {
      await api.post("/users", form);
      toast.success("User created");
      setCreateOpen(false);
      setForm({ username: "", password: "", name: "", role: "cashier", store_id: "", store_ids: [], manager_permissions: {} });
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/users/${editing.id}`, {
        name: editing.name, active: editing.active, store_id: editing.store_id,
        store_ids: editing.store_ids, manager_permissions: editing.manager_permissions,
        password: editing.new_password || undefined,
      });
      toast.success("User updated");
      setEditing(null);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const PermMatrix = ({ target, onChange }) => (
    <div className="space-y-3">
      {(target.store_ids || []).map((sid) => {
        const store = stores.find((s) => s.id === sid);
        const perms = target.manager_permissions?.[sid] || {};
        return (
          <div key={sid} className="rounded border p-3">
            <p className="font-semibold text-sm mb-2">{store?.name}</p>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {Object.entries(PERM_LABELS).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-xs cursor-pointer" data-testid={`perm-${k}-${store?.code}`}>
                  <Checkbox checked={!!perms[k]}
                    onCheckedChange={(v) => onChange({
                      ...target,
                      manager_permissions: {
                        ...target.manager_permissions,
                        [sid]: { ...perms, [k]: !!v },
                      },
                    })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  const StoreMultiSelect = ({ target, onChange }) => (
    <div className="flex flex-wrap gap-2">
      {stores.map((s) => (
        <label key={s.id} className="flex items-center gap-1.5 text-xs border rounded px-2 py-1.5 cursor-pointer">
          <Checkbox checked={(target.store_ids || []).includes(s.id)}
            onCheckedChange={(v) => {
              const ids = new Set(target.store_ids || []);
              if (v) ids.add(s.id); else ids.delete(s.id);
              onChange({ ...target, store_ids: [...ids] });
            }} />
          {s.name}
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold">Users &amp; permissions</h1>
          <p className="text-sm text-muted-foreground">Cashier store assignment, accountant/manager stores, per-store manager permission checklist</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-user-button"><Plus className="h-4 w-4 mr-1" />New user</Button>
      </div>

      <Card className="rounded-lg overflow-hidden">
        <Table className="table-compact">
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Username</TableHead><TableHead>Role</TableHead>
            <TableHead>Stores</TableHead><TableHead>Status</TableHead><TableHead className="w-[80px]"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} data-testid={`user-row-${u.username}`}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="font-mono-num text-xs">{u.username}</TableCell>
                <TableCell className="capitalize text-xs">{u.role}</TableCell>
                <TableCell className="text-xs">
                  {u.role === "cashier"
                    ? stores.find((s) => s.id === u.store_id)?.name || "—"
                    : u.role === "admin" ? "All stores"
                      : (u.store_ids || []).map((id) => stores.find((s) => s.id === id)?.name).filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell><StatusBadge status={u.active ? "active" : "void"} label={u.active ? "Active" : "Deactivated"} /></TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing({ ...u })} data-testid={`user-edit-${u.username}`}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="create-user-name" /></div>
              <div className="space-y-1"><Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="create-user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["cashier", "accountant", "manager", "admin"].map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} data-testid="create-user-username" /></div>
              <div className="space-y-1"><Label>Password</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="create-user-password" /></div>
            </div>
            {form.role === "cashier" && (
              <div className="space-y-1"><Label>Store</Label>
                <Select value={form.store_id} onValueChange={(v) => setForm({ ...form, store_id: v })}>
                  <SelectTrigger data-testid="create-user-store"><SelectValue placeholder="Assign store" /></SelectTrigger>
                  <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select></div>
            )}
            {["accountant", "manager"].includes(form.role) && (
              <div className="space-y-1"><Label>Assigned stores</Label>
                <StoreMultiSelect target={form} onChange={setForm} /></div>
            )}
            {form.role === "manager" && form.store_ids.length > 0 && (
              <div className="space-y-1"><Label>Permissions per store</Label>
                <PermMatrix target={form} onChange={setForm} /></div>
            )}
          </div>
          <DialogFooter><Button onClick={createUser} data-testid="create-user-submit">Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit {editing?.username} <span className="capitalize text-muted-foreground text-sm">({editing?.role})</span></DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} data-testid="edit-user-name" /></div>
                <div className="space-y-1"><Label>Reset password</Label><Input value={editing.new_password || ""} onChange={(e) => setEditing({ ...editing, new_password: e.target.value })} placeholder="(unchanged)" data-testid="edit-user-password" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: !!v })} data-testid="edit-user-active" />
                Active
              </label>
              {editing.role === "cashier" && (
                <div className="space-y-1"><Label>Store (transfer preserves history)</Label>
                  <Select value={editing.store_id || ""} onValueChange={(v) => setEditing({ ...editing, store_id: v })}>
                    <SelectTrigger data-testid="edit-user-store"><SelectValue /></SelectTrigger>
                    <SelectContent>{stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select></div>
              )}
              {["accountant", "manager"].includes(editing.role) && (
                <div className="space-y-1"><Label>Assigned stores</Label>
                  <StoreMultiSelect target={editing} onChange={setEditing} /></div>
              )}
              {editing.role === "manager" && (editing.store_ids || []).length > 0 && (
                <div className="space-y-1"><Label>Permission checklist per store</Label>
                  <PermMatrix target={editing} onChange={setEditing} /></div>
              )}
            </div>
          )}
          <DialogFooter><Button onClick={saveEdit} data-testid="edit-user-save">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
