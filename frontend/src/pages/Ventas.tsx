import { useState, useEffect } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Search, Eye, Plus, X } from "lucide-react";
import { Label, Input } from "../components/ui/Form";
import { api } from "../lib/api";

/* Tipos base */
type VentaRow = {
  id: number;
  cliente: string;
  fecha: string;
  metodoPago?: string | null;
  estado: string;
  total: number;
};

export default function Ventas() {
  const [tab, setTab] = useState<"ventas" | "preventas">("ventas");

  // modal registrar venta nueva
  const [openNuevaVenta, setOpenNuevaVenta] = useState(false);

  // modal ver preventa
  const [openViewPreventa, setOpenViewPreventa] = useState<null | number>(null);

  // modal validar preventa
  const [openValidate, setOpenValidate] = useState<null | number>(null);

  // filtro de búsqueda simple
  const [q, setQ] = useState("");

  // datos
  const [ventasRows, setVentasRows] = useState<VentaRow[]>([]);
  const [preRows, setPreRows] = useState<VentaRow[]>([]);
  const [loading, setLoading] = useState(false);

  // cargar datos
  async function loadData(query?: string) {
    setLoading(true);
    try {
      let ventasData: any[] = [];
      try {
        const resV = await api.get("/ventas", {
          params: { ...(query ? { q: query } : {}) },
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
        }))
      );

      // preventas pendientes
      let preData: any[] = [];
try {
  const resP = await api.get("/preventas", {
    params: { ...(query ? { q: query } : {}) },
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

      const norm = String(estadoNombre).toLowerCase().trim();

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
    }))
);


    } finally {
      setLoading(false);
    }
  }

  // carga inicial
  useEffect(() => {
    loadData();
  }, []);

  // búsqueda con debounce
  useEffect(() => {
    const t = setTimeout(() => {
      loadData(q);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

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
      cell: ({ row }) => `$${row.original.total.toFixed(2)}`,
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
    const norm = raw.toLowerCase().trim();

    let cls = "bg-blue-100 text-blue-800"; // default intermedio / caja
    if (norm.includes("pend")) {
      cls = "bg-yellow-100 text-yellow-800"; // pendiente vendedor
    } else if (
      norm.includes("finaliz") ||
      norm.includes("cerrad")
    ) {
      cls = "bg-green-100 text-green-800"; // cerrado ok
    } else if (norm.includes("cancel")) {
      cls = "bg-red-100 text-red-800"; // cancelado
    }

    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}
      >
        {raw}
      </span>
    );
  },
},


    {
      header: "Total",
      cell: ({ row }) => `$${row.original.total.toFixed(2)}`,
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
        <button
          onClick={() => setOpenNuevaVenta(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
        >
          <Plus className="h-4 w-4" />
          <span>Registrar Nueva Venta</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
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
        <button
          onClick={() => setTab("preventas")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "preventas"
              ? "border-b-2 border-black text-black"
              : "text-gray-500"
          }`}
        >
          Pre-Ventas Pendientes
        </button>
      </div>

      {/* Buscador */}
      <div className="relative w-64">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
          placeholder={
            tab === "ventas"
              ? "Buscar ventas..."
              : "Buscar pre-ventas pendientes..."
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQ("");
          }}
        />
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="rounded-xl border bg-white p-6 text-sm">Cargando…</div>
      ) : (
        <DataTable
          columns={tab === "ventas" ? columnsVentas : columnsPreVentas}
          data={tab === "ventas" ? ventasRows : preRows}
        />
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
  const [ajuste, setAjuste] = useState<number>(0);
  const [descGeneral, setDescGeneral] = useState<number>(0);
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
                Subtotal sin impuestos: {moneda} ${subtotal.toFixed(2)}
              </p>
              <p>
                Impuestos: {moneda} ${impuestos.toFixed(2)}
              </p>
              <p>
                Total final: {moneda} ${totalFinal.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">
                Descuentos totales: ${descuentosTotales.toFixed(2)}
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

  const lineItems = venta?.detalles ?? [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto w-full max-w-3xl md:rounded-2xl border bg-white shadow-xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">
              Pre-venta #{id} (solo lectura)
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
          <div className="flex-1 overflow-auto px-4 py-3 text-sm space-y-6">
            {/* Datos venta */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-gray-500">N°</p>
                <p className="font-medium">
                  {loadingVenta ? "..." : venta?.idVenta ?? id}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Fecha</p>
                <p className="font-medium">
                  {loadingVenta
                    ? "..."
                    : String(venta?.fechaVenta ?? "").slice(0, 10)}
                </p>
              </div>

              <div className="col-span-2">
                <p className="text-gray-500">Cliente</p>
                <p className="font-medium">
                  {loadingVenta
                    ? "..."
                    : venta?.Cliente
                    ? `${venta.Cliente.apellidoCliente}, ${venta.Cliente.nombreCliente}`
                    : "-"}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Método de pago</p>
                <p className="font-medium">
                  {loadingVenta ? "..." : venta?.TipoPago?.tipoPago ?? "-"}
                </p>
              </div>

              <div>
                <p className="text-gray-500">Estado actual</p>
                <p className="font-medium">
                  {loadingVenta ? "..." : estadoStr}
                </p>
              </div>

              <div className="col-span-2">
                <p className="text-gray-500">Observación</p>
                <p className="font-normal">
                  {loadingVenta ? "..." : venta?.observacion ?? "-"}
                </p>
              </div>
            </div>

            {/* Productos */}
            <div>
              <p className="text-gray-700 font-medium mb-2">Productos</p>

              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2 py-2 text-left">Producto</th>
                      <th className="px-2 py-2 text-center">Cant.</th>
                      <th className="px-2 py-2 text-center">P.Unit.</th>
                      <th className="px-2 py-2 text-center">Subtotal</th>
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
                          <tr key={idx} className="border-t">
                            <td className="px-2 py-2">
                              {d.Producto?.codigoProducto ?? ""} —{" "}
                              {d.Producto?.nombreProducto ?? ""}
                            </td>
                            <td className="px-2 py-2 text-center">{cant}</td>
                            <td className="px-2 py-2 text-center">
                              ${pu.toFixed(2)}
                            </td>
                            <td className="px-2 py-2 text-center">
                              ${subtotal.toFixed(2)}
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

            {/* Historial de estado */}
            <div>
              <p className="text-gray-700 font-medium mb-2">
                Historial de estado
              </p>

              <div className="rounded-xl border max-h-40 overflow-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2 py-1 text-left">Fecha</th>
                      <th className="px-2 py-1 text-left">Cambio</th>
                      <th className="px-2 py-1 text-left">Motivo</th>
                      <th className="px-2 py-1 text-left">Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHist ? (
                      <tr>
                        <td
                          className="px-2 py-4 text-center text-gray-500"
                          colSpan={4}
                        >
                          Cargando historial...
                        </td>
                      </tr>
                    ) : hist.length === 0 ? (
                      <tr>
                        <td
                          className="px-2 py-4 text-center text-gray-500"
                          colSpan={4}
                        >
                          Sin movimientos de estado.
                        </td>
                      </tr>
                    ) : (
                      hist.map((ev) => (
                        <tr key={ev.id} className="border-t align-top">
                          <td className="px-2 py-1">{ev.fecha}</td>
                          <td className="px-2 py-1">
                            {ev.desde ? `${ev.desde} → ${ev.hasta}` : ev.hasta}
                          </td>
                          <td className="px-2 py-1">{ev.motivo ?? "-"}</td>
                          <td className="px-2 py-1">
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

  // estado actual de la preventa (Pendiente, Finalizada, Cancelada)
  const estadoActual = venta?.EstadoVenta?.nombreEstadoVenta ?? "Pendiente";
  const isEditable = estadoActual.toLowerCase() === "pendiente";

  // cargar todo al abrir
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [resVenta, resClientes, resTiposPago, resMonedas] =
          await Promise.all([
            api.get(`/preventas/${id}`),
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
        setIdMoneda(v.idMoneda ?? v.Moneda?.idMoneda ?? "");

        setFechaFacturacion(
          v.fechaVenta ? String(v.fechaVenta).slice(0, 10) : hoy
        );
        setFechaCobro(
          v.fechaCobroVenta ? String(v.fechaCobroVenta).slice(0, 10) : hoy
        );

        setObservacion(v.observacion ?? "");

        setDescuentoGeneral(v.descuentoGeneralVenta ?? 0);
        setAjuste(v.ajusteVenta ?? 0);
        setRecargoPago(v.recargoPagoVenta ?? 0);

        // catálogos ya estandarizados del backend
        setClientes(resClientes.data ?? []);
        setTiposPago(resTiposPago.data ?? []);
        setMonedas(resMonedas.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function submit(accion: "guardar" | "finalizar" | "cancelar") {
    setSaving(true);
    try {
      const payload: any = {
        accion,
        idCliente: idCliente === "" ? null : idCliente,
        idTipoPago: idTipoPago === "" ? null : idTipoPago,
        idMoneda: idMoneda === "" ? null : idMoneda,
        fechaFacturacion,
        fechaCobro,
        observacion,
        descuentoGeneral,
        ajuste,
        recargoPago,
      };

      if (accion === "cancelar") {
        const motivo = window.prompt("Motivo de cancelación?");
        payload.motivoCancelacion = motivo ?? null;
      }

      await api.put(`/preventas/${id}`, payload);

      if (accion === "guardar") {
        // sigue Pendiente. Solo cerrar el modal
        onClose();
      } else {
        // "finalizar" o "cancelar"
        // sacarla de la lista de Pre-Ventas Pendientes
        onDone();
      }
    } catch (err) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Error al actualizar";
      alert(msg);
      setSaving(false);
    }
  }

  // ===== cálculos de la venta =====
  // tu /api/preventas/:id devuelve detalles con:
  //   cantidad        (no cantidadDetalleVenta)
  //   Producto.precioVentaPublicoProducto
  //   Producto.nombreProducto / codigoProducto
  const lineItems = venta?.detalles ?? [];

  // subtotal Bruto (antes de descuentos de caja)
  const subtotalBruto = lineItems.reduce((acc: number, d: any) => {
    const cant = Number(d.cantidad ?? 0);
    const precioUnit = Number(d.Producto?.precioVentaPublicoProducto ?? 0);
    return acc + cant * precioUnit;
  }, 0);

  // aplicar descuentoGeneral (%), ajuste (+/-), recargoPago (+)
  const totalConAjustes =
    subtotalBruto -
    subtotalBruto * (descuentoGeneral / 100) +
    ajuste +
    recargoPago;

  const IVA = 0.21;
  const subtotalSinIVA = totalConAjustes / (1 + IVA);
  const impuestos = totalConAjustes - subtotalSinIVA;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-4xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">Validar Pre-venta #{id}</h3>
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
                    />
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
                        setDescuentoGeneral(Number(e.target.value))
                      }
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
                      onChange={(e) => setAjuste(Number(e.target.value))}
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
                      onChange={(e) => setRecargoPago(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Productos cargados */}
                <div className="rounded border">
                  <div className="border-b bg-gray-50 px-3 py-2 text-sm font-medium">
                    Productos cargados
                  </div>

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
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.length === 0 ? (
                          <tr>
                            <td
                              className="px-3 py-6 text-center text-gray-500"
                              colSpan={4}
                            >
                              Sin productos agregados
                            </td>
                          </tr>
                        ) : (
                          lineItems.map((d: any, idx: number) => {
                            const cant = Number(d.cantidad ?? 0);
                            const pUnit = Number(
                              d.Producto?.precioVentaPublicoProducto ?? 0
                            );
                            const tot = cant * pUnit;
                            return (
                              <tr key={idx} className="border-t">
                                <td className="px-3 py-2">
                                  {d.Producto?.codigoProducto
                                    ? `${d.Producto.codigoProducto} - ${
                                        d.Producto.nombreProducto ?? ""
                                      }`
                                    : d.Producto?.nombreProducto ??
                                      `Producto ${d.idProducto ?? ""}`}
                                </td>
                                <td className="px-3 py-2 text-right">{cant}</td>
                                <td className="px-3 py-2 text-right">
                                  ${pUnit.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  ${tot.toFixed(2)}
                                </td>
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
                    <span>${subtotalSinIVA.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Impuestos (IVA)</span>
                    <span>${impuestos.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Descuento general (%)</span>
                    <span>{descuentoGeneral}%</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Ajuste (+ / -)</span>
                    <span>${ajuste.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Recargo crédito / QR</span>
                    <span>${recargoPago.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between font-semibold">
                    <span>Total final</span>
                    <span>${totalConAjustes.toFixed(2)}</span>
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
            {/* Guardar cambios sin cerrar la preventa. Solo permitido si sigue Pendiente */}
            {isEditable && (
              <button
                className="rounded-lg border border-gray-400 px-3 py-2 text-sm disabled:opacity-50"
                disabled={saving}
                onClick={() => submit("guardar")}
              >
                Guardar
              </button>
            )}

            {/* Marcar Finalizada. Solo si sigue Pendiente */}
            {isEditable && (
              <button
                className="rounded-lg border border-green-700 text-green-700 px-3 py-2 text-sm disabled:opacity-50"
                disabled={saving}
                onClick={() => submit("finalizar")}
              >
                Finalizar
              </button>
            )}

            {/* Marcar Cancelada. Solo si sigue Pendiente */}
            {isEditable && (
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
    </>
  );
}
