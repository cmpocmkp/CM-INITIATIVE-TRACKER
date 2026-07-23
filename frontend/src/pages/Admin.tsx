import { useEffect, useState } from "react";
import { api, fmtDate } from "../api";
import { Heading, Spinner, ErrorBox } from "../ui";

interface UserRow {
  id: string;
  username: string;
  name: string;
  role: string;
  lastLoginAt: string | null;
  department: { id: string; name: string; code: string } | null;
}

export default function Admin() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [target, setTarget] = useState<UserRow | null>(null);
  const [pwd, setPwd] = useState("");

  function load() {
    api.get<UserRow[]>("/admin/users").then(setUsers).catch((e) => setErr((e as Error).message));
  }
  useEffect(load, []);

  async function reset() {
    if (!target) return;
    try {
      await api.post(`/admin/users/${target.id}/password`, { password: pwd });
      setMsg(`✓ Password updated for ${target.username}`);
      setTarget(null);
      setPwd("");
    } catch (e) {
      setMsg(`✗ ${(e as Error).message}`);
    }
  }

  if (err) return <ErrorBox message={err} />;
  if (!users) return <Spinner label="Loading users…" />;

  return (
    <div className="space-y-5">
      <Heading
        title="Administration"
        subtitle="User accounts — departments sign in with their code. Default department password is 123456 until changed here."
      />
      {msg && (
        <div className="rounded-lg border border-navy-200 bg-navy-50 px-4 py-2.5 text-[13px] text-navy-800">{msg}</div>
      )}

      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full" style={{ minWidth: 760 }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="th">Username</th>
                <th className="th">Name / Department</th>
                <th className="th">Role</th>
                <th className="th">Last Login</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-navy-50/30">
                  <td className="td font-semibold text-navy-800">{u.username}</td>
                  <td className="td">{u.department ? u.department.name : u.name}</td>
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
                  <td className="td text-[12px] text-slate-500">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "never"}</td>
                  <td className="td text-right">
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
