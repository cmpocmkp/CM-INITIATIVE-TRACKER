import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtM, fmtPct } from "../api";
import { Heading, Spinner, ErrorBox } from "../ui";

interface SectorRow {
  sector: string;
  count: number;
  cost: number;
  alloc: number;
  spent: number;
  avgPhysical: number;
  updatedToday: number;
}

export default function Sectors() {
  const [list, setList] = useState<SectorRow[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get<SectorRow[]>("/sectors").then(setList).catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <ErrorBox message={err} />;
  if (!list) return <Spinner label="Loading sectors…" />;

  return (
    <div className="space-y-5">
      <Heading title="Sector" subtitle="Schemes grouped by ADP sector — independent of the owning department." />

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full" style={{ minWidth: 860 }}>
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="th">Sector</th>
                <th className="th !text-right">Schemes</th>
                <th className="th !text-right">Cost (M)</th>
                <th className="th !text-right">Allocation (M)</th>
                <th className="th !text-right">Spent (M)</th>
                <th className="th" style={{ minWidth: 170 }}>Physical</th>
                <th className="th !text-right">Updated Today</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.sector} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="td">
                    <Link to={`/sectors/${encodeURIComponent(r.sector)}`} className="text-neutral-900 hover:underline">
                      {r.sector}
                    </Link>
                  </td>
                  <td className="td text-right tabular-nums">{r.count}</td>
                  <td className="td text-right tabular-nums">{r.cost ? r.cost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</td>
                  <td className="td text-right tabular-nums">{r.alloc ? r.alloc.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</td>
                  <td className="td text-right tabular-nums">{r.spent ? r.spent.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</td>
                  <td className="td">
                    <div className="flex items-center gap-2">
                      <span className="h-[3px] w-28 overflow-hidden rounded-full bg-neutral-100">
                        <span className="block h-full bg-neutral-800" style={{ width: `${Math.min(100, r.avgPhysical)}%` }} />
                      </span>
                      <span className="text-[12px] tabular-nums text-neutral-700">{fmtPct(r.avgPhysical)}</span>
                    </div>
                  </td>
                  <td className="td text-right tabular-nums text-neutral-500">
                    {r.updatedToday}/{r.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">
          {list.length} sectors · total allocation {fmtM(list.reduce((a, r) => a + r.alloc, 0))}
        </div>
      </div>
    </div>
  );
}
