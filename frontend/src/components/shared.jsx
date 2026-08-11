import React from "react";
import { fmtINR, fromPaise, RECON_LABELS } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useApp } from "@/context/AppContext";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export const Money = ({ paise, signed, className = "", colored = false }) => {
  let cls = className;
  if (colored && paise > 0) cls += " money-pos";
  if (colored && paise < 0) cls += " money-neg";
  return <span className={`font-mono-num ${cls}`}>{fmtINR(paise, { signed })}</span>;
};

export const MoneyInput = ({ value, onChange, placeholder = "0", testId, className = "", autoFocus, disabled }) => (
  <Input
    type="text"
    inputMode="decimal"
    value={value}
    autoFocus={autoFocus}
    disabled={disabled}
    onChange={(e) => {
      const v = e.target.value;
      if (/^[0-9]*\.?[0-9]{0,2}$/.test(v) || v === "") onChange(v);
    }}
    placeholder={placeholder}
    className={`text-right font-mono-num ${className}`}
    data-testid={testId}
  />
);

const STATUS_STYLES = {
  pending: "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))]",
  unreviewed: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border border-[hsl(var(--warning))]/40",
  matched: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
  cleared: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border border-[hsl(var(--success))]/40",
  exception_approved: "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border border-[hsl(var(--info))]/40",
  finally_tallied: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
  open: "bg-[hsl(var(--danger))]/12 text-[hsl(var(--danger))] border border-[hsl(var(--danger))]/40",
  partially_adjusted: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border border-[hsl(var(--warning))]/40",
  adjusted: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border border-[hsl(var(--success))]/40",
  closed_unexplained: "bg-muted text-muted-foreground border",
  passed: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
  bounced: "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))]",
  paid_returned: "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border border-[hsl(var(--info))]/40",
  active: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border border-[hsl(var(--success))]/40",
  void: "bg-muted text-muted-foreground border line-through",
  finalized: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
  "open-day": "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border border-[hsl(var(--warning))]/40",
  reviewed: "bg-[hsl(var(--info))]/15 text-[hsl(var(--info))] border border-[hsl(var(--info))]/40",
};

const STATUS_LABELS = {
  ...RECON_LABELS,
  open: "Open", partially_adjusted: "Partially Adjusted", adjusted: "Adjusted",
  closed_unexplained: "Closed Unexplained", passed: "Passed", bounced: "Bounced",
  paid_returned: "Paid/Returned", active: "Active", void: "Void",
  finalized: "Finalized", "open-day": "Open", reviewed: "Reviewed",
};

export const StatusBadge = ({ status, label }) => (
  <Badge className={`rounded px-1.5 py-0 text-[11px] font-semibold whitespace-nowrap hover:bg-inherit ${STATUS_STYLES[status] || "bg-muted text-foreground border"}`}
    data-testid={`status-badge-${status}`}>
    {label || STATUS_LABELS[status] || status}
  </Badge>
);

export const VerifiedTick = ({ finalized }) =>
  finalized ? (
    <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" data-testid="verified-tick-indicator" />
  ) : (
    <Clock className="h-4 w-4 text-muted-foreground" />
  );

export const StoreDatePicker = ({ hideDate = false, hideStore = false }) => {
  const { user, allowedStores, storeId, setStoreId, date, setDate, today } = useApp();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {!hideStore && (
        user?.role === "cashier" ? (
          <span className="text-sm font-medium" data-testid="current-store-label">
            {allowedStores[0]?.name}
          </span>
        ) : (
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger className="h-9 w-[170px]" data-testid="store-selector">
              <SelectValue placeholder="Store" />
            </SelectTrigger>
            <SelectContent>
              {allowedStores.map((s) => (
                <SelectItem key={s.id} value={s.id} data-testid={`store-option-${s.code}`}>
                  {s.name} {s.type === "main" ? "(Main)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      )}
      {!hideDate && (
        user?.role === "cashier" ? (
          <span className="text-sm text-muted-foreground font-mono-num">{today}</span>
        ) : (
          <Input type="date" value={date} max={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-[150px]" data-testid="date-selector" />
        )
      )}
    </div>
  );
};

export const EmptyState = ({ icon: Icon = AlertTriangle, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center" data-testid="empty-state">
    <Icon className="h-8 w-8 text-muted-foreground/50 mb-2" />
    <p className="text-sm font-medium text-muted-foreground">{title}</p>
    {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
  </div>
);

export const SectionTitle = ({ children, right }) => (
  <div className="flex items-center justify-between gap-2 mb-2">
    <h2 className="font-display text-lg font-semibold tracking-tight">{children}</h2>
    {right}
  </div>
);
