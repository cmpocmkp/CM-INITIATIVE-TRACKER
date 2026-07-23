import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import Logo from "../Logo";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message || "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="relative w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-2 w-fit">
            <Logo size={160} className="rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">CM INITIATIVE TRACKER</h1>
          <p className="mt-1.5 text-[13px] text-slate-500">
            Chief Minister&apos;s Priority Initiatives &amp; Sector Tracking · Khyber Pakhtunkhwa
          </p>
        </div>

        <div className="card p-7">
          <h2 className="mb-5 text-lg font-bold text-navy-900">Sign in</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="u" className="label">
                Username
              </label>
              <input
                id="u"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. LG, HEALTH, CW, admin"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="p" className="label">
                Password
              </label>
              <input
                id="p"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
                {error}
              </div>
            )}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-400">
          Chief Minister&apos;s Policy Office (CMPO) · Government of Khyber Pakhtunkhwa
        </p>
      </div>
    </div>
  );
}
