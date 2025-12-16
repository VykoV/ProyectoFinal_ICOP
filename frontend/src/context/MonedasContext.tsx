import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { listMonedas } from "../lib/api/monedas";
import { fmtPrice } from "../lib/format";

type Moneda = { id: number; nombre: string; precio: number };
type Ctx = {
  monedas: Moneda[];
  convertirVisual: (precioEnARS: number, monedaSeleccionada: string) => number;
  fmtVisual: (
    precioEnARS: number,
    monedaSeleccionada: string,
    opts?: { minFraction?: number; maxFraction?: number }
  ) => string;
  refreshMonedas: () => Promise<void>;
};

const MonedasCtx = createContext<Ctx>({
  monedas: [],
  convertirVisual: (n) => n,
  fmtVisual: (n) => fmtPrice(n),
  refreshMonedas: async () => {},
});

export function MonedasProvider({ children }: { children: React.ReactNode }) {
  const [monedas, setMonedas] = useState<Moneda[]>([]);

  const refreshMonedas = async () => {
    const rows = await listMonedas();
    setMonedas(
      rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        precio: Number(r.precio || 0),
      }))
    );
  };

  useEffect(() => {
    refreshMonedas();
  }, []);

  const nombreEsARS = (nombre: string) => {
    const s = String(nombre || "").toUpperCase();
    return s.includes("ARS") || s.includes("PESO");
  };

  const getTC = (nombre: string) => {
    const m = monedas.find(
      (x) => String(x.nombre).toUpperCase() === String(nombre).toUpperCase()
    );
    return Number(m?.precio || 0);
  };

  const convertirVisual = (precioEnARS: number, monedaSeleccionada: string) => {
    if (nombreEsARS(monedaSeleccionada)) return Number(precioEnARS || 0);
    const tc = getTC(monedaSeleccionada);
    if (!tc || tc <= 0) return Number(precioEnARS || 0);
    return Number(precioEnARS || 0) / tc;
  };

  const fmtVisual: Ctx["fmtVisual"] = (
    precioEnARS,
    monedaSeleccionada,
    opts
  ) => {
    const val = convertirVisual(precioEnARS, monedaSeleccionada);
    return fmtPrice(val, opts);
  };

  const value = useMemo<Ctx>(
    () => ({ monedas, convertirVisual, fmtVisual, refreshMonedas }),
    [monedas]
  );

  return <MonedasCtx.Provider value={value}>{children}</MonedasCtx.Provider>;
}

export function useMonedas() {
  return useContext(MonedasCtx);
}
