import { SiteStatus, siteLabel, Stage, stageLabel } from "./api";

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card border-l-4 border-l-navy-700 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-bold text-navy-900">{value}</div>
      {sub != null && <div className="mt-0.5 text-xs text-white/50">{sub}</div>}
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
  NOT_STARTED: "bg-white/10 text-white/60 border-white/10",
  FEASIBILITY: "bg-navy-50 text-navy-700 border-navy-200",
  PC1_APPROVAL: "bg-navy-100 text-navy-800 border-navy-300",
  TENDERING: "bg-white/10 text-white/75 border-white/15",
  EXECUTION: "bg-white/90 text-black border-white/90",
  COMPLETED: "bg-white/[0.04] text-white/75 border-white/15",
  ON_HOLD: "bg-white/10 text-white/95 border-white/15",
};

export function StageBadge({ stage }: { stage?: Stage | null }) {
  const s = stage ?? "NOT_STARTED";
  return <span className={cn("badge", STAGE_STYLE[s])}>{stageLabel(s)}</span>;
}

const SITE_STYLE: Record<SiteStatus, string> = {
  NOT_STARTED: "bg-white/10 text-white/60 border-white/10",
  ACTIVE: "bg-white/90 text-black border-white/90",
  SLOW: "bg-white/10 text-white/75 border-white/30",
  HALTED: "bg-white text-black border-white font-medium",
  COMPLETED: "bg-white/[0.04] text-white/75 border-white/15",
};

export function SiteBadge({ status }: { status?: SiteStatus | null }) {
  const s = status ?? "NOT_STARTED";
  return <span className={cn("badge", SITE_STYLE[s])}>{siteLabel(s)}</span>;
}

export function Delta({ value }: { value: string | null }) {
  if (!value) return <span className="text-white/30">—</span>;
  const positive = value.startsWith("+") && value !== "+0.0%";
  const zero = value === "+0.0%" || value === "-0.0%";
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[11px] font-bold",
        zero ? "bg-white/10 text-white/50" : positive ? "bg-white/[0.04] text-white/75" : "bg-white/10 text-white/95",
      )}
    >
      {zero ? "0%" : value}
    </span>
  );
}

/** Bare square: no fill, hairline outline, Helvetica digit expanded to fill the box. */
export function NumBox({ n, size = 30 }: { n: number; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center border border-white/30 bg-transparent font-light leading-none text-white/95"
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(4, Math.round(size * 0.22)),
        fontSize: Math.round(size * 0.72),
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
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
        {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-12 text-sm text-white/50">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-navy-200 border-t-navy-700" />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/95">{message}</div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-1 p-10 text-center">
      <div className="text-sm font-medium text-white/75">{title}</div>
      {hint && <div className="text-xs text-white/50">{hint}</div>}
    </div>
  );
}
