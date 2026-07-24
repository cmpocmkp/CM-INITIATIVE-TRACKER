import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, Scheme, fmtM, fmtPct } from "../api";
import { Heading, Spinner, ErrorBox, Bar } from "../ui";

interface Dept {
  id: string;
  key: string;
  code: string;
  name: string;
  isSector: boolean;
  _count: { schemes: number; ledInitiatives: number };
}

interface Agg {
  count: number;
  alloc: number;
  spent: number;
  physW: number;
  w: number;
}

export default function Departments() {
  const [list, setList] = useState<Dept[] | null>(null);
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get<Dept[]>("/departments").then(setList).catch((e) => setErr((e as Error).message));
    api.get<Scheme[]>("/schemes").then(setSchemes).catch(() => setSchemes([]));
  }, []);

  const agg = useMemo(() => {
    const by = new Map<string, Agg>();
    for (const s of schemes ?? []) {
      const id = s.department?.id;
      if (!id) continue;
      const a = by.get(id) ?? { count: 0, alloc: 0, spent: 0, physW: 0, w: 0 };
      a.count++;
      a.alloc += s.adpAllocation ?? 0;
      a.spent += s.updates?.[0]?.expenditure ?? 0;
      const weight = (s.totalCost ?? 0) > 0 ? (s.totalCost as number) : 1;
      a.w += weight;
      a.physW += (s.effectivePhysical ?? s.updates?.[0]?.physicalProgressPct ?? 0) * weight;
      by.set(id, a);
    }
    return by;
  }, [schemes]);

  if (err) return <ErrorBox message={err} />;
  if (!list || !schemes) return <Spinner label="Loading departments…" />;

  const filtered = list.filter(
    (d) => !q || d.name.toLowerCase().includes(q.toLowerCase()) || d.code.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <Heading title="Department" />
      <input className="input max-w-xs" placeholder="Search department…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {filtered.map((d) => {
          const a = agg.get(d.id);
          const phys = a && a.w ? a.physW / a.w : 0;
          return (
            <Link
              key={d.id}
              to={`/departments/${d.id}`}
              className="card group p-4 transition hover:border-white/30 hover:shadow-md"
            >
              <h3 className="truncate text-[14px] leading-snug text-white/95" title={d.name}>
                {d.name}
              </h3>
              <div className="mt-1 text-[11px] text-white/50">
                {d.code}
                {d._count.ledInitiatives > 0 && <> · leads {d._count.ledInitiatives} initiative{d._count.ledInitiatives === 1 ? "" : "s"}</>}
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <Bar value={phys} className="flex-1" />
                <div className="text-[13px] text-navy-800">{fmtPct(phys)}</div>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-1 border-t border-white/[0.07] pt-2 text-center">
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-white/40">Schemes</div>
                  <div className="text-[12px] text-navy-900">{a?.count ?? 0}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-white/40">Allocation</div>
                  <div className="text-[12px] text-navy-900">{fmtM(a?.alloc ?? 0)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-white/40">Spent</div>
                  <div className="text-[12px] text-navy-900">{fmtM(a?.spent ?? 0)}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
