import { useEffect, useMemo, useState } from "react";
import { cleanName, api, PHASES, SheetRow, SiteStatus, SITE_STATUSES, Update, fmtDate, fmtDelta, fmtPct } from "../api";
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
  dayLocked: boolean; // submitted for today → frozen until correction approved
  correction: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | null;
};

/** Required columns per row type — Issues & Additional Details stay optional. */
function requiredFields(fr: FlatRow): (keyof Draft)[] {
  if (fr.computed) return [];
  if (fr.entityType === "SCHEME" && fr.hasSubs) return ["fundsReleased", "expenditure"];
  if (fr.entityType === "SCHEME")
    return ["phase", "physicalProgressPct", "narrative", "manpower", "machinery", "fundsReleased", "expenditure"];
  if (fr.entityType === "SUBPROJECT") return ["phase", "physicalProgressPct", "narrative", "manpower", "machinery"];
  return ["phase", "physicalProgressPct", "narrative"]; // direct initiative entry
}

function missingOf(fr: FlatRow, d: Draft): (keyof Draft)[] {
  return requiredFields(fr).filter((f) => (d[f] ?? "").toString().trim() === "");
}

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
      dayLocked: !!r.locked,
      correction: r.correction ?? null,
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
        dayLocked: !!s.locked,
        correction: s.correction ?? null,
      });
    }
  }
  return out;
}

