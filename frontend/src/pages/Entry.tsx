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
        subtitle="Like a spreadsheet: % is cumulative from start — the system computes today's increase (Δ) itself. Money (Rs M) is entered at scheme level."
        action={
          <div className="flex items-center gap-3">
            <input type="date" className="input w-auto" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
            <button className="btn-primary" onClick={saveAll} disabled={saving || !dirtyKeys.length}>
              {saving ? "Saving…" : `Save All${dirtyKeys.length ? ` (${dirtyKeys.length})` : ""}`}
            </button>
          </div>
        }
      />

      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">✓ {notice}</div>}
      {err && <ErrorBox message={err} />}

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 1680 }}>
            <thead>
              <tr className="border-b border-slate-200 bg-navy-900 text-white">
                <th className="sticky left-0 z-10 bg-navy-900 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ minWidth: 300 }}>
                  Scheme / Work Item
                </th>
                <th className="th !text-white/70" style={{ minWidth: 140 }}>Current Phase</th>
                <th className="th !text-right !text-white/70">% Complete</th>
                <th className="th !text-center !text-white/70">Δ Today</th>
                <th className="th !text-white/70" style={{ minWidth: 200 }}>Work Done Today</th>
                <th className="th !text-right !text-white/70">Manpower</th>
                <th className="th !text-right !text-white/70">Machinery</th>
                <th className="th !text-white/70">Site Status</th>
                <th className="th !text-white/70" style={{ minWidth: 160 }}>Issues / Needs Decision</th>
                <th className="th !text-white/70" style={{ minWidth: 170 }}>Additional Details</th>
                <th className="th !text-right !text-white/70">Released (M)</th>
                <th className="th !text-right !text-white/70">Spent (M)</th>
                <th className="th !text-center !text-white/70">✓</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((fr) => {
                const d = drafts[fr.key] ?? emptyDraft();
                const dirty = JSON.stringify(d) !== baseline[fr.key];
                const saved = savedKeys.has(fr.key);
                const isInit = fr.entityType === "INITIATIVE";
                const schemeWithSubs = fr.entityType === "SCHEME" && fr.hasSubs;
                // Locked = value comes from elsewhere (rollup) — no double typing.
                const locked = schemeWithSubs || fr.computed;
                const prevPct = fr.prev?.physicalProgressPct ?? null;
                const typedPct = d.physicalProgressPct === "" ? (fr.today?.physicalProgressPct ?? null) : Number(d.physicalProgressPct);
                const delta = fmtDelta(typedPct, prevPct);

                return (
                  <tr
                    key={fr.key}
                    className={cn(
                      "border-b border-slate-100",
                      isInit ? "bg-navy-50/70" : fr.isSub ? "bg-white" : "bg-slate-50/70",
                      dirty && "!bg-amber-50/70",
                    )}
                  >
                    <td className={cn("sticky left-0 z-10 px-3 py-2 text-[13px]", isInit ? "bg-navy-50" : dirty ? "bg-amber-50" : fr.isSub ? "bg-white" : "bg-slate-50")}>
                      <div className={cn("flex items-start gap-1.5 leading-snug", fr.isSub && "pl-5")}>
                        {fr.isSub && <span className="mt-0.5 text-navy-300">└</span>}
                        <div className="min-w-0">
                          <div className={cn("font-medium", isInit ? "text-navy-800" : fr.isSub ? "text-slate-700" : "text-slate-900")}>
                            {fr.tag && (
                              <span className={cn("mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold", fr.tag === "INITIATIVE" ? "bg-navy-800 text-white" : "bg-navy-100 text-navy-700")}>
                                {fr.tag}
                              </span>
                            )}
                            {fr.name}
                            {fr.adpCode && <span className="ml-1.5 text-[11px] text-slate-400">#{fr.adpCode}</span>}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                            {fr.computed ? (
                              <span className="italic">auto-computed from its {fr.schemeCount} scheme{fr.schemeCount === 1 ? "" : "s"} — no entry needed here</span>
                            ) : (
                              fr.prev && (
                                <>was {fr.prev.physicalProgressPct ?? "—"}% on {new Date(fr.prev.reportDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</>
                              )
                            )}
                            {fr.entityType === "SCHEME" && (
                              <button
                                className="font-semibold text-navy-500 hover:text-navy-700 hover:underline"
                                onClick={() => setAddFor({ schemeId: fr.entityId, schemeName: fr.name })}
                              >
                                + Add work item
                              </button>
                            )}
                            {schemeWithSubs && <span className="italic">% rolls up from work items</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="border-l border-slate-100 p-0">
                      {locked ? (
                        <div className="cell flex cursor-not-allowed items-center text-slate-300">—</div>
                      ) : (
                        <select className="cell" value={d.phase} onChange={(e) => set(fr.key, "phase", e.target.value)}>
                          <option value="">{fr.prev?.phase ? `(${fr.prev.phase})` : "— select phase —"}</option>
                          {PHASES.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="w-24 border-l border-slate-100 p-0">
                      {fr.computed ? (
                        <div className="cell flex items-center justify-end gap-1 font-bold text-navy-700">
                          {fmtPct(fr.rolledPhysical)} <span className="text-[9px] font-semibold text-slate-400">AUTO</span>
                        </div>
                      ) : (
                        cellTyped(fr, "physicalProgressPct", "pct", {
                          placeholder: prevPct != null ? String(prevPct) : "0–100",
                          disabled: schemeWithSubs,
                        })
                      )}
                    </td>
                    <td className="w-20 border-l border-slate-100 text-center">
                      <Delta value={locked ? null : delta} />
                    </td>
                    <td className="border-l border-slate-100 p-0">
                      <input
                        className={cn("cell", fr.computed && "cursor-not-allowed")}
                        value={d.narrative}
                        placeholder={fr.computed ? "—" : "what moved on ground today…"}
                        onChange={(e) => set(fr.key, "narrative", e.target.value)}
                        disabled={fr.computed}
                      />
                    </td>
                    <td className="w-24 border-l border-slate-100 p-0">{cellTyped(fr, "manpower", "int", { placeholder: fr.prev?.manpower?.toString(), disabled: locked })}</td>
                    <td className="w-24 border-l border-slate-100 p-0">{cellTyped(fr, "machinery", "int", { placeholder: fr.prev?.machinery?.toString(), disabled: locked })}</td>
                    <td className="w-32 border-l border-slate-100 p-0">
                      {locked ? (
                        <div className="cell flex cursor-not-allowed items-center text-slate-300">auto</div>
                      ) : (
                        <select className="cell" value={d.siteStatus} onChange={(e) => set(fr.key, "siteStatus", e.target.value)}>
                          <option value="">{fr.prev ? `(${fr.prev.siteStatus.replace(/_/g, " ").toLowerCase()})` : "auto from %"}</option>
                          {SITE_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="border-l border-slate-100 p-0">
                      <input
                        className={cn("cell", fr.computed && "cursor-not-allowed")}
                        value={d.bottlenecks}
                        placeholder={fr.computed ? "—" : "blocker / decision needed"}
                        onChange={(e) => set(fr.key, "bottlenecks", e.target.value)}
                        disabled={fr.computed}
                      />
                    </td>
                    <td className="border-l border-slate-100 p-0">
                      <input
                        className={cn("cell", fr.computed && "cursor-not-allowed")}
                        value={d.remarks}
                        placeholder={fr.computed ? "—" : "any other details…"}
                        onChange={(e) => set(fr.key, "remarks", e.target.value)}
                        disabled={fr.computed}
                      />
                    </td>
                    <td className="w-24 border-l border-slate-100 p-0">
                      {fr.entityType === "SCHEME" ? cellTyped(fr, "fundsReleased", "money", { placeholder: fr.prev?.fundsReleased?.toString() }) : <div className="cell cursor-not-allowed text-center text-slate-300">—</div>}
                    </td>
                    <td className="w-24 border-l border-slate-100 p-0">
                      {fr.entityType === "SCHEME" ? cellTyped(fr, "expenditure", "money", { placeholder: fr.prev?.expenditure?.toString() }) : <div className="cell cursor-not-allowed text-center text-slate-300">—</div>}
                    </td>
                    <td className="w-10 text-center">
                      {fr.computed ? <span className="text-[10px] font-bold text-slate-400">AUTO</span> : saved ? <span className="text-emerald-600">✓</span> : dirty ? <span className="text-amber-500">●</span> : fr.today ? <span className="text-navy-400">✓</span> : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-500">
          <div>
            <span className="mr-4">● unsaved</span>
            <span className="mr-4 text-emerald-600">✓ saved</span>
            <span>
              % is cumulative · Δ, Financial %, Site Status and Lifecycle stage are derived automatically (entering
              progress marks a scheme Started; 100% marks it Completed) · initiative &amp; scheme rows with children are
              AUTO — fill only the lowest level.
            </span>
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
