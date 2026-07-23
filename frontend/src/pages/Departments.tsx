import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Heading, Spinner, ErrorBox } from "../ui";

interface Dept {
  id: string;
  key: string;
  code: string;
  name: string;
  isSector: boolean;
  _count: { schemes: number; ledInitiatives: number };
}

export default function Departments() {
  const [list, setList] = useState<Dept[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get<Dept[]>("/departments").then(setList).catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <ErrorBox message={err} />;
  if (!list) return <Spinner label="Loading departments…" />;

  const filtered = list.filter(
    (d) => !q || d.name.toLowerCase().includes(q.toLowerCase()) || d.code.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <Heading
        title="Departments / Sectors"
        subtitle={`${list.length} departments — department and sector are one dimension. Each signs in with its code.`}
      />
      <input className="input max-w-xs" placeholder="Search department…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((d) => (
          <Link key={d.id} to={`/departments/${d.id}`} className="card group flex items-center gap-4 p-4 transition hover:border-navy-300 hover:shadow-md">
            <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-[11px] font-extrabold text-white">
              {d.code}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-navy-900 group-hover:text-navy-700">{d.name}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {d._count.schemes} scheme{d._count.schemes === 1 ? "" : "s"}
                {d._count.ledInitiatives > 0 && <> · leads {d._count.ledInitiatives} initiative{d._count.ledInitiatives === 1 ? "" : "s"}</>}
                {!d.isSector && <span className="ml-1 text-slate-400">(non-ADP)</span>}
              </div>
            </div>
            <span className="text-slate-300 group-hover:text-navy-500">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
