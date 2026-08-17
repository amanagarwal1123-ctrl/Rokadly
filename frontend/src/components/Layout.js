import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, ReceiptText, Wallet, Calculator, FilePlus2, FileText,
  GitCompareArrows, BookOpen, AlertTriangle, BookMarked, Columns3, Building2,
  Landmark, Users, Tags, ScrollText, Menu, LogOut, Gem,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["cashier", "accountant", "manager", "admin"] },
  { to: "/bills", label: "Bill Entry", icon: ReceiptText, roles: ["cashier", "admin"] },
  { to: "/allocation", label: "Opening Cash", icon: Wallet, roles: ["cashier", "admin", "manager", "accountant"] },
  { to: "/cash-count", label: "Cash Count", icon: Calculator, roles: ["cashier", "admin"] },
  { to: "/adjustments", label: "Other Receipts", icon: FilePlus2, roles: ["cashier", "admin"] },
  { to: "/expenses", label: "Expenses", icon: FileText, roles: ["cashier", "admin", "accountant", "manager"] },
  { to: "/reconciliation", label: "Reconciliation", icon: GitCompareArrows, roles: ["accountant", "admin", "manager"] },
  { to: "/cheques", label: "Cheques", icon: BookOpen, roles: ["cashier", "accountant", "manager", "admin"] },
  { to: "/discrepancies", label: "Discrepancies", icon: AlertTriangle, roles: ["cashier", "accountant", "manager", "admin"] },
  { to: "/register", label: "Rokad Register", icon: BookMarked, roles: ["cashier", "accountant", "manager", "admin"] },
  { to: "/comparison", label: "Store Comparison", icon: Columns3, roles: ["admin"] },
  { to: "/cross-store", label: "Cross-Store Receipts", icon: Building2, roles: ["admin"] },
  { to: "/banks", label: "Banks", icon: Landmark, roles: ["cashier", "accountant", "manager", "admin"] },
  { to: "/admin/users", label: "Users & Permissions", icon: Users, roles: ["admin"] },
  { to: "/admin/heads", label: "Heads", icon: Tags, roles: ["admin"] },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText, roles: ["admin"] },
];

const ROLE_LABEL = { cashier: "Cashier", accountant: "Accountant", manager: "Manager", admin: "Admin" };

const NavItems = ({ role, onNavigate }) => {
  const location = useLocation();
  return (
    <nav className="flex-1 overflow-y-auto py-2">
      {NAV.filter((n) => n.roles.includes(role)).map((n) => {
        const active = n.to === "/" ? location.pathname === "/" : location.pathname.startsWith(n.to);
        return (
          <NavLink key={n.to} to={n.to} onClick={onNavigate}
            data-testid={`nav-${n.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            className={`flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors duration-150 ${
              active
                ? "bg-white/10 text-white border-l-2 border-[hsl(var(--brass))] font-semibold"
                : "text-white/70 hover:text-white hover:bg-white/5 border-l-2 border-transparent"
            }`}>
            <n.icon className="h-4 w-4 shrink-0" />
            {n.label}
          </NavLink>
        );
      })}
    </nav>
  );
};

const Brand = () => (
  <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
    <div className="h-8 w-8 rounded bg-[hsl(var(--ruby))] flex items-center justify-center">
      <Gem className="h-4.5 w-4 text-white" />
    </div>
    <div>
      <div className="font-display font-bold text-base leading-none tracking-tight">Rokadly</div>
      <div className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">Daily Rokad</div>
    </div>
  </div>
);

export default function Layout({ children }) {
  const { user, logout, today } = useApp();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[240px] flex-col shell-texture no-print border-r border-[hsl(var(--brass)/0.2)]">
        <Brand />
        <NavItems role={user.role} />
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate" data-testid="sidebar-user-name">{user.name}</div>
              <div className="text-[11px] text-white/50">{ROLE_LABEL[user.role]}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="text-white/60 hover:text-white hover:bg-white/10 h-9 w-9" aria-label="Sign out" title="Sign out" data-testid="logout-button">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 shell-texture no-print border-b border-[hsl(var(--brass)/0.2)]">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 h-10 w-10" aria-label="Open menu" title="Open menu" data-testid="mobile-menu-button">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[260px] shell-texture border-r-0 flex flex-col">
                <Brand />
                <div className="px-4 py-2 text-xs text-white/60 border-b border-white/10">
                  {user.name} &bull; {ROLE_LABEL[user.role]} &bull; {today}
                </div>
                <NavItems role={user.role} onNavigate={() => setOpen(false)} />
                <div className="border-t border-white/10 p-3">
                  <Button variant="ghost" onClick={logout} className="text-white/70 hover:text-white hover:bg-white/10 w-full justify-start gap-2" data-testid="mobile-logout-button">
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="font-display font-bold tracking-tight">Rokadly</span>
          </div>
          <span className="text-[11px] text-white/60 font-mono-num">{today}</span>
        </div>
      </header>

      <main className="lg:pl-[240px]">
        <div className="px-3 sm:px-4 lg:px-6 py-4 pb-24 max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
