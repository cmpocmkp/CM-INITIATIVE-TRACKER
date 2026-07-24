import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtM, fmtPct } from "../api";
import { Heading, Spinner, ErrorBox, Bar } from "../ui";

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
      <Heading title="Sector" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((s) => (
          <Link
            key={s.sector}
            to={`/sectors/${encodeURIComponent(s.sector)}`}
            className="card group p-4 transition hover:border-white/30 hover:shadow-md"
          >
            <h3 className="truncate text-[14px] leading-snug text-white/95" title={s.sector}>
              {s.sector}
            </h3>
            <div className="mt-1 text-[11px] text-white/50">
              {s.updatedToday}/{s.count} reported this week
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <Bar value={s.avgPhysical} className="flex-1" />
              <div className="text-[13px] text-navy-800">{fmtPct(s.avgPhysical)}</div>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-1 border-t border-white/[0.07] pt-2 text-center">
              <div>
                <div className="text-[9px] uppercase tracking-wide text-white/40">Schemes</div>
                <div className="text-[12px] text-navy-900">{s.count}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wide text-white/40">Allocation</div>
                <div className="text-[12px] text-navy-900">{fmtM(s.alloc)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wide text-white/40">Spent</div>
                <div className="text-[12px] text-navy-900">{fmtM(s.spent)}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
