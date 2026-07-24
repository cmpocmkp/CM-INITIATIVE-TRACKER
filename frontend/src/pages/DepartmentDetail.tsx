import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Scheme, Update, fmtM, fmtPct, fmtDate } from "../api";
import { Heading, Spinner, ErrorBox, Bar, StageBadge, Kpi, NumBox } from "../ui";

interface DeptDetail {
  id: string;
  code: string;
  name: string;
  schemes: Scheme[];
  ledInitiatives: { id: string; number: number; name: string; shortName: string; updates: Update[] }[];
}

export default function DepartmentDetail() {
  const { id } = useParams();
  const [d, setD] = useState<DeptDetail | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;
    api.get<DeptDetail>(`/departments/${id}`).then(setD).catch((e) => setErr((e as Error).message));
  }, [id]);

  if (err) return <ErrorBox message={err} />;
  if (!d) return <Spinner label="Loading department…" />;

  const alloc = d.schemes.reduce((a, s) => a + (s.adpAllocation ?? 0), 0);
  const cost = d.schemes.reduce((a, s) => a + (s.totalCost ?? 0), 0);
  const spent = d.schemes.reduce((a, s) => a + (s.updates?.[0]?.expenditure ?? 0), 0);
  const reported = d.schemes.filter((s) => s.updates?.length).length;

  return (
    <div className="space-y-6">
      <Heading title={d.name} subtitle={`Login code: ${d.code} · ${d.schemes.length} priority schemes`} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Portfolio Cost" value={fmtM(cost)} />
        <Kpi label="ADP Allocation" value={fmtM(alloc)} />
        <Kpi label="Expenditure" value={fmtM(spent)} />
        <Kpi label="Schemes Reporting" value={`${reported}/${d.schemes.length}`} />
      </div>

      {d.ledInitiatives.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-900">Leads CM Initiatives</h2>
          <div className="flex flex-wrap gap-2">
            {d.ledInitiatives.map((i) => (
              <Link key={i.id} to={`/initiatives/${i.id}`} className="badge border-navy-200 bg-navy-50 text-navy-700 hover:border-navy-400">
                #{i.number} {i.shortName}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-900">Priority Schemes</h2>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full" style={{ minWidth: 900 }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="th">Initiative</th>
                <th className="th">Scheme</th>
                <th className="th !text-right">Cost (M)</th>
                <th className="th !text-right">Alloc (M)</th>
                <th className="th !text-right">Spent (M)</th>
                <th className="th">Physical</th>
                <th className="th">Stage</th>
                <th className="th">Last Report</th>
              </tr>
            </thead>
            <tbody>
              {d.schemes.map((s) => {
                const u = s.updates?.[0];
                const phys = s.effectivePhysical ?? u?.physicalProgressPct ?? null;
                return (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-navy-50/40">
                    <td className="td whitespace-nowrap">
                      {s.initiative ? <NumBox n={s.initiative.number} size={22} /> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="td max-w-[360px]">
                      <Link to={`/schemes/${s.id}`} className="font-medium text-navy-800 hover:text-navy-600">
                        {s.adpCode && <span className="mr-1.5 text-[11px] text-slate-400">{s.adpCode}</span>}
                        {s.name}
                      </Link>
                    </td>
                    <td className="td whitespace-nowrap text-right">{s.totalCost?.toLocaleString() ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right">{s.adpAllocation?.toLocaleString() ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right">{u?.expenditure?.toLocaleString() ?? "—"}</td>
                    <td className="td w-36">
                      <div className="flex items-center gap-2">
                        <Bar value={phys ?? 0} className="w-20" />
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
      </div>
    </div>
  );
}
