import { useEffect, useState } from "react";
import { Eye, Search, Plus, Trash2, X, Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Label, Input, Select } from "../components/ui/Form";
import { api } from "../lib/api";

/* ===== Tipos ===== */
type PreRow = { id: number; cliente: string; fecha: string; metodoPago?: string | null; total: number };
type Opt = { id: number; label: string };
type ProdOpt = Opt & { precio: number };
type Item = { idProducto: number; nombre: string; cantidad: number; precio: number; descuento: number };

/* ===== Página ===== */
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
          cliente: v.cliente ?? (v.Cliente ? `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}` : ""),
          fecha: String(v.fecha ?? v.fechaVenta ?? "").slice(0, 10),
          metodoPago: v.metodoPago ?? v.TipoPago?.tipoPago ?? null,
          total: Number(v.total ?? 0),
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(q), 350); return () => clearTimeout(t); }, [q]);

  const columns: ColumnDef<PreRow>[] = [
    { header: "N°", accessorKey: "id", size: 60 },
    { header: "Cliente", accessorKey: "cliente" },
    { header: "Fecha", accessorKey: "fecha" },
    { header: "Método de pago", accessorKey: "metodoPago" },
    { header: "Total", cell: ({ row }) => `$${row.original.total.toFixed(2)}` },
    {
      header: "Acciones",
      id: "acciones",
      size: 220,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1 border px-2 py-1 text-xs" onClick={() => setOpenView(row.original.id)} title="Ver">
            <Eye className="h-3.5 w-3.5" /> Ver
          </button>
          <button className="inline-flex items-center gap-1 border px-2 py-1 text-xs" onClick={() => setOpenForm(row.original.id)} title="Editar">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            className="inline-flex items-center gap-1 border px-2 py-1 text-xs"
            onClick={async () => { if (!confirm("¿Eliminar pre-venta?")) return; await api.delete(`/preventas/${row.original.id}`); await load(q); }}
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </button>
        </div>
      ),
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
              onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
            />
          </div>
          <button onClick={() => setOpenForm(0)} className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2">
            <Plus className="h-4 w-4" /> Nueva Pre-venta
          </button>
        </div>
      </div>

      {loading ? <div className="rounded-xl border bg-white p-6 text-sm">Cargando…</div> : <DataTable columns={columns} data={rows} />}

      {openForm !== null && (
        <PreventaForm
          id={openForm || undefined}
          onClose={async (reload?: boolean) => { setOpenForm(null); if (reload) await load(q); }}
        />
      )}
      {openView !== null && <PreventaView id={openView} onClose={() => setOpenView(null)} />}
    </section>
  );
}

