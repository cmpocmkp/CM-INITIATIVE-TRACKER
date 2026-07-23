import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Initiative, fmtM, fmtPct, fmtDate } from "../api";
import { Heading, Spinner, ErrorBox, Bar, StageBadge, SiteBadge, Empty } from "../ui";
import { TrendLine } from "../charts";

export default function InitiativeDetail() {
  const { id } = useParams();
  const [i, setI] = useState<Initiative | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;
    api.get<Initiative>(`/initiatives/${id}`).then(setI).catch((e) => setErr((e as Error).message));
  }, [id]);

  if (err) return <ErrorBox message={err} />;
  if (!i) return <Spinner label="Loading initiative…" />;

  const alloc = i.schemes.reduce((a, s) => a + (s.adpAllocation ?? 0), 0);
  const cost = i.schemes.reduce((a, s) => a + (s.totalCost ?? 0), 0);
  const spent = i.schemes.reduce((a, s) => a + (s.updates?.[0]?.expenditure ?? 0), 0);

  const trendMap = new Map<string, { p: number[]; f: number[] }>();
  for (const t of i.trend ?? []) {
    const d = t.reportDate.slice(0, 10);
    const rec = trendMap.get(d) ?? { p: [], f: [] };
    if (t.physicalProgressPct != null) rec.p.push(t.physicalProgressPct);
    if (t.financialProgressPct != null) rec.f.push(t.financialProgressPct);
    trendMap.set(d, rec);
  }
  const trend = [...trendMap.entries()].map(([date, r]) => ({
    date: date.slice(5),
    physical: r.p.length ? r.p.reduce((a, b) => a + b, 0) / r.p.length : null,
    financial: r.f.length ? r.f.reduce((a, b) => a + b, 0) / r.f.length : null,
  }));

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="border-b-4 border-navy-500 bg-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-600 text-lg font-extrabold text-white">
              {i.number}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-navy-600">{i.category} · CM Focus Initiative</div>
              <h1 className="text-xl font-bold text-navy-900">{i.name}</h1>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Lead Department", i.leadDepartment ? `${i.leadDepartment.name}` : "—"],
              ["Schemes", String(i.schemes.length)],
              ["Portfolio Cost", fmtM(cost)],
              ["Alloc / Spent", `${fmtM(alloc)} · ${fmtM(spent)}`],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">{l}</div>
                <div className="mt-0.5 text-[13px] font-semibold text-navy-900">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy-900">Daily Progress Trend (30 days)</h2>
        <TrendLine data={trend} />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-900">Schemes under this Initiative</h2>
        </div>
        {i.schemes.length === 0 ? (
          <Empty title="No schemes visible" hint="This initiative has no ADP schemes attached yet (or none under your department)." />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="th">Scheme</th>
                  <th className="th">Dept</th>
                  <th className="th !text-right">Cost (M)</th>
                  <th className="th !text-right">Alloc (M)</th>
                  <th className="th !text-right">Spent (M)</th>
                  <th className="th">Physical</th>
                  <th className="th">Stage</th>
                  <th className="th">Last Report</th>
                </tr>
              </thead>
              <tbody>
                {i.schemes.map((s) => {
                  const u = s.updates?.[0];
                  const phys = s.effectivePhysical ?? u?.physicalProgressPct ?? null;
                  return (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-navy-50/40">
                      <td className="td max-w-[380px]">
                        <Link to={`/schemes/${s.id}`} className="font-medium text-navy-800 hover:text-navy-600">
                          {s.adpCode && <span className="mr-1.5 text-[11px] text-slate-400">{s.adpCode}</span>}
                          {s.name}
                        </Link>
                      </td>
                      <td className="td whitespace-nowrap text-[12px]">{s.department?.code}</td>
                      <td className="td whitespace-nowrap text-right">{s.totalCost?.toLocaleString() ?? "—"}</td>
                      <td className="td whitespace-nowrap text-right">{s.adpAllocation?.toLocaleString() ?? "—"}</td>
                      <td className="td whitespace-nowrap text-right">{u?.expenditure?.toLocaleString() ?? "—"}</td>
                      <td className="td w-40">
                        <div className="flex items-center gap-2">
                          <Bar value={phys ?? 0} className="w-24" />
                          <span className="text-xs font-semibold">{fmtPct(phys)}</span>
                        </div>
                      </td>
                      <td className="td">
                        <StageBadge stage={s.stage} />
                      </td>
                      <td className="td whitespace-nowrap text-[12px] text-slate-500">{fmtDate(u?.reportDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(i.updates?.length ?? 0) > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-900">
            Initiative-level Updates (by {i.leadDepartment?.code ?? "lead"})
          </h2>
          <div className="space-y-3">
            {i.updates.slice(0, 10).map((u) => (
              <div key={u.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-500">
                  <span className="font-semibold text-navy-800">{fmtDate(u.reportDate)}</span>
                  <span className="flex items-center gap-2">
                    {u.phase && <span className="text-slate-600">{u.phase}</span>}
                    phys {fmtPct(u.physicalProgressPct)} <SiteBadge status={u.siteStatus} />
                  </span>
                </div>
                {u.narrative && <p className="mt-1.5 text-[13px] text-slate-700">{u.narrative}</p>}
                {u.bottlenecks && (
                  <p className="mt-1 text-[12px] text-rose-600">
                    <b>Bottleneck:</b> {u.bottlenecks}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
