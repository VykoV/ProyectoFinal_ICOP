import { useEffect, useState } from "react";
import { Eye, Search, Plus, Trash2, X, Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Label, Input, Select } from "../components/ui/Form";
import { api } from "../lib/api";
import { fmtPrice } from "../lib/format";
import Modal from "../components/Modal";
import { getProductStock } from "../lib/api/products";
import { askText } from "../lib/alerts";

/* ===== Tipos ===== */
type PreRow = {
  id: number;
  cliente: string;
  fecha: string;
  metodoPago?: string | null;
  total: number;
  estado: string; // "Pendiente" | "ListoCaja" | etc
};

type Opt = { id: number; label: string };
type ProdOpt = Opt & { precio: number };
type Item = {
  idProducto: number;
  nombre: string;
  cantidad: number;
  precio: number;
  descuento: number;
};

/* ===== Página listado ===== */
export default function PreVentas() {
  const [rows, setRows] = useState<PreRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [selectedEstados, setSelectedEstados] = useState<string[]>([]);
  const [preDesde, setPreDesde] = useState<string>("");
  const [preHasta, setPreHasta] = useState<string>("");
  const [preSort, setPreSort] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;
  const [openForm, setOpenForm] = useState<null | number>(null);
  const [openView, setOpenView] = useState<null | number>(null);
  const [openFiltros, setOpenFiltros] = useState(false);
  const [soloVencidas, setSoloVencidas] = useState(false);

  function normEstado(raw: string): "pendiente" | "listocaja" | "finalizada" | "cancelada" | "otro" {
    const n = String(raw || "").toLowerCase().replace(/[\s_]+/g, "");
    if (n.includes("pend")) return "pendiente";
    if (n.includes("listocaja")) return "listocaja";
    if (n.includes("finaliz") || n.includes("cerrad")) return "finalizada";
    if (n.includes("cancel")) return "cancelada";
    return "otro";
  }

  // Coincidencia simple en múltiples campos; si q vacío retorna true
  function matchesQuery(qv: string, ...fields: Array<string | null | undefined>): boolean {
    const qn = (qv || "").trim().toLowerCase();
    if (!qn) return true;
    return fields.some((f) => String(f || "").toLowerCase().includes(qn));
  }

  function readParams() {
    const sp = new URLSearchParams(window.location.search);
    const q0 = sp.get("q") || "";
    const est = sp.get("preEstados");
    const pageStr = sp.get("prePage");
    const dsd = sp.get("preDesde") || "";
    const hst = sp.get("preHasta") || "";
    const srt = sp.get("preSort") || "";
    setQ(q0);
    if (est) setSelectedEstados(est.split(",").filter(Boolean));
    else setSelectedEstados(["pendiente", "listocaja"]);
    setPreDesde(dsd);
    setPreHasta(hst);
    setPreSort(srt === "asc" || srt === "desc" ? (srt as any) : "desc");
    setPage(Math.max(1, Number(pageStr) || 1));
  }

  function writeParams(next?: Partial<{ q: string; preEstados: string[]; prePage: number; preDesde: string; preHasta: string; preSort: "asc" | "desc" }>) {
    const sp = new URLSearchParams(window.location.search);
    const qv = next?.q ?? q;
    const estv = next?.preEstados ?? selectedEstados;
    const pv = next?.prePage ?? page;
    const dsd = next?.preDesde ?? preDesde;
    const hst = next?.preHasta ?? preHasta;
    const srt = next?.preSort ?? preSort;
    if (qv) sp.set("q", qv); else sp.delete("q");
    if (estv && estv.length > 0) sp.set("preEstados", estv.join(",")); else sp.delete("preEstados");
    if (dsd) sp.set("preDesde", dsd); else sp.delete("preDesde");
    if (hst) sp.set("preHasta", hst); else sp.delete("preHasta");
    sp.set("prePage", String(pv));
    sp.set("preSort", srt);
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }

  async function load(query?: string) {
    setLoading(true);
    try {
      const { data } = soloVencidas
        ? await api.get("/preventas/reservas-vencidas")
        : await api.get("/preventas", { params: { ...(query ? { q: query } : {}) } });
      setRows(
        (data ?? [])
          .map((v: any) => ({
            id: v.id ?? v.idVenta,
            cliente: v.cliente
              ? v.cliente
              : v.Cliente
              ? `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}`
              : "",
            fecha: String(v.fecha ?? v.fechaVenta ?? "").slice(0, 10),
            metodoPago: v.metodoPago ?? v.TipoPago?.tipoPago ?? null,
            total: Number(v.total ?? 0),
            estado:
              v.estado ??
              v.estadoVenta ??
              v.EstadoVenta?.nombreEstadoVenta ??
              "Pendiente",
          }))
      );

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    readParams();
    load();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => load(q), 350);
    return () => clearTimeout(t);
  }, [q, soloVencidas]);
  useEffect(() => {
    writeParams();
  }, [q]);

  // whenever filters/page change, sync URL
  useEffect(() => {
    writeParams();
  }, [selectedEstados, page, preDesde, preHasta, preSort]);

  const columns: ColumnDef<PreRow>[] = [
    { header: "N°", accessorKey: "id", size: 60 },
    { header: "Cliente", accessorKey: "cliente" },
    { header: "Fecha", accessorKey: "fecha" },
    { header: "Método de pago", accessorKey: "metodoPago" },
    {
      header: "Estado",
      cell: ({ row }) => {
        const raw = row.original.estado || "Pendiente";
        const norm = raw.toLowerCase().replace(/[\s_]+/g, "");
        let cls = "bg-gray-100 text-gray-800";
        if (norm.includes("pend")) cls = "bg-yellow-100 text-yellow-800";
        else if (norm.includes("listocaja")) cls = "bg-blue-100 text-blue-800";
        else if (norm.includes("finaliz") || norm.includes("cerrad")) cls = "bg-green-100 text-green-800";
        else if (norm.includes("cancel")) cls = "bg-red-100 text-red-800";
        return (
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}>
            {raw}
          </span>
        );
      },
    },
    {
      header: "Total",
      cell: ({ row }) => (
        <span className="block text-right">${fmtPrice(row.original.total, { minFraction: 2, maxFraction: 2 })}</span>
      ),
    },
    {
  header: "Acciones",
  id: "acciones",
  size: 220,
  cell: ({ row }) => {
    const estadoNorm = (row.original.estado || "")
      .toLowerCase()
      .replace(/[\s_]+/g, "");
    const isEditable = estadoNorm === "pendiente";

    return (
      <div className="flex gap-2">
        <button
          className="inline-flex items-center gap-1 border px-2 py-1 text-xs"
          onClick={() => setOpenView(row.original.id)}
          title="Ver"
        >
          <Eye className="h-3.5 w-3.5" /> Ver
        </button>

        {isEditable && (
          <button
            className="inline-flex items-center gap-1 border px-2 py-1 text-xs"
            onClick={() => setOpenForm(row.original.id)}
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        )}

        {isEditable && (
          <button
            className="inline-flex items-center gap-1 border px-2 py-1 text-xs"
            onClick={async () => {
    const motivo = await askText({
      title: "Cancelar presupuesto",
      label: "Motivo de cancelación",
      placeholder: "Ingresa un motivo (opcional)",
      confirmText: "Cancelar presupuesto",
      cancelText: "Volver",
      required: false,
    });
    if (motivo === null) return; // cancelado por usuario
              await api.put(`/preventas/${row.original.id}` , {
                accion: "cancelar",
    motivoCancelacion: (motivo && motivo.length > 0) ? motivo : null,
              });
              await load(q);
            }}
            title="Cancelar presupuesto"
          >
            <Trash2 className="h-3.5 w-3.5" /> Cancelar
          </button>
        )}
      </div>
    );
  },
},

  ];

  // filtering + pagination
  const rowsFiltered = rows
    .filter((r) => matchesQuery(q, r.cliente, r.metodoPago))
    .filter((r) => {
      const key = normEstado(r.estado);
      if (selectedEstados.length === 0) return true;
      return selectedEstados.includes(key);
    })
    .filter((r) => {
      const f = String(r.fecha || "").slice(0, 10);
      if (preDesde && f < preDesde) return false;
      if (preHasta && f > preHasta) return false;
      return true;
    });
  const rowsSorted = [...rowsFiltered].sort((a, b) => {
    const va = a.fecha;
    const vb = b.fecha;
    if (va === vb) return 0;
    const cmp = va < vb ? -1 : 1;
    return preSort === "asc" ? cmp : -cmp;
  });
  const total = rowsSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pageRows = rowsSorted.slice(startIdx, endIdx);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Presupuestos</h1>
        <button
          onClick={() => setOpenForm(0)}
          className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
        >
          <Plus className="h-4 w-4" /> Nuevo Presupuesto
        </button>
      </div>

      {/* Buscador + botón de filtros */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="relative w-64 sm:w-72 md:w-80 lg:w-96 xl:w-[32rem] flex-1 min-w-[14rem]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
            placeholder="Buscar por cliente o método de pago…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQ("");
            }}
          />
        </div>
        <button className="rounded border px-3 py-2" onClick={() => setOpenFiltros(true)}>Filtros</button>
        <span className="ml-auto text-xs text-gray-600">
          Mostrando {total === 0 ? 0 : startIdx + 1}–{endIdx} de {total}
        </span>
      </div>

      {/* Popup de filtros */}
      {openFiltros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg md:max-w-xl lg:max-w-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-medium">Filtros de Presupuestos</h2>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => setOpenFiltros(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Estado</span>
                <select
                  className="rounded border px-2 py-1"
                  value={selectedEstados.length === 2 ? "todas" : selectedEstados[0] || "todas"}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = v === "todas" ? ["pendiente", "listocaja"] : [v];
                    setSelectedEstados(next);
                    setPage(1);
                  }}
                >
                  <option value="todas">Pendiente o ListoCaja</option>
                  <option value="pendiente">Solo Pendiente</option>
                  <option value="listocaja">Solo ListoCaja</option>
                </select>
                <span className="text-gray-600 ml-auto">Orden</span>
                <select
                  className="rounded border px-2 py-1"
                  value={preSort}
                  onChange={(e) => setPreSort(e.target.value as "asc" | "desc")}
                >
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Fecha desde</span>
                <input
                  type="date"
                  className="rounded border px-2 py-1"
                  value={preDesde}
                  onChange={(e) => {
                    setPreDesde(e.target.value);
                    setPage(1);
                  }}
                />
                <span className="text-gray-600">hasta</span>
                <input
                  type="date"
                  className="rounded border px-2 py-1"
                  value={preHasta}
                  onChange={(e) => {
                    setPreHasta(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={soloVencidas}
                  onChange={(e) => {
                    setSoloVencidas(e.target.checked);
                    setPage(1);
                  }}
                />
                Solo reservas vencidas
              </label>
              
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm"
                onClick={() => {
                  setSelectedEstados(["pendiente", "listocaja"]);
                  setPreDesde("");
                  setPreHasta("");
                  setPreSort("desc");
                  setSoloVencidas(false);
                  setPage(1);
                }}
              >
                <X className="h-3.5 w-3.5" /> Borrar filtros
              </button>
              <button className="rounded border px-3 py-1 text-sm" onClick={() => setOpenFiltros(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border bg-white p-6 text-sm">Cargando…</div>
      ) : (
        <>
          <DataTable columns={columns} data={pageRows} />
          {/* Paginación */}
          <div className="flex items-center justify-between mt-2 text-sm">
            <div className="flex items-center gap-2">
              <button
                className="border px-2 py-1 rounded disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                Anterior
              </button>
              <button
                className="border px-2 py-1 rounded disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Siguiente
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span>Página</span>
              <input
                className="w-16 rounded border px-2 py-1"
                type="number"
                min={1}
                max={totalPages}
                value={safePage}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                  setPage(v);
                }}
              />
              <span>de {totalPages}</span>
            </div>
          </div>
        </>
      )}

      {openForm !== null && (
        <PreventaForm
          id={openForm || undefined}
          onClose={async (reload?: boolean) => {
            setOpenForm(null);
            if (reload) await load(q);
          }}
        />
      )}

      {openView !== null && (
        <PreventaView
          id={openView}
          onClose={async (reload?: boolean) => {
            setOpenView(null);
            if (reload) await load(q);
          }}
        />
      )}
    </section>
  );
}

