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
    <div className="flex min-h-screen items-center justify-center bg-navy-900 px-4">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, #ffffff 1px, transparent 1px), radial-gradient(circle at 80% 60%, #ffffff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-7 text-center text-white">
          <div className="mx-auto mb-4 w-fit shadow-lg">
            <Logo size={72} className="rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">CM INITIATIVE TRACKER</h1>
          <p className="mt-1.5 text-[13px] text-white/60">
            Chief Minister&apos;s Priority Initiatives &amp; Sector Tracking · Khyber Pakhtunkhwa
          </p>
        </div>

        <div className="card p-7">
          <h2 className="text-lg font-bold text-navy-900">Sign in</h2>
          <p className="mb-5 mt-1 text-[13px] text-slate-500">
            Departments use their department code as username — e.g. Local Government signs in as{" "}
            <span className="font-semibold text-navy-800">LG</span>.
          </p>
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

        <p className="mt-5 text-center text-[11px] text-white/40">
          Chief Minister&apos;s Policy &amp; Reform Unit (CMPO) · Government of Khyber Pakhtunkhwa
        </p>
      </div>
    </div>
  );
}
