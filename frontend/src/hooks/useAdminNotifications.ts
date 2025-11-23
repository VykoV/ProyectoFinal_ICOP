import { useEffect, useRef } from "react";
import { publish } from "../store/notifications";
import { api } from "../lib/api";

function scheduleAt(hour: number, minute: number, fn: () => void) {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  const delay = Math.max(0, target.getTime() - now.getTime());
  const t = window.setTimeout(async () => {
    try { await fn(); } finally { scheduleAt(hour, minute, fn); }
  }, delay);
  return t;
}

export function useAdminNotifications(enabled: boolean) {
  const timers = useRef<number[]>([]);
  useEffect(() => {
    if (!enabled) return;

    async function stockMinimo() {
      try {
        const { data } = await api.get("/products/stock-minimo");
        const list = Array.isArray(data) ? data : [];
        for (const it of list) {
          publish({
            code: "STOCK_MINIMO",
            type: "warning",
            title: "Stock mínimo",
            message: `${it.nombreProducto} — disp: ${it.disponible}, mínimo: ${it.minimo}`,
          });
        }
      } catch {}
    }

    async function presupuestosVencidos() {
      try {
        const { data } = await api.get("/preventas/vencidas");
        const rows = Array.isArray(data) ? data : [];
        if (rows.length > 0) {
          const resumen = rows.slice(0, 5).map((r: any) => `#${r.idVenta} ${r.cliente} ${String(r.fecha || "").slice(0,10)} $${Number(r.total || 0).toFixed(2)}`).join("; ");
          publish({
            code: "PRESUPUESTO_VENCIDO",
            type: "warning",
            title: "Presupuestos vencidos",
            message: `Cantidad: ${rows.length}. ${resumen}`,
          });
        }
      } catch {}
    }

    async function reservasHoy() {
      try {
        const { data } = await api.get("/preventas/reservas-hoy");
        const rows = Array.isArray(data) ? data : [];
        if (rows.length > 0) {
          publish({
            code: "RESERVA_RETIRO_HOY",
            type: "info",
            title: "Reservas hoy",
            message: `Cantidad: ${rows.length}`,
          });
        }
      } catch {}
    }

    async function reservasVencidas() {
      try {
        const { data } = await api.get("/preventas/reservas-vencidas");
        const rows = Array.isArray(data) ? data : [];
        if (rows.length > 0) {
          publish({
            code: "RESERVA_VENCIDA",
            type: "warning",
            title: "Reservas vencidas",
            message: `Cantidad: ${rows.length}`,
          });
        }
      } catch {}
    }

    async function ventasPendientesCobro() {
      try {
        const { data } = await api.get("/ventas/pendientes-cobro");
        const rows = Array.isArray(data) ? data : [];
        if (rows.length > 0) {
          publish({
            code: "VENTA_PENDIENTE_COBRO",
            type: "warning",
            title: "Ventas pendientes de cobro",
            message: `Cantidad: ${rows.length}`,
          });
        }
      } catch {}
    }


    stockMinimo();
    presupuestosVencidos();
    reservasHoy();
    reservasVencidas();
    ventasPendientesCobro();

    timers.current.push(scheduleAt(8, 0, presupuestosVencidos));
    timers.current.push(scheduleAt(9, 0, reservasHoy));
    timers.current.push(scheduleAt(11, 0, () => {}));

    const hourly = window.setInterval(ventasPendientesCobro, 60 * 60 * 1000);
    const tenMin = window.setInterval(stockMinimo, 10 * 60 * 1000);
    timers.current.push(hourly);
    timers.current.push(tenMin);

    return () => {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    };
  }, [enabled]);
}