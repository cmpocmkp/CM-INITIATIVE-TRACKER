import { useEffect, useMemo, useState } from "react";
import { api, PHASES, SheetRow, SiteStatus, SITE_STATUSES, Update, fmtDelta, fmtPct, todayStr } from "../api";
import { Heading, Spinner, ErrorBox, Delta, cn } from "../ui";

// ── Typed input sanitizers (regex-enforced while typing) ──────
const reDecimal = /[^0-9.]/g;
const reInt = /[^0-9]/g;

/** Keep only digits + a single decimal point. */
function sanitizeDecimal(v: string): string {
  const s = v.replace(reDecimal, "");
  const firstDot = s.indexOf(".");
  return firstDot === -1 ? s : s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
}
function sanitizeInt(v: string): string {
  return v.replace(reInt, "");
}
/** Percent: 0–100, one decimal max on blur. */
function clampPct(v: string): string {
  if (v === "") return "";
  const n = Number(v);
  if (!isFinite(n)) return "";
  return String(Math.round(Math.max(0, Math.min(100, n)) * 10) / 10);
}
/** Money: 2 decimals max on blur. */
function roundMoney(v: string): string {
  if (v === "") return "";
  const n = Number(v);
  if (!isFinite(n)) return "";
  return String(Math.round(Math.max(0, n) * 100) / 100);
}

type Draft = {
  phase: string;
  physicalProgressPct: string;
  narrative: string;
  manpower: string;
  machinery: string;
  siteStatus: SiteStatus | "";
  bottlenecks: string;
  remarks: string;
  fundsReleased: string;
  expenditure: string;
};

const emptyDraft = (): Draft => ({
  phase: "",
  physicalProgressPct: "",
  narrative: "",
  manpower: "",
  machinery: "",
  siteStatus: "",
  bottlenecks: "",
  remarks: "",
  fundsReleased: "",
  expenditure: "",
});

function fromUpdate(u: Update | null): Draft {
  if (!u) return emptyDraft();
  return {
    phase: u.phase ?? "",
    physicalProgressPct: u.physicalProgressPct?.toString() ?? "",
    narrative: u.narrative ?? "",
    manpower: u.manpower?.toString() ?? "",
    machinery: u.machinery?.toString() ?? "",
    siteStatus: u.siteStatus ?? "",
    bottlenecks: u.bottlenecks ?? "",
    remarks: u.remarks ?? "",
    fundsReleased: u.fundsReleased?.toString() ?? "",
    expenditure: u.expenditure?.toString() ?? "",
  };
}

type FlatRow = {
  key: string;
  entityType: "SCHEME" | "INITIATIVE" | "SUBPROJECT";
  entityId: string;
  name: string;
  tag: string | null; // INITIATIVE / PRP / null
  adpCode: string | null;
  allocation: number | null;
  hasSubs: boolean; // scheme with sub-items → % is rolled up, not typed here
  computed: boolean; // initiative with schemes → whole row auto-computed
  schemeCount?: number;
  rolledPhysical?: number | null;
  isSub: boolean;
  parentSchemeId?: string;
  today: Update | null;
  prev: Update | null;
};

function flatten(rows: SheetRow[]): FlatRow[] {
  const out: FlatRow[] = [];
  for (const r of rows) {
    out.push({
      key: `${r.entityType}:${r.entityId}`,
      entityType: r.entityType,
      entityId: r.entityId,
      name: r.name,
      tag: r.entityType === "INITIATIVE" ? "INITIATIVE" : r.isPRP ? "PRP" : null,
      adpCode: r.adpCode,
      allocation: r.allocation,
      hasSubs: r.hasSubs,
      computed: r.entityType === "INITIATIVE" && !!r.hasSchemes,
      schemeCount: r.schemeCount,
      rolledPhysical: r.rolledPhysical,
      isSub: false,
      today: r.today,
      prev: r.prev,
    });
    for (const s of r.subRows) {
      out.push({
        key: `SUBPROJECT:${s.entityId}`,
        entityType: "SUBPROJECT",
        entityId: s.entityId,
        name: s.name,
        tag: null,
        adpCode: null,
        allocation: null,
        hasSubs: false,
        computed: false,
        isSub: true,
        parentSchemeId: r.entityId,
        today: s.today,
        prev: s.prev,
      });
    }
  }
  return out;
}

