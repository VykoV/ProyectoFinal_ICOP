import { useEffect, useState } from "react";
import { Eye, Search, Plus, Trash2, X, Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Label, Input, Select } from "../components/ui/Form";
import { api } from "../lib/api";

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
  const [openForm, setOpenForm] = useState<null | number>(null);
  const [openView, setOpenView] = useState<null | number>(null);

  async function load(query?: string) {
    setLoading(true);
    try {
      const { data } = await api.get("/preventas", {
        params: { ...(query ? { q: query } : {}), estado: "pendiente" },
      });
      setRows(
  (data ?? []).map((v: any) => ({
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
    load();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => load(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const columns: ColumnDef<PreRow>[] = [
    { header: "N°", accessorKey: "id", size: 60 },
    { header: "Cliente", accessorKey: "cliente" },
    { header: "Fecha", accessorKey: "fecha" },
    { header: "Método de pago", accessorKey: "metodoPago" },
    {
      header: "Total",
      cell: ({ row }) => `$${row.original.total.toFixed(2)}`,
    },
    {
  header: "Acciones",
  id: "acciones",
  size: 220,
  cell: ({ row }) => {
    const estado = (row.original.estado || "").toLowerCase();
    const isEditable = estado === "pendiente";

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
              if (!confirm("¿Eliminar pre-venta?")) return;
              await api.delete(`/preventas/${row.original.id}`);
              await load(q);
            }}
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </button>
        )}
      </div>
    );
  },
},

  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pre-Ventas</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
              placeholder="Buscar por cliente…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQ("");
              }}
            />
          </div>
          <button
            onClick={() => setOpenForm(0)}
            className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
          >
            <Plus className="h-4 w-4" /> Nueva Pre-venta
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6 text-sm">Cargando…</div>
      ) : (
        <DataTable columns={columns} data={rows} />
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
        <PreventaView id={openView} onClose={() => setOpenView(null)} />
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
      .trim() === "pendiente";

  // 3. Handler para cerrar edición (lock -> ListoCaja)
  async function terminarEdicion() {
    const ok = window.confirm(
      "¿Finalizar edición?\nYa no vas a poder modificar ni eliminar esta pre-venta."
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
        <div className="mx-auto w-full max-w-3xl md:rounded-2xl border bg-white shadow-xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">
              Detalle de Pre-venta #{id}
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

            {/* Historial */}
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
                            {ev.desde
                              ? `${ev.desde} → ${ev.hasta}`
                              : ev.hasta}
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
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idCliente) return alert("Seleccioná un cliente válido.");
    if (!idTipoPago) return alert("Seleccioná método de pago.");
    if (items.length === 0) return alert("Agregá al menos un producto.");

    const today = new Date();
    const ventaDate = fechaFactura ? new Date(fechaFactura) : today;

    const payload: any = {
      idCliente: Number(idCliente),
      idTipoPago: Number(idTipoPago),
      observacion: obs || null,
      fechaVenta: ventaDate,
      fechaCobroVenta: today,
      descuentoGeneral: Number(descClientePct) || 0,
      porcentajeMetodo: tieneRecargoMP ? Number(porcentajeMP) || 0 : 0,
      detalles: items.map((i) => ({
        idProducto: Number(i.idProducto),
        cantidad: Number(i.cantidad),
      })),
    };

    try {
      if (isEdit) await api.put(`/preventas/${id}`, payload);
      else await api.post("/preventas", payload);
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
              {isEdit ? "Editar Pre-venta" : "Nueva Pre-venta"}
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
                            {o.label} — ${o.precio.toFixed(2)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Productos cargados
              </h4>
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
                    <th className="px-3 py-2 text-center">Cant. (g)</th>
                    <th className="px-3 py-2 text-center">Precio</th>
                    <th className="px-3 py-2 text-center">Desc %</th>
                    <th className="px-3 py-2 text-center">Total</th>
                    <th className="px-3 py-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.idProducto} className="border-t">
                      <td className="px-3 py-2">{i.nombre}</td>
                      <td className="px-3 py-2 text-center">{i.cantidad}</td>
                      <td className="px-3 py-2 text-center">
                        ${i.precio.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">{i.descuento}%</td>
                      <td className="px-3 py-2 text-center">
                        $
                        {(
                          i.cantidad *
                          i.precio *
                          (1 - (i.descuento || 0) / 100)
                        ).toFixed(2)}
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
                <h2 className="font-medium">Resumen de la Pre-venta</h2>
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
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-black text-white px-3 py-2 text-sm"
                >
                  {isEdit ? "Guardar cambios" : "Guardar Pre-venta"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