/* ===== Modal Ver ===== */
function PreventaView({
  id,
  onClose,
}: {
  id: number;
  onClose: (reload?: boolean) => void;
}) {
  const [venta, setVenta] = useState<any>(null);
  const [hist, setHist] = useState<
    Array<{
      id: number;
      fecha: string;
      desde: string | number | null;
      hasta: string | number;
      motivo: string | null;
      usuario: {
        idUsuario: number;
        nombreUsuario: string;
        emailUsuario: string;
      } | null;
    }>
  >([]);
  const [loadingVenta, setLoadingVenta] = useState(true);
  const [loadingHist, setLoadingHist] = useState(true);
  const now = new Date();

  async function loadVenta() {
    setLoadingVenta(true);
    try {
      const { data } = await api.get(`/preventas/${id}`);
      setVenta(data);
    } finally {
      setLoadingVenta(false);
    }
  }

  async function loadHist() {
    setLoadingHist(true);
    try {
      const { data } = await api.get(`/preventas/${id}/historial`);
      setHist(
        (data ?? []).map((ev: any) => ({
          id: ev.id,
          fecha: new Date(ev.fecha).toLocaleString(),
          desde: ev.desde ?? null,
          hasta: ev.hasta,
          motivo: ev.motivo ?? null,
          usuario: ev.usuario ?? null,
        }))
      );
    } finally {
      setLoadingHist(false);
    }
  }

  useEffect(() => {
    loadVenta();
    loadHist();
  }, [id]);

  // 1. Estado actual legible
  const estadoStr =
    venta?.EstadoVenta?.nombreEstadoVenta ??
    (venta?.idEstadoVenta ? `Estado ${venta.idEstadoVenta}` : "-");

  // 2. Flag editable. Solo si está "Pendiente"
  const isEditable =
    (venta?.EstadoVenta?.nombreEstadoVenta ?? "")
      .toLowerCase()
      .replace(/[\s_]+/g, "") === "pendiente";

  const reservaVencida = (() => {
    try {
      if (!isEditable) return false;
      if (!venta?.fechaReservaLimite) return false;
      return new Date(venta.fechaReservaLimite).getTime() < now.getTime();
    } catch {
      return false;
    }
  })();

  // 3. Handler para cerrar edición (lock -> ListoCaja)
  async function terminarEdicion() {
    const ok = window.confirm(
      "¿Finalizar edición?\nYa no vas a poder modificar ni eliminar este presupuesto."
    );
    if (!ok) return;

    try {
      await api.put(`/preventas/${id}`, {
        accion: "lock",
      });

      // Cerramos modal y pedimos reload al padre
      onClose(true);
    } catch (e: any) {
      alert(
        e?.response?.data?.error ||
          e?.message ||
          "No se pudo finalizar la edición"
      );
    }
  }

  const lineItems = venta?.detalles ?? [];

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={() => onClose()}
      />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-2xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">
              Detalle de Presupuesto #{id}
            </h3>
            <button
              onClick={() => onClose()}
              className="p-2 rounded hover:bg-gray-100"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 text-sm overflow-auto flex-1">
            {loadingVenta ? (
              <div className="text-gray-600">Cargando…</div>
            ) : (
              <>
                {/* Resumen superior (similar a Productos) */}
                <div className="space-y-2 mb-4">
                  <p className="text-lg font-semibold text-gray-900">
                    {venta?.Cliente
                      ? `${venta.Cliente.apellidoCliente}, ${venta.Cliente.nombreCliente}`
                      : "Presupuesto"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-700 bg-gray-50">
                      N°: {venta?.idVenta ?? id}
                    </span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-700 bg-gray-50">
                      Fecha: {String(venta?.fechaVenta ?? "").slice(0, 10) || "-"}
                    </span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-700 bg-gray-50">
                      Estado: {estadoStr}
                    </span>
                    {venta?.fechaReservaLimite ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${reservaVencida ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                        Reserva hasta: {new Date(venta.fechaReservaLimite).toLocaleString()}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-gray-100 text-gray-700">
                        Sin reserva
                      </span>
                    )}
                  </div>
                </div>

                {/* Total principal */}
                <div className="rounded-xl border bg-white p-3 mb-4">
                  <p className="text-gray-500">Total</p>
                  <p className="text-2xl font-semibold">
                    {new Intl.NumberFormat("es-AR", {
                      style: "currency",
                      currency: "ARS",
                      maximumFractionDigits: 2,
                    }).format(
                      (lineItems ?? []).reduce((acc: number, d: any) => {
                        const cant = Number(d.cantidad ?? 0);
                        const pu = Number(
                          d.Producto?.precioVentaPublicoProducto ?? 0
                        );
                        return acc + cant * pu;
                      }, 0)
                    )}
                  </p>
                </div>

                {/* Información agrupada en tarjetas (como Productos) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Cliente */}
                  <div className="rounded-xl border bg-white p-3">
                    <p className="text-gray-500">Cliente</p>
                    <p className="font-medium">
                      {venta?.Cliente
                        ? `${venta.Cliente.apellidoCliente}, ${venta.Cliente.nombreCliente}`
                        : "-"}
                    </p>
                  </div>

                  {/* Datos (Fecha + Método de pago) */}
                  <div className="rounded-xl border bg-white p-3">
                    <p className="text-gray-500">Datos</p>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <p className="text-gray-500 text-xs">Fecha</p>
                        <p className="font-medium">
                          {String(venta?.fechaVenta ?? "").slice(0, 10) || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Método de pago</p>
                        <p className="font-medium">
                          {venta?.TipoPago?.tipoPago ?? "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Observación */}
                  <div className="md:col-span-2 rounded-xl border bg-white p-3">
                    <p className="text-gray-500">Observación</p>
                    <p className="font-normal">{venta?.observacion ?? "-"}</p>
                  </div>
                </div>
              </>
            )}

            {/* Productos */}
            <div>
              <p className="text-gray-700 font-medium mb-2">Productos</p>

              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2 py-2 text-left">Producto</th>
                      <th className="px-2 py-2 text-right">Cant.</th>
                      <th className="px-2 py-2 text-right">P.Unit.</th>
                      <th className="px-2 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingVenta ? (
                      <tr>
                        <td
                          className="px-2 py-4 text-center text-gray-500"
                          colSpan={4}
                        >
                          Cargando productos...
                        </td>
                      </tr>
                    ) : lineItems.length > 0 ? (
                      lineItems.map((d: any, idx: number) => {
                        const cant = Number(d.cantidad ?? 0);
                        const pu = Number(
                          d.Producto?.precioVentaPublicoProducto ?? 0
                        );
                        const subtotal = cant * pu;
                        return (
                          <tr
                            key={`${d.idDetalleVenta ?? d.idProducto}-${idx}`}
                            className="border-t"
                          >
                            <td className="px-2 py-2">
                              {d.Producto?.codigoProducto ?? ""} —{" "}
                              {d.Producto?.nombreProducto ?? ""}
                            </td>
                            <td className="px-2 py-2 text-right">{cant}</td>
                            <td className="px-2 py-2 text-right">
                              ${fmtPrice(pu, { minFraction: 2, maxFraction: 2 })}
                            </td>
                            <td className="px-2 py-2 text-right">
                              ${fmtPrice(subtotal, { minFraction: 2, maxFraction: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          className="px-2 py-4 text-center text-gray-500"
                          colSpan={4}
                        >
                          Sin items
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumen */}
            <div className="rounded-xl border bg-white p-3">
              <p className="text-gray-700 font-medium mb-2">Resumen</p>
              {loadingVenta ? (
                <div className="text-sm text-gray-500">Cargando resumen…</div>
              ) : (
                (() => {
                  const IVA = 0.21;
                  const bruto = (lineItems ?? []).reduce((acc: number, d: any) => {
                    const cant = Number(d.cantidad ?? 0);
                    const pu = Number(d.Producto?.precioVentaPublicoProducto ?? 0);
                    return acc + cant * pu;
                  }, 0);
                  const subtotalSinIVA = bruto / (1 + IVA);
                  const impuestos = bruto - subtotalSinIVA;
                  const totalFinal = bruto;
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Subtotal (sin impuestos)</p>
                        <p className="text-xl font-semibold">${fmtPrice(subtotalSinIVA)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Impuestos (IVA)</p>
                        <p className="text-xl font-semibold">${fmtPrice(impuestos)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total</p>
                        <p className="text-xl font-semibold">${fmtPrice(totalFinal)}</p>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Historial (tarjeta similar a Productos) */}
            <div className="rounded-xl border bg-white p-3 mt-4">
              <p className="text-gray-500 mb-2">Historial de estado</p>
              <div className="rounded-xl border overflow-hidden max-h-52">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2 py-2 text-left">Fecha</th>
                      <th className="px-2 py-2 text-left">Cambio</th>
                      <th className="px-2 py-2 text-left">Motivo</th>
                      <th className="px-2 py-2 text-left">Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHist ? (
                      <tr>
                        <td className="px-2 py-3 text-gray-600" colSpan={4}>Cargando…</td>
                      </tr>
                    ) : hist.length === 0 ? (
                      <tr>
                        <td className="px-2 py-3 text-gray-600" colSpan={4}>Sin movimientos de estado.</td>
                      </tr>
                    ) : (
                      hist.map((ev, idx) => (
                        <tr key={ev.id} className={idx % 2 ? "bg-gray-50" : undefined}>
                          <td className="px-2 py-2">{ev.fecha}</td>
                          <td className="px-2 py-2">{ev.desde ? `${ev.desde} → ${ev.hasta}` : ev.hasta}</td>
                          <td className="px-2 py-2">{ev.motivo ?? "-"}</td>
                          <td className="px-2 py-2">{ev.usuario ? (ev.usuario.nombreUsuario || ev.usuario.emailUsuario) : "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">
            {isEditable && (
              <button
                className="rounded-lg border border-blue-600 text-blue-600 px-3 py-2 text-xs font-medium hover:bg-blue-50 disabled:opacity-50"
                type="button"
                onClick={terminarEdicion}
              >
                Finalizar edición
              </button>
            )}

            <button
              onClick={() => onClose()}
              className="rounded-lg border px-3 py-2 text-xs font-medium bg-white"
              type="button"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ===== Modal Crear / Editar ===== */
function PreventaForm({
  id,
  onClose,
}: {
  id?: number;
  onClose: (reload?: boolean) => void;
}) {
  // Estado para modal de stock de producto
  const [openStock, setOpenStock] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockData, setStockData] = useState<{
    idProducto: number;
    nombre: string;
    real: number;
    comprometido: number;
    minimo: number;
    actualizadoEn: string | null;
  }[]>([]);

  async function openStockForLoadedProducts() {
    setStockError(null);
    setStockLoading(true);
    setOpenStock(true);
    try {
      const list = await Promise.all(
        items.map(async (i) => {
          const s = await getProductStock(i.idProducto);
          return {
            idProducto: i.idProducto,
            nombre: i.nombre,
            real: s.real,
            comprometido: s.comprometido,
            minimo: s.minimo,
            actualizadoEn: s.actualizadoEn ?? null,
          };
        })
      );
      setStockData(list);
    } catch (e: any) {
      setStockError(e?.response?.data?.error || e?.message || "No se pudo leer stock");
    } finally {
      setStockLoading(false);
    }
  }
  const isEdit = !!id;

  // tipos de pago
  const [tiposPago, setTiposPago] = useState<
    Array<{ id: number; nombre: string }>
  >([]);

  // cliente
  const [idCliente, setIdCliente] = useState<string>("");
  const [cliQ, setCliQ] = useState("");
  const [cliOpts, setCliOpts] = useState<Opt[]>([]);
  const [cliAll, setCliAll] = useState<Opt[]>([]);
  const [beneficioCliente, setBeneficioCliente] = useState<number>(0); // %

  // método de pago
  const [idTipoPago, setIdTipoPago] = useState<string>("");

  // recargo método de pago
  const [porcentajeMP, setPorcentajeMP] = useState<number>(0);

  // observaciones
  const [obs, setObs] = useState<string>("");

  // reserva hasta (fecha/hora límite de reserva)
  const [reservaHasta, setReservaHasta] = useState<string>("");

  // fecha de facturación = hoy fija
  const todayStr = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();
  const [fechaFactura, setFechaFactura] = useState<string>(todayStr);

  // productos buscador y línea editable
  const [prodQ, setProdQ] = useState("");
  const [prodOpts, setProdOpts] = useState<ProdOpt[]>([]);
  const [prodSel, setProdSel] = useState<ProdOpt | null>(null);

  const [cant, setCant] = useState<number>(0);
  const [precio, setPrecio] = useState<number>(0);
  const [desc, setDesc] = useState<number>(0); // % descuento línea

  // items agregados
  const [items, setItems] = useState<Item[]>([]);

  // Indicador de stock bajo (real - comprometido < minimo)
  const [lowStock, setLowStock] = useState<Record<number, "none" | "orange" | "red">>({});
  useEffect(() => {
    let canceled = false;
    const ids = Array.from(new Set(items.map((i) => i.idProducto)));
    if (ids.length === 0) {
      setLowStock({});
      return;
    }
    (async () => {
      try {
        const list = await Promise.allSettled(
          ids.map(async (idP) => {
            const s = await getProductStock(idP);
            const disponible = Number(s.real || 0) - Number(s.comprometido || 0);
            // máximo solicitado para este producto entre las líneas cargadas
            const maxSolicitada = Math.max(
              0,
              ...items
                .filter((it) => it.idProducto === idP)
                .map((it) => Number(it.cantidad || 0))
            );
            const minimo = Number(s.minimo || 0);
            const belowMin = disponible < minimo;
            const atOrBelowMin = disponible <= minimo;
            const belowRequested = disponible < maxSolicitada;
            const status: "none" | "orange" | "red" =
              belowMin || belowRequested ? "red" : atOrBelowMin ? "orange" : "none";
            return { id: idP, status };
          })
        );
        if (!canceled) {
          const map: Record<number, "none" | "orange" | "red"> = {};
          for (const r of list) {
            if (r.status === "fulfilled") map[r.value.id] = r.value.status;
          }
          setLowStock(map);
        }
      } catch {
        // Ignorar errores
      }
    })();
    return () => {
      canceled = true;
    };
  }, [items]);

  // recargo visible si método de pago es qr o crédito
  const tieneRecargoMP = (() => {
    const nombrePago =
      tiposPago
        .find((t) => String(t.id) === idTipoPago)
        ?.nombre?.toLowerCase()
        .trim() || "";
    return (
      nombrePago.includes("qr") ||
      nombrePago.includes("cred") ||
      nombrePago.includes("crédit")
    );
  })();

  /* ===== Helpers negocio ===== */
  async function fetchBeneficioCliente(idC: string) {
    if (!idC) {
      setBeneficioCliente(0);
      return;
    }
    try {
      const { data } = await api.get(`/clientes/${idC}`);

      const nivel =
        data?.NivelCliente ??
        data?.nivelCliente ??
        data?.Nivel ??
        data?.nivel ??
        {};

      const directCandidates = [
        data?.indiceBeneficio,
        data?.beneficio,
        data?.descuentoCliente,
        data?.descuento,
        data?.porcentajeDescuento,
      ];

      const nivelCandidates = [
        nivel?.indiceBeneficio,
        nivel?.beneficio,
        nivel?.descuentoCliente,
        nivel?.descuento,
        nivel?.porcentajeDescuento,
        nivel?.porcentaje,
      ];

      const all = [...directCandidates, ...nivelCandidates];
      const chosen = all.find(
        (v) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100
      );

      if (chosen !== undefined) {
        setBeneficioCliente(Number(chosen));
      } else {
        setBeneficioCliente(0);
      }
    } catch {
      setBeneficioCliente(0);
    }
  }

  // sincroniza descuento cliente cuando idCliente queda confirmado
  useEffect(() => {
    if (!idCliente) {
      setBeneficioCliente(0);
      return;
    }
    (async () => {
      await fetchBeneficioCliente(idCliente);
    })();
  }, [idCliente]);

  /* ===== Cargas iniciales catálogos ===== */
  useEffect(() => {
    (async () => {
      const [c0, tp] = await Promise.all([
        api.get("/clientes"),
        api.get("/tipos-pago"),
      ]);

      setCliAll(
        (c0.data ?? []).slice(0, 50).map((c: any) => ({
          id: c.idCliente ?? c.id,
          label: `${c.apellidoCliente ?? c.apellido}, ${
            c.nombreCliente ?? c.nombre
          }`,
        }))
      );

      // normalizamos tiposPago aquí:
      setTiposPago(
        (tp.data ?? []).map((t: any) => ({
          id: t.idTipoPago,
          nombre: t.tipoPago,
        }))
      );
    })();
  }, []);

  /* ===== Si es edición cargo datos previos ===== */
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data } = await api.get(`/preventas/${id}`);

      const cId = String(data?.idCliente ?? "");
      setIdCliente(cId);
      setCliQ(
        data?.Cliente
          ? `${data.Cliente.apellidoCliente}, ${data.Cliente.nombreCliente}`
          : ""
      );
      setIdTipoPago(String(data?.idTipoPago ?? ""));
      setObs(data?.observacion ?? "");

      const ff = String(data?.fechaVenta ?? "").slice(0, 10);
      setFechaFactura(ff || todayStr);

      if (data?.porcentajeMetodo != null) {
        setPorcentajeMP(Number(data.porcentajeMetodo) || 0);
      }

      // fechaReservaLimite viene como ISO; normalizamos a input datetime-local (sin segundos)
      if (data?.fechaReservaLimite) {
        const dt = new Date(data.fechaReservaLimite);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const d = String(dt.getDate()).padStart(2, "0");
        const hh = String(dt.getHours()).padStart(2, "0");
        const mm = String(dt.getMinutes()).padStart(2, "0");
        setReservaHasta(`${y}-${m}-${d}T${hh}:${mm}`);
      } else {
        setReservaHasta("");
      }

      if (Array.isArray(data?.detalles)) {
        setItems(
          data.detalles.map((d: any) => ({
            idProducto: d.idProducto,
            nombre: `${d.Producto?.codigoProducto ?? ""} — ${
              d.Producto?.nombreProducto ?? ""
            }`,
            cantidad: Number(d.cantidad ?? 0),
            precio: Number(d.Producto?.precioVentaPublicoProducto ?? 0),
            descuento: 0,
          }))
        );
      }
    })();
  }, [isEdit, id, todayStr]);

  /* ===== Búsqueda cliente en vivo ===== */
  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await api.get("/clientes", {
        params: cliQ ? { q: cliQ } : undefined,
      });
      setCliOpts(
        (data ?? []).slice(0, 20).map((c: any) => ({
          id: c.idCliente ?? c.id,
          label: `${c.apellidoCliente ?? c.apellido}, ${
            c.nombreCliente ?? c.nombre
          }`,
        }))
      );
    }, 250);
    return () => clearTimeout(t);
  }, [cliQ]);

  async function resolveClientFromText(txt: string) {
    const pool = [...cliOpts, ...cliAll];
    const t = txt.trim().toLowerCase();

    let m =
      pool.find((o) => o.label.toLowerCase() === t) ||
      pool.find((o) => o.label.toLowerCase().startsWith(t));

    if (m) {
      const sid = String(m.id);
      if (sid !== idCliente) {
        setIdCliente(sid); // confirma cliente real
      }
      setCliQ(m.label); // normaliza texto mostrado
      setCliOpts([]);
    }
    // si no hay match no tocamos idCliente
  }

  /* ===== Búsqueda producto en vivo ===== */
  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await api.get("/products", {
        params: prodQ ? { q: prodQ } : undefined,
      });
      const opts: ProdOpt[] = (data ?? []).map((p: any) => ({
        id: p.id ?? p.idProducto,
        label: `${p.sku ?? p.codigoProducto} — ${p.nombre ?? p.nombreProducto}`,
        precio: Number(p.precio ?? p.precioVentaPublicoProducto ?? 0),
      }));
      setProdOpts(opts);
      if (prodSel) {
        const found = opts.find((o) => o.id === prodSel.id);
        if (found) setPrecio(found.precio);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [prodQ]); // eslint-disable-line

  /* ===== Selección y agregado de producto ===== */
  function pickProduct(o: ProdOpt) {
    setProdSel(o);
    setProdQ(o.label);
    setPrecio(o.precio);
    setProdOpts([]);
    setCant(0);
    setDesc(0);
  }

  function addItem() {
    if (!prodSel) return;
    if (cant <= 0 || precio < 0 || desc < 0 || desc > 100) return;

    setItems((prev) => [
      ...prev,
      {
        idProducto: prodSel.id,
        nombre: prodSel.label,
        cantidad: Number(cant),
        precio: Number(precio),
        descuento: Number(desc),
      },
    ]);

    setProdSel(null);
    setProdQ("");
    setCant(0);
    setPrecio(0);
    setDesc(0);
  }

  function delItem(idProducto: number) {
    setItems((prev) => prev.filter((i) => i.idProducto !== idProducto));
  }

  function setItemCantidad(idProducto: number, cantidad: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.idProducto === idProducto ? { ...i, cantidad: Math.max(0, cantidad) } : i
      )
    );
  }

  function setItemDescuento(idProducto: number, descuento: number) {
    const pct = Math.min(100, Math.max(0, descuento));
    setItems((prev) =>
      prev.map((i) =>
        i.idProducto === idProducto ? { ...i, descuento: pct } : i
      )
    );
  }

  /* ===== Cálculos de totales ===== */
  const bruto = items.reduce((a, i) => a + i.cantidad * i.precio, 0);

  const descLineasMonto = items.reduce(
    (a, i) => a + i.cantidad * i.precio * ((i.descuento || 0) / 100),
    0
  );

  const baseTrasDescLineas = bruto - descLineasMonto;

  const descClientePct = beneficioCliente;
  const descClienteMonto = baseTrasDescLineas * (descClientePct / 100);

  const baseTrasDescCliente = baseTrasDescLineas - descClienteMonto;

  const IVA = 0.21;
  const subtotalSinIVA = baseTrasDescCliente;
  const impuestos = subtotalSinIVA * IVA;

  const totalAntesRecargo = subtotalSinIVA + impuestos;

  const recargoPct = tieneRecargoMP ? porcentajeMP : 0;
  const recargoMonto = totalAntesRecargo * (recargoPct / 100);

  const totalFinal = totalAntesRecargo + recargoMonto;

  /* ===== Submit ===== */
  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    console.log("CLICK GUARDAR", { isEdit, id, items });
    if (!idCliente) return alert("Seleccioná un cliente válido.");
    if (!idTipoPago) return alert("Seleccioná método de pago.");
    if (items.length === 0) return alert("Agregá al menos un producto.");

    const today = new Date();
    const ventaDate = fechaFactura ? new Date(fechaFactura) : today;

    // Construir payload diferenciando crear (POST) vs guardar (PUT)
    const payload: any = isEdit
      ? {
          accion: "guardar",
          items: items.map((i) => ({
            idProducto: Number(i.idProducto),
            cantidad: Number(i.cantidad),
          })),
          idCliente: Number(idCliente),
          idTipoPago: Number(idTipoPago),
          observacion: obs || null,
          fechaFacturacion: ventaDate.toISOString(),
          fechaCobro: today.toISOString(),
          descuentoGeneral: Number(descClientePct) || 0,
          porcentajeMetodo: tieneRecargoMP ? Number(porcentajeMP) || 0 : 0,
        }
      : {
          idCliente: Number(idCliente),
          idTipoPago: Number(idTipoPago),
          observacion: obs || null,
          // en creación el backend espera "detalles"
          detalles: items.map((i) => ({
            idProducto: Number(i.idProducto),
            cantidad: Number(i.cantidad),
          })),
          descuentoGeneral: Number(descClientePct) || 0,
          porcentajeMetodo: tieneRecargoMP ? Number(porcentajeMP) || 0 : 0,
        };

    try {
      if (isEdit) {
        await api.put(`/preventas/${id}`, payload);
        // actualizar reserva si corresponde (permite limpiar si vacío)
        await api.put(`/preventas/${id}/reserva`, {
          fechaReservaLimite: reservaHasta || null,
        });
      } else {
        const { data } = await api.post("/preventas", payload);
        const newId = Number(data?.idVenta ?? data?.id ?? 0);
        if (newId && reservaHasta) {
          await api.put(`/preventas/${newId}/reserva`, {
            fechaReservaLimite: reservaHasta,
          });
        }
      }
      onClose(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || err?.message || "Error al guardar";
      alert(`No se pudo guardar: ${msg}`);
    }
  }

  /* ===== UI modal crear/editar ===== */
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={() => onClose()}
      />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-7xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">
              {isEdit ? "Editar Presupuesto" : "Nuevo Presupuesto"}
            </h3>
            <button
              onClick={() => onClose()}
              className="p-2 rounded hover:bg-gray-100"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form
            onSubmit={onSubmit}
            className="p-4 overflow-auto flex-1 space-y-6"
          >
            {/* === Datos de la operación === */}
          <div className="rounded-2xl border bg-white p-4 space-y-4">
            <h4 className="text-sm font-medium text-gray-700">
              Datos de la operación
            </h4>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Cliente */}
                <div className="lg:col-span-1">
                  <Label htmlFor="clienteSearch">Cliente</Label>
                  <div className="relative">
                    <Input
                      id="clienteSearch"
                      placeholder="Buscar cliente…"
                      value={cliQ}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCliQ(val);

                        // al escribir, no autoseleccionamos cliente
                        // tampoco forzamos idCliente = "" acá
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          await resolveClientFromText(cliQ);
                        }
                      }}
                      onBlur={async () => {
                        await resolveClientFromText(cliQ);
                      }}
                    />
                    {cliQ && cliOpts.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-white shadow">
                        {cliOpts.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-100"
                            onClick={async () => {
                              const sid = String(o.id);
                              setIdCliente(sid); // confirmamos cliente
                              setCliQ(o.label); // mostramos label limpio
                              setCliOpts([]);

                              // llamamos de inmediato para tener beneficioCliente al instante
                              await fetchBeneficioCliente(sid);
                            }}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Método de pago */}
                <div className="lg:col-span-1">
                  <Label htmlFor="pago">Método de pago</Label>
                  <Select
                    id="pago"
                    value={idTipoPago}
                    onChange={(e) => setIdTipoPago(e.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    {tiposPago.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.nombre}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Fecha de facturación fija = hoy */}
                <div className="lg:col-span-1">
                  <Label htmlFor="fFac">Fecha de facturación</Label>
                  <Input
                    id="fFac"
                    type="date"
                    value={fechaFactura}
                    readOnly
                    className="bg-gray-100"
                  />
                </div>

                {/* Reserva hasta */}
                <div className="lg:col-span-1">
                  <Label htmlFor="fRes">Reserva hasta</Label>
                  <Input
                    id="fRes"
                    type="datetime-local"
                    value={reservaHasta}
                    onChange={(e) => setReservaHasta(e.target.value)}
                  />
                </div>

                {/* Recargo (QR o Crédito). Aparece debajo */}
                {tieneRecargoMP && (
                  <div className="lg:col-span-1">
                    <Label htmlFor="pctmp">Recargo (%)</Label>
                    <Input
                      id="pctmp"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={porcentajeMP}
                      onChange={(e) =>
                        setPorcentajeMP(
                          Math.max(0, Number(e.target.value) || 0)
                        )
                      }
                    />
                  </div>
                )}

                {/* Observaciones */}
                <div className="lg:col-span-3">
                  <Label htmlFor="obs">Observaciones</Label>
                  <Input
                    id="obs"
                    placeholder="Opcional"
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* === Agregar productos === */}
            <div className="rounded-2xl border bg-white p-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">
                Agregar producto
              </h4>

            <div className="grid grid-cols-1 md:grid-cols-20 gap-3">
              {/* Producto */}
              <div className="md:col-span-10">
                <Label htmlFor="productoSearch" className="mb-1 block">
                  Producto
                </Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                  <input
                    id="productoSearch"
                    className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
                    placeholder="Buscar producto"
                    value={prodQ}
                    onChange={(e) => setProdQ(e.target.value)}
                  />
                  {prodQ && prodOpts.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-white shadow">
                      {prodOpts.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className="block w-full text-left px-2 py-1 hover:bg-gray-50 text-sm"
                          onClick={() => {
                            pickProduct(o);
                            setProdQ(o.label);
                          }}
                        >
                          {o.label} — ${fmtPrice(o.precio, { minFraction: 2, maxFraction: 2 })}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {prodSel && null}
              </div>

                {/* Cantidad */}
                <div className="md:col-span-3">
                  <Label htmlFor="cantidad" className="mb-1 block">
                    Cantidad (g)
                  </Label>
                  <Input
                    id="cantidad"
                    type="number"
                    inputMode="numeric"
                    value={cant}
                    onChange={(e) =>
                      setCant(Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </div>

                {/* Precio */}
                <div className="md:col-span-3">
                  <Label htmlFor="precio" className="mb-1 block">
                    Precio
                  </Label>
                  <Input
                    id="precio"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={precio}
                    onChange={(e) =>
                      setPrecio(Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </div>

                {/* Descuento línea */}
                <div className="md:col-span-3">
                  <Label htmlFor="descuento" className="mb-1 block">
                    Descuento %
                  </Label>
                  <Input
                    id="descuento"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={desc}
                    onChange={(e) =>
                      setDesc(
                        Math.min(100, Math.max(0, Number(e.target.value) || 0))
                      )
                    }
                  />
                </div>

                {/* Botón agregar */}
                <button
                  type="button"
                  onClick={addItem}
                  disabled={!prodSel}
                  className="self-end inline-flex items-center justify-center rounded-lg bg-black text-white p-2 disabled:opacity-50"
                  title="Agregar"
                  aria-label="Agregar"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* === Tabla productos === */}
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Productos cargados</h4>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                  onClick={openStockForLoadedProducts}
                >
                  <Eye className="h-3.5 w-3.5" /> Ver stock
                </button>
              </div>
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col style={{ width: "40%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-right">Cant. (g)</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-right">Desc %</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => (
                    <tr key={`${i.idProducto}-${idx}`} className="border-t">
                      <td className="px-3 py-2">
                        {i.nombre}
                        {lowStock[i.idProducto] && lowStock[i.idProducto] !== "none" && (
                          <span
                            title={
                              lowStock[i.idProducto] === "red"
                                ? "Stock crítico"
                                : "Stock bajo (umbral mínimo)"
                            }
                            className={
                              "ml-2 inline-flex items-center justify-center rounded-full text-xs font-bold w-4 h-4 align-middle " +
                              (lowStock[i.idProducto] === "red"
                                ? "bg-red-100 text-red-700"
                                : "bg-orange-100 text-orange-700")
                            }
                          >
                            !
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isEdit ? (
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={i.cantidad}
                            onChange={(e) =>
                              setItemCantidad(
                                i.idProducto,
                                Number(e.target.value) || 0
                              )
                            }
                            className="w-24 text-center"
                          />
                        ) : (
                          i.cantidad
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">${fmtPrice(i.precio, { minFraction: 2, maxFraction: 2 })}</td>
                      <td className="px-3 py-2 text-center">
                        {isEdit ? (
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            value={i.descuento}
                            onChange={(e) =>
                              setItemDescuento(
                                i.idProducto,
                                Number(e.target.value) || 0
                              )
                            }
                            className="w-20 text-center"
                          />
                        ) : (
                          `${i.descuento}%`
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        ${fmtPrice(i.cantidad * i.precio * (1 - (i.descuento || 0) / 100), { minFraction: 2, maxFraction: 2 })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 border px-2 py-1 text-xs"
                          onClick={() => delItem(i.idProducto)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-gray-500"
                        colSpan={6}
                      >
                        Sin productos agregados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* === Resumen === */}
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="font-medium">Resumen del Presupuesto</h2>
                <span className="rounded-full px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800">
                  Estado: Pendiente
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
                {/* Subtotal neto antes de IVA */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">
                    Subtotal (sin impuestos)
                  </p>
                  <p className="text-2xl font-semibold">
                    ${baseTrasDescCliente.toFixed(2)}
                  </p>
                </div>

                {/* IVA */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Impuestos (IVA)</p>
                  <p className="text-2xl font-semibold">
                    ${impuestos.toFixed(2)}
                  </p>
                </div>

                {/* Descuentos */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Descuentos</p>

                  <div className="text-xs text-gray-500 leading-relaxed">
                    <div>
                      <span className="font-medium">Por ítems:</span> -$
                      {descLineasMonto.toFixed(2)}
                    </div>
                    <div>
                      <span className="font-medium">
                        Por cliente ({descClientePct.toFixed(2)}
                        %):
                      </span>{" "}
                      -$
                      {descClienteMonto.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Recargo */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Recargo</p>
                  <p className="text-2xl font-semibold">
                    {recargoPct.toFixed(2)}%
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    + ${recargoMonto.toFixed(2)}
                  </p>
                </div>

                {/* Total final */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Total final</p>
                  <p className="text-2xl font-semibold">
                    ${totalFinal.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t">
                {/* Modal de Stock de productos cargados */}
                <Modal
                  open={openStock}
                  title="Stock de productos cargados"
                  onClose={() => setOpenStock(false)}
                  centered
                >
                  <div className="space-y-3 text-sm">
                    {stockLoading ? (
                      <div className="text-gray-600">Cargando stock…</div>
                    ) : stockError ? (
                      <div className="text-red-700">{stockError}</div>
                    ) : stockData.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {stockData.map((s) => (
                          <div key={s.idProducto} className="rounded-xl border bg-white p-3">
                            <p className="text-gray-700 text-sm font-medium mb-2">{s.nombre}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-gray-500 text-xs">Real</p>
                                <p className="font-medium">{fmtPrice(s.real, { minFraction: 2, maxFraction: 2 })} g</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Comprometido</p>
                                <p className="font-medium">{fmtPrice(s.comprometido, { minFraction: 2, maxFraction: 2 })} g</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Mínimo</p>
                                <p className="font-medium">{fmtPrice(s.minimo, { minFraction: 2, maxFraction: 2 })} g</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Actualizado</p>
                                <p className="font-medium">{s.actualizadoEn ? new Date(s.actualizadoEn).toLocaleString() : "-"}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-600">Sin datos de stock</div>
                    )}
                  </div>
                </Modal>

                <button
                  type="button"
                  onClick={() => onClose()}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  className="rounded-lg bg-black text-white px-3 py-2 text-sm"
                >
                  {isEdit ? "Guardar cambios" : "Guardar Presupuesto"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