export default function Entry() {
  const [date, setDate] = useState(todayStr());
  const [sheet, setSheet] = useState<SheetRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [addFor, setAddFor] = useState<{ schemeId: string; schemeName: string } | null>(null);
  const [newSub, setNewSub] = useState({ name: "", weight: "", targetDate: "" });

  const rows = useMemo(() => (sheet ? flatten(sheet) : []), [sheet]);

  async function load(d: string) {
    setSheet(null);
    setErr("");
    setSavedKeys(new Set());
    try {
      const res = await api.get<{ date: string; rows: SheetRow[] }>(`/progress/sheet?date=${d}`);
      const dr: Record<string, Draft> = {};
      const base: Record<string, string> = {};
      for (const fr of flatten(res.rows)) {
        const draft = fromUpdate(fr.today);
        dr[fr.key] = draft;
        base[fr.key] = JSON.stringify(draft);
      }
      setSheet(res.rows);
      setDrafts(dr);
      setBaseline(base);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const dirtyKeys = useMemo(
    () => Object.keys(drafts).filter((k) => JSON.stringify(drafts[k]) !== baseline[k]),
    [drafts, baseline],
  );

  function set(k: string, field: keyof Draft, value: string) {
    setDrafts((p) => ({ ...p, [k]: { ...p[k], [field]: value } }));
    setSavedKeys((p) => {
      if (!p.has(k)) return p;
      const n = new Set(p);
      n.delete(k);
      return n;
    });
  }

  async function saveAll() {
    if (!dirtyKeys.length) return;
    setSaving(true);
    setErr("");
    setNotice("");
    try {
      const entries = dirtyKeys.map((k) => {
        const [entityType, entityId] = k.split(":");
        const d = drafts[k];
        return {
          entityType,
          entityId,
          phase: d.phase || null,
          physicalProgressPct: d.physicalProgressPct === "" ? null : Number(d.physicalProgressPct),
          narrative: d.narrative || null,
          manpower: d.manpower === "" ? null : Number(d.manpower),
          machinery: d.machinery === "" ? null : Number(d.machinery),
          siteStatus: d.siteStatus === "" ? null : d.siteStatus,
          bottlenecks: d.bottlenecks || null,
          remarks: d.remarks || null,
          fundsReleased: d.fundsReleased === "" ? null : Number(d.fundsReleased),
          expenditure: d.expenditure === "" ? null : Number(d.expenditure),
        };
      });
      const res = await api.post<{ ok: boolean; saved: number; errors: string[] }>("/progress/sheet", { date, entries });
      const nb = { ...baseline };
      for (const k of dirtyKeys) nb[k] = JSON.stringify(drafts[k]);
      setBaseline(nb);
      setSavedKeys(new Set(dirtyKeys));
      setNotice(
        `Saved ${res.saved} entr${res.saved === 1 ? "y" : "ies"} for ${date}.` +
          (res.errors.length ? ` Errors: ${res.errors.join("; ")}` : ""),
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function createSub() {
    if (!addFor || !newSub.name.trim()) return;
    try {
      await api.post("/subprojects", {
        schemeId: addFor.schemeId,
        name: newSub.name.trim(),
        weight: newSub.weight === "" ? undefined : Number(newSub.weight),
        targetDate: newSub.targetDate || undefined,
      });
      setAddFor(null);
      setNewSub({ name: "", weight: "", targetDate: "" });
      await load(date);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (err && !sheet) return <ErrorBox message={err} />;
  if (!sheet) return <Spinner label="Loading your data sheet…" />;

  // Regex-typed numeric cell: pct → 0–100, int → whole numbers, money → 2 decimals.
  const cellTyped = (
    fr: FlatRow,
    field: keyof Draft,
    kind: "pct" | "int" | "money",
    opts?: { placeholder?: string; disabled?: boolean },
  ) => (
    <input
      type="text"
      inputMode={kind === "int" ? "numeric" : "decimal"}
      disabled={opts?.disabled}
      className={cn("cell text-right", opts?.disabled && "cursor-not-allowed text-slate-300")}
      value={drafts[fr.key]?.[field] ?? ""}
      placeholder={opts?.placeholder}
      onChange={(e) =>
        set(fr.key, field, kind === "int" ? sanitizeInt(e.target.value) : sanitizeDecimal(e.target.value))
      }
      onBlur={(e) => {
        if (kind === "pct") set(fr.key, field, clampPct(e.target.value));
        if (kind === "money") set(fr.key, field, roundMoney(e.target.value));
      }}
    />
  );

  return (
    <div className="space-y-4">
      <Heading
        title="Daily Data Entry"
        subtitle="Cumulative % from start — Δ, financial % and statuses compute automatically."
        action={
          <div className="flex items-center gap-2">
            <input type="date" className="input w-auto" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
            <button className="btn-primary" onClick={saveAll} disabled={saving || !dirtyKeys.length}>
              {saving ? "Saving…" : `Save All${dirtyKeys.length ? ` (${dirtyKeys.length})` : ""}`}
            </button>
          </div>
        }
      />

      {notice && <div className="rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-[13px] text-neutral-800">✓ {notice}</div>}
      {err && <ErrorBox message={err} />}

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full table-fixed border-collapse" style={{ minWidth: 1810 }}>
            <colgroup>
              <col style={{ width: 340 }} />
              <col style={{ width: 165 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 76 }} />
              <col style={{ width: 230 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 105 }} />
              <col style={{ width: 105 }} />
              <col style={{ width: 48 }} />
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="grid-th sticky left-0 z-30 bg-white shadow-[2px_0_4px_-2px_rgba(11,74,104,0.15)]">Scheme / Work Item</th>
                <th className="grid-th">Phase</th>
                <th className="grid-th !text-right">% Done</th>
                <th className="grid-th !text-center">Δ Today</th>
                <th className="grid-th">Work Done Today</th>
                <th className="grid-th !text-right">Manpower</th>
                <th className="grid-th !text-right">Machinery</th>
                <th className="grid-th">Site Status</th>
                <th className="grid-th">Issues / Decisions</th>
                <th className="grid-th">Additional Details</th>
                <th className="grid-th !text-right">Released M</th>
                <th className="grid-th !text-right">Spent M</th>
                <th className="grid-th !border-r-0 !text-center">✓</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((fr) => {
                const d = drafts[fr.key] ?? emptyDraft();
                const dirty = JSON.stringify(d) !== baseline[fr.key];
                const saved = savedKeys.has(fr.key);
                const isInit = fr.entityType === "INITIATIVE";
                const schemeWithSubs = fr.entityType === "SCHEME" && fr.hasSubs;
                const locked = schemeWithSubs || fr.computed;
                const prevPct = fr.prev?.physicalProgressPct ?? null;
                const typedPct = d.physicalProgressPct === "" ? (fr.today?.physicalProgressPct ?? null) : Number(d.physicalProgressPct);
                const delta = fmtDelta(typedPct, prevPct);
                const nameBg = dirty ? "bg-neutral-100" : isInit ? "bg-navy-50/50" : "bg-white";

                return (
                  <tr key={fr.key} className={cn("group/row", dirty && "bg-neutral-100/60", isInit && !dirty && "bg-navy-50/30")}>
                    {/* Name (frozen) */}
                    <td className={cn("grid-td sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(11,74,104,0.12)]", nameBg)}>
                      <div className={cn("px-3 py-2", fr.isSub && "pl-8")}>
                        <div className={cn("truncate text-[13px] font-medium leading-tight", isInit ? "text-navy-800" : fr.isSub ? "text-slate-600" : "text-slate-900")} title={fr.name}>
                          {fr.isSub && <span className="mr-1.5 text-navy-300">└</span>}
                          {fr.tag === "INITIATIVE" && <span className="mr-1.5 rounded bg-navy-600 px-1 py-px text-[9px] font-bold text-white">INITIATIVE</span>}
                          {fr.tag === "PRP" && <span className="mr-1.5 rounded bg-navy-50 px-1 py-px text-[9px] font-bold text-navy-600 ring-1 ring-navy-200">PRP</span>}
                          {fr.name}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-[10.5px] text-slate-400">
                          {fr.adpCode && <span className="font-medium text-slate-400">#{fr.adpCode}</span>}
                          {fr.computed ? (
                            <span>auto from {fr.schemeCount} scheme{fr.schemeCount === 1 ? "" : "s"}</span>
                          ) : fr.prev ? (
                            <span>
                              was {fr.prev.physicalProgressPct ?? "—"}% · {new Date(fr.prev.reportDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                            </span>
                          ) : null}
                          {schemeWithSubs && <span>rolls up</span>}
                          {fr.entityType === "SCHEME" && (
                            <button
                              className="font-semibold text-navy-500 opacity-0 transition-opacity hover:underline group-hover/row:opacity-100"
                              onClick={() => setAddFor({ schemeId: fr.entityId, schemeName: fr.name })}
                            >
                              + work item
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Phase */}
                    <td className="grid-td">
                      {locked ? (
                        <div className="cell flex items-center justify-center" aria-disabled>—</div>
                      ) : (
                        <select className="cell" value={d.phase} onChange={(e) => set(fr.key, "phase", e.target.value)}>
                          <option value="">{fr.prev?.phase ? `(${fr.prev.phase})` : "select…"}</option>
                          {PHASES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    {/* % */}
                    <td className="grid-td">
                      {fr.computed ? (
                        <div className="flex h-10 items-center justify-end gap-1 px-2.5 text-[13px] font-bold text-navy-700">
                          {fmtPct(fr.rolledPhysical)}
                          <span className="text-[8px] font-bold tracking-wide text-slate-400">AUTO</span>
                        </div>
                      ) : (
                        cellTyped(fr, "physicalProgressPct", "pct", { placeholder: prevPct != null ? String(prevPct) : "0–100", disabled: schemeWithSubs })
                      )}
                    </td>
                    {/* Δ */}
                    <td className="grid-td text-center"><Delta value={locked ? null : delta} /></td>
                    {/* Work */}
                    <td className="grid-td">
                      <input className="cell" value={d.narrative} placeholder={fr.computed ? "" : "today's work…"} onChange={(e) => set(fr.key, "narrative", e.target.value)} disabled={fr.computed} />
                    </td>
                    <td className="grid-td">{cellTyped(fr, "manpower", "int", { placeholder: fr.prev?.manpower?.toString(), disabled: locked })}</td>
                    <td className="grid-td">{cellTyped(fr, "machinery", "int", { placeholder: fr.prev?.machinery?.toString(), disabled: locked })}</td>
                    {/* Status */}
                    <td className="grid-td">
                      {locked ? (
                        <div className="cell flex items-center justify-center" aria-disabled>—</div>
                      ) : (
                        <select className="cell" value={d.siteStatus} onChange={(e) => set(fr.key, "siteStatus", e.target.value)}>
                          <option value="">{fr.prev ? `(${fr.prev.siteStatus.replace(/_/g, " ").toLowerCase()})` : "auto"}</option>
                          {SITE_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="grid-td">
                      <input className="cell" value={d.bottlenecks} placeholder={fr.computed ? "" : "issues…"} onChange={(e) => set(fr.key, "bottlenecks", e.target.value)} disabled={fr.computed} />
                    </td>
                    <td className="grid-td">
                      <input className="cell" value={d.remarks} placeholder={fr.computed ? "" : "details…"} onChange={(e) => set(fr.key, "remarks", e.target.value)} disabled={fr.computed} />
                    </td>
                    <td className="grid-td">
                      {fr.entityType === "SCHEME" ? cellTyped(fr, "fundsReleased", "money", { placeholder: fr.prev?.fundsReleased?.toString() }) : <div className="cell flex items-center justify-center" aria-disabled>—</div>}
                    </td>
                    <td className="grid-td">
                      {fr.entityType === "SCHEME" ? cellTyped(fr, "expenditure", "money", { placeholder: fr.prev?.expenditure?.toString() }) : <div className="cell flex items-center justify-center" aria-disabled>—</div>}
                    </td>
                    <td className="grid-td !border-r-0 text-center">
                      {fr.computed ? (
                        <span className="text-[9px] font-bold text-slate-300">AUTO</span>
                      ) : saved ? (
                        <span className="font-bold text-neutral-900">✓</span>
                      ) : dirty ? (
                        <span className="text-neutral-500">●</span>
                      ) : fr.today ? (
                        <span className="text-navy-400">✓</span>
                      ) : (
                        <span className="text-slate-200">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span><span className="text-neutral-500">●</span> unsaved</span>
            <span><span className="font-bold text-neutral-900">✓</span> saved</span>
            <span><span className="font-bold text-slate-300">AUTO</span> computed — fill the lowest level only</span>
          </div>
          <div>
            {rows.length} rows · {dirtyKeys.length} unsaved
          </div>
        </div>
      </div>

      {/* Add work item modal */}
      {addFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-[15px] font-bold text-navy-900">Add work item</h3>
            <p className="mt-1 text-[12px] text-slate-500">
              Under: <span className="font-medium text-slate-700">{addFor.schemeName}</span> — e.g. “Dalazak Road Underpass”. It becomes its own daily-tracked row; the scheme&apos;s % rolls up from its work items.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Work item name *</label>
                <input className="input" value={newSub.name} onChange={(e) => setNewSub({ ...newSub, name: e.target.value })} placeholder="e.g. Dalazak Road Underpass" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Weight / cost share (M) — optional</label>
                  <input className="input" type="number" min={0} value={newSub.weight} onChange={(e) => setNewSub({ ...newSub, weight: e.target.value })} placeholder="equal if blank" />
                </div>
                <div>
                  <label className="label">Target date — optional</label>
                  <input className="input" type="date" value={newSub.targetDate} onChange={(e) => setNewSub({ ...newSub, targetDate: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setAddFor(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={createSub} disabled={!newSub.name.trim()}>
                Add work item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
