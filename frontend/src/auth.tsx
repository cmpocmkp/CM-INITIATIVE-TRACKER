import { createContext, useContext, useEffect, useState } from "react";
import { api, SessionUser } from "./api";

interface AuthCtx {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, login: async () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: SessionUser }>("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const d = await api.post<{ ok: boolean; user: SessionUser }>("/auth/login", { username, password });
    setUser(d.user);
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
export const isStaff = (u: SessionUser | null) => !!u && (u.role === "SUPERADMIN" || u.role === "ADMIN");
