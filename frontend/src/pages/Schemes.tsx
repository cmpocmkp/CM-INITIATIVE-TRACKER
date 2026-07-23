import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, Scheme, fmtPct, fmtDate } from "../api";
import { useAuth, isStaff } from "../auth";
import { Heading, Spinner, ErrorBox, Bar, StageBadge } from "../ui";

export default function Schemes() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const [params] = useSearchParams();
  const [list, setList] = useState<Scheme[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All");

  useEffect(() => {
    const init = params.get("initiativeId");
    const dept = params.get("departmentId");
    const qs = new URLSearchParams();
    if (init) qs.set("initiativeId", init);
    if (dept) qs.set("departmentId", dept);
    api
      .get<Scheme[]>(`/schemes${qs.toString() ? `?${qs}` : ""}`)
      .then(setList)
      .catch((e) => setErr((e as Error).message));
  }, [params]);

  const sectors = useMemo(() => ["All", ...Array.from(new Set((list ?? []).map((s) => s.sector)))], [list]);

  if (err) return <ErrorBox message={err} />;
  if (!list) return <Spinner label="Loading schemes…" />;

  const filtered = list.filter((s) => {
    if (sector !== "All" && s.sector !== sector) return false;
    if (q) {
      const t = q.toLowerCase();
      return (
        s.name.toLowerCase().includes(t) ||
        (s.adpCode ?? "").includes(t) ||
        s.sector.toLowerCase().includes(t)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <Heading
        title={staff ? "All Priority Schemes" : "My Schemes"}
        subtitle={`${filtered.length} of ${list.length} schemes · CM's priority portfolio`}
        action={
          <a href="/api/export/schemes.csv" className="btn-ghost" download>
            ⬇ Export CSV
          </a>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search scheme, ADP code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input w-auto" value={sector} onChange={(e) => setSector(e.target.value)}>
          {sectors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1000 }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="th">#</th>
                <th className="th">Scheme</th>
                <th className="th">Sector / Dept</th>
                <th className="th">Initiative</th>
                <th className="th !text-right">Cost (M)</th>
                <th className="th !text-right">Alloc (M)</th>
                <th className="th !text-right">Spent (M)</th>
                <th className="th">Physical</th>
                <th className="th">Stage</th>
                <th className="th">Last Report</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => {
                const u = s.updates?.[0];
                return (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-navy-50/40">
                    <td className="td text-[12px] text-slate-400">{idx + 1}</td>
                    <td className="td max-w-[360px]">
                      <Link to={`/schemes/${s.id}`} className="font-medium text-navy-800 hover:text-navy-600">
                        {s.adpCode && <span className="mr-1.5 text-[11px] text-slate-400">{s.adpCode}</span>}
                        {s.name}
                      </Link>
                      {s.isPRP && (
                        <span className="ml-1.5 rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-bold text-navy-700">PRP</span>
                      )}
                    </td>
                    <td className="td whitespace-nowrap text-[12px]">{s.sector}</td>
                    <td className="td whitespace-nowrap text-[12px]">
                      {s.initiative ? (
                        <Link to={`/initiatives/${s.initiative.id}`} className="text-navy-600 hover:underline">
                          #{s.initiative.number} {s.initiative.shortName}
                        </Link>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="td whitespace-nowrap text-right">{s.totalCost?.toLocaleString() ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right">{s.adpAllocation?.toLocaleString() ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right">{u?.expenditure?.toLocaleString() ?? "—"}</td>
                    <td className="td w-36">
                      <div className="flex items-center gap-2">
                        <Bar value={u?.physicalProgressPct ?? 0} className="w-20" />
                        <span className="text-xs font-semibold">{fmtPct(u?.physicalProgressPct)}</span>
                      </div>
                    </td>
                    <td className="td">
                      <StageBadge stage={u?.stage} />
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
