import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { cleanName, api, Scheme, deptShort, fmtPct, fmtDate } from "../api";
import { useAuth, isStaff } from "../auth";
import { Heading, Spinner, ErrorBox, Bar, StageBadge, InitTag } from "../ui";

export default function Schemes() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const [params] = useSearchParams();
  const [list, setList] = useState<Scheme[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All");
  const [officialOnly, setOfficialOnly] = useState(staff);

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
    if (officialOnly && !s.isOfficial) return false;
    if (sector !== "All" && s.sector !== sector) return false;
    if (q) {
      const t = q.toLowerCase();
      return (
        s.name.toLowerCase().includes(t) ||
        (s.adpCode ?? "").includes(t) ||
        s.sector.toLowerCase().includes(t) ||
        (s.department?.name ?? "").toLowerCase().includes(t) ||
        (s.implementingAgency ?? "").toLowerCase().includes(t)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <Heading
        title={staff ? "All Priority Schemes" : "My Schemes"}
        subtitle={`${filtered.length} shown · ${list.filter((x) => x.isOfficial).length} official schemes · ${list.length - list.filter((x) => x.isOfficial).length} initiative work items`}
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
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/70">
          <input type="checkbox" checked={officialOnly} onChange={(e) => setOfficialOnly(e.target.checked)} className="h-4 w-4 accent-white" />
          Official schemes only
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1340 }}>
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04]">
                <th className="th">Initiative</th>
                <th className="th">Code</th>
                <th className="th">Scheme</th>
                <th className="th">Sector</th>
                <th className="th">Department</th>
                <th className="th">Implementation</th>
                <th className="th !text-right">Cost (M)</th>
                <th className="th !text-right">Alloc (M)</th>
                <th className="th !text-right">Spent (M)</th>
                <th className="th">Physical</th>
                <th className="th">Stage</th>
                <th className="th">Last Report</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const u = s.updates?.[0];
                const phys = s.effectivePhysical ?? u?.physicalProgressPct ?? null;
                return (
                  <tr key={s.id} className="border-b border-white/[0.07] hover:bg-white/[0.06]">
                    <td className="td whitespace-nowrap">
                      {s.initiative ? (
                        <Link
                          to={`/initiatives/${s.initiative.id}`}
                          title={`#${s.initiative.number} ${s.initiative.shortName}`}
                          className="inline-flex items-center gap-1.5 hover:opacity-70"
                        >
                          <InitTag number={s.initiative.number} />
                        </Link>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="td whitespace-nowrap text-[12px] tabular-nums text-white/50">{s.adpCode ?? "—"}</td>
                    <td className="td max-w-[360px]">
                      <Link to={`/schemes/${s.id}`} className="text-white/90 hover:text-white hover:underline">
                        {cleanName(s.name)}
                      </Link>
                      {(s.subProjects?.length ?? 0) > 0 && (
                        <span className="ml-1.5 text-[10px] font-semibold text-white/40">{s.subProjects!.length} work items</span>
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
                    <td className="td whitespace-nowrap text-right">{s.totalCost?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right">{s.adpAllocation?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right">{u?.expenditure?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? "—"}</td>
                    <td className="td w-36">
                      <div className="flex items-center gap-2">
                        <Bar value={phys ?? 0} className="w-20" />
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
