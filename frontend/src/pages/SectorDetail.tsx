import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Scheme, deptShort, fmtDate, fmtPct } from "../api";
import { Heading, Spinner, ErrorBox, Bar, StageBadge, NumBox } from "../ui";

interface SectorDetailData {
  sector: string;
  schemes: Scheme[];
}

export default function SectorDetail() {
  const { name } = useParams();
  const [d, setD] = useState<SectorDetailData | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!name) return;
    api
      .get<SectorDetailData>(`/sectors/${encodeURIComponent(name)}`)
      .then(setD)
      .catch((e) => setErr((e as Error).message));
  }, [name]);

  if (err) return <ErrorBox message={err} />;
  if (!d) return <Spinner label="Loading sector…" />;

  return (
    <div className="space-y-5">
      <Heading
        title={`Sector — ${d.sector}`}
        subtitle={`${d.schemes.length} scheme(s) · owning departments shown per row`}
        action={
          <Link to="/sectors" className="btn-ghost">
            ← All sectors
          </Link>
        }
      />

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1000 }}>
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="th">Initiative</th>
                <th className="th">Scheme</th>
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
              {d.schemes.map((s) => {
                const u = s.updates?.[0];
                const phys = s.effectivePhysical ?? u?.physicalProgressPct ?? null;
                return (
                  <tr key={s.id} className="border-b border-neutral-100 align-top hover:bg-neutral-50">
                    <td className="td whitespace-nowrap">
                      {s.initiative ? (
                        <Link
                          to={`/initiatives/${s.initiative.id}`}
                          title={`#${s.initiative.number} ${s.initiative.shortName}`}
                          className="inline-flex hover:opacity-70"
                        >
                          <NumBox n={s.initiative.number} size={22} />
                        </Link>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="td max-w-[360px]">
                      <Link to={`/schemes/${s.id}`} className="text-neutral-900 hover:underline">
                        {s.adpCode && <span className="mr-1.5 text-[11px] text-neutral-400">{s.adpCode}</span>}
                        {s.name}
                      </Link>
                    </td>
                    <td className="td whitespace-nowrap text-[12px]" title={s.department?.name}>
                      {deptShort(s.department)}
                    </td>
                    <td className="td whitespace-nowrap text-right tabular-nums">{s.totalCost?.toLocaleString() ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right tabular-nums">{s.adpAllocation?.toLocaleString() ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right tabular-nums">{u?.expenditure?.toLocaleString() ?? "—"}</td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <Bar value={phys ?? 0} className="w-24" />
                        <span className="text-xs tabular-nums">{fmtPct(phys)}</span>
                      </div>
                    </td>
                    <td className="td">
                      <StageBadge stage={s.stage} />
                    </td>
                    <td className="td whitespace-nowrap text-[12px] text-neutral-500">{fmtDate(u?.reportDate)}</td>
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
