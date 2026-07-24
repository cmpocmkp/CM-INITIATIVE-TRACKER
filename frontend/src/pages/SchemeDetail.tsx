import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { cleanName, api, Scheme, STAGES, Stage, Update, fmtM, fmtPct, fmtDate, fmtDelta } from "../api";
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
                <td className="td whitespace-nowrap text-white/85">{fmtDate(x.reportDate)}</td>
                <td className="td whitespace-nowrap text-[12px]">{x.phase ?? "—"}</td>
                <td className="td whitespace-nowrap text-right tabular-nums">{fmtPct(x.physicalProgressPct)}</td>
                <td className="td text-center">
                  <Delta value={delta} />
                </td>
                <td className="td whitespace-nowrap text-right">{x.manpower ?? "—"}</td>
                <td className="td whitespace-nowrap text-right">{x.machinery ?? "—"}</td>
                <td className="td">
                  <SiteBadge status={x.siteStatus} />
                </td>
                {showMoney && <td className="td whitespace-nowrap text-right">{x.fundsReleased?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? "—"}</td>}
                {showMoney && <td className="td whitespace-nowrap text-right">{x.expenditure?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? "—"}</td>}
                {showMoney && <td className="td whitespace-nowrap text-right">{x.financialProgressPct != null ? `${x.financialProgressPct.toFixed(1)}%` : "—"}</td>}
                <td className="td max-w-[240px] text-[12px] text-white/75">{x.narrative ?? <span className="text-white/30">—</span>}</td>
                <td className="td max-w-[220px] text-[12px]">
                  {x.bottlenecks ? (
                    <span className="text-white/95">
                      <b></b> {x.bottlenecks}
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
  const [editOpen, setEditOpen] = useState(false);
  const [depts, setDepts] = useState<{ id: string; name: string; code: string }[]>([]);
  const [inits, setInits] = useState<{ id: string; number: number; shortName: string }[]>([]);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const superadmin = user?.role === "SUPERADMIN";

  function openEditor() {
    if (!s) return;
    setForm({
      name: s.name,
      adpCode: s.adpCode ?? "",
      sector: s.sector,
      departmentId: s.department?.id ?? "",
      initiativeId: s.initiative?.id ?? "",
      implementingAgency: s.implementingAgency ?? "",
      totalCost: s.totalCost != null ? String(s.totalCost) : "",
      adpAllocation: s.adpAllocation != null ? String(s.adpAllocation) : "",
      isOfficial: !!s.isOfficial,
      isPRP: !!s.isPRP,
    });
    if (!depts.length) api.get<{ id: string; name: string; code: string }[]>("/departments").then(setDepts).catch(() => {});
    if (!inits.length) api.get<{ id: string; number: number; shortName: string }[]>("/initiatives").then(setInits).catch(() => {});
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!id) return;
    setSavingEdit(true);
    setMsg("");
    try {
      await api.patch(`/schemes/${id}`, {
        name: form.name,
        adpCode: form.adpCode,
        sector: form.sector,
        departmentId: form.departmentId,
        initiativeId: form.initiativeId || null,
        implementingAgency: form.implementingAgency,
        totalCost: form.totalCost === "" ? null : Number(form.totalCost),
        adpAllocation: form.adpAllocation === "" ? null : Number(form.adpAllocation),
        isOfficial: form.isOfficial,
        isPRP: form.isPRP,
      });
      setMsg("✓ Scheme updated");
      setEditOpen(false);
      load();
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    } finally {
      setSavingEdit(false);
    }
  }

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
              <h1 className="mt-1 text-lg font-bold leading-snug text-navy-900">{cleanName(s.name)}</h1>
            </div>
            <div className="text-right">
              {superadmin && (
                <button className="btn-ghost mb-2 px-3 py-1 text-[11px]" onClick={openEditor}>
                  Edit Scheme
                </button>
              )}
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

      {/* Government position — synced from PCFMS (P&D) */}
      {(s.pcfmsCategory || s.pcfmsBudget != null) && (
        <div className="card p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm uppercase tracking-widest text-white/95">P&amp;D Position (PCFMS)</h2>
            <span className="text-[11px] text-white/40">
              {s.pcfmsSyncedAt ? `synced ${new Date(s.pcfmsSyncedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}` : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Category</div>
              <div className="mt-1">
                {s.pcfmsCategory === "A" ? (
                  <span className="badge border-white/90 bg-white/90 text-black">A — Approved</span>
                ) : s.pcfmsCategory === "B" ? (
                  <span className="badge border-white/30 bg-white/10 text-white/80">B — PC-1 pending</span>
                ) : (
                  <span className="text-white/40">{s.pcfmsCategory ?? "—"}</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Forum</div>
              <div className="mt-1 text-[13px] text-white/85">{s.pcfmsForum || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">FY Budget</div>
              <div className="mt-1 text-[13px] tabular-nums text-white/95">{s.pcfmsBudget != null ? fmtM(s.pcfmsBudget) : "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Released</div>
              <div className="mt-1 text-[13px] tabular-nums text-white/95">{s.pcfmsReleases != null ? fmtM(s.pcfmsReleases) : "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">Expenditure</div>
              <div className="mt-1 text-[13px] tabular-nums text-white/95">{s.pcfmsExpenditure != null ? fmtM(s.pcfmsExpenditure) : "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40">P&amp;D Status</div>
              <div className="mt-1 text-[12px] text-white/75">{(s.pcfmsOverallStatus || "—").replace(/_/g, " ")}</div>
            </div>
          </div>
          {s.pcfmsTag && s.pcfmsTag !== "Normal" && (
            <div className="mt-3 text-[11px] text-white/50">
              Tagged <span className="text-white/85">{s.pcfmsTag === "TwentyBnScheme" ? "20bn Scheme" : s.pcfmsTag}</span> in the P&amp;D priority list.
            </div>
          )}
        </div>
      )}

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

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditOpen(false)}>
          <div className="card scroll-thin max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-sm uppercase tracking-widest text-white/95">Edit Scheme</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Scheme name</label>
                <textarea className="input" rows={2} value={String(form.name ?? "")} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">ADP code</label>
                <input className="input" value={String(form.adpCode ?? "")} onChange={(e) => setForm({ ...form, adpCode: e.target.value })} />
              </div>
              <div>
                <label className="label">Sector</label>
                <input className="input" value={String(form.sector ?? "")} onChange={(e) => setForm({ ...form, sector: e.target.value })} />
              </div>
              <div>
                <label className="label">Owner department (data entry)</label>
                <select className="input" value={String(form.departmentId ?? "")} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                  {depts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Initiative</label>
                <select className="input" value={String(form.initiativeId ?? "")} onChange={(e) => setForm({ ...form, initiativeId: e.target.value })}>
                  <option value="">— none —</option>
                  {inits.map((i) => (
                    <option key={i.id} value={i.id}>#{i.number} {i.shortName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Implementation (executing agency)</label>
                <input className="input" placeholder="PDA, WSSP, CMGP…" value={String(form.implementingAgency ?? "")} onChange={(e) => setForm({ ...form, implementingAgency: e.target.value })} />
              </div>
              <div>
                <label className="label">Total cost (Rs M)</label>
                <input className="input" inputMode="decimal" value={String(form.totalCost ?? "")} onChange={(e) => setForm({ ...form, totalCost: e.target.value })} />
              </div>
              <div>
                <label className="label">ADP allocation (Rs M)</label>
                <input className="input" inputMode="decimal" value={String(form.adpAllocation ?? "")} onChange={(e) => setForm({ ...form, adpAllocation: e.target.value })} />
              </div>
              <div className="flex items-center gap-5 sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/75">
                  <input type="checkbox" className="h-4 w-4 accent-white" checked={!!form.isOfficial} onChange={(e) => setForm({ ...form, isOfficial: e.target.checked })} />
                  Official scheme (counts in the 112)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-white/75">
                  <input type="checkbox" className="h-4 w-4 accent-white" checked={!!form.isPRP} onChange={(e) => setForm({ ...form, isPRP: e.target.checked })} />
                  Part of PRP
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
