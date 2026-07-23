import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Scheme, fmtM, fmtPct, fmtDate } from "../api";
import { Heading, Spinner, ErrorBox, Bar, StageBadge, Empty } from "../ui";

export default function SchemeDetail() {
  const { id } = useParams();
  const [s, setS] = useState<Scheme | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;
    api.get<Scheme>(`/schemes/${id}`).then(setS).catch((e) => setErr((e as Error).message));
  }, [id]);

  if (err) return <ErrorBox message={err} />;
  if (!s) return <Spinner label="Loading scheme…" />;

  const u = s.updates?.[0];

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="bg-navy-900 px-6 py-5 text-white">
          <div className="text-[11px] uppercase tracking-wider text-white/60">
            {s.sector} {s.adpCode ? `· ADP ${s.adpCode}` : ""} {s.isPRP ? "· Peshawar Revitalization Plan" : ""}
          </div>
          <h1 className="mt-1 text-lg font-bold leading-snug">{s.name}</h1>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Owner Department", s.department?.name ?? "—"],
              ["Initiative", s.initiative ? `#${s.initiative.number} ${s.initiative.shortName}` : "—"],
              ["Total Cost", fmtM(s.totalCost)],
              ["ADP Allocation", fmtM(s.adpAllocation)],
            ].map(([l, v]) => (
              <div key={l as string}>
                <div className="text-[10px] uppercase tracking-wider text-white/50">{l}</div>
                <div className="mt-0.5 text-[13px] font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 px-6 py-4 sm:grid-cols-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Funds Released</div>
            <div className="text-[15px] font-bold text-navy-900">{fmtM(u?.fundsReleased)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Expenditure</div>
            <div className="text-[15px] font-bold text-navy-900">{fmtM(u?.expenditure)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Financial Progress</div>
            <div className="flex items-center gap-2">
              <Bar value={u?.financialProgressPct ?? 0} className="w-20" />
              <span className="text-[13px] font-bold text-navy-900">{fmtPct(u?.financialProgressPct)}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Physical Progress</div>
            <div className="flex items-center gap-2">
              <Bar value={u?.physicalProgressPct ?? 0} className="w-20" />
              <span className="text-[13px] font-bold text-navy-900">{fmtPct(u?.physicalProgressPct)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-900">Daily Progress History</h2>
          <span className="text-xs text-slate-400">{s.updates?.length ?? 0} submissions</span>
        </div>
        {!s.updates?.length ? (
          <Empty title="No submissions yet" hint="The owning department has not reported progress on this scheme yet." />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full" style={{ minWidth: 860 }}>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="th">Date</th>
                  <th className="th !text-right">Released (M)</th>
                  <th className="th !text-right">Spent (M)</th>
                  <th className="th !text-right">Fin %</th>
                  <th className="th !text-right">Phys %</th>
                  <th className="th">Stage</th>
                  <th className="th">Progress / Bottlenecks</th>
                  <th className="th">By</th>
                </tr>
              </thead>
              <tbody>
                {s.updates.map((x) => (
                  <tr key={x.id} className="border-b border-slate-100 align-top hover:bg-navy-50/30">
                    <td className="td whitespace-nowrap font-medium text-navy-800">{fmtDate(x.reportDate)}</td>
                    <td className="td whitespace-nowrap text-right">{x.fundsReleased?.toLocaleString() ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right">{x.expenditure?.toLocaleString() ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right">{fmtPct(x.financialProgressPct)}</td>
                    <td className="td whitespace-nowrap text-right">{fmtPct(x.physicalProgressPct)}</td>
                    <td className="td">
                      <StageBadge stage={x.stage} />
                    </td>
                    <td className="td max-w-[320px] text-[12px]">
                      {x.narrative && <div className="text-slate-700">{x.narrative}</div>}
                      {x.bottlenecks && (
                        <div className="mt-0.5 text-rose-600">
                          <b>⚠</b> {x.bottlenecks}
                        </div>
                      )}
                      {!x.narrative && !x.bottlenecks && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="td whitespace-nowrap text-[12px] text-slate-500">{x.submittedBy?.username ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-[12px] text-slate-400">
        Raw ADP entry: <span className="text-slate-500">{s.rawName}</span>
        {s.initiative && (
          <>
            {" · "}
            <Link className="text-navy-600 hover:underline" to={`/initiatives/${s.initiative.id}`}>
              View initiative
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
