import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

type User = { id: number; nombre: string; email: string; roles: string[] } | null;
type Ctx = { user: User; loading: boolean; refresh: (u?: User) => Promise<void>; hasRole: (...r: string[]) => boolean };

const AuthCtx = createContext<Ctx>({ user: null, loading: true, refresh: async () => {}, hasRole: () => false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  async function refresh(u?: User) {
    // Permite actualización inmediata opcional (p. ej., tras login/logout)
    if (u !== undefined) {
      setUser(u);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function hasRole(...roles: string[]) {
    if (!user) return false;
    const set = new Set(user.roles.map((r) => r.toLowerCase().trim()));
    return roles.some((r) => set.has(r.toLowerCase().trim()));
  }

  return (
    <AuthCtx.Provider value={{ user, loading, refresh, hasRole }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}