/* ===== Modal Ver ===== */
function PreventaView({ id, onClose }: { id: number; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { (async () => { const { data } = await api.get(`/preventas/${id}`); setData(data); })(); }, [id]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto w-full max-w-3xl md:rounded-2xl border bg-white shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">Detalle de Pre-venta</h3>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100" aria-label="Cerrar"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4 text-sm grid grid-cols-2 gap-3">
            <div><p className="text-gray-500">N°</p><p className="font-medium">{data?.idVenta ?? id}</p></div>
            <div><p className="text-gray-500">Fecha</p><p className="font-medium">{String(data?.fechaVenta ?? "").slice(0, 10)}</p></div>
            <div className="col-span-2"><p className="text-gray-500">Cliente</p>
              <p className="font-medium">{data?.Cliente ? `${data.Cliente.apellidoCliente}, ${data.Cliente.nombreCliente}` : "-"}</p>
            </div>
            <div><p className="text-gray-500">Método de pago</p><p className="font-medium">{data?.TipoPago?.tipoPago ?? "-"}</p></div>
            <div className="col-span-2"><p className="text-gray-500">Observación</p><p className="font-normal">{data?.observacion ?? "-"}</p></div>
          </div>
          <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
            <button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">Cerrar</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ===== Modal Crear/Editar ===== */
function PreventaForm({ id, onClose }: { id?: number; onClose: (reload?: boolean) => void }) {
  const isEdit = !!id;

  const [tiposPago, setTiposPago] = useState<Array<{ id: number; nombre: string }>>([]);
  const [idCliente, setIdCliente] = useState<string>("");
  const [idTipoPago, setIdTipoPago] = useState<string>("");
  const [obs, setObs] = useState<string>("");

  // facturación
  const [nroFactura, setNroFactura] = useState<string>("");
  const [fechaFactura, setFechaFactura] = useState<string>("");
  const [fechaCobro, setFechaCobro] = useState<string>("");

  // recargo/descuento por método: campo "%"
const [porcentajeMP, setPorcentajeMP] = useState<number>(0);

const mostrarPct = (() => {
  const n = tiposPago
    .find(t => String(t.id) === idTipoPago)
    ?.nombre?.toLowerCase()
    .trim() || "";
  return n === "crédito 7%" || n === "crédito 5%" || n === "QR 5%" || n === "QR 7%";
})();


  // búsqueda cliente
  const [cliQ, setCliQ] = useState("");
  const [cliOpts, setCliOpts] = useState<Opt[]>([]);
  const [cliAll, setCliAll] = useState<Opt[]>([]);

  // búsqueda producto
  const [prodQ, setProdQ] = useState("");
  const [prodOpts, setProdOpts] = useState<ProdOpt[]>([]);
  const [prodSel, setProdSel] = useState<ProdOpt | null>(null);

  // línea actual
  const [cant, setCant] = useState<number>(0);
  const [precio, setPrecio] = useState<number>(0);
  const [desc, setDesc] = useState<number>(0);

  // items
  const [items, setItems] = useState<Item[]>([]);

  // descuento general
  const [descGeneral, setDescGeneral] = useState<number>(0);

  /* ===== Cargas iniciales ===== */
  useEffect(() => {
    (async () => {
      const [c0, tp] = await Promise.all([
        api.get("/clientes"),
        api.get("/tipos-pago"),
      ]);
      setCliAll((c0.data ?? []).slice(0, 50).map((c: any) => ({
        id: c.idCliente ?? c.id,
        label: `${c.apellidoCliente ?? c.apellido}, ${c.nombreCliente ?? c.nombre}`,
      })));
      setTiposPago(tp.data ?? []);
    })();
  }, []);

  // edición
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data } = await api.get(`/preventas/${id}`);
      setIdCliente(String(data?.idCliente ?? ""));
      setIdTipoPago(String(data?.idTipoPago ?? ""));
      setObs(data?.observacion ?? "");
      setNroFactura(String(data?.nroFactura ?? ""));
      setFechaFactura(String(data?.fechaVenta ?? "").slice(0, 10));
      setFechaCobro(String(data?.fechaCobroVenta ?? "").slice(0, 10));
      if (Array.isArray(data?.detalles)) {
        setItems(
          data.detalles.map((d: any) => ({
            idProducto: d.idProducto,
            nombre: `${d.Producto?.codigoProducto ?? ""} — ${d.Producto?.nombreProducto ?? ""}`,
            cantidad: Number(d.cantidad ?? 0),
            precio: Number(d.Producto?.precioVentaPublicoProducto ?? 0),
            descuento: 0,
          }))
        );
      }
    })();
  }, [isEdit, id]);

  /* ===== Búsquedas ===== */
  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await api.get("/clientes", { params: cliQ ? { q: cliQ } : undefined });
      setCliOpts((data ?? []).slice(0, 20).map((c: any) => ({
        id: c.idCliente ?? c.id,
        label: `${c.apellidoCliente ?? c.apellido}, ${c.nombreCliente ?? c.nombre}`,
      })));
    }, 250);
    return () => clearTimeout(t);
  }, [cliQ]);

  function resolveClientFromText(txt: string) {
    const base = cliQ ? cliOpts : cliAll;
    const t = txt.trim().toLowerCase();
    const m = base.find(o => o.label.toLowerCase() === t) ?? base.find(o => o.label.toLowerCase().includes(t));
    if (m) { setIdCliente(String(m.id)); setCliQ(m.label); setCliOpts([]); }
  }

  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await api.get("/products", { params: prodQ ? { q: prodQ } : undefined });
      const opts: ProdOpt[] = (data ?? []).map((p: any) => ({
        id: p.id ?? p.idProducto,
        label: `${p.sku ?? p.codigoProducto} — ${p.nombre ?? p.nombreProducto}`,
        precio: Number(p.precio ?? p.precioVentaPublicoProducto ?? 0),
      }));
      setProdOpts(opts);
      if (prodSel) {
        const found = opts.find(o => o.id === prodSel.id);
        if (found) setPrecio(found.precio);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [prodQ]); // eslint-disable-line

  /* ===== Helpers ===== */
  function pickProduct(o: ProdOpt) {
    setProdSel(o); setProdQ(o.label); setPrecio(o.precio); setProdOpts([]); setCant(0); setDesc(0);
  }

  /* ===== Items ===== */
  function addItem() {
    if (!prodSel) return;
    if (cant <= 0 || precio < 0 || desc < 0 || desc > 100) return;
    setItems(prev => [...prev, { idProducto: prodSel.id, nombre: prodSel.label, cantidad: Number(cant), precio: Number(precio), descuento: Number(desc) }]);
    setProdSel(null); setProdQ(""); setCant(0); setPrecio(0); setDesc(0);
  }
  function delItem(idProducto: number) { setItems(prev => prev.filter(i => i.idProducto !== idProducto)); }

  /* ===== Totales con descuento general ===== */
  const IVA = 0.21;
  const bruto = items.reduce((a, i) => a + i.cantidad * i.precio, 0);
  const descLineas = items.reduce((a, i) => a + i.cantidad * i.precio * ((i.descuento || 0) / 100), 0);
  const base = bruto - descLineas;
  const descGeneralMonto = base * (descGeneral / 100);
  const total = base - descGeneralMonto;
  const subtotal = total / (1 + IVA);
  const impuestos = total - subtotal;

  /* ===== Submit ===== */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idCliente) return alert("Seleccioná un cliente válido.");
    if (!idTipoPago) return alert("Seleccioná método de pago.");
    if (items.length === 0) return alert("Agregá al menos un producto.");

    const today = new Date();
    const ventaDate = fechaFactura ? new Date(fechaFactura) : today;
    const cobroDate = fechaCobro ? new Date(fechaCobro) : today;

    const payload: any = {
      idCliente: Number(idCliente),
      idTipoPago: Number(idTipoPago),
      observacion: obs || null,
      fechaVenta: ventaDate,
      fechaCobroVenta: cobroDate,
      descuentoGeneral: Number(descGeneral) || 0,
      porcentajeMetodo : mostrarPct ? Number(porcentajeMP) || 0 : 0,
      detalles: items.map(i => ({ idProducto: Number(i.idProducto), cantidad: Number(i.cantidad) })),
    };
    if (nroFactura) payload.nroFactura = String(nroFactura);

    try {
      if (isEdit) await api.put(`/preventas/${id}`, payload);
      else await api.post("/preventas", payload);
      onClose(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Error al guardar";
      alert(`No se pudo guardar: ${msg}`);
    }
  }

  /* ===== UI ===== */
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => onClose()} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-7xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">{isEdit ? "Editar Pre-venta" : "Nueva Pre-venta"}</h3>
            <button onClick={() => onClose()} className="p-2 rounded hover:bg-gray-100" aria-label="Cerrar"><X className="h-4 w-4" /></button>
          </div>

          <form onSubmit={onSubmit} className="p-4 overflow-auto flex-1 space-y-6">
            {/* Facturación */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div><Label htmlFor="nro">N° de facturación</Label><Input id="nro" value={nroFactura} onChange={(e) => setNroFactura(e.target.value)} /></div>
              <div><Label htmlFor="fFac">Fecha de facturación</Label><Input id="fFac" type="date" value={fechaFactura} onChange={(e) => setFechaFactura(e.target.value)} /></div>
              <div><Label htmlFor="fCob">Fecha de cobro</Label><Input id="fCob" type="date" value={fechaCobro} onChange={(e) => setFechaCobro(e.target.value)} /></div>
            </div>

            {/* Cliente / Pago / Obs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="clienteSearch">Cliente</Label>
                <div className="relative">
                  <Input
                    id="clienteSearch"
                    placeholder="Buscar cliente…"
                    value={cliQ}
                    onChange={(e) => { setCliQ(e.target.value); setIdCliente(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); resolveClientFromText(cliQ); } }}
                    onBlur={() => resolveClientFromText(cliQ)}
                  />
                  {cliQ && cliOpts.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-white shadow">
                      {cliOpts.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-100"
                          onClick={() => { setIdCliente(String(o.id)); setCliQ(o.label); setCliOpts([]); }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="pago">Método de pago</Label>
                <Select id="pago" value={idTipoPago} onChange={(e) => setIdTipoPago(e.target.value)}>
                  <option value="">Seleccionar</option>
                  {tiposPago.map((t) => (<option key={t.id} value={String(t.id)}>{t.nombre}</option>))}
                </Select>

                {mostrarPct && (
                  <div className="mt-2">
                    <Label htmlFor="pctmp">%</Label>
                    <Input
                      id="pctmp"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      value={porcentajeMP}
                      onChange={(e) => setPorcentajeMP(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>
                )}
              </div>

              {mostrarPct && (
  <div>
    <Label htmlFor="porcentajeMP">%</Label>
    <Input
      id="porcentajeMP"
      type="number"
      step="0.1"
      inputMode="decimal"
      value={porcentajeMP}
      onChange={e => setPorcentajeMP(Math.max(0, Number(e.target.value) || 0))}
    />
  </div>
)}


              <div><Label htmlFor="obs">Observaciones</Label><Input id="obs" placeholder="Opcional" value={obs} onChange={(e) => setObs(e.target.value)} /></div>
            </div>

            {/* Agregar productos */}
            <div className="rounded-2xl border bg-white p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-20 gap-3">
                <div className="md:col-span-10">
                  <Label htmlFor="productoSearch" className="mb-1 block">Producto</Label>
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
                          <button key={o.id} type="button" className="block w-full text-left px-2 py-1 hover:bg-gray-50 text-sm"
                            onClick={() => { pickProduct(o); setProdQ(o.label); }}>
                            {o.label} — ${o.precio.toFixed(2)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-3">
                  <Label htmlFor="cantidad" className="mb-1 block">Cantidad (g)</Label>
                  <Input id="cantidad" type="number" inputMode="numeric" value={cant} onChange={(e) => setCant(Math.max(0, Number(e.target.value) || 0))} />
                </div>

                <div className="md:col-span-3">
                  <Label htmlFor="precio" className="mb-1 block">Precio</Label>
                  <Input id="precio" type="number" inputMode="decimal" step="0.01" value={precio}
                    onChange={(e) => setPrecio(Math.max(0, Number(e.target.value) || 0))} />
                </div>

                <div className="md:col-span-3">
                  <Label htmlFor="descuento" className="mb-1 block">Descuento %</Label>
                  <Input id="descuento" type="number" inputMode="decimal" step="0.1" value={desc}
                    onChange={(e) => setDesc(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  disabled={!prodSel}
                  className="self-end inline-flex items-center justify-center rounded-lg bg-black text-white p-2 disabled:opacity-50"
                  title="Agregar" aria-label="Agregar">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tabla productos */}
            <div className="rounded-2xl border bg-white p-4">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col style={{ width: "40%" }} /><col style={{ width: "10%" }} /><col style={{ width: "15%" }} />
                  <col style={{ width: "10%" }} /><col style={{ width: "15%" }} /><col style={{ width: "10%" }} />
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
                      <td className="px-3 py-2 text-center">${i.precio.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">{i.descuento}%</td>
                      <td className="px-3 py-2 text-center">${(i.cantidad * i.precio * (1 - (i.descuento || 0) / 100)).toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">
                        <button type="button" className="inline-flex items-center gap-1 border px-2 py-1 text-xs" onClick={() => delItem(i.idProducto)}>
                          <Trash2 className="h-3.5 w-3.5" /> Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={6}>Sin productos agregados</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Resumen + Descuento general */}
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="font-medium">Resumen de la Pre-venta</h2>
                <span className="rounded-full px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800">Estado: Pendiente</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
                <div className="rounded-xl border p-4"><p className="text-sm text-gray-500">Subtotal (sin impuestos)</p><p className="text-2xl font-semibold">${subtotal.toFixed(2)}</p></div>
                <div className="rounded-xl border p-4"><p className="text-sm text-gray-500">Impuestos extraídos</p><p className="text-2xl font-semibold">${impuestos.toFixed(2)}</p></div>

                <div className="rounded-xl border p-4">
                  <label className="block text-xs mb-1 text-gray-600">Descuento general (%)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={descGeneral}
                    onChange={(e) => setDescGeneral(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-full rounded-lg border px-2 py-1 text-sm"
                  />
                  <p className="mt-2 text-xs text-gray-500">Monto: ${descGeneralMonto.toFixed(2)}</p>
                </div>

                <div className="rounded-xl border p-4"><p className="text-sm text-gray-500">Descuentos de líneas</p><p className="text-2xl font-semibold">${descLineas.toFixed(2)}</p></div>
                <div className="rounded-xl border p-4"><p className="text-sm text-gray-500">Total</p><p className="text-2xl font-semibold">${total.toFixed(2)}</p></div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t">
                <button type="button" onClick={() => onClose()} className="rounded-lg border px-3 py-2 text-sm">Cancelar</button>
                <button type="submit" className="rounded-lg bg-black text-white px-3 py-2 text-sm">{isEdit ? "Guardar cambios" : "Guardar Pre-venta"}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
