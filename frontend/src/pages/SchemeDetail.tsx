import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, Scheme, STAGES, Stage, Update, fmtM, fmtPct, fmtDate, fmtDelta } from "../api";
import { useAuth, isStaff } from "../auth";
import { Heading, Spinner, ErrorBox, Bar, StageBadge, SiteBadge, Delta, Empty } from "../ui";

function HistoryTable({ updates, showMoney }: { updates: Update[]; showMoney: boolean }) {
  if (!updates.length) return <Empty title="No submissions yet" hint="Daily entries will appear here with computed day-on-day change." />;
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full" style={{ minWidth: showMoney ? 1400 : 1260 }}>
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.04]">
            <th className="th">Date</th>
            <th className="th">Phase</th>
            <th className="th !text-right">% Complete</th>
            <th className="th !text-center">Δ</th>
            <th className="th !text-right">Manpower</th>
            <th className="th !text-right">Machinery</th>
            <th className="th">Site</th>
            {showMoney && <th className="th !text-right">Released (M)</th>}
            {showMoney && <th className="th !text-right">Spent (M)</th>}
            {showMoney && <th className="th !text-right">Fin %</th>}
            <th className="th" style={{ minWidth: 170 }}>Work Done</th>
            <th className="th" style={{ minWidth: 150 }}>Issues</th>
            <th className="th" style={{ minWidth: 150 }}>Additional Details</th>
            <th className="th">By</th>
          </tr>
        </thead>
        <tbody>
          {updates.map((x, i) => {
            const prev = updates[i + 1]; // list is newest-first
            const delta = fmtDelta(x.physicalProgressPct, prev?.physicalProgressPct ?? null);
            return (
              <tr key={x.id} className="border-b border-white/[0.07] align-top hover:bg-navy-50/30">
                <td className="td whitespace-nowrap font-medium text-navy-800">{fmtDate(x.reportDate)}</td>
                <td className="td whitespace-nowrap text-[12px]">{x.phase ?? "—"}</td>
                <td className="td whitespace-nowrap text-right font-semibold">{fmtPct(x.physicalProgressPct)}</td>
                <td className="td text-center">
                  <Delta value={delta} />
                </td>
                <td className="td whitespace-nowrap text-right">{x.manpower ?? "—"}</td>
                <td className="td whitespace-nowrap text-right">{x.machinery ?? "—"}</td>
                <td className="td">
                  <SiteBadge status={x.siteStatus} />
                </td>
                {showMoney && <td className="td whitespace-nowrap text-right">{x.fundsReleased?.toLocaleString() ?? "—"}</td>}
                {showMoney && <td className="td whitespace-nowrap text-right">{x.expenditure?.toLocaleString() ?? "—"}</td>}
                {showMoney && <td className="td whitespace-nowrap text-right">{x.financialProgressPct != null ? `${x.financialProgressPct.toFixed(1)}%` : "—"}</td>}
                <td className="td max-w-[240px] text-[12px] text-white/75">{x.narrative ?? <span className="text-white/30">—</span>}</td>
                <td className="td max-w-[220px] text-[12px]">
                  {x.bottlenecks ? (
                    <span className="text-white/95">
                      <b>⚠</b> {x.bottlenecks}
                    </span>
                  ) : (
                    <span className="text-white/30">—</span>
                  )}
                </td>
                <td className="td max-w-[220px] text-[12px] text-white/60">{x.remarks ?? <span className="text-white/30">—</span>}</td>
                <td className="td whitespace-nowrap text-[12px] text-white/50">{x.submittedBy?.username ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SchemeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [s, setS] = useState<Scheme | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [openSub, setOpenSub] = useState<string | null>(null);

  const canEdit = !!user && (isStaff(user) || user.departmentId === s?.department?.id);

  function load() {
    if (!id) return;
    api.get<Scheme>(`/schemes/${id}`).then(setS).catch((e) => setErr((e as Error).message));
  }
  useEffect(load, [id]);

  async function changeStage(stage: Stage) {
    if (!id) return;
    setMsg("");
    try {
      await api.patch(`/schemes/${id}/stage`, { stage });
      setMsg("✓ Lifecycle stage updated");
      load();
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    }
  }

  async function deleteSub(subId: string, name: string) {
    if (!window.confirm(`Delete work item "${name}" and its history?`)) return;
    try {
      await api.del(`/subprojects/${subId}`);
      load();
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    }
  }

  if (err) return <ErrorBox message={err} />;
  if (!s) return <Spinner label="Loading scheme…" />;

  const u = s.updates?.[0];
  const phys = s.effectivePhysical ?? u?.physicalProgressPct ?? null;
  const subs = s.subProjects ?? [];

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="border-b border-white/10 bg-white/[0.05] px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-navy-600">
                {s.sector} {s.adpCode ? `· ADP ${s.adpCode}` : ""} {s.isPRP ? "· Peshawar Revitalization Plan" : ""}
              </div>
              <h1 className="mt-1 text-lg font-bold leading-snug text-navy-900">{s.name}</h1>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-white/40">Lifecycle (PC-1 etc.)</div>
              {canEdit ? (
                <select
                  className="input mt-1 w-auto py-1.5 text-[13px] font-semibold text-navy-900"
                  value={s.stage}
                  onChange={(e) => changeStage(e.target.value as Stage)}
                >
                  {STAGES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1">
                  <StageBadge stage={s.stage} />
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Owner Department", s.department?.name ?? "—"],
              ["Initiative", s.initiative ? `#${s.initiative.number} ${s.initiative.shortName}` : "—"],
              ["Total Cost", fmtM(s.totalCost)],
              ["ADP Allocation", fmtM(s.adpAllocation)],
            ].map(([l, v]) => (
              <div key={l as string}>
                <div className="text-[10px] uppercase tracking-wider text-white/40">{l}</div>
                <div className="mt-0.5 text-[13px] font-semibold text-navy-900">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 px-6 py-4 sm:grid-cols-5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Physical (rolled up)</div>
            <div className="flex items-center gap-2">
              <Bar value={phys ?? 0} className="w-20" />
              <span className="text-[15px] font-bold text-navy-900">{fmtPct(phys)}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Site Status</div>
            <div className="mt-1">
              <SiteBadge status={u?.siteStatus} />
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Funds Released</div>
            <div className="text-[15px] font-bold text-navy-900">{fmtM(u?.fundsReleased)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Expenditure</div>
            <div className="text-[15px] font-bold text-navy-900">{fmtM(u?.expenditure)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">Financial % (auto)</div>
            <div className="text-[15px] font-bold text-navy-900">
              {u?.financialProgressPct != null ? `${u.financialProgressPct.toFixed(1)}%` : "—"}
            </div>
          </div>
        </div>
        {msg && <div className="border-t border-white/[0.07] px-6 py-2 text-[12px] text-navy-700">{msg}</div>}
      </div>

      {/* Work items */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-900">
            Work Items ({subs.length}) — underpasses, packages, sites…
          </h2>
          <span className="text-[11px] text-white/40">added by the department from the Daily Entry sheet</span>
        </div>
        {!subs.length ? (
          <Empty title="No work items yet" hint='Use "+ Add work item" on the Daily Data Entry sheet to split this scheme into individually tracked works (e.g. each underpass).' />
        ) : (
          <div className="divide-y divide-white/[0.07]">
            {subs.map((sp) => {
              const lu = sp.updates?.[0];
              const open = openSub === sp.id;
              return (
                <div key={sp.id}>
                  <div className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-navy-50/30">
                    <button className="flex-1 text-left" onClick={() => setOpenSub(open ? null : sp.id)}>
                      <span className="text-[13px] font-semibold text-navy-800">{sp.name}</span>
                      {sp.weight != null && <span className="ml-2 text-[11px] text-white/40">weight {sp.weight}</span>}
                      {sp.targetDate && <span className="ml-2 text-[11px] text-white/40">target {fmtDate(sp.targetDate)}</span>}
                    </button>
                    <div className="flex items-center gap-2">
                      <Bar value={lu?.physicalProgressPct ?? 0} className="w-24" />
                      <span className="w-10 text-right text-xs font-bold text-navy-800">{fmtPct(lu?.physicalProgressPct)}</span>
                    </div>
                    <SiteBadge status={lu?.siteStatus} />
                    <span className="text-[11px] text-white/40">{lu ? fmtDate(lu.reportDate) : "no report"}</span>
                    <button className="text-[11px] text-white/40 hover:text-navy-600" onClick={() => setOpenSub(open ? null : sp.id)}>
                      {open ? "▲ hide history" : "▼ history"}
                    </button>
                    {canEdit && (
                      <button className="text-[11px] text-white/40 hover:text-white" onClick={() => deleteSub(sp.id, sp.name)}>
                        delete
                      </button>
                    )}
                  </div>
                  {open && (
                    <div className="border-t border-white/[0.07] bg-white/[0.04]/50 px-5 py-3">
                      <HistoryTable updates={sp.updates ?? []} showMoney={false} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scheme-level history */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-900">Scheme-level Daily History</h2>
          <span className="text-xs text-white/40">{s.updates?.length ?? 0} submissions</span>
        </div>
        <HistoryTable updates={s.updates ?? []} showMoney={true} />
      </div>

      <div className="text-[12px] text-white/40">
        Raw ADP entry: <span className="text-white/50">{s.rawName}</span>
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
