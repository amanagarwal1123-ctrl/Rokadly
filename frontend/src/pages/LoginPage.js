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

/* Grand nine-lobed cusped Mughal arch, all curves, brass strokes */
const MughalArch = ({ className }) => (
  <svg viewBox="0 0 400 620" fill="none" aria-hidden="true" className={className} preserveAspectRatio="xMidYMax meet">
    {/* outer smooth band */}
    <path d="M22 300 A178 178 0 0 1 378 300" stroke="hsl(43 62% 52% / 0.3)" strokeWidth="1.5" />
    <path d="M22 300 V620" stroke="hsl(43 62% 52% / 0.3)" strokeWidth="1.5" />
    <path d="M378 300 V620" stroke="hsl(43 62% 52% / 0.3)" strokeWidth="1.5" />
    {/* multifoil cusped arch (9 lobes) */}
    <path
      d="M50 300 A30 30 0 0 1 59 248.7 A30 30 0 0 1 85.1 203.6 A30 30 0 0 1 125 170.1 A30 30 0 0 1 174 152.3 A30 30 0 0 1 226 152.3 A30 30 0 0 1 275 170.1 A30 30 0 0 1 314.9 203.6 A30 30 0 0 1 341 248.7 A30 30 0 0 1 350 300"
      stroke="hsl(43 62% 52% / 0.62)" strokeWidth="2"
    />
    <path d="M50 300 V620" stroke="hsl(43 62% 52% / 0.62)" strokeWidth="2" />
    <path d="M350 300 V620" stroke="hsl(43 62% 52% / 0.62)" strokeWidth="2" />
    {/* inner smooth arch echo */}
    <path d="M68 300 A132 132 0 0 1 332 300" stroke="hsl(43 62% 52% / 0.22)" strokeWidth="1" />
    {/* springing flourishes */}
    <path d="M36 300 C46 292 54 292 64 300" stroke="hsl(43 62% 52% / 0.45)" strokeWidth="1.2" />
    <path d="M336 300 C346 292 354 292 364 300" stroke="hsl(43 62% 52% / 0.45)" strokeWidth="1.2" />
    {/* hanging jhoomar pendant from apex */}
    <path d="M200 138 V158" stroke="hsl(43 62% 52% / 0.55)" strokeWidth="1.2" />
    <circle cx="200" cy="162" r="3" fill="hsl(43 62% 52% / 0.6)" />
    <path d="M200 168 C208 179 208 192 200 200 C192 192 192 179 200 168 Z" stroke="hsl(43 62% 52% / 0.55)" strokeWidth="1.2" />
    <circle cx="200" cy="207" r="1.6" fill="hsl(43 62% 52% / 0.5)" />
  </svg>
);

/* Small five-lobed niche arch crowning the sign-in card */
const NicheArch = ({ className }) => (
  <svg viewBox="0 0 120 34" fill="none" aria-hidden="true" className={className}>
    <path
      d="M34 32 A9.5 9.5 0 0 1 39 16.7 A9.5 9.5 0 0 1 52 7.3 A9.5 9.5 0 0 1 68 7.3 A9.5 9.5 0 0 1 81 16.7 A9.5 9.5 0 0 1 86 32"
      stroke="hsl(43 62% 52% / 0.6)" strokeWidth="1.5"
    />
    <path d="M0 32 H34" stroke="hsl(43 62% 52% / 0.35)" strokeWidth="1" />
    <path d="M86 32 H120" stroke="hsl(43 62% 52% / 0.35)" strokeWidth="1" />
    <circle cx="60" cy="17" r="1.6" fill="hsl(43 62% 52% / 0.55)" />
  </svg>
);

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
      {/* Hero: Mughal arch chamber */}
      <div className="login-hero relative lg:w-[46%] flex flex-col p-8 lg:p-12">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded bg-[hsl(var(--ruby))] flex items-center justify-center shadow-[0_0_24px_hsl(350_78%_46%/0.45)]">
            <Gem className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display font-bold text-2xl tracking-tight">Rokadly</div>
            <div className="text-[11px] text-white/50 uppercase tracking-[0.2em]">Daily Cash &amp; Rokad</div>
          </div>
        </div>

        <div className="relative flex-1 hidden lg:flex items-end justify-center min-h-[420px]">
          <MughalArch className="absolute inset-x-0 bottom-0 mx-auto h-[92%] max-w-[400px]" />
          <div className="relative text-center max-w-[280px] pb-24">
            <h1 className="font-display text-3xl font-semibold leading-tight">
              Every rupee accounted.<br />
              <span className="text-[hsl(var(--brass))] glow-sapphire">Every day verified.</span>
            </h1>
            <p className="text-white/60 text-sm leading-relaxed mt-4">
              Daily cash counts, payment breakups, bank reconciliation and store finalization
              for your main store and every branch — in one ledger.
            </p>
          </div>
        </div>

        <div className="hidden lg:flex gap-6 justify-center text-[11px] uppercase tracking-widest text-white/40 pt-6">
          <span>Cash</span><span>·</span><span>Card</span><span>·</span><span>Cheque</span><span>·</span><span>Bank</span><span>·</span><span>Other</span>
        </div>
      </div>

      {/* Sign-in niche */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="rounded-lg border border-[hsl(var(--border)/0.45)] bg-card card-zardozi shadow-[0_18px_60px_hsl(var(--shadow)/0.6)] p-6 sm:p-8 space-y-6">
            <div className="text-center">
              <NicheArch className="mx-auto w-[120px] mb-3" />
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
                className="w-full h-11 bg-[hsl(var(--ruby))] hover:bg-[hsl(350_78%_40%)] text-white font-semibold shadow-[0_4px_20px_hsl(350_78%_46%/0.3)]"
                data-testid="login-form-submit-button">
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <div className="border-t border-[hsl(var(--border)/0.35)] pt-4">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2 text-center">Demo accounts</p>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO.map((d) => (
                  <button key={d.u} onClick={() => quick(d.u, d.p)} disabled={busy}
                    className="text-left text-xs px-2.5 py-2 rounded border border-[hsl(var(--border)/0.4)] bg-[hsl(var(--surface-2))] hover:border-[hsl(var(--brass))] hover:bg-[hsl(var(--accent))] transition-colors duration-150"
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
    </div>
  );
}
