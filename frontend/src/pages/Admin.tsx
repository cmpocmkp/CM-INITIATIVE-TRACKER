import { useEffect, useState } from "react";
import { api, fmtDate } from "../api";
import { Heading, Spinner, ErrorBox } from "../ui";

interface UserRow {
  id: string;
  username: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  passwordPlain: string | null;
  lastLoginAt: string | null;
  department: { id: string; name: string; code: string } | null;
}

interface DeptRow {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  _count: { schemes: number; ledInitiatives: number };
}

export default function Admin() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [depts, setDepts] = useState<DeptRow[] | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<UserRow | null>(null);
  const [pwd, setPwd] = useState("");
  const [uEmails, setUEmails] = useState<Record<string, string>>({});
  const [uPhones, setUPhones] = useState<Record<string, string>>({});
  const [showPwd, setShowPwd] = useState(false);

  function load() {
    api
      .get<UserRow[]>("/admin/users")
      .then((u) => {
        setUsers(u);
        setUEmails(Object.fromEntries(u.map((x) => [x.id, x.email ?? ""])));
        setUPhones(Object.fromEntries(u.map((x) => [x.id, x.phone ?? ""])));
      })
      .catch((e) => setErr((e as Error).message));
    api
      .get<DeptRow[]>("/departments")
      .then((d) => {
        setDepts(d);
        setEmails(Object.fromEntries(d.map((x) => [x.id, x.email ?? ""])));
        setPhones(Object.fromEntries(d.map((x) => [x.id, x.phone ?? ""])));
      })
      .catch((e) => setErr((e as Error).message));
  }
  useEffect(load, []);

  async function saveContact(d: DeptRow) {
    setMsg("");
    try {
      await api.post(`/admin/departments/${d.id}/email`, { email: emails[d.id] ?? "", phone: phones[d.id] ?? "" });
      setMsg(`✓ Contact saved for ${d.code}`);
      load();
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    }
  }

  async function sendOnboarding(deptIds?: string[]) {
    setBusy(true);
    setMsg("");
    try {
      const r = await api.post<{ ok: boolean; reason?: string; sent: string[]; noEmail: string[] }>(
        "/digest/onboarding",
        deptIds ? { departmentIds: deptIds } : {},
      );
      setMsg(
        r.ok
          ? `✓ Credentials emailed to: ${r.sent.join(", ") || "none"}${r.noEmail.length ? ` · no email set: ${r.noEmail.join(", ")}` : ""}`
          : `✗ ${r.reason}`,
      );
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!target) return;
    try {
      await api.post(`/admin/users/${target.id}/password`, { password: pwd });
      setMsg(`✓ Password updated for ${target.username}`);
      setTarget(null);
      setPwd("");
      load();
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    }
  }

  async function saveUserContact(u: UserRow) {
    setMsg("");
    try {
      await api.post(`/admin/users/${u.id}/contact`, { email: uEmails[u.id] ?? "", phone: uPhones[u.id] ?? "" });
      setMsg(`✓ Contact saved for ${u.username}`);
      load();
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    }
  }

  if (err) return <ErrorBox message={err} />;
  if (!users || !depts) return <Spinner label="Loading administration…" />;

  return (
    <div className="space-y-6">
      <Heading
        title="Administration"
        subtitle="Department focal emails, onboarding (credentials) emails, and account passwords."
        action={
          <button className="btn-primary" onClick={() => sendOnboarding()} disabled={busy}>
            {busy ? "Sending…" : "✉ Send credentials to all (with email)"}
          </button>
        }
      />
      {msg && <div className="rounded-lg border border-navy-200 bg-navy-50 px-4 py-2.5 text-[13px] text-navy-800">{msg}</div>}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-900">Departments — focal person contacts</h2>
          <p className="mt-0.5 text-[12px] text-slate-500">
            First message = username + password + instructions (email and WhatsApp when configured). Afterwards, departments with a pending sheet get an automatic reminder each morning (9:00 AM PKT).
          </p>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full" style={{ minWidth: 760 }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="th">Code</th>
                <th className="th">Department</th>
                <th className="th">Schemes</th>
                <th className="th" style={{ minWidth: 220 }}>Focal Email</th>
                <th className="th" style={{ minWidth: 160 }}>WhatsApp #</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-navy-50/30">
                  <td className="td font-bold text-navy-800">{d.code}</td>
                  <td className="td max-w-[280px] truncate" title={d.name}>{d.name}</td>
                  <td className="td">{d._count.schemes}</td>
                  <td className="td">
                    <input
                      className="input py-1.5 text-[13px]"
                      type="email"
                      placeholder="focal.person@dept.gov.pk"
                      value={emails[d.id] ?? ""}
                      onChange={(e) => setEmails((p) => ({ ...p, [d.id]: e.target.value }))}
                    />
                  </td>
                  <td className="td">
                    <input
                      className="input py-1.5 text-[13px]"
                      type="tel"
                      placeholder="923001234567"
                      value={phones[d.id] ?? ""}
                      onChange={(e) => setPhones((p) => ({ ...p, [d.id]: e.target.value.replace(/[^\d+]/g, "") }))}
                    />
                  </td>
                  <td className="td whitespace-nowrap text-right">
                    <button className="btn-ghost mr-2 px-3 py-1 text-xs" onClick={() => saveContact(d)}>
                      Save
                    </button>
                    <button
                      className="btn-ghost px-3 py-1 text-xs"
                      disabled={(!(emails[d.id] ?? "").trim() && !(phones[d.id] ?? "").trim()) || busy}
                      onClick={() => sendOnboarding([d.id])}
                      title="Send username + password to this department (email + WhatsApp)"
                    >
                      ✉ Credentials
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy-900">User accounts</h2>
            <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setShowPwd((v) => !v)}>
              {showPwd ? "🙈 Hide passwords" : "👁 Show passwords"}
            </button>
          </div>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1180 }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="th">Username</th>
                <th className="th">Name / Department</th>
                <th className="th">Role</th>
                <th className="th">Password</th>
                <th className="th" style={{ minWidth: 210 }}>Email</th>
                <th className="th" style={{ minWidth: 150 }}>Phone</th>
                <th className="th">Last Login</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-navy-50/30">
                  <td className="td font-semibold text-navy-800">{u.username}</td>
                  <td className="td max-w-[220px] truncate" title={u.department ? u.department.name : u.name}>
                    {u.department ? u.department.name : u.name}
                  </td>
                  <td className="td">
                    <span
                      className={
                        u.role === "SUPERADMIN"
                          ? "badge border-navy-800 bg-navy-800 text-white"
                          : u.role === "ADMIN"
                            ? "badge border-navy-300 bg-navy-100 text-navy-800"
                            : "badge border-slate-200 bg-slate-50 text-slate-600"
                      }
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="td whitespace-nowrap font-mono text-[12px] text-slate-700">
                    {u.passwordPlain ? (showPwd ? u.passwordPlain : "•".repeat(Math.min(10, u.passwordPlain.length))) : "—"}
                  </td>
                  <td className="td">
                    <input
                      className="input py-1.5 text-[12px]"
                      type="email"
                      placeholder="user@email.com"
                      value={uEmails[u.id] ?? ""}
                      onChange={(e) => setUEmails((p) => ({ ...p, [u.id]: e.target.value }))}
                    />
                  </td>
                  <td className="td">
                    <input
                      className="input py-1.5 text-[12px]"
                      type="tel"
                      placeholder="9230…"
                      value={uPhones[u.id] ?? ""}
                      onChange={(e) => setUPhones((p) => ({ ...p, [u.id]: e.target.value.replace(/[^\d+]/g, "") }))}
                    />
                  </td>
                  <td className="td whitespace-nowrap text-[12px] text-slate-500">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "never"}</td>
                  <td className="td whitespace-nowrap text-right">
                    <button className="btn-ghost mr-2 px-3 py-1 text-xs" onClick={() => saveUserContact(u)}>
                      Save
                    </button>
                    <button className="btn-ghost px-3 py-1 text-xs" onClick={() => { setTarget(u); setPwd(""); setMsg(""); }}>
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
          <div className="card w-full max-w-sm p-6">
            <h3 className="text-[15px] font-bold text-navy-900">
              Reset password — <span className="text-navy-600">{target.username}</span>
            </h3>
            <input
              type="text"
              className="input mt-4"
              placeholder="New password (min 6 chars)"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setTarget(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={reset} disabled={pwd.length < 6}>
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
