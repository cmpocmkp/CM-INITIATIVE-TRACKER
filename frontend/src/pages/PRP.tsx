import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cleanName, api, Scheme, deptShort, fmtM, fmtPct, fmtDate } from "../api";
import { Heading, Spinner, ErrorBox, Bar, StageBadge, Kpi } from "../ui";

export default function PRP() {
  const [list, setList] = useState<Scheme[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get<Scheme[]>("/schemes").then(setList).catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <ErrorBox message={err} />;
  if (!list) return <Spinner label="Loading PRP…" />;

  const prp = list.filter((s) => s.isPRP);
  const cost = prp.reduce((a, s) => a + (s.totalCost ?? 0), 0);
  const alloc = prp.reduce((a, s) => a + (s.adpAllocation ?? 0), 0);
  const spent = prp.reduce((a, s) => a + (s.updates?.[0]?.expenditure ?? 0), 0);

  return (
    <div className="space-y-6">
      <Heading title="Peshawar Revitalization Plan" />

      {/* KPI row — 4 cards as on Overview */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Schemes" value={prp.length} />
        <Kpi label="Cost" value={fmtM(cost)} />
        <Kpi label="ADP Allocation" value={fmtM(alloc)} />
        <Kpi label="Expenditure" value={fmtM(spent)} />
      </div>

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1240 }}>
            <thead>
              <tr className="border-b border-white/10">
                <th className="th">Code</th>
                <th className="th">Scheme</th>
                <th className="th">Sector</th>
                <th className="th">Department</th>
                <th className="th">Implementation</th>
                <th className="th !text-right">Cost (M)</th>
                <th className="th !text-right">Alloc (M)</th>
                <th className="th !text-right">Spent (M)</th>
                <th className="th" style={{ minWidth: 150 }}>Physical</th>
                <th className="th">Stage</th>
                <th className="th">Last Report</th>
              </tr>
            </thead>
            <tbody>
              {prp.map((s) => {
                const u = s.updates?.[0];
                const phys = s.effectivePhysical ?? u?.physicalProgressPct ?? null;
                return (
                  <tr key={s.id} className="border-b border-white/[0.07] align-top hover:bg-white/[0.06]">
                    <td className="td whitespace-nowrap text-[12px] tabular-nums text-white/50">{s.adpCode ?? "—"}</td>
                    <td className="td max-w-[420px]">
                      <Link to={`/schemes/${s.id}`} className="text-white/90 hover:text-white hover:underline">
                        {cleanName(s.name)}
                      </Link>
                      {(s.subProjects?.length ?? 0) > 0 && (
                        <span className="ml-1.5 text-[10px] text-white/40">{s.subProjects!.length} work items</span>
                      )}
                    </td>
                    <td className="td whitespace-nowrap text-[12px]">{s.sector}</td>
                    <td className="td whitespace-nowrap text-[12px]" title={s.department?.name}>
                      {deptShort(s.department)}
                    </td>
                    <td className="td whitespace-nowrap text-[12px]">
                      {s.implementingAgency ? (
                        <span className="rounded-md border border-white/20 bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/80">
                          {s.implementingAgency}
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="td whitespace-nowrap text-right tabular-nums">{s.totalCost?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right tabular-nums">{s.adpAllocation?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right tabular-nums">{u?.expenditure?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? "—"}</td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <Bar value={phys ?? 0} className="w-24" />
                        <span className="text-xs tabular-nums">{fmtPct(phys)}</span>
                      </div>
                    </td>
                    <td className="td">
                      <StageBadge stage={s.stage} />
                    </td>
                    <td className="td whitespace-nowrap text-[12px] text-white/50">{fmtDate(u?.reportDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
