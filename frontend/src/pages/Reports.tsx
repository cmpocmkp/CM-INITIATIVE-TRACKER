import { useEffect, useState } from "react";
import { api, Dashboard as Dash } from "../api";
import { Heading, Spinner, ErrorBox } from "../ui";
import { ComplianceBar } from "../charts";

interface AnalysisRow {
  id: string;
  code: string;
  name: string;
  units: number;
  entries: number;
  expected: number;
  reported: number;
  compliancePct: number | null;
  avgSubmitHourPkt: number | null;
  avgFilingLagDays: number | null;
  lastReportDate: string | null;
  daysSilent: number | null;
}
interface Recon {
  lastSync: string | null;
  totals: { official: number; coded: number; matchedInPcfms: number; noCode: number };
  sectors: { sector: string; ours: number; inPcfms: number; ourAlloc: number; pcfmsBudget: number }[];
  missingInPcfms: { adpCode: string | null; name: string; sector: string; dept?: string }[];
  moneyMismatches: { adpCode: string | null; name: string; ourAlloc: number | null; pcfmsBudget: number | null; diff: number }[];
}

interface Analysis {
  windowDays: number;
  windowWeeks?: number;
  since: string;
  today: string;
  rows: AnalysisRow[];
  fastest: AnalysisRow[];
  slowest: AnalysisRow[];
}

