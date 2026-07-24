import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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
        title="Department"
        subtitle={`${list.length} departments — schemes grouped by the owning department. Each signs in with its code.`}
      />
      <input className="input max-w-xs" placeholder="Search department…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full" style={{ minWidth: 640 }}>
            <thead>
              <tr className="border-b border-white/10">
                <th className="th">Code</th>
                <th className="th">Department</th>
                <th className="th !text-right">Schemes</th>
                <th className="th !text-right">Leads Initiatives</th>
                <th className="th">ADP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  className="cursor-pointer border-b border-white/[0.07] hover:bg-white/[0.06]"
                  onClick={() => navigate(`/departments/${d.id}`)}
                >
                  <td className="td whitespace-nowrap text-[12px] text-white/50">{d.code}</td>
                  <td className="td">
                    <Link to={`/departments/${d.id}`} className="text-white/95 hover:underline">
                      {d.name}
                    </Link>
                  </td>
                  <td className="td text-right tabular-nums">{d._count.schemes || "—"}</td>
                  <td className="td text-right tabular-nums">{d._count.ledInitiatives || "—"}</td>
                  <td className="td text-[12px] text-white/40">{d.isSector ? "✓" : "non-ADP"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
