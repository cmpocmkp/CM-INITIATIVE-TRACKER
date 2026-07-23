import { useEffect, useMemo, useState } from "react";
import { api, SheetRow, Stage, STAGES, fmtM, todayStr } from "../api";
import { Heading, Spinner, ErrorBox, cn } from "../ui";

type Draft = {
  fundsReleased: string;
  expenditure: string;
  financialProgressPct: string;
  physicalProgressPct: string;
  stage: Stage | "";
  narrative: string;
  bottlenecks: string;
};

const emptyDraft = (): Draft => ({
  fundsReleased: "",
  expenditure: "",
  financialProgressPct: "",
  physicalProgressPct: "",
  stage: "",
  narrative: "",
  bottlenecks: "",
});

function fromUpdate(u: SheetRow["today"]): Draft {
  if (!u) return emptyDraft();
  return {
    fundsReleased: u.fundsReleased?.toString() ?? "",
    expenditure: u.expenditure?.toString() ?? "",
    financialProgressPct: u.financialProgressPct?.toString() ?? "",
    physicalProgressPct: u.physicalProgressPct?.toString() ?? "",
    stage: u.stage ?? "",
    narrative: u.narrative ?? "",
    bottlenecks: u.bottlenecks ?? "",
  };
}

const key = (r: SheetRow) => `${r.entityType}:${r.entityId}`;

