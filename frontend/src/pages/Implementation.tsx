import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, Scheme, fmtM, fmtPct } from "../api";
import { Heading, Spinner, ErrorBox, Bar, Empty } from "../ui";

interface Agg {
  agency: string;
  count: number;
  cost: number;
  alloc: number;
  spent: number;
  physW: number;
  w: number;
}

export default function Implementation() {
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get<Scheme[]>("/schemes").then(setSchemes).catch((e) => setErr((e as Error).message));
  }, []);

  const rows = useMemo(() => {
    const by = new Map<string, Agg>();
    for (const s of schemes ?? []) {
      const agency = s.implementingAgency?.trim();
      if (!agency) continue;
      const a = by.get(agency) ?? { agency, count: 0, cost: 0, alloc: 0, spent: 0, physW: 0, w: 0 };
      a.count++;
      a.cost += s.totalCost ?? 0;
      a.alloc += s.adpAllocation ?? 0;
      a.spent += s.updates?.[0]?.expenditure ?? 0;
      const weight = (s.totalCost ?? 0) > 0 ? (s.totalCost as number) : 1;
      a.w += weight;
      a.physW += (s.effectivePhysical ?? s.updates?.[0]?.physicalProgressPct ?? 0) * weight;
      by.set(agency, a);
    }
    return [...by.values()].sort((x, y) => y.alloc - x.alloc);
  }, [schemes]);

  if (err) return <ErrorBox message={err} />;
  if (!schemes) return <Spinner label="Loading implementation view…" />;

  return (
    <div className="space-y-5">
      <Heading title="Implementation" />

      {!rows.length ? (
        <Empty
          title="No implementing agencies set yet"
          hint="Set the implementing agency on a scheme (✎ Edit Scheme) and it appears here."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {rows.map((a) => {
            const phys = a.w ? a.physW / a.w : 0;
            return (
              <Link
                key={a.agency}
                to={`/implementation/${encodeURIComponent(a.agency)}`}
                className="card group p-4 transition hover:border-white/30 hover:shadow-md"
              >
                <h3 className="truncate text-[14px] leading-snug text-white/95" title={a.agency}>
                  {a.agency}
                </h3>
                <div className="mt-1 text-[11px] text-white/50">implementing agency</div>

                <div className="mt-2.5 flex items-center gap-2">
                  <Bar value={phys} className="flex-1" />
                  <div className="text-[13px] text-navy-800">{fmtPct(phys)}</div>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-1 border-t border-white/[0.07] pt-2 text-center">
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-white/40">Schemes</div>
                    <div className="text-[12px] text-navy-900">{a.count}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-white/40">Allocation</div>
                    <div className="text-[12px] text-navy-900">{fmtM(a.alloc)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-white/40">Spent</div>
                    <div className="text-[12px] text-navy-900">{fmtM(a.spent)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
