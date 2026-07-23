import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, Initiative, fmtM, fmtPct } from "../api";
import { Heading, Spinner, ErrorBox, Bar } from "../ui";

function roll(i: Initiative) {
  let cost = 0, alloc = 0, spent = 0, physW = 0, w = 0, updated = 0;
  for (const s of i.schemes) {
    cost += s.totalCost ?? 0;
    alloc += s.adpAllocation ?? 0;
    const u = s.updates?.[0];
    spent += u?.expenditure ?? 0;
    const weight = (s.totalCost ?? 0) > 0 ? (s.totalCost as number) : 1;
    w += weight;
    physW += (u?.physicalProgressPct ?? 0) * weight;
    if (u) updated++;
  }
  const own = i.updates?.[0];
  const phys = i.schemes.length ? (w ? physW / w : 0) : own?.physicalProgressPct ?? 0;
  return { cost, alloc, spent, phys, updated };
}

export default function Initiatives() {
  const [list, setList] = useState<Initiative[] | null>(null);
  const [err, setErr] = useState("");
  const [cat, setCat] = useState("All");

  useEffect(() => {
    api.get<Initiative[]>("/initiatives").then(setList).catch((e) => setErr((e as Error).message));
  }, []);

  const cats = useMemo(
    () => ["All", ...Array.from(new Set((list ?? []).map((i) => i.category)))],
    [list],
  );

  if (err) return <ErrorBox message={err} />;
  if (!list) return <Spinner label="Loading initiatives…" />;

  const filtered = cat === "All" ? list : list.filter((i) => i.category === cat);

  return (
    <div className="space-y-5">
      <Heading
        title="The 21 CM Focus Initiatives"
        subtitle="Chief Minister's flagship priorities — each groups its ADP schemes across departments"
      />

      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={
              c === cat
                ? "badge border-navy-800 bg-navy-800 text-white"
                : "badge border-slate-300 bg-white text-slate-600 hover:border-navy-400"
            }
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((i) => {
          const r = roll(i);
          return (
            <Link key={i.id} to={`/initiatives/${i.id}`} className="card group p-5 transition hover:border-navy-300 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-sm font-extrabold text-white">
                  {i.number}
                </div>
                <span className="badge border-navy-100 bg-navy-50 text-navy-600">{i.category}</span>
              </div>
              <h3 className="mt-3 text-[15px] font-bold leading-snug text-navy-900 group-hover:text-navy-700">
                {i.name}
              </h3>
              <div className="mt-1 text-[12px] text-slate-500">
                Lead: <span className="font-semibold text-slate-700">{i.leadDepartment?.name ?? "—"}</span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Bar value={r.phys} className="flex-1" />
                <div className="text-sm font-bold text-navy-800">{fmtPct(r.phys)}</div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Schemes</div>
                  <div className="text-[13px] font-bold text-navy-900">{i.schemes.length}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Allocation</div>
                  <div className="text-[13px] font-bold text-navy-900">{fmtM(r.alloc)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Spent</div>
                  <div className="text-[13px] font-bold text-navy-900">{fmtM(r.spent)}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