export default function Entry() {
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<SheetRow[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function load(d: string) {
    setRows(null);
    setErr("");
    setSavedKeys(new Set());
    try {
      const res = await api.get<{ date: string; rows: SheetRow[] }>(`/progress/sheet?date=${d}`);
      const dr: Record<string, Draft> = {};
      const base: Record<string, string> = {};
      for (const r of res.rows) {
        const draft = fromUpdate(r.today);
        dr[key(r)] = draft;
        base[key(r)] = JSON.stringify(draft);
      }
      setRows(res.rows);
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

  /** Auto-suggest financial % when expenditure entered and % empty. */
  function onSpentBlur(r: SheetRow) {
    const k = key(r);
    const d = drafts[k];
    if (!d || d.financialProgressPct !== "" || d.expenditure === "") return;
    const alloc = r.adpAllocation;
    const spent = Number(d.expenditure);
    if (alloc && alloc > 0 && isFinite(spent)) {
      set(k, "financialProgressPct", Math.min(100, (spent / alloc) * 100).toFixed(1));
    }
  }

  async function saveAll() {
    if (!rows || !dirtyKeys.length) return;
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
          fundsReleased: d.fundsReleased === "" ? null : Number(d.fundsReleased),
          expenditure: d.expenditure === "" ? null : Number(d.expenditure),
          financialProgressPct: d.financialProgressPct === "" ? null : Number(d.financialProgressPct),
          physicalProgressPct: d.physicalProgressPct === "" ? null : Number(d.physicalProgressPct),
          stage: d.stage === "" ? null : d.stage,
          narrative: d.narrative || null,
          bottlenecks: d.bottlenecks || null,
        };
      });
      const res = await api.post<{ ok: boolean; saved: number; errors: string[] }>("/progress/sheet", {
        date,
        entries,
      });
      const nb = { ...baseline };
      for (const k of dirtyKeys) nb[k] = JSON.stringify(drafts[k]);
      setBaseline(nb);
      setSavedKeys(new Set(dirtyKeys));
      setNotice(`Saved ${res.saved} entr${res.saved === 1 ? "y" : "ies"} for ${date}. ${res.errors.length ? `Errors: ${res.errors.join("; ")}` : ""}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (err && !rows) return <ErrorBox message={err} />;
  if (!rows) return <Spinner label="Loading your data sheet…" />;

  const numCell = (r: SheetRow, field: keyof Draft, placeholder?: string) => {
    const k = key(r);
    const dirty = JSON.stringify(drafts[k]) !== baseline[k];
    return (
      <input
        type="number"
        min={0}
        step="any"
        className={cn("cell text-right", dirty && drafts[k][field] !== JSON.parse(baseline[k] || "{}")[field] && "cell-dirty")}
        value={drafts[k]?.[field] ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(k, field, e.target.value)}
        onBlur={field === "expenditure" ? () => onSpentBlur(r) : undefined}
      />
    );
  };

  return (
    <div className="space-y-4">
      <Heading
        title="Daily Data Entry"
        subtitle="Fill like a spreadsheet — figures are cumulative, Rs in millions. Only your department's entities are shown."
        action={
          <div className="flex items-center gap-3">
            <input
              type="date"
              className="input w-auto"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
            />
            <button className="btn-primary" onClick={saveAll} disabled={saving || !dirtyKeys.length}>
              {saving ? "Saving…" : `Save All${dirtyKeys.length ? ` (${dirtyKeys.length})` : ""}`}
            </button>
          </div>
        }
      />

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800">
          ✓ {notice}
        </div>
      )}
      {err && <ErrorBox message={err} />}

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 1350 }}>
            <thead>
              <tr className="border-b border-slate-200 bg-navy-900 text-white">
                <th className="sticky left-0 z-10 bg-navy-900 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ minWidth: 320 }}>
                  Scheme / Initiative
                </th>
                <th className="th !text-white/70">ADP #</th>
                <th className="th !text-right !text-white/70">Alloc (M)</th>
                <th className="th !text-right !text-white/70">Released (M)</th>
                <th className="th !text-right !text-white/70">Spent (M)</th>
                <th className="th !text-right !text-white/70">Fin %</th>
                <th className="th !text-right !text-white/70">Phys %</th>
                <th className="th !text-white/70">Stage</th>
                <th className="th !text-white/70" style={{ minWidth: 220 }}>
                  Today&apos;s Progress
                </th>
                <th className="th !text-white/70" style={{ minWidth: 180 }}>
                  Bottlenecks
                </th>
                <th className="th !text-center !text-white/70">✓</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const k = key(r);
                const d = drafts[k] ?? emptyDraft();
                const dirty = JSON.stringify(d) !== baseline[k];
                const saved = savedKeys.has(k);
                const isInit = r.entityType === "INITIATIVE";
                return (
                  <tr
                    key={k}
                    className={cn(
                      "border-b border-slate-100",
                      isInit ? "bg-navy-50/60" : idx % 2 ? "bg-slate-50/50" : "bg-white",
                      dirty && "bg-amber-50/60",
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 max-w-[340px] px-3 py-2 text-[13px]",
                        isInit ? "bg-navy-50" : dirty ? "bg-amber-50" : "bg-white",
                      )}
                    >
                      <div className={cn("font-medium leading-snug", isInit ? "text-navy-800" : "text-slate-800")}>
                        {isInit && (
                          <span className="mr-1.5 rounded bg-navy-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            INITIATIVE
                          </span>
                        )}
                        {r.isPRP && (
                          <span className="mr-1.5 rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-bold text-navy-700">
                            PRP
                          </span>
                        )}
                        {r.name}
                      </div>
                      {r.latest && (
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          last: {new Date(r.latest.reportDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · phys{" "}
                          {r.latest.physicalProgressPct ?? "—"}%
                        </div>
                      )}
                    </td>
                    <td className="td whitespace-nowrap text-[12px] text-slate-500">{r.adpCode ?? "—"}</td>
                    <td className="td whitespace-nowrap text-right text-[12px] text-slate-500">
                      {r.adpAllocation != null ? r.adpAllocation.toLocaleString() : "—"}
                    </td>
                    <td className="w-28 border-l border-slate-100 p-0">{numCell(r, "fundsReleased", r.latest?.fundsReleased?.toString())}</td>
                    <td className="w-28 border-l border-slate-100 p-0">{numCell(r, "expenditure", r.latest?.expenditure?.toString())}</td>
                    <td className="w-20 border-l border-slate-100 p-0">{numCell(r, "financialProgressPct", r.latest?.financialProgressPct?.toString())}</td>
                    <td className="w-20 border-l border-slate-100 p-0">{numCell(r, "physicalProgressPct", r.latest?.physicalProgressPct?.toString())}</td>
                    <td className="w-36 border-l border-slate-100 p-0">
                      <select className="cell" value={d.stage} onChange={(e) => set(k, "stage", e.target.value)}>
                        <option value="">{r.latest ? `(${r.latest.stage.replace(/_/g, " ").toLowerCase()})` : "— select —"}</option>
                        {STAGES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-l border-slate-100 p-0">
                      <input
                        className="cell"
                        value={d.narrative}
                        placeholder="what moved today…"
                        onChange={(e) => set(k, "narrative", e.target.value)}
                      />
                    </td>
                    <td className="border-l border-slate-100 p-0">
                      <input
                        className="cell"
                        value={d.bottlenecks}
                        placeholder="issues / blockers"
                        onChange={(e) => set(k, "bottlenecks", e.target.value)}
                      />
                    </td>
                    <td className="w-10 text-center">
                      {saved ? (
                        <span className="text-emerald-600">✓</span>
                      ) : dirty ? (
                        <span className="text-amber-500">●</span>
                      ) : r.today ? (
                        <span className="text-navy-400">✓</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-500">
          <div>
            <span className="mr-4">● unsaved change</span>
            <span className="mr-4 text-emerald-600">✓ saved</span>
            <span>Blank cells keep previous values untouched — enter cumulative figures.</span>
          </div>
          <div>
            {rows.length} row{rows.length === 1 ? "" : "s"} · {dirtyKeys.length} unsaved
          </div>
        </div>
      </div>
    </div>
  );
}
