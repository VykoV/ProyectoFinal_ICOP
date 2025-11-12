import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

export type UiDensity = "COMPACT" | "COZY" | "COMFORTABLE";
export type GlobalUI = {
  primaryHex: string;
  radiusPx: number;
  fontScale: number;
  density: UiDensity;
  darkDefault: boolean;
};
export type UserUI = {
  primaryHex?: string | null;
  radiusPx?: number | null;
  fontScale?: number | null;
  density?: UiDensity | null;
  dark?: boolean | null;
};

type Ctx = {
  global: GlobalUI;
  effective: GlobalUI & { dark: boolean };
  userOverrides: UserUI | null;
  loading: boolean;
  previewUpdate: (patch: Partial<GlobalUI & { dark: boolean }>) => void;
  updateGlobal: (patch: Partial<GlobalUI & { dark: boolean }>) => void;
  saveGlobal: () => Promise<void>;
  saveUser: () => Promise<void>;
};

export const DEFAULT: GlobalUI = {
  primaryHex: "#0ea5e9",
  radiusPx: 12,
  fontScale: 1.0,
  density: "COZY",
  darkDefault: false,
};

const ThemeCtx = createContext<Ctx>({
  global: DEFAULT,
  effective: { ...DEFAULT, dark: false },
  userOverrides: null,
  loading: true,
  previewUpdate: () => {},
  updateGlobal: () => {},
  saveGlobal: async () => {},
  saveUser: async () => {},
});

function applyToHtml(cfg: GlobalUI, user: UserUI | null) {
  const html = document.documentElement;
  const dark = (user?.dark ?? null) ?? cfg.darkDefault;
  html.style.setProperty("--primary", cfg.primaryHex);
  html.style.setProperty("--radius", `${cfg.radiusPx}px`);
  html.style.setProperty("--font-scale", String(cfg.fontScale));
  html.setAttribute("data-density", (user?.density ?? cfg.density).toLowerCase());
  html.classList.toggle("dark", !!dark);
}

function merge(global: GlobalUI, user: UserUI | null): GlobalUI & { dark: boolean } {
  return {
    primaryHex: user?.primaryHex ?? global.primaryHex,
    radiusPx: user?.radiusPx ?? global.radiusPx,
    fontScale: user?.fontScale ?? global.fontScale,
    density: (user?.density ?? global.density) as UiDensity,
    darkDefault: global.darkDefault,
    dark: (user?.dark ?? null) ?? global.darkDefault,
  } as any;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [global, setGlobal] = useState<GlobalUI>(DEFAULT);
  const [userOverrides, setUserOverrides] = useState<UserUI | null>(null);
  const [loading, setLoading] = useState(true);

  const effective = useMemo(() => merge(global, userOverrides), [global, userOverrides]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const g = await api.get("/config/ui");
        const gv: GlobalUI = {
          primaryHex: g.data.primaryHex ?? DEFAULT.primaryHex,
          radiusPx: Number(g.data.radiusPx ?? DEFAULT.radiusPx),
          fontScale: Number(g.data.fontScale ?? DEFAULT.fontScale),
          density: (g.data.density ?? DEFAULT.density) as UiDensity,
          darkDefault: !!g.data.darkDefault,
        };
        setGlobal(gv);

        if (user?.id) {
          try {
            const u = await api.get(`/usuarios/${user.id}/ui`);
            setUserOverrides(u.data ?? null);
          } catch {
            setUserOverrides(null);
          }
        } else {
          setUserOverrides(null);
        }
      } catch (err) {
        // Fallback: intentar cargar de localStorage
        try {
          const gLS = localStorage.getItem("ui.global");
          if (gLS) setGlobal(JSON.parse(gLS));
          const uLS = user?.id ? localStorage.getItem(`ui.user.${user.id}`) : null;
          setUserOverrides(uLS ? JSON.parse(uLS) : null);
        } catch {}
      } finally {
        setLoading(false);
        applyToHtml(global, userOverrides);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    applyToHtml(global, userOverrides);
  }, [global, userOverrides]);

  function previewUpdate(patch: Partial<GlobalUI & { dark: boolean }>) {
    if (patch.dark !== undefined) setUserOverrides(prev => ({ ...(prev ?? {}), dark: patch.dark }));
    if (patch.primaryHex !== undefined) setUserOverrides(prev => ({ ...(prev ?? {}), primaryHex: patch.primaryHex }));
    if (patch.radiusPx !== undefined) setUserOverrides(prev => ({ ...(prev ?? {}), radiusPx: patch.radiusPx }));
    if (patch.fontScale !== undefined) setUserOverrides(prev => ({ ...(prev ?? {}), fontScale: patch.fontScale }));
    if (patch.density !== undefined) setUserOverrides(prev => ({ ...(prev ?? {}), density: patch.density }));
  }

  function updateGlobal(patch: Partial<GlobalUI & { dark: boolean }>) {
    setGlobal(prev => ({
      ...prev,
      primaryHex: patch.primaryHex ?? prev.primaryHex,
      radiusPx: patch.radiusPx ?? prev.radiusPx,
      fontScale: patch.fontScale ?? prev.fontScale,
      density: (patch.density ?? prev.density) as UiDensity,
      darkDefault: patch.dark !== undefined ? !!patch.dark : prev.darkDefault,
    }));
  }

  async function saveGlobal() {
    try {
      await api.put("/config/ui", global);
      localStorage.setItem("ui.global", JSON.stringify(global));
    } catch {
      localStorage.setItem("ui.global", JSON.stringify(global));
    }
  }

  async function saveUser() {
    if (!user?.id) return;
    try {
      await api.put(`/usuarios/${user.id}/ui`, userOverrides ?? {});
      localStorage.setItem(`ui.user.${user.id}`, JSON.stringify(userOverrides ?? {}));
    } catch {
      localStorage.setItem(`ui.user.${user.id}`, JSON.stringify(userOverrides ?? {}));
    }
  }

  return (
    <ThemeCtx.Provider value={{ global, effective, userOverrides, loading, previewUpdate, updateGlobal, saveGlobal, saveUser }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}