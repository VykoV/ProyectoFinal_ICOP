import { useState, useEffect } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Search, Eye, Plus, X } from "lucide-react";
import { Label, Input } from "../components/ui/Form";
import { api } from "../lib/api";
import { askText, showAlert } from "../lib/alerts";
import { fmtPrice } from "../lib/format";
import Modal from "../components/Modal";
import { getProductStock } from "../lib/api/products";
import { useAuth } from "../context/AuthContext";
import { useMonedas } from "../context/MonedasContext";

/* Tipos base */
type VentaRow = {
  id: number;
  cliente: string;
  fecha: string;
  metodoPago?: string | null;
  estado: string;
  total: number;
  estadoPago?: string | null;
  fechaCobro?: string | null;
  fechaReservaLimite?: string | null;
};

export default function Ventas() {
  const [tab, setTab] = useState<"ventas" | "preventas" | "vencidos">(
    "preventas"
  );
  const { hasRole } = useAuth();
  const canViewVencidos = hasRole("Administrador");

  // modal registrar venta nueva
  const [openNuevaVenta, setOpenNuevaVenta] = useState(false);

  // modal ver preventa
  const [openViewPreventa, setOpenViewPreventa] = useState<null | number>(null);

  // modal validar preventa
  const [openValidate, setOpenValidate] = useState<null | number>(null);

  // filtro de búsqueda simple
  const [q, setQ] = useState("");
  const [openFiltros, setOpenFiltros] = useState(false);

  // datos
  const [ventasRows, setVentasRows] = useState<VentaRow[]>([]);
  const [preRows, setPreRows] = useState<VentaRow[]>([]);
  const [loading, setLoading] = useState(false);

  // filtros/paginación
  const [preEstados, setPreEstados] = useState<string[]>([]);
  const [preDesde, setPreDesde] = useState<string>("");
  const [preHasta, setPreHasta] = useState<string>("");
  const [prePage, setPrePage] = useState<number>(1);
  const [venEstados, setVenEstados] = useState<string[]>([
    "finalizada",
    "cancelada",
  ]);
  const [venDesde, setVenDesde] = useState<string>("");
  const [venHasta, setVenHasta] = useState<string>("");
  const [venPage, setVenPage] = useState<number>(1);
  const [vencPage, setVencPage] = useState<number>(1);
  const [preSort, setPreSort] = useState<"asc" | "desc">("desc");
  const [venSort, setVenSort] = useState<"asc" | "desc">("desc");
  const pageSize = 10;

  function normEstado(
    raw: string
  ):
    | "pendiente"
    | "reservado"
    | "listocaja"
    | "vencido"
    | "finalizada"
    | "cancelada"
    | "otro" {
    const n = String(raw || "")
      .toLowerCase()
      .replace(/[\s_]+/g, "");
    if (n.includes("pend")) return "pendiente";
    if (n.includes("reserv")) return "reservado";
    if (n.includes("listocaja")) return "listocaja";
    if (n.includes("vencid")) return "vencido";
    if (n.includes("finaliz") || n.includes("cerrad")) return "finalizada";
    if (n.includes("cancel")) return "cancelada";
    return "otro";
  }

  // Coincidencia simple contra múltiples campos; si q está vacío, siempre true
  function matchesQuery(
    qv: string,
    ...fields: Array<string | null | undefined>
  ): boolean {
    const qn = (qv || "").trim().toLowerCase();
    if (!qn) return true;
    return fields.some((f) =>
      String(f || "")
        .toLowerCase()
        .includes(qn)
    );
  }

  function readParams() {
    const sp = new URLSearchParams(window.location.search);
    const tabQ = sp.get("tab") as any;
    const q0 = sp.get("q") || "";
    const newQ = sp.get("new") || "";
    const preE = sp.get("preEstados");
    const preD = sp.get("preDesde") || "";
    const preH = sp.get("preHasta") || "";
    const preP = Number(sp.get("prePage") || "1");
    const preS = sp.get("preSort") || "";
    const venE = sp.get("venEstados");
    const venD = sp.get("venDesde") || "";
    const venH = sp.get("venHasta") || "";
    const venP = Number(sp.get("venPage") || "1");
    const vencP = Number(sp.get("vencPage") || "1");
    const venS = sp.get("venSort") || "";
    if (tabQ === "ventas" || tabQ === "preventas") setTab(tabQ);
    else if (tabQ === "vencidos")
      setTab(canViewVencidos ? "vencidos" : "preventas");
    setQ(q0);
    setPreEstados(
      preE
        ? preE.split(",").filter(Boolean)
        : ["pendiente", "reservado", "listocaja"]
    );
    setPreDesde(preD);
    setPreHasta(preH);
    setPrePage(Math.max(1, preP || 1));
    setPreSort(preS === "asc" || preS === "desc" ? (preS as any) : "desc");
    setVenEstados(
      venE ? venE.split(",").filter(Boolean) : ["finalizada", "cancelada"]
    );
    setVenDesde(venD);
    setVenHasta(venH);
    setVenPage(Math.max(1, venP || 1));
    setVenSort(venS === "asc" || venS === "desc" ? (venS as any) : "desc");
    setVencPage(Math.max(1, vencP || 1));
    if (newQ.toLowerCase() === "preventa") {
      setOpenNuevaVenta(true);
    }
  }

  function writeParams(
    next?: Partial<{
      tab: "ventas" | "preventas" | "vencidos";
      q: string;
      preEstados: string[];
      preDesde: string;
      preHasta: string;
      prePage: number;
      preSort: "asc" | "desc";
      venEstados: string[];
      venDesde: string;
      venHasta: string;
      venPage: number;
      venSort: "asc" | "desc";
      vencPage: number;
    }>
  ) {
    const sp = new URLSearchParams(window.location.search);
    const t = next?.tab ?? tab;
    const qv = next?.q ?? q;
    const pe = next?.preEstados ?? preEstados;
    const pd = next?.preDesde ?? preDesde;
    const ph = next?.preHasta ?? preHasta;
    const pp = next?.prePage ?? prePage;
    const ps = next?.preSort ?? preSort;
    const ve = next?.venEstados ?? venEstados;
    const vd = next?.venDesde ?? venDesde;
    const vh = next?.venHasta ?? venHasta;
    const vp = next?.venPage ?? venPage;
    const vep = next?.vencPage ?? vencPage;
    const vs = next?.venSort ?? venSort;
    sp.set("tab", t);
    if (qv) sp.set("q", qv);
    else sp.delete("q");
    if (pe.length) sp.set("preEstados", pe.join(","));
    else sp.delete("preEstados");
    if (pd) sp.set("preDesde", pd);
    else sp.delete("preDesde");
    if (ph) sp.set("preHasta", ph);
    else sp.delete("preHasta");
    sp.set("prePage", String(pp));
    sp.set("preSort", ps);
    if (ve.length) sp.set("venEstados", ve.join(","));
    else sp.delete("venEstados");
    if (vd) sp.set("venDesde", vd);
    else sp.delete("venDesde");
    if (vh) sp.set("venHasta", vh);
    else sp.delete("venHasta");
    sp.set("venPage", String(vp));
    sp.set("venSort", vs);
    sp.set("vencPage", String(vep));
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }

  // cargar datos
  async function loadData(query?: string) {
    setLoading(true);
    try {
      let ventasData: any[] = [];
      try {
        const resV = await api.get("/ventas", {
          params: { ...(query ? { q: query } : {}), _: Date.now() },
        });
        ventasData = resV.data ?? [];
      } catch {
        ventasData = [];
      }

      setVentasRows(
        ventasData.map((v: any) => ({
          id: v.id,
          cliente: v.cliente,
          fecha: v.fecha,
          metodoPago: v.metodoPago,
          estado: v.estado,
          total: Number(v.total ?? 0),
          estadoPago: v.estadoPago ?? null,
          fechaCobro: v.fechaCobroVenta
            ? String(v.fechaCobroVenta).slice(0, 10)
            : null,
        }))
      );

      // preventas pendientes
      let preData: any[] = [];
      try {
        const resP = await api.get("/preventas", {
          params: { ...(query ? { q: query } : {}), _: Date.now() },
        });
        preData = resP.data ?? [];
      } catch {
        preData = [];
      }

      setPreRows(
        preData
          .filter((v: any) => {
            const estadoNombre =
              v.estado ??
              v.estadoVenta ??
              v.EstadoVenta?.nombreEstadoVenta ??
              "Pendiente";

            const norm = String(estadoNombre)
              .toLowerCase()
              .replace(/[\s_]+/g, "");

            // Estados que NO queremos ver en la pestaña de "Pre-Ventas Pendientes" de caja:
            // finalizada, finalizado, cerrado, cancelada, cancelado
            const esCerrada =
              norm.includes("finaliz") ||
              norm.includes("cerrad") ||
              norm.includes("cancel");

            // Caja debe ver todo lo que no esté cerrado
            return !esCerrada;
          })
          .map((v: any) => ({
            id: v.id ?? v.idVenta,
            cliente: v.cliente
              ? v.cliente
              : v.Cliente
              ? `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}`
              : "",
            fecha: String(v.fecha ?? v.fechaVenta ?? "").slice(0, 10),
            metodoPago:
              v.metodoPago ?? v.TipoPago?.tipoPago ?? v.metodo ?? null,
            estado:
              v.estado ??
              v.estadoVenta ??
              v.EstadoVenta?.nombreEstadoVenta ??
              "Pendiente",
            total: Number(v.total ?? 0),
            fechaReservaLimite: v.fechaReservaLimite ?? null,
          }))
      );
    } finally {
      setLoading(false);
    }
  }

  // carga inicial
  useEffect(() => {
    readParams();
    loadData();
  }, []);

  // búsqueda con debounce
  useEffect(() => {
    const t = setTimeout(() => {
      loadData(q);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    writeParams();
  }, [q]);

  // sync URL when filters/page/tab change
  useEffect(() => {
    writeParams();
  }, [
    tab,
    preEstados,
    preDesde,
    preHasta,
    prePage,
    preSort,
    venEstados,
    venDesde,
    venHasta,
    venPage,
    venSort,
    vencPage,
  ]);

  // derived filtered + paginated datasets
  const preFiltered = preRows
    .filter((r) => matchesQuery(q, r.cliente, r.metodoPago))
    .filter((r) => {
      const k = normEstado(r.estado);
      if (k === "vencido") return false;
      if (preEstados.length === 0) return true;
      return preEstados.includes(k);
    })
    .filter((r) => {
      const f = r.fecha; // YYYY-MM-DD
      if (preDesde && f < preDesde) return false;
      if (preHasta && f > preHasta) return false;
      return true;
    });
  const preSorted = [...preFiltered].sort((a, b) => {
    const va = a.fecha;
    const vb = b.fecha;
    if (va === vb) return 0;
    const cmp = va < vb ? -1 : 1;
    return preSort === "asc" ? cmp : -cmp;
  });
  const preTotal = preSorted.length;
  const preTotalPages = Math.max(1, Math.ceil(preTotal / pageSize));
  const preSafePage = Math.min(Math.max(1, prePage), preTotalPages);
  const preStart = (preSafePage - 1) * pageSize;
  const preEnd = Math.min(preStart + pageSize, preTotal);
  const prePageRows = preSorted.slice(preStart, preEnd);

  const venFiltered = ventasRows
    .filter((r) => matchesQuery(q, r.cliente, r.metodoPago))
    .filter((r) => {
      const k = normEstado(r.estado);
      if (venEstados.length === 0) return true;
      return venEstados.includes(k);
    })
    .filter((r) => {
      const f = r.fecha; // formato YYYY-MM-DD
      if (venDesde && f < venDesde) return false;
      if (venHasta && f > venHasta) return false;
      return true;
    });
  const venSorted = [...venFiltered].sort((a, b) => {
    const va = a.fecha;
    const vb = b.fecha;
    if (va === vb) return 0;
    const cmp = va < vb ? -1 : 1;
    return venSort === "asc" ? cmp : -cmp;
  });
  const venTotal = venSorted.length;
  const venTotalPages = Math.max(1, Math.ceil(venTotal / pageSize));
  const venSafePage = Math.min(Math.max(1, venPage), venTotalPages);
  const venStart = (venSafePage - 1) * pageSize;
  const venEnd = Math.min(venStart + pageSize, venTotal);
  const venPageRows = venSorted.slice(venStart, venEnd);
  const venEstadoSel: "todas" | "finalizada" | "cancelada" =
    venEstados.length === 1
      ? (venEstados[0] as "finalizada" | "cancelada")
      : "todas";

  // presupuestos vencidos
  const vencFiltered = preRows
    .filter((r) => matchesQuery(q, r.cliente, r.metodoPago))
    .filter((r) => normEstado(r.estado) === "vencido")
    .filter((r) => {
      const f = r.fecha;
      if (preDesde && f < preDesde) return false;
      if (preHasta && f > preHasta) return false;
      return true;
    });
  const vencSorted = [...vencFiltered].sort((a, b) => {
    const va = a.fecha;
    const vb = b.fecha;
    if (va === vb) return 0;
    const cmp = va < vb ? -1 : 1;
    return preSort === "asc" ? cmp : -cmp;
  });
  const vencTotal = vencSorted.length;
  const vencTotalPages = Math.max(1, Math.ceil(vencTotal / pageSize));
  const vencSafePage = Math.min(Math.max(1, vencPage), vencTotalPages);
  const vencStart = (vencSafePage - 1) * pageSize;
  const vencEnd = Math.min(vencStart + pageSize, vencTotal);
  const vencPageRows = vencSorted.slice(vencStart, vencEnd);

  /* Columnas Ventas (finalizadas) */
  /* Columnas Ventas (finalizadas / canceladas) */
  const columnsVentas: ColumnDef<VentaRow>[] = [
    { header: "N° Venta", accessorKey: "id" },
    { header: "Cliente", accessorKey: "cliente" },
    { header: "Fecha", accessorKey: "fecha" },
    { header: "Método de Pago", accessorKey: "metodoPago" },
    {
      header: "Estado",
      cell: ({ row }) => {
        const est = row.original.estado?.toLowerCase() || "";
        let cls =
          "rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300";
        if (est.includes("final")) {
          cls =
            "rounded-full px-2 py-1 text-xs font-medium bg-green-100 text-green-700 border border-green-300";
        } else if (est.includes("cancel")) {
          cls =
            "rounded-full px-2 py-1 text-xs font-medium bg-red-100 text-red-700 border border-red-300";
        }
        return <span className={cls}>{row.original.estado}</span>;
      },
    },
    {
      header: "Total",
      meta: { headerAlign: "right" },
      cell: ({ row }) => (
        <span className="block text-right">
          ${fmtPrice(row.original.total, { minFraction: 2, maxFraction: 2 })}
        </span>
      ),
    },
    {
      header: "Acciones",
      cell: ({ row }) => (
        <button
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
          onClick={() => {
            // abrimos modal preventa genérico para ver historial también
            setOpenViewPreventa(row.original.id);
          }}
        >
          <Eye className="h-3.5 w-3.5" /> Ver
        </button>
      ),
    },
  ];

  /* Columnas Pre-Ventas Pendientes */
  const columnsPreVentas: ColumnDef<VentaRow>[] = [
    { header: "N° Venta", accessorKey: "id" },
    { header: "Cliente", accessorKey: "cliente" },
    { header: "Fecha", accessorKey: "fecha" },
    {
      header: "Estado",
      cell: ({ row }) => {
        const raw = row.original.estado || "Pendiente";
        const norm = raw.toLowerCase().replace(/[\s_]+/g, "");

        let cls = "bg-blue-100 text-blue-800";
        if (norm.includes("pend")) {
          cls = "bg-yellow-100 text-yellow-800";
        } else if (norm.includes("finaliz") || norm.includes("cerrad")) {
          cls = "bg-green-100 text-green-800";
        } else if (norm.includes("cancel")) {
          cls = "bg-red-100 text-red-800";
        } else if (norm.includes("reserv")) {
          cls = "bg-purple-100 text-purple-800";
        }

        let extra: string | null = null;
        let extraCls = "";
        if (norm.includes("reserv")) {
          const limStr = row.original.fechaReservaLimite
            ? String(row.original.fechaReservaLimite).slice(0, 10)
            : null;
          const d = new Date();
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const hoyYmd = `${y}-${m}-${day}`;
          if (limStr && limStr < hoyYmd) {
            extra = "Reserva vencida";
            extraCls =
              "rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px]";
          } else if (limStr && limStr === hoyYmd) {
            extra = "Retiro del día";
            extraCls =
              "rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px]";
          }
        }

        return (
          <span
            className={`inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium ${cls}`}
          >
            <span>{raw}</span>
            {extra && <span className={extraCls}>{extra}</span>}
          </span>
        );
      },
    },

    {
      header: "Total",
      meta: { headerAlign: "right" },
      cell: ({ row }) => (
        <span className="block text-right">
          ${fmtPrice(row.original.total, { minFraction: 2, maxFraction: 2 })}
        </span>
      ),
    },
    {
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
            onClick={() => setOpenViewPreventa(row.original.id)}
          >
            <Eye className="h-3.5 w-3.5" /> Ver
          </button>

          <button
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-blue-700 border-blue-700"
            onClick={() => setOpenValidate(row.original.id)}
          >
            Validar
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Gestión de Ventas</h1>
        {/**
         * Botón "+ Registrar Nueva Venta" comentado por solicitud
         */}
        {/*
        <button
          onClick={() => setOpenNuevaVenta(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
        >
          <Plus className="h-4 w-4" />
          <span>Registrar Nueva Venta</span>
        </button>
        */}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab("preventas")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "preventas"
              ? "border-b-2 border-black text-black"
              : "text-gray-500"
          }`}
        >
          Presupuestos Pendientes
        </button>
        {canViewVencidos && (
          <button
            onClick={() => setTab("vencidos")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "vencidos"
                ? "border-b-2 border-black text-black"
                : "text-gray-500"
            }`}
          >
            Vencidos
          </button>
        )}
        <button
          onClick={() => setTab("ventas")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "ventas"
              ? "border-b-2 border-black text-black"
              : "text-gray-500"
          }`}
        >
          Ventas
        </button>
      </div>

      {/* Buscador + botón de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64 sm:w-72 md:w-80 lg:w-96 xl:w-[32rem] flex-1 min-w-[14rem]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
            placeholder={
              tab === "ventas"
                ? "Buscar por cliente o método de pago..."
                : "Buscar por cliente o método de pago..."
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQ("");
            }}
          />
        </div>
        <button
          className="rounded border px-3 py-2 text-sm"
          onClick={() => setOpenFiltros(true)}
        >
          Filtros
        </button>
        <span className="ml-auto text-xs text-gray-600">
          {tab === "ventas"
            ? `Mostrando ${
                venTotal === 0 ? 0 : venStart + 1
              }–${venEnd} de ${venTotal}`
            : tab === "vencidos"
            ? `Mostrando ${
                vencTotal === 0 ? 0 : vencStart + 1
              }–${vencEnd} de ${vencTotal}`
            : `Mostrando ${
                preTotal === 0 ? 0 : preStart + 1
              }–${preEnd} de ${preTotal}`}
        </span>
      </div>

      {/* Popup de filtros */}
      {openFiltros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg md:max-w-xl lg:max-w-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-medium">
                {tab === "ventas"
                  ? "Filtros de Ventas"
                  : "Filtros de Presupuestos"}
              </h2>
              <button
                className="rounded border px-2 py-1 text-xs"
                onClick={() => setOpenFiltros(false)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              {tab === "preventas" ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Estado</span>
                    {(() => {
                      const preEstadoSel:
                        | "todas"
                        | "pendiente"
                        | "reservado"
                        | "listocaja"
                        | "vencido" =
                        preEstados.length === 1
                          ? (preEstados[0] as
                              | "pendiente"
                              | "reservado"
                              | "listocaja"
                              | "vencido")
                          : "todas";
                      return (
                        <>
                          <select
                            className="rounded border px-2 py-1"
                            value={preEstadoSel}
                            onChange={(e) => {
                              const val = e.target.value as
                                | "todas"
                                | "pendiente"
                                | "reservado"
                                | "listocaja"
                                | "vencido";
                              const next =
                                val === "todas"
                                  ? ["pendiente", "reservado", "listocaja"]
                                  : [val];
                              setPreEstados(next);
                              setPrePage(1);
                            }}
                          >
                            <option value="todas">
                              Pendiente / Reservado / ListoCaja
                            </option>
                            <option value="pendiente">Solo Pendiente</option>
                            <option value="reservado">Solo Reservado</option>
                            <option value="listocaja">Solo ListoCaja</option>
                            {/* "Vencido" no se muestra en esta pestaña */}
                          </select>
                          <span className="text-gray-600 ml-auto">Orden</span>
                          <select
                            className="rounded border px-2 py-1"
                            value={preSort}
                            onChange={(e) =>
                              setPreSort(e.target.value as "asc" | "desc")
                            }
                          >
                            <option value="desc">Descendente</option>
                            <option value="asc">Ascendente</option>
                          </select>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Fecha desde</span>
                    <input
                      type="date"
                      className="rounded border px-2 py-1"
                      value={preDesde}
                      onChange={(e) => {
                        setPreDesde(e.target.value);
                        setPrePage(1);
                      }}
                    />
                    <span className="text-gray-600">hasta</span>
                    <input
                      type="date"
                      className="rounded border px-2 py-1"
                      value={preHasta}
                      onChange={(e) => {
                        setPreHasta(e.target.value);
                        setPrePage(1);
                      }}
                    />
                  </div>
                </>
              ) : tab === "ventas" ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Estado</span>
                    <select
                      className="rounded border px-2 py-1"
                      value={venEstadoSel}
                      onChange={(e) => {
                        const val = e.target.value as
                          | "todas"
                          | "finalizada"
                          | "cancelada";
                        const next =
                          val === "todas" ? ["finalizada", "cancelada"] : [val];
                        setVenEstados(next);
                        setVenPage(1);
                      }}
                    >
                      <option value="todas">Finalizada o Cancelada</option>
                      <option value="finalizada">Solo Finalizada</option>
                      <option value="cancelada">Solo Cancelada</option>
                    </select>
                    <span className="text-gray-600 ml-auto">Orden</span>
                    <select
                      className="rounded border px-2 py-1"
                      value={venSort}
                      onChange={(e) =>
                        setVenSort(e.target.value as "asc" | "desc")
                      }
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
                      value={venDesde}
                      onChange={(e) => {
                        setVenDesde(e.target.value);
                        setVenPage(1);
                      }}
                    />
                    <span className="text-gray-600">hasta</span>
                    <input
                      type="date"
                      className="rounded border px-2 py-1"
                      value={venHasta}
                      onChange={(e) => {
                        setVenHasta(e.target.value);
                        setVenPage(1);
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Fecha desde</span>
                    <input
                      type="date"
                      className="rounded border px-2 py-1"
                      value={preDesde}
                      onChange={(e) => {
                        setPreDesde(e.target.value);
                        setVencPage(1);
                      }}
                    />
                    <span className="text-gray-600">hasta</span>
                    <input
                      type="date"
                      className="rounded border px-2 py-1"
                      value={preHasta}
                      onChange={(e) => {
                        setPreHasta(e.target.value);
                        setVencPage(1);
                      }}
                    />
                    <span className="text-gray-600 ml-auto">Orden</span>
                    <select
                      className="rounded border px-2 py-1"
                      value={preSort}
                      onChange={(e) =>
                        setPreSort(e.target.value as "asc" | "desc")
                      }
                    >
                      <option value="desc">Descendente</option>
                      <option value="asc">Ascendente</option>
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm"
                onClick={() => {
                  if (tab === "preventas") {
                    setPreEstados(["pendiente", "reservado", "listocaja"]);
                    setPreDesde("");
                    setPreHasta("");
                    setPrePage(1);
                    setPreSort("desc");
                  } else if (tab === "ventas") {
                    setVenEstados(["finalizada", "cancelada"]);
                    setVenDesde("");
                    setVenHasta("");
                    setVenPage(1);
                    setVenSort("desc");
                  } else {
                    setPreDesde("");
                    setPreHasta("");
                    setVencPage(1);
                    setPreSort("desc");
                  }
                }}
              >
                <X className="h-3.5 w-3.5" /> Borrar filtros
              </button>
              <button
                className="rounded border px-3 py-1 text-sm"
                onClick={() => setOpenFiltros(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="rounded-xl border bg-white p-6 text-sm">Cargando…</div>
      ) : (
        <DataTable
          columns={tab === "ventas" ? columnsVentas : columnsPreVentas}
          data={
            tab === "ventas"
              ? venPageRows
              : tab === "vencidos" && canViewVencidos
              ? vencPageRows
              : prePageRows
          }
        />
      )}

      {/* Paginación */}
      {!loading && (
        <div className="flex items-center justify-between mt-2 text-sm">
          {tab === "preventas" ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  className="border px-2 py-1 rounded disabled:opacity-50"
                  onClick={() => setPrePage((p) => Math.max(1, p - 1))}
                  disabled={preSafePage <= 1}
                >
                  Anterior
                </button>
                <button
                  className="border px-2 py-1 rounded disabled:opacity-50"
                  onClick={() =>
                    setPrePage((p) => Math.min(preTotalPages, p + 1))
                  }
                  disabled={preSafePage >= preTotalPages}
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
                  max={preTotalPages}
                  value={preSafePage}
                  onChange={(e) => {
                    const v = Math.max(
                      1,
                      Math.min(preTotalPages, Number(e.target.value) || 1)
                    );
                    setPrePage(v);
                  }}
                />
                <span>de {preTotalPages}</span>
              </div>
            </>
          ) : tab === "ventas" ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  className="border px-2 py-1 rounded disabled:opacity-50"
                  onClick={() => setVenPage((p) => Math.max(1, p - 1))}
                  disabled={venSafePage <= 1}
                >
                  Anterior
                </button>
                <button
                  className="border px-2 py-1 rounded disabled:opacity-50"
                  onClick={() =>
                    setVenPage((p) => Math.min(venTotalPages, p + 1))
                  }
                  disabled={venSafePage >= venTotalPages}
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
                  max={venTotalPages}
                  value={venSafePage}
                  onChange={(e) => {
                    const v = Math.max(
                      1,
                      Math.min(venTotalPages, Number(e.target.value) || 1)
                    );
                    setVenPage(v);
                  }}
                />
                <span>de {venTotalPages}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  className="border px-2 py-1 rounded disabled:opacity-50"
                  onClick={() => setVencPage((p) => Math.max(1, p - 1))}
                  disabled={vencSafePage <= 1}
                >
                  Anterior
                </button>
                <button
                  className="border px-2 py-1 rounded disabled:opacity-50"
                  onClick={() =>
                    setVencPage((p) => Math.min(vencTotalPages, p + 1))
                  }
                  disabled={vencSafePage >= vencTotalPages}
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
                  max={vencTotalPages}
                  value={vencSafePage}
                  onChange={(e) => {
                    const v = Math.max(
                      1,
                      Math.min(vencTotalPages, Number(e.target.value) || 1)
                    );
                    setVencPage(v);
                  }}
                />
                <span>de {vencTotalPages}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal Nueva Venta */}
      {openNuevaVenta && (
        <VentaPopup onClose={() => setOpenNuevaVenta(false)} />
      )}

      {/* Modal ver preventa */}
      {openViewPreventa !== null && (
        <PreventaView
          id={openViewPreventa}
          onClose={async () => {
            setOpenViewPreventa(null);
            // refrescamos ambas listas al cerrar, por si cambió estado
            await loadData(q);
          }}
        />
      )}

      {/* Modal Validar preventa */}
      {openValidate !== null && (
        <ValidarPreventaModal
          id={openValidate}
          onClose={() => setOpenValidate(null)}
          onDone={async () => {
            setOpenValidate(null);
            await loadData(q); // recarga preventas Pendiente
          }}
        />
      )}
    </section>
  );
}

/* Popup Registrar Nueva Venta */
function VentaPopup({ onClose }: { onClose: () => void }) {
  const IVA = 0.21;

  type Item = {
    id: number;
    producto: string;
    cantidad: number;
    precio: number;
    descuento: number;
  };
  const [items] = useState<Item[]>([
    {
      id: 1,
      producto: "Ovillo Merino 100 g",
      cantidad: 2,
      precio: 3999,
      descuento: 0,
    },
    {
      id: 2,
      producto: "Agujas 4 mm",
      cantidad: 1,
      precio: 1999,
      descuento: 5,
    },
  ]);

  const descuentosCliente: Record<string, number> = {
    "Juan Pérez": 5,
    "Ana Gómez": 0,
    "María López": 12,
  };
  const [cliente, setCliente] = useState("Juan Pérez");
  const clienteDesc = descuentosCliente[cliente] ?? 0;

  const [metodo, setMetodo] = useState("Efectivo");
  const [estadoPago, setEstadoPago] = useState<"Pendiente" | "Finalizado">(
    "Pendiente"
  );
  const [moneda, setMoneda] = useState("ARS");
  // setters no utilizados en este popup: solo usamos valores por defecto
  const [ajuste] = useState<number>(0);
  const [descGeneral] = useState<number>(0);
  const [obs, setObs] = useState("");

  const rawIncl = items.reduce((a, i) => a + i.cantidad * i.precio, 0);
  const lineDisc = items.reduce(
    (a, i) => a + i.cantidad * i.precio * ((i.descuento || 0) / 100),
    0
  );
  const afterLine = rawIncl - lineDisc;
  const clientDiscAmt = afterLine * (clienteDesc / 100);
  const afterClient = afterLine - clientDiscAmt;
  const generalDiscAmt = afterClient * (descGeneral / 100);
  const afterAllDiscounts = afterClient - generalDiscAmt;
  const totalFinal = afterAllDiscounts + ajuste;
  const subtotal = totalFinal / (1 + IVA);
  const impuestos = totalFinal - subtotal;
  const descuentosTotales = lineDisc + clientDiscAmt + generalDiscAmt;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-6xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">Registrar Nueva Venta</h3>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-100"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 overflow-auto flex-1 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cliente">Cliente</Label>
                  {clienteDesc > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-md border bg-green-50 text-green-700 px-2 py-0.5 text-xs">
                      Descuento cliente:
                      <span className="ml-1 font-medium">{clienteDesc}%</span>
                    </span>
                  )}
                </div>

                <select
                  id="cliente"
                  className="w-full rounded border px-2 py-2 text-sm"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                >
                  {Object.keys(descuentosCliente).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="pago">Método de pago</Label>
                <select
                  id="pago"
                  className="w-full rounded border px-2 py-2 text-sm"
                  value={metodo}
                  onChange={(e) => setMetodo(e.target.value)}
                >
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>Tarjeta</option>
                </select>
              </div>

              <div>
                <Label htmlFor="estado">Estado de pago</Label>
                <select
                  id="estado"
                  className="w-full rounded border px-2 py-2 text-sm"
                  value={estadoPago}
                  onChange={(e) =>
                    setEstadoPago(e.target.value as "Pendiente" | "Finalizado")
                  }
                >
                  <option>Pendiente</option>
                  <option>Finalizado</option>
                </select>
              </div>

              <div>
                <Label htmlFor="moneda">Unidad monetaria</Label>
                <select
                  id="moneda"
                  className="w-full rounded border px-2 py-2 text-sm"
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                >
                  <option>ARS</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </div>

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

            <div className="rounded-2xl border bg-white p-4 text-sm space-y-1">
              <p className="text-xs text-gray-500">
                Este popup se conectará al backend después.
              </p>
              <p>
                Subtotal sin impuestos: {moneda} ${fmtPrice(subtotal)}
              </p>
              <p>
                Impuestos: {moneda} ${fmtPrice(impuestos)}
              </p>
              <p>
                Total final: {moneda} ${fmtPrice(totalFinal)}
              </p>
              <p className="text-xs text-gray-500">
                Descuentos totales: ${fmtPrice(descuentosTotales)}
              </p>
            </div>

            <div className="flex items-center justify-end">
              <button className="rounded-lg bg-black text-white px-4 py-2">
                Guardar Venta
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* modal eliminado aquí; se añadió dentro de PreventaView */}
    </>
  );
}

/* Modal ver / operar preventa con historial de auditoría */

function PreventaView({ id, onClose }: { id: number; onClose: () => void }) {
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

  // carga venta
  async function loadVenta() {
    setLoadingVenta(true);
    try {
      const { data } = await api.get(`/preventas/${id}`);
      setVenta(data);
    } finally {
      setLoadingVenta(false);
    }
  }

  // carga historial auditoría
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

  const estadoStr =
    venta?.EstadoVenta?.nombreEstadoVenta ??
    (venta?.idEstadoVenta ? `Estado ${venta.idEstadoVenta}` : "-");

  const estadoEsReservado = String(estadoStr || "")
    .toLowerCase()
    .includes("reserv");

  const reservaVencida = (() => {
    try {
      if (!venta?.fechaReservaLimite) return false;
      const limStr = String(venta.fechaReservaLimite).slice(0, 10);
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hoyYmd = `${y}-${m}-${day}`;
      return limStr < hoyYmd;
    } catch {
      return false;
    }
  })();

  const lineItems = venta?.detalles ?? [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-2xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">
              Presupuesto #{id} (solo lectura)
            </h3>
            <button
              onClick={onClose}
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
                      Fecha:{" "}
                      {String(venta?.fechaVenta ?? "").slice(0, 10) || "-"}
                    </span>
                    {estadoEsReservado ? (
                      venta?.fechaReservaLimite ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                            reservaVencida
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          Estado: Reservado hasta {""}
                          {String(venta.fechaReservaLimite).slice(0, 10)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-700 bg-gray-50">
                          Estado: Reservado (sin vencimiento)
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-700 bg-gray-50">
                        Estado: {estadoStr}
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
                      (() => {
                        const tot = venta?.totales;
                        if (tot) return Number(tot.totalFinal ?? 0);
                        const bruto = (lineItems ?? []).reduce(
                          (acc: number, d: any) => {
                            const cant = Number(d.cantidad ?? 0);
                            const puBase = Number(
                              d.precioUnit ??
                                d.Producto?.precioVentaPublicoProducto ??
                                0
                            );
                            const descPct = Number(d.descuentoItem ?? 0) / 100;
                            const puFinal = puBase * (1 - descPct);
                            return acc + cant * puFinal;
                          },
                          0
                        );
                        const descGPercent =
                          Number(
                            venta?.descuentoGeneralVenta ??
                              venta?.descuentoGeneral ??
                              0
                          ) / 100;
                        const recargoPercent =
                          Number(
                            venta?.recargoPagoVenta ?? venta?.recargoPago ?? 0
                          ) / 100;
                        const trasDescuento = bruto * (1 - descGPercent);
                        const finalFallback =
                          trasDescuento * (1 + recargoPercent);
                        return finalFallback;
                      })()
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
                      <div>
                        <p className="text-gray-500 text-xs">Estado de pago</p>
                        <p className="font-medium">
                          {venta?.estadoPago ?? "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Fecha de cobro</p>
                        <p className="font-medium">
                          {String(venta?.fechaCobroVenta ?? "").slice(0, 10) ||
                            "-"}
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
                      <th className="px-2 py-2 text-right">Desc %</th>
                      <th className="px-2 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingVenta ? (
                      <tr>
                        <td
                          className="px-2 py-4 text-center text-gray-500"
                          colSpan={5}
                        >
                          Cargando productos...
                        </td>
                      </tr>
                    ) : lineItems.length > 0 ? (
                      lineItems.map((d: any, idx: number) => {
                        const cant = Number(d.cantidad ?? 0);
                        const puBase = Number(
                          d.precioUnit ??
                            d.Producto?.precioVentaPublicoProducto ??
                            0
                        );
                        const descPct = Number(d.descuentoItem ?? 0);
                        const puFinal = puBase * (1 - (descPct || 0) / 100);
                        const subtotal = cant * puFinal;
                        return (
                          <tr key={idx} className="border-t">
                            <td className="px-2 py-2">
                              {d.Producto?.codigoProducto ?? ""} —{" "}
                              {d.Producto?.nombreProducto ?? ""}
                            </td>
                            <td className="px-2 py-2 text-right">{cant}</td>
                            <td className="px-2 py-2 text-right">
                              {descPct > 0 ? (
                                <div className="flex flex-col items-end">
                                  <span className="line-through text-gray-400">
                                    $
                                    {fmtPrice(puBase, {
                                      minFraction: 2,
                                      maxFraction: 2,
                                    })}
                                  </span>
                                  <span className="text-green-700 font-medium">
                                    $
                                    {fmtPrice(puFinal, {
                                      minFraction: 2,
                                      maxFraction: 2,
                                    })}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  $
                                  {fmtPrice(puBase, {
                                    minFraction: 2,
                                    maxFraction: 2,
                                  })}
                                </>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right">
                              {descPct > 0 ? `-${descPct}%` : "-"}
                            </td>
                            <td className="px-2 py-2 text-right">
                              $
                              {fmtPrice(subtotal, {
                                minFraction: 2,
                                maxFraction: 2,
                              })}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          className="px-2 py-4 text-center text-gray-500"
                          colSpan={5}
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
            <div className="rounded-xl border bg-white p-3 mt-4">
              <p className="text-gray-700 font-medium mb-2">Resumen</p>
              {loadingVenta ? (
                <div className="text-sm text-gray-500">Cargando resumen…</div>
              ) : (
                (() => {
                  const tot = venta?.totales;
                  const IVA = 0.21;
                  let subtotalSinIVA: number;
                  let impuestos: number;
                  let totalFinal: number;
                  let baseArticulos: number;
                  let descuentoGeneralMonto = 0;
                  let recargoPagoMonto = 0;
                  const descGPercent =
                    Number(
                      venta?.descuentoGeneralVenta ??
                        venta?.descuentoGeneral ??
                        0
                    ) / 100;
                  const recargoPercent =
                    Number(venta?.recargoPagoVenta ?? venta?.recargoPago ?? 0) /
                    100;

                  if (tot) {
                    subtotalSinIVA = Number(tot.importeNeto ?? 0);
                    impuestos = Number(tot.impuesto ?? 0);
                    totalFinal = Number(tot.totalFinal ?? 0);
                    baseArticulos = Number(tot.importeArticulos ?? 0);
                    descuentoGeneralMonto = baseArticulos * descGPercent;
                    const trasDescuento = baseArticulos * (1 - descGPercent);
                    recargoPagoMonto = trasDescuento * recargoPercent;
                  } else {
                    const bruto = (lineItems ?? []).reduce(
                      (acc: number, d: any) => {
                        const cant = Number(d.cantidad ?? 0);
                        const puBase = Number(
                          d.precioUnit ??
                            d.Producto?.precioVentaPublicoProducto ??
                            0
                        );
                        const descPct = Number(d.descuentoItem ?? 0) / 100;
                        const puFinal = puBase * (1 - descPct);
                        return acc + cant * puFinal;
                      },
                      0
                    );
                    baseArticulos = bruto;
                    descuentoGeneralMonto = baseArticulos * descGPercent;
                    const trasDescuento = baseArticulos * (1 - descGPercent);
                    recargoPagoMonto = trasDescuento * recargoPercent;
                    const finalFallback = trasDescuento * (1 + recargoPercent);
                    subtotalSinIVA = finalFallback / (1 + IVA);
                    impuestos = finalFallback - subtotalSinIVA;
                    totalFinal = finalFallback;
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">
                          Subtotal (sin impuestos)
                        </p>
                        <p className="text-xl font-semibold">
                          ${fmtPrice(subtotalSinIVA)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Impuestos (IVA)</p>
                        <p className="text-xl font-semibold">
                          ${fmtPrice(impuestos)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total</p>
                        <p className="text-xl font-semibold">
                          ${fmtPrice(totalFinal)}
                        </p>
                      </div>
                      <div className="sm:col-span-3 border-t pt-2 mt-2">
                        <div className="flex flex-wrap items-center justify-between text-xs">
                          <span className="text-gray-600">
                            Base artículos (con descuentos por ítem)
                          </span>
                          <span className="font-medium">
                            ${fmtPrice(baseArticulos)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between text-xs mt-1">
                          <span className="text-gray-600">
                            Descuento general{" "}
                            {descGPercent > 0
                              ? `(${Math.round(descGPercent * 100)}%)`
                              : ""}
                          </span>
                          <span className="font-medium text-green-700">
                            −${fmtPrice(descuentoGeneralMonto)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between text-xs mt-1">
                          <span className="text-gray-600">
                            Recargo método de pago{" "}
                            {recargoPercent > 0
                              ? `(${Math.round(recargoPercent * 100)}%)`
                              : ""}
                          </span>
                          <span className="font-medium text-orange-700">
                            +${fmtPrice(recargoPagoMonto)}
                          </span>
                        </div>
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
                        <td className="px-2 py-3 text-gray-600" colSpan={4}>
                          Cargando…
                        </td>
                      </tr>
                    ) : hist.length === 0 ? (
                      <tr>
                        <td className="px-2 py-3 text-gray-600" colSpan={4}>
                          Sin movimientos de estado.
                        </td>
                      </tr>
                    ) : (
                      hist.map((ev, idx) => (
                        <tr
                          key={ev.id}
                          className={idx % 2 ? "bg-gray-50" : undefined}
                        >
                          <td className="px-2 py-2">{ev.fecha}</td>
                          <td className="px-2 py-2">
                            {ev.desde ? `${ev.desde} → ${ev.hasta}` : ev.hasta}
                          </td>
                          <td className="px-2 py-2">{ev.motivo ?? "-"}</td>
                          <td className="px-2 py-2">
                            {ev.usuario
                              ? ev.usuario.nombreUsuario ||
                                ev.usuario.emailUsuario
                              : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-xs font-medium bg-white"
              type="button"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
      {/* Modal de postergar se maneja en ValidarPreventaModal */}
    </>
  );
}

/* Modal Validar Pre-venta */
function ValidarPreventaModal({
  id,
  onClose,
  onDone,
}: {
  id: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { hasRole } = useAuth();
  const [ventaId, setVentaId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // data base de la venta
  const [venta, setVenta] = useState<any>(null);

  // catálogos normalizados
  const [clientes, setClientes] = useState<
    { idCliente: number; apellidoCliente: string; nombreCliente: string }[]
  >([]);
  const [tiposPago, setTiposPago] = useState<
    { idTipoPago: number; tipoPago: string }[]
  >([]);
  const [monedas, setMonedas] = useState<
    { idMoneda: number; moneda: string; precio: number }[]
  >([]);
  const { fmtVisual } = useMonedas();

  // form state
  const [idCliente, setIdCliente] = useState<number | "">("");
  const [idTipoPago, setIdTipoPago] = useState<number | "">("");
  const [idMoneda, setIdMoneda] = useState<number | "">("");

  const [fechaFacturacion, setFechaFacturacion] = useState<string>("");
  const [fechaCobro, setFechaCobro] = useState<string>("");

  const [observacion, setObservacion] = useState<string>("");

  const [descuentoGeneral, setDescuentoGeneral] = useState<number>(0);
  const [ajuste, setAjuste] = useState<number>(0);
  const [recargoPago, setRecargoPago] = useState<number>(0);
  const [comentarioCajero, setComentarioCajero] = useState<string>("");

  const monedaSel = monedas.find((m) => m.idMoneda === idMoneda);
  const esARS =
    String(monedaSel?.moneda ?? "")
      .toUpperCase()
      .includes("ARS") ||
    String(monedaSel?.moneda ?? "")
      .toUpperCase()
      .includes("PESO");
  const tipoCambioVisual = esARS ? 1 : monedaSel?.precio ?? 1;
  const fmtV = (
    n: number,
    opts?: { minFraction?: number; maxFraction?: number }
  ) => fmtVisual(Number(n || 0), monedaSel?.moneda ?? "ARS", opts);

  // estado actual de la preventa (Pendiente, ListoCaja, Finalizada, Cancelada)
  const estadoActual = venta?.EstadoVenta?.nombreEstadoVenta ?? "Pendiente";
  const estadoNorm = estadoActual.toLowerCase().replace(/[\s_]+/g, "");
  const isPendiente = estadoNorm === "pendiente";
  const isReservado = estadoNorm === "reservado";
  const isListoCaja = estadoNorm.includes("listocaja");
  const puedeEditarListoCaja =
    isListoCaja && (hasRole("Administrador") || hasRole("Cajero"));
  const canSave = puedeEditarListoCaja;
  const [openPostergar, setOpenPostergar] = useState(false);
  const [postergarFecha, setPostergarFecha] = useState("");

  async function postergarReserva() {
    if (!hasRole("Administrador") && !hasRole("Cajero")) return;
    setPostergarFecha("");
    setOpenPostergar(true);
  }

  async function confirmarPostergar() {
    if (!hasRole("Administrador") && !hasRole("Cajero")) return;
    const idTarget = venta?.idVenta ?? id;
    if (!postergarFecha || postergarFecha.trim() === "") {
      await showAlert({
        type: "warning",
        title: "Falta fecha",
        message: "Selecciona una nueva fecha límite.",
      });
      return;
    }
    const motivo = await askText({
      title: "Motivo de postergación",
      label: "Describe el motivo",
      placeholder: "Ej: cliente solicita extender el retiro",
      confirmText: "Aceptar",
      cancelText: "Volver",
      required: true,
    });
    if (motivo === null) return;
    try {
      await api.put(`/preventas/${idTarget}/reserva`, {
        fechaReservaLimite: postergarFecha.trim(),
        motivo,
      });
      setFechaCobro(postergarFecha.trim());
      setOpenPostergar(false);
      await showAlert({
        type: "success",
        title: "Reserva postergada",
        message: `Nueva fecha: ${postergarFecha.trim()}. Se actualizó la fecha de cobro.`,
      });
    } catch (err: any) {
      await showAlert({
        type: "error",
        title: "Error",
        message:
          err?.response?.data?.error || err?.message || "No se pudo postergar",
      });
    }
  }

  // sincronizar ventaId local con prop
  useEffect(() => {
    setVentaId(id);
  }, [id]);

  // cargar todo al abrir / cuando cambia ventaId
  useEffect(() => {
    if (!ventaId) return;
    (async () => {
      setLoading(true);
      try {
        const [resVenta, resClientes, resTiposPago, resMonedas] =
          await Promise.all([
            api.get(`/preventas/${ventaId}`),
            api.get("/clientes"),
            api.get("/tipos-pago"),
            api.get("/monedas"),
          ]);

        const v = resVenta.data;
        const hoy = new Date().toISOString().slice(0, 10);

        // guardar venta completa
        setVenta(v);

        // inicializar form con los valores de la preventa
        setIdCliente(v.idCliente ?? v.Cliente?.idCliente ?? "");
        setIdTipoPago(v.idTipoPago ?? v.TipoPago?.idTipoPago ?? "");
        // Forzar ARS
        const mons = (resMonedas.data ?? []) as {
          idMoneda: number;
          moneda: string;
        }[];
        const ars = mons.find((m) => String(m.moneda).toUpperCase() === "ARS");
        const idArs = ars?.idMoneda ?? v.idMoneda ?? v.Moneda?.idMoneda ?? "";
        setIdMoneda(idArs);

        setFechaFacturacion(
          v.fechaVenta ? String(v.fechaVenta).slice(0, 10) : hoy
        );
        setFechaCobro(
          v.fechaCobroVenta ? String(v.fechaCobroVenta).slice(0, 10) : hoy
        );

        setObservacion(v.observacion ?? "");

        // normalizar números provenientes del backend
        setDescuentoGeneral(Number(v.descuentoGeneralVenta ?? 0));
        setAjuste(Number(v.ajusteVenta ?? 0));
        setRecargoPago(Number(v.recargoPagoVenta ?? 0));

        // catálogos ya estandarizados del backend
        setClientes(resClientes.data ?? []);
        setTiposPago(resTiposPago.data ?? []);
        setMonedas(resMonedas.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [ventaId]);

  async function submit(accion: "guardar" | "finalizar" | "cancelar") {
    setSaving(true);
    try {
      if (accion === "guardar") {
        console.log("CLICK GUARDAR", { estado: estadoActual, ventaId: id });
        const detalles: any[] = Array.isArray(venta?.detalles)
          ? venta.detalles
          : [];
        const tieneCantidadCero = detalles.some(
          (d: any) => Number(d.cantidad ?? 0) <= 0
        );
        if (tieneCantidadCero) {
          await showAlert({
            type: "warning",
            title: "Validación",
            message: "La cantidad de cada producto debe ser mayor a 0.",
          });
          setSaving(false);
          return;
        }
      }
      if (accion === "finalizar") {
        const detalles: any[] = Array.isArray(venta?.detalles)
          ? venta.detalles
          : [];
        const tieneCantidadCero = detalles.some(
          (d: any) => Number(d.cantidad ?? 0) <= 0
        );
        if (tieneCantidadCero) {
          await showAlert({
            type: "warning",
            title: "Validación",
            message:
              "La cantidad de cada producto debe ser mayor a 0. Guardá los cambios antes de finalizar.",
          });
          setSaving(false);
          return;
        }
      }
      // Congelar descuentos: enviar el descuento ya guardado por línea, sin recalcular ofertas
      const items = (venta?.detalles ?? [])
        .map((d: any) => {
          const idProducto = Number(d.idProducto ?? d.Producto?.idProducto);
          const cantidad = Number(d.cantidad ?? 0);
          if (!idProducto || cantidad <= 0) return null;
          const precioUnit = Number(
            d.precioUnit ?? d.Producto?.precioVentaPublicoProducto ?? 0
          );
          const descuentoItem = Number(d.descuentoItem ?? 0);
          return { idProducto, cantidad, precioUnit, descuentoItem };
        })
        .filter(Boolean) as {
        idProducto: number;
        cantidad: number;
        precioUnit: number;
        descuentoItem: number;
      }[];

      // Payload básico. En "guardar" NO enviar descuentoGeneral/ajuste/recargoPago.
      const payload: any = {
        accion,
        ...(accion === "guardar" && { items }),
        idCliente: idCliente === "" ? null : idCliente,
        idTipoPago: idTipoPago === "" ? null : idTipoPago,
        idMoneda: idMoneda === "" ? null : idMoneda,
        fechaFacturacion,
        fechaCobro,
        observacion,
        ...(accion !== "cancelar" &&
          comentarioCajero.trim().length > 0 && { comentarioCajero }),
      };

      if (accion === "cancelar") {
        const motivo = await askText({
          title: "Cancelar presupuesto",
          label: "Motivo de cancelación",
          placeholder: "Ingresa un motivo (opcional)",
          confirmText: "Cancelar presupuesto",
          cancelText: "Volver",
          required: false,
        });
        if (motivo === null) {
          setSaving(false);
          return; // cancelado por usuario
        }
        payload.motivoCancelacion = motivo && motivo.length > 0 ? motivo : null;
      }

      await api.put(`/preventas/${ventaId}`, payload);
      if (accion === "cancelar") {
        await showAlert({
          type: "success",
          title: "Éxito",
          message: "Presupuesto cancelado con éxito",
        });
      }

      // Refresco duro tras cualquier PUT para recalcular flags con estado normalizado
      const resVenta = await api.get(`/preventas/${ventaId}`);
      setVenta(resVenta.data);

      // Si la acción fue finalizar, cerrar oferta de productos cuyo stock quedó en 0
      if (accion === "finalizar") {
        try {
          const detalles: any[] = Array.isArray(resVenta.data?.detalles)
            ? resVenta.data.detalles
            : [];
          await Promise.all(
            detalles.map(async (d: any) => {
              const idProducto = Number(d.idProducto ?? d.Producto?.idProducto);
              if (!idProducto) return;
              const [prodRes, stockRes] = await Promise.all([
                api.get(`/products/${idProducto}`),
                api.get(`/products/${idProducto}/stock`),
              ]);
              const p = prodRes.data ?? {};
              const ofertaFlag = Boolean(p?.oferta ?? p?.ofertaProducto);
              const pct = Number(
                p?.porcentajeOferta ?? p?.porcentajeOfertaProducto ?? 0
              );
              const ini = p?.fechaInicioOferta
                ? new Date(p.fechaInicioOferta).getTime()
                : null;
              const fin = p?.fechaFinOferta
                ? new Date(p.fechaFinOferta).getTime()
                : null;
              const now = Date.now();
              const activo =
                ofertaFlag &&
                pct > 0 &&
                (!ini || ini <= now) &&
                (!fin || fin >= now);
              const stockActual = Number(
                (stockRes.data ?? {})?.cantidadRealStock ??
                  (stockRes.data ?? {})?.real ??
                  p?.stock ??
                  0
              );
              if (activo && stockActual === 0) {
                await api.put(`/products/${idProducto}`, {
                  oferta: false,
                  porcentajeOferta: null,
                  fechaFinOferta: new Date().toISOString(),
                });
              }
            })
          );
        } catch (err) {
          console.warn(
            "No se pudo sincronizar cierre de oferta tras finalizar venta",
            err
          );
        }
        await showAlert({
          type: "success",
          title: "Venta finalizada",
          message: `Venta finalizada con éxito. Total: $${fmtPrice(
            totalConAjustes,
            { minFraction: 2, maxFraction: 2 }
          )}`,
        });
      }

      if (accion === "guardar") {
        if (isListoCaja) {
          await showAlert({
            type: "success",
            title: "Cambios guardados",
            message: `Se guardaron cambios de caja. Total: $${fmtPrice(
              totalConAjustes,
              { minFraction: 2, maxFraction: 2 }
            )}`,
          });
        }
        setSaving(false);
        return;
      }

      // "finalizar" o "cancelar" -> cerrar y recargar listas en el padre
      onDone();
      setSaving(false);
    } catch (err) {
      console.error(err);
      const raw =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Error al actualizar";
      const msg =
        String(raw) === "ESTADO_INVALIDO"
          ? "La validación no es posible con el estado actual. Pasá a caja nuevamente."
          : String(raw) === "PREVENTA_VENCIDA"
          ? "El presupuesto está vencido. Postergá la reserva o generá uno nuevo."
          : String(raw) === "Network Error"
          ? "Error de red. Verificá la conexión e intentá nuevamente."
          : String(raw);
      await showAlert({ type: "error", title: "Error", message: msg });
      setSaving(false);
    }
  }

  async function lock() {
    const targetId = ventaId ?? id;
    if (!targetId) {
      await showAlert({
        type: "error",
        title: "Error",
        message: "ID de preventa no cargado",
      });
      return;
    }
    setSaving(true);
    try {
      console.log("LOCK click", { targetId, estadoNorm, estadoActual });
      const motivo = await askText({
        title: isReservado ? "Quitar reserva y pasar a caja" : "Pasar a caja",
        label: "Motivo",
        placeholder: "Ingresa un motivo (obligatorio)",
        confirmText: isReservado
          ? "Quitar reserva y pasar a caja"
          : "Pasar a caja",
        cancelText: "Volver",
        required: true,
      });
      if (motivo === null) {
        setSaving(false);
        return;
      }
      const putRes = await api.put(
        `/preventas/${targetId}`,
        { accion: "lock", motivoLock: motivo },
        { headers: { "x-skip-alert": "1" } }
      );
      const updated = putRes?.data;
      console.log("LOCK put response", {
        status: (putRes as any)?.status,
        nuevoEstado: updated?.EstadoVenta?.nombreEstadoVenta,
      });
      // Usar respuesta directa del PUT, que ya incluye EstadoVenta actualizado
      setVenta(updated);
      // Como refuerzo, disparar una lectura sin cache para sincronizar padre si hiciera falta
      await api.get(`/preventas/${targetId}`, { params: { _: Date.now() } });
      // cerrar modal y refrescar listas en el padre para que el cambio se vea inmediatamente
      onDone();
      {
        const estadoNuevo = String(
          updated?.EstadoVenta?.nombreEstadoVenta ?? ""
        ).toLowerCase();
        const msg = isReservado
          ? "Reserva quitada y pasado a caja con éxito"
          : estadoNuevo.includes("listocaja")
          ? "Pasado a caja con éxito"
          : `Estado actualizado: ${
              updated?.EstadoVenta?.nombreEstadoVenta ?? ""
            }`;
        await showAlert({ type: "success", title: "Éxito", message: msg });
      }
    } catch (err) {
      console.error(err);
      const raw =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Error al cerrar y pasar a caja";
      const msg =
        String(raw) === "ESTADO_INVALIDO"
          ? "La preventa está vencida o en un estado inválido para pasar a caja."
          : String(raw) === "RESERVA_VENCIDA"
          ? "La reserva está vencida. No se puede validar. Cancelá o generá una nueva."
          : String(raw) === "PREVENTA_VENCIDA"
          ? "El presupuesto está vencido. Postergá la reserva o generá uno nuevo."
          : String(raw) === "Network Error"
          ? "Error de red. Verificá la conexión e intentá nuevamente."
          : String(raw);
      await showAlert({ type: "error", title: "Error", message: msg });
    } finally {
      setSaving(false);
    }
  }

  // ===== cálculos de la venta =====
  // tu /api/preventas/:id devuelve detalles con:
  //   cantidad        (no cantidadDetalleVenta)
  //   Producto.precioVentaPublicoProducto
  //   Producto.nombreProducto / codigoProducto
  const lineItems = venta?.detalles ?? [];

  // subtotal Bruto (antes de descuentos de caja), usando precioUnit/desc por línea si existen
  const subtotalBruto = lineItems.reduce((acc: number, d: any) => {
    const cant = Number(d.cantidad ?? 0);
    const puBase = Number(
      d.precioUnit ?? d.Producto?.precioVentaPublicoProducto ?? 0
    );
    const descPct = Number(d.descuentoItem ?? 0) / 100;
    const puFinal = puBase * (1 - descPct);
    return acc + cant * puFinal;
  }, 0);

  // aplicar descuentoGeneral (%), ajuste (+/-), recargoPago (+)
  const totalConAjustes =
    subtotalBruto -
    subtotalBruto * (Number(descuentoGeneral) / 100) +
    Number(ajuste) +
    Number(recargoPago);

  const IVA = 0.21;
  const subtotalSinIVA = totalConAjustes / (1 + IVA);
  const impuestos = totalConAjustes - subtotalSinIVA;

  // Stock modal state (apertura manual desde "Productos cargados")
  const [openStock, setOpenStock] = useState(false);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockData, setStockData] = useState<
    {
      idProducto: number;
      nombre: string;
      real: number;
      comprometido: number;
      minimo: number;
      actualizadoEn: string | null;
    }[]
  >([]);

  // Picker de productos para agregar a la preventa
  const [openProdPicker, setOpenProdPicker] = useState(false);
  const [prodQ, setProdQ] = useState("");
  const [prodResults, setProdResults] = useState<any[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);
  const [prodQuantities, setProdQuantities] = useState<Record<number, number>>(
    {}
  );

  useEffect(() => {
    if (!openProdPicker) return;
    const t = setTimeout(async () => {
      setProdLoading(true);
      setProdError(null);
      try {
        const { data } = await api.get("/products", {
          params: prodQ ? { q: prodQ } : undefined,
        });
        setProdResults(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setProdError(
          e?.response?.data?.error || e?.message || "Error al buscar productos"
        );
      } finally {
        setProdLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [openProdPicker, prodQ]);

  async function openStockForLoadedProducts() {
    const detalles = venta?.detalles ?? [];
    setStockError(null);
    setStockLoading(true);
    setOpenStock(true);
    try {
      const list = await Promise.all(
        (Array.isArray(detalles) ? detalles : []).map(async (d: any) => {
          const idProd = Number(d.idProducto ?? d.Producto?.idProducto);
          if (!idProd) return null;
          const nombre =
            d.Producto?.nombreProducto ||
            d.Producto?.codigoProducto ||
            String(idProd);
          const s = await getProductStock(idProd);
          return {
            idProducto: idProd,
            nombre,
            real: s.real,
            comprometido: s.comprometido,
            minimo: s.minimo,
            actualizadoEn: s.actualizadoEn ?? null,
          };
        })
      );
      setStockData(list.filter(Boolean) as any);
    } catch (e: any) {
      setStockError(
        e?.response?.data?.error || e?.message || "No se pudo leer stock"
      );
    } finally {
      setStockLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-4xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">
              Validar Presupuesto #{id}
            </h3>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* body */}
          <div className="flex-1 overflow-auto p-4 text-sm space-y-6">
            {loading ? (
              <div className="text-gray-500">Cargando…</div>
            ) : (
              <>
                {/* Fechas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                      Fecha facturación
                    </label>
                    <input
                      className="w-full rounded border px-2 py-2 text-sm"
                      type="date"
                      value={fechaFacturacion}
                      onChange={(e) => setFechaFacturacion(e.target.value)}
                      disabled={estadoNorm === "pendiente"}
                    />
                    {estadoNorm === "pendiente" && (
                      <p className="text-[10px] text-gray-500">
                        No editable al validar preventas pendientes.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                      Fecha de cobro
                    </label>
                    <input
                      className="w-full rounded border px-2 py-2 text-sm"
                      type="date"
                      value={fechaCobro}
                      onChange={(e) => setFechaCobro(e.target.value)}
                    />
                  </div>
                </div>

                {/* Cliente / pago / moneda */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Cliente */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Cliente</label>
                    <select
                      className="w-full rounded border px-2 py-2 text-sm"
                      value={String(idCliente)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setIdCliente(v === "" ? "" : Number(v));
                      }}
                    >
                      <option key="cli-none" value="">
                        Seleccionar...
                      </option>
                      {clientes.map((c) => (
                        <option key={c.idCliente} value={c.idCliente}>
                          {c.apellidoCliente}, {c.nombreCliente}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Método de pago */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                      Método de pago
                    </label>
                    <select
                      className="w-full rounded border px-2 py-2 text-sm"
                      value={String(idTipoPago)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setIdTipoPago(v === "" ? "" : Number(v));
                      }}
                      disabled={!puedeEditarListoCaja}
                    >
                      <option key="tp-none" value="">
                        Seleccionar...
                      </option>
                      {tiposPago.map((p) => (
                        <option key={p.idTipoPago} value={p.idTipoPago}>
                          {p.tipoPago}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Unidad monetaria */}
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                      Unidad monetaria
                    </label>
                    <select
                      className="w-full rounded border px-2 py-2 text-sm"
                      value={String(idMoneda)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setIdMoneda(v === "" ? "" : Number(v));
                      }}
                      disabled={!puedeEditarListoCaja}
                    >
                      <option key="m-none" value="">
                        Seleccionar...
                      </option>
                      {monedas.map((m) => (
                        <option key={m.idMoneda} value={m.idMoneda}>
                          {m.moneda}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-muted-foreground mt-1">
                      Tipo de cambio (solo visual):{" "}
                      {esARS
                        ? "1"
                        : `1 ${monedaSel?.moneda ?? "USD"} = $${fmtPrice(
                            tipoCambioVisual
                          )}`}
                    </div>
                  </div>
                </div>

                {/* Observación */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">
                    Observación de venta (vendedor)
                  </label>
                  <input
                    className="w-full rounded border px-2 py-2 text-sm bg-gray-100 text-gray-700"
                    readOnly
                    value={observacion}
                    onChange={() => {}}
                  />
                  <p className="text-[10px] text-gray-500">Solo lectura</p>
                </div>

                {/* Comentario del cajero */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium">
                    Comentario del cajero (opcional)
                  </label>
                  <textarea
                    className="w-full rounded border px-2 py-2 text-sm"
                    placeholder="Agrega un comentario si es necesario"
                    value={comentarioCajero}
                    onChange={(e) => setComentarioCajero(e.target.value)}
                  />
                </div>

                {/* Ajustes de caja */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                      Descuento general (%)
                    </label>
                    <input
                      className="w-full rounded border px-2 py-2 text-sm"
                      type="number"
                      value={descuentoGeneral}
                      onChange={(e) =>
                        setDescuentoGeneral(Number(e.target.value || 0))
                      }
                      disabled={!puedeEditarListoCaja}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                      Ajuste (+ / -)
                    </label>
                    <input
                      className="w-full rounded border px-2 py-2 text-sm"
                      type="number"
                      value={ajuste}
                      onChange={(e) => setAjuste(Number(e.target.value || 0))}
                      disabled={!puedeEditarListoCaja}
                    />
                    <p className="text-[10px] text-gray-500">
                      Positivo suma. Negativo resta.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">
                      Recargo crédito / QR
                    </label>
                    <input
                      className="w-full rounded border px-2 py-2 text-sm"
                      type="number"
                      value={recargoPago}
                      onChange={(e) =>
                        setRecargoPago(Number(e.target.value || 0))
                      }
                      disabled={!puedeEditarListoCaja}
                    />
                  </div>
                </div>

                {/* Modal de Stock al cargar productos */}
                <Modal
                  open={openStock}
                  title="Stock de productos cargados"
                  centered
                  onClose={() => setOpenStock(false)}
                >
                  <div className="space-y-3 text-sm">
                    {stockLoading ? (
                      <div className="text-gray-600">Cargando stock…</div>
                    ) : stockError ? (
                      <div className="text-red-700">{stockError}</div>
                    ) : stockData.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {stockData.map((s) => (
                          <div
                            key={s.idProducto}
                            className="rounded-xl border bg-white p-3"
                          >
                            <p className="text-gray-700 text-sm font-medium mb-2">
                              {s.nombre}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-gray-500 text-xs">Real</p>
                                <p className="font-medium">
                                  {fmtPrice(s.real, {
                                    minFraction: 2,
                                    maxFraction: 2,
                                  })}{" "}
                                  g
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">
                                  Comprometido
                                </p>
                                <p className="font-medium">
                                  {fmtPrice(s.comprometido, {
                                    minFraction: 2,
                                    maxFraction: 2,
                                  })}{" "}
                                  g
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">Mínimo</p>
                                <p className="font-medium">
                                  {fmtPrice(s.minimo, {
                                    minFraction: 2,
                                    maxFraction: 2,
                                  })}{" "}
                                  g
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-xs">
                                  Actualizado
                                </p>
                                <p className="font-medium">
                                  {s.actualizadoEn
                                    ? new Date(s.actualizadoEn).toLocaleString()
                                    : "-"}
                                </p>
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

                {/* Productos cargados */}
                <div className="rounded border">
                  <div className="border-b bg-gray-50 px-3 py-2 text-sm font-medium flex items-center justify-between">
                    <span>Productos cargados</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                        onClick={openStockForLoadedProducts}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Ver stock</span>
                      </button>
                      {puedeEditarListoCaja && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                          onClick={() => {
                            setOpenProdPicker(true);
                            setProdQ("");
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Agregar producto</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {openProdPicker && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl">
                        <div className="flex items-center justify-between border-b px-4 py-2">
                          <h2 className="text-sm font-medium">
                            Seleccionar producto
                          </h2>
                          <button
                            className="rounded border px-2 py-1 text-xs"
                            onClick={() => setOpenProdPicker(false)}
                            title="Cerrar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="p-4 space-y-3">
                          <div>
                            <Label htmlFor="buscarProd">Buscar</Label>
                            <input
                              id="buscarProd"
                              type="text"
                              className="rounded border px-2 py-1 w-full"
                              placeholder="Código, nombre o SKU"
                              value={prodQ}
                              onChange={(e) => setProdQ(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Escribe para ver productos existentes. Se muestran
                              precio y oferta vigente.
                            </p>
                          </div>
                          <div className="rounded border">
                            <div className="border-b bg-gray-50 px-3 py-2 text-xs text-gray-600">
                              Resultados
                            </div>
                            <div className="max-h-64 overflow-auto">
                              {prodLoading ? (
                                <div className="p-3 text-sm text-gray-600">
                                  Buscando…
                                </div>
                              ) : prodError ? (
                                <div className="p-3 text-sm text-red-700">
                                  {prodError}
                                </div>
                              ) : prodResults.length === 0 ? (
                                <div className="p-3 text-sm text-gray-600">
                                  No se encontraron productos
                                </div>
                              ) : (
                                <table className="min-w-full text-xs">
                                  <thead className="bg-gray-100 text-left">
                                    <tr>
                                      <th className="px-3 py-2">Código</th>
                                      <th className="px-3 py-2">Nombre</th>
                                      <th className="px-3 py-2 text-right">
                                        Precio
                                      </th>
                                      <th className="px-3 py-2 text-right">
                                        Oferta
                                      </th>
                                      <th className="px-3 py-2 text-center">
                                        Cant.
                                      </th>
                                      <th className="px-3 py-2 text-right">
                                        Acción
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {prodResults.slice(0, 50).map((p: any) => {
                                      const pu = Number(
                                        p.precio ??
                                          p.precioVentaPublicoProducto ??
                                          0
                                      );
                                      const pct = Number(
                                        p.porcentajeOferta ??
                                          p.porcentajeOfertaProducto ??
                                          0
                                      );
                                      const oferta = pct > 0;
                                      const pId = Number(p.idProducto ?? p.id);
                                      const qty = prodQuantities[pId] ?? 1;

                                      return (
                                        <tr key={pId} className="border-t">
                                          <td className="px-3 py-2">
                                            {p.codigoProducto ?? p.sku ?? pId}
                                          </td>
                                          <td className="px-3 py-2">
                                            {p.nombreProducto ?? p.nombre}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            $
                                            {fmtV(
                                              oferta
                                                ? pu * (1 - pct / 100)
                                                : pu,
                                              { minFraction: 2, maxFraction: 2 }
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            {oferta ? `${pct}%` : "-"}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <input
                                              type="number"
                                              min="1"
                                              className="w-16 rounded border px-1 py-0.5 text-center text-xs"
                                              value={qty}
                                              onChange={(e) => {
                                                const val = Math.max(
                                                  1,
                                                  Number(e.target.value) || 1
                                                );
                                                setProdQuantities((prev) => ({
                                                  ...prev,
                                                  [pId]: val,
                                                }));
                                              }}
                                            />
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            <button
                                              type="button"
                                              className="rounded border px-2 py-1 text-xs"
                                              onClick={async () => {
                                                setVenta((prev: any) => {
                                                  const detalles =
                                                    Array.isArray(
                                                      prev?.detalles
                                                    )
                                                      ? [...prev.detalles]
                                                      : [];

                                                  const existingIndex =
                                                    detalles.findIndex(
                                                      (d: any) =>
                                                        Number(
                                                          d.idProducto ??
                                                            d.Producto
                                                              ?.idProducto
                                                        ) === pId
                                                    );

                                                  if (existingIndex >= 0) {
                                                    detalles[existingIndex] = {
                                                      ...detalles[
                                                        existingIndex
                                                      ],
                                                      cantidad:
                                                        Number(
                                                          detalles[
                                                            existingIndex
                                                          ].cantidad
                                                        ) + qty,
                                                    };
                                                  } else {
                                                    detalles.push({
                                                      idProducto: pId,
                                                      cantidad: qty,
                                                      precioUnit: pu,
                                                      descuentoItem: oferta
                                                        ? pct
                                                        : 0,
                                                      Producto: p,
                                                    });
                                                  }
                                                  return { ...prev, detalles };
                                                });
                                                setOpenProdPicker(false);
                                                await showAlert({
                                                  type: "success",
                                                  title: "Producto agregado",
                                                  message: `${
                                                    p.nombreProducto ?? p.nombre
                                                  } añadido a la preventa`,
                                                });
                                              }}
                                            >
                                              Agregar
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-100 text-left">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Producto</th>
                          <th className="px-3 py-2 font-semibold text-right">
                            Cant.
                          </th>
                          <th className="px-3 py-2 font-semibold text-right">
                            Precio
                          </th>
                          <th className="px-3 py-2 font-semibold text-right">
                            Total
                          </th>
                          {canSave && (
                            <th className="px-3 py-2 font-semibold text-right">
                              Acciones
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.length === 0 ? (
                          <tr>
                            <td
                              className="px-3 py-6 text-center text-gray-500"
                              colSpan={canSave ? 5 : 4}
                            >
                              Sin productos agregados
                            </td>
                          </tr>
                        ) : (
                          lineItems.map((d: any, idx: number) => {
                            const cant = Number(d.cantidad ?? 0);
                            const puBase = Number(
                              d.precioUnit ??
                                d.Producto?.precioVentaPublicoProducto ??
                                0
                            );
                            const descPct = Number(d.descuentoItem ?? 0);
                            const puFinal = puBase * (1 - (descPct || 0) / 100);
                            const tot = cant * puFinal;

                            function setCantidad(c: number) {
                              const next = Math.max(0, Number(c || 0));
                              setVenta((prev: any) => {
                                const detalles = Array.isArray(prev?.detalles)
                                  ? [...prev.detalles]
                                  : [];
                                if (detalles[idx]) {
                                  detalles[idx] = {
                                    ...detalles[idx],
                                    cantidad: next,
                                  };
                                }
                                return { ...prev, detalles };
                              });
                            }

                            function eliminarDetalle() {
                              setVenta((prev: any) => {
                                const detalles = Array.isArray(prev?.detalles)
                                  ? prev.detalles.filter(
                                      (_: any, i: number) => i !== idx
                                    )
                                  : [];
                                return { ...prev, detalles };
                              });
                            }

                            return (
                              <tr
                                key={`${
                                  d.idDetalleVenta ?? d.idProducto
                                }-${idx}`}
                                className="border-t"
                              >
                                <td className="px-3 py-2">
                                  {(() => {
                                    const codigo =
                                      d.Producto?.codigoProducto ??
                                      d.Producto?.sku ??
                                      d.Producto?.codigo ??
                                      d.idProducto ??
                                      "";
                                    const nombre =
                                      d.Producto?.nombreProducto ??
                                      d.Producto?.nombre ??
                                      `Producto ${d.idProducto ?? ""}`;
                                    return codigo
                                      ? `${codigo} — ${nombre}`
                                      : nombre;
                                  })()}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {canSave ? (
                                    <input
                                      className="w-20 text-right rounded border px-2 py-1"
                                      type="number"
                                      value={cant}
                                      min={0}
                                      onChange={(e) =>
                                        setCantidad(Number(e.target.value))
                                      }
                                    />
                                  ) : (
                                    cant
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {Number(descPct) > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span className="line-through text-gray-400">
                                        $
                                        {fmtV(puBase, {
                                          minFraction: 2,
                                          maxFraction: 2,
                                        })}
                                      </span>
                                      <span className="text-green-700 font-medium">
                                        $
                                        {fmtV(puFinal, {
                                          minFraction: 2,
                                          maxFraction: 2,
                                        })}
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      $
                                      {fmtV(puBase, {
                                        minFraction: 2,
                                        maxFraction: 2,
                                      })}
                                    </>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  $
                                  {fmtV(tot, {
                                    minFraction: 2,
                                    maxFraction: 2,
                                  })}
                                </td>
                                {canSave && (
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 rounded border px-2 py-1 hover:bg-red-50 hover:text-red-700"
                                      onClick={eliminarDetalle}
                                    >
                                      <X className="h-4 w-4" />
                                      Eliminar
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Resumen final */}
                <div className="rounded border bg-gray-50 p-3 text-xs text-gray-700 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal (sin impuestos)</span>
                    <span className="text-right">
                      $
                      {fmtV(Number(subtotalSinIVA), {
                        minFraction: 2,
                        maxFraction: 2,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Impuestos (IVA)</span>
                    <span className="text-right">
                      $
                      {fmtV(Number(impuestos), {
                        minFraction: 2,
                        maxFraction: 2,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Descuento general (%)</span>
                    <span className="text-right">
                      {Number(descuentoGeneral)}%
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Ajuste (+ / -)</span>
                    <span className="text-right">
                      $
                      {fmtV(Number(ajuste), {
                        minFraction: 2,
                        maxFraction: 2,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Recargo crédito / QR</span>
                    <span className="text-right">
                      $
                      {fmtV(Number(recargoPago), {
                        minFraction: 2,
                        maxFraction: 2,
                      })}
                    </span>
                  </div>

                  <div className="flex justify-between font-semibold">
                    <span>Total final</span>
                    <span className="text-right">
                      $
                      {fmtV(Number(totalConAjustes), {
                        minFraction: 2,
                        maxFraction: 2,
                      })}
                      <span className="ml-2 text-[10px] text-gray-500">
                        Conversión visual estimada; se almacena en ARS
                      </span>
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Estado actual</span>
                    <span>
                      {venta?.EstadoVenta?.nombreEstadoVenta ?? "Pendiente"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* footer */}
          <div className="px-4 py-3 border-t bg-gray-50 flex flex-wrap justify-end gap-2">
            {/* Guardar cambios sin cerrar la preventa. Permitido si Pendiente o ListoCaja */}
            {canSave && (
              <button
                type="button"
                className="rounded-lg border border-gray-400 px-3 py-2 text-sm disabled:opacity-50"
                disabled={
                  saving || !canSave || (venta?.detalles?.length ?? 0) === 0
                }
                onClick={() => submit("guardar")}
              >
                Guardar cambios
              </button>
            )}

            {/* Cerrar y pasar a caja (lock) desde Pendiente o quitar reserva */}
            {(isPendiente || isReservado) &&
              (hasRole("Administrador") || hasRole("Cajero")) && (
                <button
                  className="rounded-lg border border-blue-700 text-blue-700 px-3 py-2 text-sm disabled:opacity-50"
                  disabled={saving}
                  onClick={lock}
                >
                  {estadoNorm === "reservado"
                    ? "Quitar reserva y pasar a caja"
                    : "Cerrar y pasar a caja"}
                </button>
              )}

            {isReservado && (hasRole("Administrador") || hasRole("Cajero")) && (
              <button
                className="rounded-lg border border-gray-700 text-gray-700 px-3 py-2 text-sm disabled:opacity-50"
                disabled={saving}
                onClick={postergarReserva}
              >
                Postergar reserva
              </button>
            )}

            {/* Marcar Finalizada. Solo si está en ListoCaja */}
            {isListoCaja && (
              <button
                className="rounded-lg border border-green-700 text-green-700 px-3 py-2 text-sm disabled:opacity-50"
                disabled={saving}
                onClick={() => submit("finalizar")}
              >
                Finalizar
              </button>
            )}

            {/* Marcar Cancelada. En Pendiente o ListoCaja */}
            {(isPendiente || isReservado || isListoCaja) && (
              <button
                className="rounded-lg border border-red-700 text-red-700 px-3 py-2 text-sm disabled:opacity-50"
                disabled={saving}
                onClick={() => submit("cancelar")}
              >
                Cancelar
              </button>
            )}

            {/* Siempre puedo cerrar */}
            <button
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
      {openPostergar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-sm">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-medium">Postergar reserva</h2>
              <button
                className="rounded border px-2 py-1 text-xs"
                onClick={() => setOpenPostergar(false)}
                title="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <Label htmlFor="fechaPostergar">Nueva fecha límite</Label>
                <input
                  id="fechaPostergar"
                  type="date"
                  className="rounded border px-2 py-1 w-full"
                  value={postergarFecha}
                  onChange={(e) => setPostergarFecha(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Se actualizará también la fecha de cobro a ese día.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                className="rounded border px-3 py-1 text-sm"
                onClick={() => setOpenPostergar(false)}
              >
                Volver
              </button>
              <button
                className="inline-flex items-center gap-1 rounded bg-black text-white px-3 py-1 text-sm"
                onClick={confirmarPostergar}
              >
                Postergar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