function fmtHour(h: number | null): string {
  if (h == null) return "—";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

export default function Reports() {
  const [d, setD] = useState<Dash | null>(null);
  const [an, setAn] = useState<Analysis | null>(null);
  const [recon, setRecon] = useState<Recon | null>(null);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [preview, setPreview] = useState("");

  useEffect(() => {
    api.get<Dash>("/dashboard").then(setD).catch((e) => setErr((e as Error).message));
    api.get<Analysis>("/reports/analysis").then(setAn).catch(() => {});
    api.get<Recon>("/reports/reconciliation").then(setRecon).catch(() => {});
  }, []);

  async function sendNow() {
    setSending(true);
    setResult("");
    try {
      const r = await api.post<{ ok: boolean; reason?: string; recipients?: string[] }>("/digest/send");
      setResult(r.ok ? `✓ Digest emailed to: ${r.recipients?.join(", ")}` : `✗ ${r.reason}`);
    } catch (e) {
      setResult(`✗ ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  async function remindNow() {
    setSending(true);
    setResult("");
    try {
      const r = await api.post<{ ok: boolean; reason?: string; sent: string[] }>("/digest/remind");
      setResult(
        r.ok
          ? r.sent.length
            ? `✓ Reminder sent to: ${r.sent.join(", ")}`
            : "✓ No pending departments with an email set — nothing to remind."
          : `✗ ${r.reason}`,
      );
    } catch (e) {
      setResult(`✗ ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  async function loadPreview() {
    const html = await api.get<string>("/digest/preview");
    setPreview(typeof html === "string" ? html : String(html));
  }

  if (err) return <ErrorBox message={err} />;
  if (!d) return <Spinner label="Loading reports…" />;

  return (
    <div className="space-y-6">
      <Heading
        title="Reports"
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={loadPreview}>
              Preview
            </button>
            <button
              className="btn-ghost"
              onClick={async () => {
                setResult("");
                try {
                  await api.post("/pcfms/sync");
                  setResult("✓ P&D (PCFMS) sync started — government figures refresh in about a minute.");
                } catch (e) {
                  setResult(`✗ ${(e as Error).message}`);
                }
              }}
              title="Pull Category, budget, releases and expenditure from the P&D PCFMS portal"
            >
              Sync P&D Data
            </button>
            <button className="btn-ghost" onClick={remindNow} disabled={sending} title="Email departments that haven't filled this week's sheet">
              Remind Pending Depts
            </button>
            <button className="btn-primary" onClick={sendNow} disabled={sending}>
              {sending ? "Sending…" : "Send Digest Now"}
            </button>
          </div>
        }
      />

      {result && (
        <div
          className={
            result.startsWith("✓")
              ? "rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2.5 text-[13px] text-white/85"
              : "rounded-lg border border-white/15 bg-white/10 px-4 py-2.5 text-[13px] text-white/95"
          }
        >
          {result}
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-navy-900">
          This Week&apos;s Reporting Compliance (week of {d.today})
        </h2>
        <div className="space-y-3">
          {d.compliance
            .filter((c) => c.schemes > 0)
            .sort((a, b) => b.schemes - a.schemes)
            .map((c) => (
              <div key={c.id} className="flex items-center gap-4">
                <div className="w-56 truncate text-[13px]" title={c.name}>
                  <span className="mr-2 inline-block w-16 font-bold text-navy-800">{c.code}</span>
                  <span className="text-white/50">{c.name.length > 26 ? c.name.slice(0, 26) + "…" : c.name}</span>
                </div>
                <div className="flex-1">
                  <ComplianceBar done={c.updatedToday} total={c.schemes} />
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Departmental performance analysis */}
      {an && an.rows.length > 0 && (
        <div className="card p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm uppercase tracking-widest text-white/95">
              Departmental Performance — last {an.windowWeeks ?? an.windowDays} weeks
            </h2>
            <span className="text-[11px] text-white/40">
              {an.since} → {an.today}
            </span>
          </div>

          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 p-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-white/50">● Best reporting</div>
              {an.fastest.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-white/[0.07] py-1.5 text-[13px] last:border-0">
                  <span className="text-white/85">{r.code}</span>
                  <span className="text-white/50">
                    {r.compliancePct != null ? `${Math.round(r.compliancePct)}%` : "—"} · avg {fmtHour(r.avgSubmitHourPkt)}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-white/10 p-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-white/50">○ Weakest / slowest</div>
              {an.slowest.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-white/[0.07] py-1.5 text-[13px] last:border-0">
                  <span className="text-white/85">{r.code}</span>
                  <span className="text-white/50">
                    {r.compliancePct != null ? `${Math.round(r.compliancePct)}%` : "—"} ·{" "}
                    {r.daysSilent == null ? `silent ${an.windowDays}+ d` : r.daysSilent > 0 ? `silent ${r.daysSilent} d` : "reported today"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="scroll-thin overflow-x-auto">
            <table className="w-full" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="th">#</th>
                  <th className="th">Department</th>
                  <th className="th !text-right">Units</th>
                  <th className="th !text-right">Entries</th>
                  <th className="th !text-right">Reported / Expected</th>
                  <th className="th" style={{ minWidth: 160 }}>Compliance</th>
                  <th className="th !text-right">Avg Entry Time (PKT)</th>
                  <th className="th !text-right">Avg Filing Lag</th>
                  <th className="th !text-right">Days Silent</th>
                </tr>
              </thead>
              <tbody>
                {an.rows.map((r, idx) => (
                  <tr key={r.id} className="border-b border-white/[0.07] hover:bg-white/[0.06]">
                    <td className="td text-[12px] text-white/40">{idx + 1}</td>
                    <td className="td">
                      <span className="text-white/95">{r.code}</span>
                      <span className="ml-2 hidden text-[11px] text-white/40 lg:inline">{r.name.slice(0, 34)}</span>
                    </td>
                    <td className="td text-right tabular-nums">{r.units}</td>
                    <td className="td text-right tabular-nums">{r.entries}</td>
                    <td className="td text-right tabular-nums text-white/50">
                      {r.reported}/{r.expected}
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <span className="h-[3px] w-24 overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full bg-white/85" style={{ width: `${Math.min(100, r.compliancePct ?? 0)}%` }} />
                        </span>
                        <span className="text-[12px] tabular-nums text-white/75">
                          {r.compliancePct != null ? `${Math.round(r.compliancePct)}%` : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="td text-right text-[12px] tabular-nums">{fmtHour(r.avgSubmitHourPkt)}</td>
                    <td className="td text-right text-[12px] tabular-nums">
                      {r.avgFilingLagDays != null ? `${r.avgFilingLagDays.toFixed(1)} d` : "—"}
                    </td>
                    <td className="td text-right text-[12px] tabular-nums">
                      {r.daysSilent == null ? `${an.windowDays}+` : r.daysSilent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            Units = schemes owned + scheme-less initiatives led. Compliance = weekly unit-reports filed ÷ expected
            (units × {an.windowWeeks ?? 8} Mondays). Avg Entry Time = when the department actually submits (PKT). Filing Lag =
            how many days after the reporting Monday entries are filed. Days Silent = days since the last entry.
          </p>
        </div>
      )}

      {recon && (
        <div className="card p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm uppercase tracking-widest text-white/95">Data Consistency — System vs P&amp;D</h2>
            <span className="text-[11px] text-white/40">
              {recon.lastSync ? `P&D synced ${new Date(recon.lastSync).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : "not yet synced"}
            </span>
          </div>
          <p className="mb-4 text-[12px] text-white/50">
            {recon.totals.official} official schemes · {recon.totals.coded} carry ADP codes · {recon.totals.matchedInPcfms} matched in the live P&amp;D system ·{" "}
            {recon.totals.noCode} non-ADP items (KPCIP / policy) have no code to match.
          </p>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full" style={{ minWidth: 640 }}>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="th">Sector</th>
                  <th className="th !text-right">On System</th>
                  <th className="th !text-right">In P&amp;D</th>
                  <th className="th !text-right">Gap</th>
                  <th className="th !text-right">Our Alloc (M)</th>
                  <th className="th !text-right">P&amp;D Budget (M)</th>
                </tr>
              </thead>
              <tbody>
                {recon.sectors.map((s) => {
                  const gap = s.ours - s.inPcfms;
                  return (
                    <tr key={s.sector} className="border-b border-white/[0.07] hover:bg-white/[0.04]">
                      <td className="td text-[13px]">{s.sector}</td>
                      <td className="td text-right tabular-nums">{s.ours}</td>
                      <td className="td text-right tabular-nums">{s.inPcfms}</td>
                      <td className="td text-right tabular-nums">
                        {gap === 0 ? <span className="text-white/30">0</span> : <span className="text-white">{gap}</span>}
                      </td>
                      <td className="td text-right tabular-nums">{s.ourAlloc.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                      <td className="td text-right tabular-nums">{s.pcfmsBudget.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {recon.missingInPcfms.length > 0 && (
            <div className="mt-3 text-[12px] text-white/60">
              <span className="text-white/85">Coded but not in live P&amp;D data:</span>{" "}
              {recon.missingInPcfms.map((m) => `${m.adpCode} ${m.name}`).join(" · ")}
            </div>
          )}
          {recon.moneyMismatches.length > 0 ? (
            <div className="mt-2 text-[12px] text-white/60">
              <span className="text-white/85">Money mismatches vs P&amp;D:</span>{" "}
              {recon.moneyMismatches.slice(0, 6).map((m) => `${m.adpCode ?? "—"} (ours ${m.ourAlloc ?? "—"} vs P&D ${m.pcfmsBudget ?? "—"})`).join(" · ")}
            </div>
          ) : (
            <div className="mt-2 text-[12px] text-white/40">Allocations match P&amp;D budgets on every matched scheme.</div>
          )}
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy-900">Exports</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/api/export/schemes.csv" download className="btn-ghost">
            All schemes with latest progress (CSV)
          </a>
          <a href="/api/reports/schemes.pdf" download className="btn-ghost">
            Official schemes — one-page card sheet (PDF)
          </a>
        </div>
      </div>

      {preview && (
        <div className="card overflow-hidden">
          <div className="border-b border-white/10 bg-white/[0.04] px-5 py-2.5 text-xs font-semibold text-white/50">
            EMAIL PREVIEW — exactly what recipients get
          </div>
          <iframe title="digest preview" srcDoc={preview} className="h-[720px] w-full bg-white" />
        </div>
      )}
    </div>
  );
}
