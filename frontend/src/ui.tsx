import { SiteStatus, siteLabel, Stage, stageLabel } from "./api";

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card border-l-4 border-l-navy-700 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-navy-900">{value}</div>
      {sub != null && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Bar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-navy-50", className)}>
      <div
        className={cn("h-full rounded-full", v >= 100 ? "bg-navy-900" : "bg-navy-600")}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

const STAGE_STYLE: Record<Stage, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600 border-slate-200",
  FEASIBILITY: "bg-navy-50 text-navy-700 border-navy-200",
  PC1_APPROVAL: "bg-navy-100 text-navy-800 border-navy-300",
  TENDERING: "bg-neutral-100 text-neutral-700 border-neutral-300",
  EXECUTION: "bg-navy-700 text-white border-navy-700",
  COMPLETED: "bg-neutral-50 text-neutral-700 border-neutral-300",
  ON_HOLD: "bg-neutral-100 text-neutral-900 border-neutral-300",
};

export function StageBadge({ stage }: { stage?: Stage | null }) {
  const s = stage ?? "NOT_STARTED";
  return <span className={cn("badge", STAGE_STYLE[s])}>{stageLabel(s)}</span>;
}

const SITE_STYLE: Record<SiteStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600 border-slate-200",
  ACTIVE: "bg-navy-700 text-white border-navy-700",
  SLOW: "bg-neutral-100 text-neutral-700 border-neutral-400",
  HALTED: "bg-white text-neutral-900 border-neutral-900 font-medium",
  COMPLETED: "bg-neutral-50 text-neutral-700 border-neutral-300",
};

export function SiteBadge({ status }: { status?: SiteStatus | null }) {
  const s = status ?? "NOT_STARTED";
  return <span className={cn("badge", SITE_STYLE[s])}>{siteLabel(s)}</span>;
}

export function Delta({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-300">—</span>;
  const positive = value.startsWith("+") && value !== "+0.0%";
  const zero = value === "+0.0%" || value === "-0.0%";
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[11px] font-bold",
        zero ? "bg-slate-100 text-slate-500" : positive ? "bg-neutral-50 text-neutral-700" : "bg-neutral-100 text-neutral-900",
      )}
    >
      {zero ? "0%" : value}
    </span>
  );
}

/** Apple-style rounded square (continuous-corner look) holding a number that fills it. */
export function NumBox({ n, size = 28 }: { n: number; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center bg-neutral-100 font-light leading-none text-neutral-800"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.58), borderRadius: Math.round(size * 0.28) }}
    >
      {n}
    </span>
  );
}

export function Heading({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-navy-200 border-t-navy-700" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-3 text-sm text-neutral-900">{message}</div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-1 p-10 text-center">
      <div className="text-sm font-medium text-slate-700">{title}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
