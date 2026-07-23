import { useEffect, useState } from "react";
import { api, Dashboard as Dash } from "../api";
import { Heading, Spinner, ErrorBox } from "../ui";
import { ComplianceBar } from "../charts";

export default function Reports() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [preview, setPreview] = useState("");

  useEffect(() => {
    api.get<Dash>("/dashboard").then(setD).catch((e) => setErr((e as Error).message));
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
        title="Reports & Daily Digest"
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
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-800"
              : "rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-700"
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
