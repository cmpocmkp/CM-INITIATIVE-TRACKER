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
interface Analysis {
  windowDays: number;
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
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [preview, setPreview] = useState("");

  useEffect(() => {
    api.get<Dash>("/dashboard").then(setD).catch((e) => setErr((e as Error).message));
    api.get<Analysis>("/reports/analysis").then(setAn).catch(() => {});
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
        subtitle="The digest email goes out automatically every day at 6:00 PM (PKT) — you can also send or preview it now."
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={loadPreview}>
              👁 Preview
            </button>
            <button className="btn-ghost" onClick={remindNow} disabled={sending} title="Email departments that haven't filled today's sheet">
              🔔 Remind Pending Depts
            </button>
            <button className="btn-primary" onClick={sendNow} disabled={sending}>
              {sending ? "Sending…" : "✉ Send Digest Now"}
            </button>
          </div>
        }
      />

      {result && (
        <div
          className={
            result.startsWith("✓")
              ? "rounded-lg border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-[13px] text-neutral-800"
              : "rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-[13px] text-neutral-900"
          }
        >
          {result}
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-navy-900">
          Today&apos;s Reporting Compliance ({d.today})
        </h2>
        <div className="space-y-3">
          {d.compliance
            .filter((c) => c.schemes > 0)
            .sort((a, b) => b.schemes - a.schemes)
            .map((c) => (
              <div key={c.id} className="flex items-center gap-4">
                <div className="w-56 truncate text-[13px]" title={c.name}>
                  <span className="mr-2 inline-block w-16 font-bold text-navy-800">{c.code}</span>
                  <span className="text-slate-500">{c.name.length > 26 ? c.name.slice(0, 26) + "…" : c.name}</span>
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
            <h2 className="text-sm uppercase tracking-widest text-neutral-900">
              Departmental Performance — last {an.windowDays} days
            </h2>
            <span className="text-[11px] text-neutral-400">
              {an.since} → {an.today}
            </span>
          </div>

          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">● Best reporting</div>
              {an.fastest.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-neutral-100 py-1.5 text-[13px] last:border-0">
                  <span className="text-neutral-800">{r.code}</span>
                  <span className="text-neutral-500">
                    {r.compliancePct != null ? `${Math.round(r.compliancePct)}%` : "—"} · avg {fmtHour(r.avgSubmitHourPkt)}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-neutral-200 p-3">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">○ Weakest / slowest</div>
              {an.slowest.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-neutral-100 py-1.5 text-[13px] last:border-0">
                  <span className="text-neutral-800">{r.code}</span>
                  <span className="text-neutral-500">
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
                <tr className="border-b border-neutral-200">
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
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="td text-[12px] text-neutral-400">{idx + 1}</td>
                    <td className="td">
                      <span className="text-neutral-900">{r.code}</span>
                      <span className="ml-2 hidden text-[11px] text-neutral-400 lg:inline">{r.name.slice(0, 34)}</span>
                    </td>
                    <td className="td text-right tabular-nums">{r.units}</td>
                    <td className="td text-right tabular-nums">{r.entries}</td>
                    <td className="td text-right tabular-nums text-neutral-500">
                      {r.reported}/{r.expected}
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <span className="h-[3px] w-24 overflow-hidden rounded-full bg-neutral-100">
                          <span className="block h-full bg-neutral-800" style={{ width: `${Math.min(100, r.compliancePct ?? 0)}%` }} />
                        </span>
                        <span className="text-[12px] tabular-nums text-neutral-700">
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
          <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
            Units = schemes owned + scheme-less initiatives led. Compliance = daily unit-reports filed ÷ expected
            (units × {an.windowDays} days). Avg Entry Time = when the department actually submits (PKT). Filing Lag =
            how many days after the reporting day entries are filed. Days Silent = days since the last entry.
          </p>
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-navy-900">Exports</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/api/export/schemes.csv" download className="btn-ghost">
            ⬇ All schemes with latest progress (CSV)
          </a>
        </div>
      </div>

      {preview && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-semibold text-slate-500">
            EMAIL PREVIEW — exactly what recipients get
          </div>
          <iframe title="digest preview" srcDoc={preview} className="h-[720px] w-full bg-white" />
        </div>
      )}
    </div>
  );
}