export default function Entry() {
  // Reporting date is fixed to TODAY in Pakistan — set by the server, never picked.
  const [date, setDate] = useState<string>("");
  const [sheet, setSheet] = useState<SheetRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [addFor, setAddFor] = useState<{ schemeId: string; schemeName: string } | null>(null);
  const [newSub, setNewSub] = useState({ name: "", weight: "", targetDate: "" });
  const [corrFor, setCorrFor] = useState<FlatRow | null>(null);
  const [corrReason, setCorrReason] = useState("");
  const [attempted, setAttempted] = useState(false);

  const rows = useMemo(() => (sheet ? flatten(sheet) : []), [sheet]);

  // Rows the department must fill today (not auto, not already locked)
  const editableRows = useMemo(() => rows.filter((r) => !r.computed && !r.dayLocked), [rows]);
  const completeRows = useMemo(
    () => editableRows.filter((r) => missingOf(r, drafts[r.key] ?? emptyDraft()).length === 0),
    [editableRows, drafts],
  );
  const allComplete = editableRows.length > 0 && completeRows.length === editableRows.length;

  async function load() {
    setSheet(null);
    setErr("");
    setSavedKeys(new Set());
    try {
      const res = await api.get<{ date: string; rows: SheetRow[] }>("/progress/sheet");
      const dr: Record<string, Draft> = {};
      const base: Record<string, string> = {};
      for (const fr of flatten(res.rows)) {
        const draft = fromUpdate(fr.today);
        dr[fr.key] = draft;
        base[fr.key] = JSON.stringify(draft);
      }
      setDate(res.date);
      setSheet(res.rows);
      setDrafts(dr);
      setBaseline(base);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!editableRows.length) return;
    // Everything must be complete — the whole day submits as one sealed record.
    if (!allComplete) {
      setAttempted(true);
      const firstIncomplete = editableRows.find((r) => missingOf(r, drafts[r.key] ?? emptyDraft()).length > 0);
      setErr(
        `Cannot submit yet — ${editableRows.length - completeRows.length} row(s) have empty fields (highlighted). ` +
          (firstIncomplete ? `Start with "${firstIncomplete.name.slice(0, 50)}".` : ""),
      );
      return;
    }
    setSaving(true);
    setErr("");
    setNotice("");
    try {
      const entries = editableRows.map((fr) => {
        const d = drafts[fr.key];
        return {
          entityType: fr.entityType,
          entityId: fr.entityId,
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
      const res = await api.post<{ ok: boolean; saved: number; errors: string[] }>("/progress/sheet", { entries });
      if (!res.ok && res.saved === 0) {
        setErr(res.errors.join(" · "));
        return;
      }
      setAttempted(false);
      setNotice(`✓ Day submitted — ${res.saved} entr${res.saved === 1 ? "y" : "ies"} recorded for ${fmtDate(date)}. The sheet is now locked; corrections go through the CM Office.`);
      await load(); // reload → rows come back locked 
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submitCorrection() {
    if (!corrFor || corrReason.trim().length < 5) return;
    try {
      await api.post("/corrections", { entityType: corrFor.entityType, entityId: corrFor.entityId, reason: corrReason.trim() });
      setCorrFor(null);
      setCorrReason("");
      setNotice("Correction request sent to the CM Office — the row unlocks once approved.");
      await load();
    } catch (e) {
      setErr((e as Error).message);
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
      await load();
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
    opts?: { placeholder?: string; disabled?: boolean; missing?: boolean },
  ) => (
    <input
      type="text"
      inputMode={kind === "int" ? "numeric" : "decimal"}
      disabled={opts?.disabled}
      className={cn(
        "cell text-right",
        opts?.disabled && "cursor-not-allowed text-white/30",
        opts?.missing && "bg-white/10 ring-1 ring-inset ring-white/60",
      )}
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
        title="Weekly Data Entry"
        subtitle="Weekly collection — every Monday. Cumulative % from start; Δ, financial % and statuses compute automatically."
        action={
          <div className="flex items-center gap-3">
            <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white/75">
              Reporting week: <span className="font-medium">Mon {date ? fmtDate(date) : "…"}</span>
              <span className="ml-1.5 text-[11px] text-white/40">(current week · Pakistan)</span>
            </span>
            <button
              className={cn("btn-primary", !allComplete && editableRows.length > 0 && "opacity-80")}
              onClick={saveAll}
              disabled={saving || editableRows.length === 0}
              title={allComplete ? "All rows complete — submit the week" : "Fill every required field first (click to highlight what's missing)"}
            >
              {saving
                ? "Submitting…"
                : editableRows.length === 0
                  ? "Week Submitted ✓"
                  : `Submit Week (${completeRows.length}/${editableRows.length})`}
            </button>
          </div>
        }
      />

      {/* Completion strip — the user always knows where they stand */}
      {editableRows.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5">
          <span className="h-[4px] w-40 flex-1 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-white/85 transition-all"
              style={{ width: `${(completeRows.length / editableRows.length) * 100}%` }}
            />
          </span>
          <span className="whitespace-nowrap text-[12px] tabular-nums text-white/60">
            {completeRows.length}/{editableRows.length} rows complete
          </span>
          <span className="hidden whitespace-nowrap text-[11px] text-white/40 lg:inline">
            · all fields required except Issues &amp; Details · one submission per week — then the sheet locks
          </span>
        </div>
      )}
      {editableRows.length === 0 && rows.some((r) => r.dayLocked) && (
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[13px] text-white/75">
          This week&apos;s sheet is submitted and locked. To fix a mistake use{" "}
          <span className="font-medium">request correction</span> on the row — the CM Office approves or rejects it.
        </div>
      )}

      {notice && <div className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[13px] text-white/85">{notice}</div>}
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
                <th className="grid-th sticky left-0 z-30 !bg-[#26282d] shadow-[2px_0_8px_rgba(0,0,0,0.45)]">Scheme / Work Item</th>
                <th className="grid-th">Phase</th>
                <th className="grid-th !text-right">% Done</th>
                <th className="grid-th !text-center">Δ Week</th>
                <th className="grid-th">Work Done This Week</th>
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
                const rowAuto = schemeWithSubs || fr.computed;
                const frozen = fr.dayLocked; // today's entry submitted → read-only
                const locked = rowAuto || frozen;
                const prevPct = fr.prev?.physicalProgressPct ?? null;
                const typedPct = d.physicalProgressPct === "" ? (fr.today?.physicalProgressPct ?? null) : Number(d.physicalProgressPct);
                const delta = fmtDelta(typedPct, prevPct);
                const nameBg = dirty ? "bg-[#2e3036]" : isInit ? "bg-[#292b31]" : "bg-[#242629]";
                const missSet = new Set<string>(!locked ? missingOf(fr, d) : []);
                const hl = (f: keyof Draft) => attempted && missSet.has(f); // highlight after a submit attempt
                const rowDone = !locked && missSet.size === 0;

                return (
                  <tr key={fr.key} className={cn("group/row", dirty && "bg-white/[0.07]", isInit && !dirty && "bg-white/[0.04]")}>
                    {/* Name (frozen) */}
                    <td className={cn("grid-td sticky left-0 z-10 shadow-[2px_0_4px_-2px_rgba(11,74,104,0.12)]", nameBg)}>
                      <div className={cn("px-3 py-2", fr.isSub && "pl-8")}>
                        <div className={cn("truncate text-[13px] leading-tight", isInit ? "text-navy-800" : fr.isSub ? "text-white/60" : "text-white/95")} title={cleanName(fr.name)}>
                          {fr.isSub && <span className="mr-1.5 text-navy-300">└</span>}
                          {fr.tag === "INITIATIVE" && <span className="mr-1.5 rounded bg-white/90 px-1 py-px text-[9px] font-bold text-black">INITIATIVE</span>}
                          {fr.tag === "PRP" && <span className="mr-1.5 rounded bg-navy-50 px-1 py-px text-[9px] font-bold text-navy-600 ring-1 ring-navy-200">PRP</span>}
                          {cleanName(fr.name)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-[10.5px] text-white/40">
                          {fr.adpCode && <span className="font-medium text-white/40">#{fr.adpCode}</span>}
                          {fr.computed ? (
                            <span>auto from {fr.schemeCount} scheme{fr.schemeCount === 1 ? "" : "s"}</span>
                          ) : fr.prev ? (
                            <span>
                              was {fr.prev.physicalProgressPct ?? "—"}% · {new Date(fr.prev.reportDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                            </span>
                          ) : null}
                          {schemeWithSubs && <span>rolls up</span>}
                          {frozen && fr.correction !== "PENDING" && (
                            <button className="font-medium text-white/75 hover:underline" onClick={() => { setCorrFor(fr); setCorrReason(""); }}>
                              request correction
                            </button>
                          )}
                          {fr.correction === "PENDING" && <span className="text-white/50">correction pending with CM Office…</span>}
                          {fr.correction === "APPROVED" && !frozen && <span className="text-white/85">correction approved — edit &amp; save (one time)</span>}
                          {fr.entityType === "SCHEME" && !frozen && (
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
                        <div className="cell flex items-center text-[12px]" aria-disabled>
                          {frozen ? fr.today?.phase ?? "—" : "—"}
                        </div>
                      ) : (
                        <select className={cn("cell", hl("phase") && "bg-white/10 ring-1 ring-inset ring-white/60")} value={d.phase} onChange={(e) => set(fr.key, "phase", e.target.value)}>
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
                          <span className="text-[8px] font-bold tracking-wide text-white/40">AUTO</span>
                        </div>
                      ) : (
                        cellTyped(fr, "physicalProgressPct", "pct", { placeholder: prevPct != null ? String(prevPct) : "0–100", disabled: schemeWithSubs || frozen, missing: hl("physicalProgressPct") })
                      )}
                    </td>
                    {/* Δ */}
                    <td className="grid-td text-center"><Delta value={locked ? null : delta} /></td>
                    {/* Work */}
                    <td className="grid-td">
                      <input className={cn("cell", hl("narrative") && "bg-white/10 ring-1 ring-inset ring-white/60")} value={d.narrative} placeholder={fr.computed || frozen ? "" : "this week's work…"} onChange={(e) => set(fr.key, "narrative", e.target.value)} disabled={fr.computed || frozen} />
                    </td>
                    <td className="grid-td">{cellTyped(fr, "manpower", "int", { placeholder: fr.prev?.manpower?.toString(), disabled: locked, missing: hl("manpower") })}</td>
                    <td className="grid-td">{cellTyped(fr, "machinery", "int", { placeholder: fr.prev?.machinery?.toString(), disabled: locked, missing: hl("machinery") })}</td>
                    {/* Status */}
                    <td className="grid-td">
                      {locked ? (
                        <div className="cell flex items-center text-[12px]" aria-disabled>
                          {frozen && fr.today ? fr.today.siteStatus.replace(/_/g, " ").toLowerCase() : "—"}
                        </div>
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
                      <input className="cell" value={d.bottlenecks} placeholder={fr.computed || frozen ? "" : "issues…"} onChange={(e) => set(fr.key, "bottlenecks", e.target.value)} disabled={fr.computed || frozen} />
                    </td>
                    <td className="grid-td">
                      <input className="cell" value={d.remarks} placeholder={fr.computed || frozen ? "" : "details…"} onChange={(e) => set(fr.key, "remarks", e.target.value)} disabled={fr.computed || frozen} />
                    </td>
                    <td className="grid-td">
                      {fr.entityType === "SCHEME" ? cellTyped(fr, "fundsReleased", "money", { placeholder: fr.prev?.fundsReleased?.toString(), disabled: frozen, missing: hl("fundsReleased") }) : <div className="cell flex items-center justify-center" aria-disabled>—</div>}
                    </td>
                    <td className="grid-td">
                      {fr.entityType === "SCHEME" ? cellTyped(fr, "expenditure", "money", { placeholder: fr.prev?.expenditure?.toString(), disabled: frozen, missing: hl("expenditure") }) : <div className="cell flex items-center justify-center" aria-disabled>—</div>}
                    </td>
                    <td className="grid-td !border-r-0 text-center">
                      {fr.computed ? (
                        <span className="text-[9px] font-bold text-white/30">AUTO</span>
                      ) : frozen ? (
                        <span title="Submitted — locked for today. Use 'request correction' to edit."></span>
                      ) : rowDone ? (
                        <span className="font-bold text-white/95" title="Row complete — ready to submit">✓</span>
                      ) : (
                        <span className="text-[10px] tabular-nums text-white/40" title={`${missSet.size} required field(s) empty`}>
                          {missSet.size} left
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] text-white/40">
          <div className="flex items-center gap-4">
            <span><span className="text-white/50">●</span> unsaved</span>
            <span><span className="font-bold text-white/95">✓</span> saved</span>
            <span><span className="font-bold text-white/30">AUTO</span> computed — fill the lowest level only</span>
          </div>
          <div>
            {rows.length} rows · {dirtyKeys.length} unsaved
          </div>
        </div>
      </div>

      {/* Correction request modal */}
      {corrFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-[15px] text-white/95">Request correction</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-white/50">
              Today&apos;s entry for <span className="text-white/85">{corrFor.name}</span> is locked. Explain what
              needs correcting — the CM Office will approve or reject; on approval you can edit and save once.
            </p>
            <textarea
              className="input mt-4 h-24 resize-none"
              placeholder="e.g. entered 45% instead of 35% by mistake…"
              value={corrReason}
              onChange={(e) => setCorrReason(e.target.value)}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setCorrFor(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={submitCorrection} disabled={corrReason.trim().length < 5}>
                Send request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add work item modal */}
      {addFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
          <div className="card w-full max-w-md p-6">
            <h3 className="text-[15px] font-bold text-navy-900">Add work item</h3>
            <p className="mt-1 text-[12px] text-white/50">
              Under: <span className="font-medium text-white/75">{addFor.schemeName}</span> — e.g. “Dalazak Road Underpass”. It becomes its own daily-tracked row; the scheme&apos;s % rolls up from its work items.
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
