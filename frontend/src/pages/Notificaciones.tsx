import { useEffect, useMemo, useState } from "react";
import { useNotifications, type NotificationItem } from "../store/notifications";
import { Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

type TabKey = "todas" | "no-leidas" | "stock" | "pagos" | "sistema";

function iconFor(type: string) {
  switch (type) {
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "success":
      return <CheckCircle className="h-4 w-4 text-emerald-600" />;
    default:
      return <Info className="h-4 w-4 text-blue-600" />;
  }
}

function severityChip(type: NotificationItem["type"]) {
  const map: Record<NotificationItem["type"], { label: string; cls: string }> = {
    error: { label: "Alta", cls: "bg-red-50 text-red-700" },
    warning: { label: "Media", cls: "bg-amber-50 text-amber-700" },
    info: { label: "Baja", cls: "bg-gray-100 text-gray-700" },
    success: { label: "Baja", cls: "bg-emerald-50 text-emerald-700" },
  };
  const s = map[type] ?? map.info;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${s.cls}`}>{s.label}</span>;
}

function relTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return day === 1 ? "1 día atrás" : `${day} días atrás`;
  if (hr > 0) return hr === 1 ? "1 hora atrás" : `${hr} horas atrás`;
  return min <= 1 ? "Hace un minuto" : `${min} minutos atrás`;
}

export default function Notificaciones() {
  const { list, unreadCount, markAllRead, markRead, sync } = useNotifications();
  const [tab, setTab] = useState<TabKey>("no-leidas");
  useEffect(() => { sync(); }, []);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const byTab: Record<TabKey, (n: NotificationItem) => boolean> = {
      "todas": () => true,
      "no-leidas": (n) => !n.read,
      "stock": (n) => (n.code ?? "").includes("STOCK") || /stock/i.test(n.title ?? "") || /stock/i.test(n.message ?? ""),
      "pagos": (n) => (n.code ?? "").includes("VENTA") || /pago|cobro/i.test(n.title ?? "") || /pago|cobro/i.test(n.message ?? ""),
      "sistema": (n) => (n.code ?? "").includes("CIERRE") || (n.code ?? "").includes("PRESUPUESTO") || (n.code ?? "").includes("RESERVA"),
    };
    return list.filter(byTab[tab]);
  }, [list, tab]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => (Number(a.read) - Number(b.read)) || (b.createdAt - a.createdAt));
  }, [filtered]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageItems = sorted.slice(start, start + pageSize);

  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), totalPages)); }, [totalPages]);

  function dateKey(ts: number) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function dateLabel(key: string) {
    const today = dateKey(Date.now());
    const yest = dateKey(Date.now() - 24 * 60 * 60 * 1000);
    if (key === today) return "Hoy";
    if (key === yest) return "Ayer";
    const [y, m, d] = key.split("-");
    return `${d}/${m}/${y}`;
  }

  const groups = useMemo(() => {
    if (tab !== "todas") return [] as { key: string; label: string; items: NotificationItem[] }[];
    const map = new Map<string, NotificationItem[]>();
    for (const n of pageItems) {
      const k = dateKey(n.createdAt);
      const arr = map.get(k) || [];
      arr.push(n);
      map.set(k, arr);
    }
    const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return keys.map((k) => ({ key: k, label: dateLabel(k), items: map.get(k)! }));
  }, [sorted, tab]);

  const countByTab: Record<TabKey, number> = useMemo(() => ({
    "todas": list.length,
    "no-leidas": list.filter((n) => !n.read).length,
    "stock": list.filter((n) => (n.code ?? "").includes("STOCK") || /stock/i.test(n.title ?? "") || /stock/i.test(n.message ?? "")).length,
    "pagos": list.filter((n) => (n.code ?? "").includes("VENTA") || /pago|cobro/i.test(n.title ?? "") || /pago|cobro/i.test(n.message ?? "")).length,
    "sistema": list.filter((n) => (n.code ?? "").includes("CIERRE") || (n.code ?? "").includes("PRESUPUESTO") || (n.code ?? "").includes("RESERVA")).length,
  }), [list]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notificaciones</h1>
        <button
          className="rounded border px-3 py-2 text-sm disabled:opacity-50"
          onClick={markAllRead}
          disabled={unreadCount === 0}
        >
          Marcar todas como leídas
        </button>
      </div>
      <p className="text-sm text-gray-500">
        {unreadCount === 0 ? "No tienes notificaciones sin leer" : `Tienes ${unreadCount} notificación${unreadCount > 1 ? "es" : ""} sin leer`}
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-2 text-sm">
        {([
          { key: "todas" as const, label: "Todas" },
          { key: "no-leidas" as const, label: "No leídas" },
          { key: "stock" as const, label: "Stock" },
          { key: "pagos" as const, label: "Pagos" },
          { key: "sistema" as const, label: "Sistema" },
        ]).map(({ key, label }) => (
          <button
            key={key}
            className={`rounded-full border px-3 py-1 ${tab === key ? "bg-gray-100" : "bg-white"}`}
            onClick={() => setTab(key)}
          >
            {label} ({countByTab[key]})
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">No hay notificaciones para este filtro</div>
      ) : (
        tab === "todas" ? (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.key} className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-700">{g.label}</h2>
                <ul className="space-y-3">
                  {g.items.map((n) => (
                    <li
                      key={n.id}
                      className={`rounded-2xl border bg-white p-4 ${!n.read ? "border-amber-300" : ""}`}
                      onClick={() => { if (!n.read) markRead(n.id); }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          {iconFor(n.type)}
                          <div>
                            {n.title ? <p className="text-sm font-medium">{n.title}</p> : null}
                            <p className="text-sm text-gray-700">{n.message}</p>
                            <p className="text-xs text-gray-500 mt-1">{relTime(n.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {severityChip(n.type)}
                          {n.read && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {pageItems.map((n) => (
              <li
                key={n.id}
                className={`rounded-2xl border bg-white p-4 ${!n.read ? "border-amber-300" : ""}`}
                onClick={() => { if (!n.read) markRead(n.id); }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    {iconFor(n.type)}
                    <div>
                      {n.title ? <p className="text-sm font-medium">{n.title}</p> : null}
                      <p className="text-sm text-gray-700">{n.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{relTime(n.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {severityChip(n.type)}
                    {n.read && <CheckCircle className="h-4 w-4 text-emerald-600" />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {sorted.length > 0 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-gray-500">Mostrando {start + 1}-{Math.min(start + pageSize, total)} de {total}</p>
          <div className="flex items-center gap-2">
            <button
              className="rounded border px-2 py-1 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span className="text-sm">{page} / {totalPages}</span>
            <button
              className="rounded border px-2 py-1 text-sm disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </section>
  );
}