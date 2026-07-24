import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cleanName, api, Scheme, deptShort, fmtPct, fmtDate } from "../api";
import { Heading, Spinner, ErrorBox, Bar, StageBadge, InitTag } from "../ui";

export default function ImplementationDetail() {
  const { name } = useParams();
  const [list, setList] = useState<Scheme[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get<Scheme[]>("/schemes").then(setList).catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <ErrorBox message={err} />;
  if (!list || !name) return <Spinner label="Loading…" />;

  const agency = decodeURIComponent(name);
  const schemes = list.filter((s) => (s.implementingAgency ?? "").trim() === agency);

  return (
    <div className="space-y-5">
      <Heading
        title={`Implementation — ${agency}`}
        action={
          <Link to="/implementation" className="btn-ghost">
            ← All agencies
          </Link>
        }
      />

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1220 }}>
            <thead>
              <tr className="border-b border-white/10">
                <th className="th">Initiative</th>
                <th className="th">Code</th>
                <th className="th">Scheme</th>
                <th className="th">Sector</th>
                <th className="th">Department</th>
                <th className="th !text-right">Cost (M)</th>
                <th className="th !text-right">Alloc (M)</th>
                <th className="th !text-right">Spent (M)</th>
                <th className="th" style={{ minWidth: 150 }}>Physical</th>
                <th className="th">Stage</th>
                <th className="th">Last Report</th>
              </tr>
            </thead>
            <tbody>
              {schemes.map((s) => {
                const u = s.updates?.[0];
                const phys = s.effectivePhysical ?? u?.physicalProgressPct ?? null;
                return (
                  <tr key={s.id} className="border-b border-white/[0.07] align-top hover:bg-white/[0.06]">
                    <td className="td whitespace-nowrap">
                      {s.initiative ? (
                        <Link to={`/initiatives/${s.initiative.id}`} title={`#${s.initiative.number} ${s.initiative.shortName}`} className="inline-flex hover:opacity-70">
                          <InitTag number={s.initiative.number} />
                        </Link>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="td whitespace-nowrap text-[12px] tabular-nums text-white/50">{s.adpCode ?? "—"}</td>
                    <td className="td max-w-[420px]">
                      <Link to={`/schemes/${s.id}`} className="text-white/90 hover:text-white hover:underline">
                        {cleanName(s.name)}
                      </Link>
                    </td>
                    <td className="td whitespace-nowrap text-[12px]">{s.sector}</td>
                    <td className="td whitespace-nowrap text-[12px]" title={s.department?.name}>
                      {deptShort(s.department)}
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
