import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Dashboard as Dash, deptShort, fmtM, fmtPct } from "../api";
import { useAuth, isStaff } from "../auth";
import { Kpi, Bar, Heading, Spinner, ErrorBox, NumBox } from "../ui";

/** Reporting dot: filled = all reported today, half = partial, hollow = none. */
function cnDot(i: { schemes: number; updatedToday: number }): string {
  const base = "h-1.5 w-1.5 shrink-0 rounded-full";
  const full = i.schemes > 0 ? i.updatedToday >= i.schemes : i.updatedToday > 0;
  if (full) return `${base} bg-neutral-900`;
  if (i.updatedToday > 0) return `${base} bg-neutral-400`;
  return `${base} border border-neutral-300 bg-white`;
}
import { SectorBars, StageDonut, ComplianceBar } from "../charts";

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get<Dash>("/dashboard").then(setD).catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <ErrorBox message={err} />;
  if (!d) return <Spinner label="Loading dashboard…" />;
  const staff = isStaff(user);

  return (
    <div className="space-y-6">
      <Heading
        title={staff ? "Provincial Dashboard" : `${d.department?.name ?? "Department"} Dashboard`}
        subtitle={
          staff
            ? `CM's priority portfolio · live position as of ${d.today}`
            : `Your schemes & progress · ${d.today}`
        }
        action={
          !staff && (
            <Link to="/entry" className="btn-primary">
              ✎ Enter Today&apos;s Progress
            </Link>
          )
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Priority Schemes" value={d.totals.count} sub={`${d.totals.completed} completed`} />
        <Kpi label="Portfolio Cost" value={fmtM(d.totals.totalCost)} />
        <Kpi label="ADP Allocation" value={fmtM(d.totals.totalAlloc)} />
        <Kpi label="Expenditure" value={fmtM(d.totals.totalSpent)} sub={`${fmtM(d.totals.totalReleased)} released`} />
        <Kpi label="Physical Progress" value={fmtPct(d.totals.avgPhysical)} sub="cost-weighted" />
        <Kpi
          label="Updated Today"
          value={`${d.totals.updatedToday}/${d.totals.count}`}
          sub={`${d.totals.reported} ever reported`}
        />
      </div>

      {/* Daily Progress — minimalist initiative list */}
      <div className="card p-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm uppercase tracking-widest text-neutral-900">Daily Progress</h2>
          <div className="flex items-baseline gap-4">
            <span className="text-[11px] text-neutral-400">{d.today}</span>
            <Link to="/initiatives" className="text-[11px] text-neutral-500 hover:text-neutral-900">
              View all →
            </Link>
          </div>
        </div>
        <div className="grid gap-x-12 lg:grid-cols-2">
          {d.initiatives.map((i) => (
            <Link
              key={i.id}
              to={`/initiatives/${i.id}`}
              className="group flex items-center gap-3 border-b border-neutral-100 py-2.5"
              title={`${i.name} — ${deptShort(i.leadDepartment)} · ${i.schemes} scheme${i.schemes === 1 ? "" : "s"}`}
            >
              <NumBox n={i.number} size={22} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-600 transition-colors group-hover:text-neutral-900">
                {i.shortName}
              </span>
              <span
                className={cnDot(i)}
                title={i.schemes > 0 ? `${i.updatedToday}/${i.schemes} reported today` : i.updatedToday > 0 ? "reported today" : "no report today"}
              />
              <span className="hidden w-14 shrink-0 text-right text-[10px] tabular-nums text-neutral-300 sm:block">
                {i.schemes > 0 ? `${i.updatedToday}/${i.schemes}` : ""}
              </span>
              <span className="h-[3px] w-24 shrink-0 overflow-hidden rounded-full bg-neutral-100 sm:w-32">
                <span className="block h-full bg-neutral-800" style={{ width: `${Math.min(100, i.avgPhysical || 0)}%` }} />
              </span>
              <span className="w-11 shrink-0 text-right text-[12px] tabular-nums text-neutral-800">{fmtPct(i.avgPhysical)}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Sites needing attention */}
      {d.attention.length > 0 && (
        <div className="card border-l-4 border-l-neutral-800 p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-900">
            ⚠ Sites Halted / Slow — needs attention
          </h2>
          <div className="space-y-2">
            {d.attention.map((a, i) => (
              <Link key={i} to={`/schemes/${a.schemeId}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px] hover:border-neutral-400">
                <span className={a.status === "HALTED" ? "badge border-neutral-900 bg-neutral-900 text-white" : "badge border-neutral-400 bg-neutral-100 text-neutral-700"}>
                  {a.status}
                </span>
                <span className="font-bold text-navy-800">{a.dept}</span>
                <span className="flex-1 truncate text-slate-700">{a.name}</span>
                {a.note && <span className="text-[12px] italic text-neutral-900">{a.note}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="card p-5 xl:col-span-3">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy-900">
            Allocation vs Expenditure by Sector
          </h2>
          <SectorBars data={d.sectors.map((s) => ({ sector: s.sector, alloc: s.alloc, spent: s.spent }))} />
        </div>
        <div className="card p-5 xl:col-span-2">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy-900">
            Lifecycle Stage (PC-1 → Completion)
          </h2>
          <StageDonut dist={d.stageDist} />
        </div>
      </div>

      {/* Compliance (staff only) */}
      {staff && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-900">
              Today&apos;s Reporting Compliance — by Department
            </h2>
            <Link to="/reports" className="text-xs font-semibold text-navy-600 hover:text-navy-800">
              Reports →
            </Link>
          </div>
          <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {d.compliance
              .filter((c) => c.schemes > 0)
              .map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <Link
                    to={`/departments/${c.id}`}
                    className="w-40 truncate text-[13px] font-medium text-slate-700 hover:text-navy-700"
                    title={c.name}
                  >
                    <span className="mr-1.5 font-bold text-navy-800">{c.code}</span>
                  </Link>
                  <div className="flex-1">
                    <ComplianceBar done={c.updatedToday} total={c.schemes} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
