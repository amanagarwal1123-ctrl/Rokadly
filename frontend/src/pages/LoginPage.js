import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errMsg } from "@/lib/api";
import { Gem } from "lucide-react";
import { toast } from "sonner";

const DEMO = [
  { u: "admin", p: "admin123", label: "Admin" },
  { u: "manager1", p: "manager123", label: "Manager (Rohini, full)" },
  { u: "manager2", p: "manager123", label: "Manager (Lajpat, limited)" },
  { u: "accountant1", p: "account123", label: "Accountant" },
  { u: "cashier1", p: "cashier123", label: "Cashier (Main)" },
  { u: "cashier3", p: "cashier123", label: "Cashier (Rohini)" },
];

export default function LoginPage() {
  const { login } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate("/");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const quick = async (u, p) => {
    setUsername(u); setPassword(p);
    setBusy(true);
    try {
      await login(u, p);
      navigate("/");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="shell-texture relative lg:w-[44%] flex flex-col justify-between p-8 lg:p-12">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded bg-[hsl(var(--ruby))] flex items-center justify-center">
            <Gem className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-2xl tracking-tight">Rokadly</div>
            <div className="text-[11px] text-white/50 uppercase tracking-[0.2em]">Daily Cash &amp; Rokad</div>
          </div>
        </div>
        <div className="hidden lg:block space-y-4 py-10">
          <h1 className="font-display text-3xl font-semibold leading-tight">
            Every rupee accounted.<br />
            <span className="text-[hsl(var(--brass))]">Every day verified.</span>
          </h1>
          <p className="text-white/60 text-sm max-w-md leading-relaxed">
            Daily cash counts, payment breakups, bank reconciliation and store finalization
            for your main store and every branch — in one ledger.
          </p>
        </div>
        <div className="hidden lg:flex gap-6 text-[11px] uppercase tracking-widest text-white/40">
          <span>Cash</span><span>Card</span><span>Cheque</span><span>Bank</span><span>Other</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground">Use your Rokadly credentials</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)}
                autoFocus autoComplete="username" className="h-11" data-testid="login-username-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" className="h-11" data-testid="login-password-input" />
            </div>
            <Button type="submit" disabled={busy || !username || !password}
              className="w-full h-11 bg-[hsl(var(--ruby))] hover:bg-[hsl(var(--ruby))]/90 text-white font-semibold"
              data-testid="login-form-submit-button">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="border-t pt-4">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Demo accounts</p>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO.map((d) => (
                <button key={d.u} onClick={() => quick(d.u, d.p)} disabled={busy}
                  className="text-left text-xs px-2.5 py-2 rounded border hover:border-[hsl(var(--brass))] hover:bg-[hsl(var(--brass))]/5 transition-colors duration-150"
                  data-testid={`demo-login-${d.u}`}>
                  <span className="font-semibold block">{d.label}</span>
                  <span className="text-muted-foreground font-mono-num">{d.u}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
