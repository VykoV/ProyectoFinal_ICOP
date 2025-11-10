import { useEffect, useMemo, useState } from "react";
import { Eye, Search, Plus, Trash2, X, Pencil, Check } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Label, Input, Select } from "../components/ui/Form";
import { api } from "../lib/api";

/* ===== Tipos ===== */
type CompraRow = {
  id: number;
  proveedor: string;
  fecha: string;            // fechaComprobanteCompra YYYY-MM-DD
  nroFactura: string;
  metodoPago?: string | null;
  moneda?: string | null;
  total: number;
  estado: "PendientePago" | "Finalizado" | string;
};

type Opt = { id: number; label: string };
type ProdOpt = Opt & { precio: number };
type Item = {
  idProducto: number;
  nombre: string;
  cantidad: number;
  precioUnit: number;
};

/* ===== Página listado ===== */
export default function Compras() {
  const [rows, setRows] = useState<CompraRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");                 // busca proveedor o nro factura
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  const [openForm, setOpenForm] = useState<null | number>(null); // null=no, 0=nueva, >0=editar
  const [openView, setOpenView] = useState<null | number>(null);
  const [openFiltros, setOpenFiltros] = useState(false);

  function readParams() {
    const sp = new URLSearchParams(window.location.search);
    setQ(sp.get("q") || "");
    setDesde(sp.get("cDesde") || "");
    setHasta(sp.get("cHasta") || "");
    setSortDir((sp.get("cSort") as any) === "asc" ? "asc" : "desc");
    setPage(Math.max(1, Number(sp.get("cPage")) || 1));
  }
  function writeParams(next?: Partial<{ q: string; cDesde: string; cHasta: string; cSort: "asc" | "desc"; cPage: number }>) {
    const sp = new URLSearchParams(window.location.search);
    const qv = next?.q ?? q;
    const dsd = next?.cDesde ?? desde;
    const hst = next?.cHasta ?? hasta;
    const srt = next?.cSort ?? sortDir;
    const pg  = next?.cPage ?? page;
    if (qv) sp.set("q", qv); else sp.delete("q");
    if (dsd) sp.set("cDesde", dsd); else sp.delete("cDesde");
    if (hst) sp.set("cHasta", hst); else sp.delete("cHasta");
    sp.set("cSort", srt);
    sp.set("cPage", String(pg));
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }

  async function load() {
    setLoading(true);
    try {
      // Respetar validación del backend (limit <= 100) y traer todas las páginas
      const limit = 100;
      const all: any[] = [];
      let pg = 1;
      // Construye filtros de fecha si aplica
      const baseParams: any = {};
      if (desde) baseParams.desde = desde;
      if (hasta) baseParams.hasta = hasta;
      // Paginado incremental hasta que no haya más resultados
      while (true) {
        const params: any = { ...baseParams, page: pg, limit };
        const { data } = await api.get("/compras", { params });
        const chunk = (data?.rows ?? data ?? []) as any[];
        all.push(...chunk);
        if (chunk.length < limit) break;
        pg += 1;
        if (pg > 100) break; // tope de seguridad
      }
      const list = all.map((v: any) => ({
        id: v.id ?? v.idCompra,
        proveedor: v.Proveedor?.nombreProveedor ?? "",
        fecha: String(v.fechaComprobanteCompra ?? v.fecha ?? "").slice(0, 10),
        nroFactura: String(v.nroFactura ?? ""),
        metodoPago: v.MetodoPago?.metodoPago ?? null,
        moneda: v.Moneda?.moneda ?? v.Moneda?.codigo ?? null,
        total: Number(v.total ?? 0),
        estado: v.estado ?? "PendientePago",
      })) as CompraRow[];
      setRows(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { readParams(); load(); }, []);
  useEffect(() => { writeParams(); }, [q, desde, hasta, sortDir, page]);

  const columns: ColumnDef<CompraRow>[] = useMemo(() => [
    { header: "N°", accessorKey: "id", size: 60 },
    { header: "Proveedor", accessorKey: "proveedor" },
    { header: "Fecha", accessorKey: "fecha" },
    { header: "Factura", accessorKey: "nroFactura" },
    { header: "Método de pago", accessorKey: "metodoPago" },
    { header: "Moneda", accessorKey: "moneda" },
    {
      header: "Estado",
      cell: ({ row }) => {
        const raw = row.original.estado || "PendientePago";
        const n = raw.toLowerCase();
        const cls = n.includes("pend") ? "bg-yellow-100 text-yellow-800"
                 : n.includes("final") ? "bg-green-100 text-green-800"
                 : "bg-gray-100 text-gray-800";
        return <span className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{raw}</span>;
      }
    },
    { header: "Total", cell: ({ row }) => `$${row.original.total.toFixed(2)}` },
    {
      header: "Acciones",
      id: "acciones",
      size: 280,
      cell: ({ row }) => {
        const isEditable = (row.original.estado || "").toLowerCase().includes("pend");
        return (
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1 border px-2 py-1 text-xs"
              onClick={() => setOpenView(row.original.id)} title="Ver">
              <Eye className="h-3.5 w-3.5" /> Ver
            </button>

            {isEditable && (
              <button className="inline-flex items-center gap-1 border px-2 py-1 text-xs"
                onClick={() => setOpenForm(row.original.id)} title="Editar">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            )}

            {isEditable && (
              <button className="inline-flex items-center gap-1 border px-2 py-1 text-xs"
                onClick={async () => {
                  if (!confirm("Confirmar compra y actualizar stock?")) return;
                  await api.post(`/compras/${row.original.id}/confirmar`, {});
                  await load();
                }}
                title="Confirmar compra">
                <Check className="h-3.5 w-3.5" /> Confirmar
              </button>
            )}

            {isEditable && (
              <button className="inline-flex items-center gap-1 border px-2 py-1 text-xs"
                onClick={async () => {
                  if (!confirm("Eliminar compra en Pendiente de pago?")) return;
                  await api.delete(`/compras/${row.original.id}`);
                  await load();
                }}
                title="Eliminar compra">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            )}
          </div>
        );
      }
    }
  ], []); // eslint-disable-line

  // filtros y paginado en cliente como preventas
  const rowsFiltered = rows.filter(r => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    const hay = [r.proveedor, r.nroFactura, r.metodoPago, r.moneda].some(f =>
      String(f || "").toLowerCase().includes(needle)
    );
    return hay;
  }).filter(r => {
    const f = String(r.fecha || "").slice(0, 10);
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    return true;
  });

  const rowsSorted = [...rowsFiltered].sort((a,b) => {
    const va = a.fecha, vb = b.fecha;
    if (va === vb) return 0;
    const cmp = va < vb ? -1 : 1;
    return sortDir === "asc" ? cmp : -cmp;
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
        <h1 className="text-xl font-semibold">Compras</h1>
        <button
          onClick={() => setOpenForm(0)}
          className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
        >
          <Plus className="h-4 w-4" /> Nueva Compra
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="relative w-64 sm:w-72 md:w-80 lg:w-96 xl:w-[32rem] flex-1 min-w-[14rem]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
            placeholder="Buscar por proveedor, factura, pago o moneda…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
          />
        </div>

        <button className="rounded border px-3 py-2" onClick={() => setOpenFiltros(true)}>Filtros</button>
        <span className="ml-auto text-xs text-gray-600">
          Mostrando {total === 0 ? 0 : startIdx + 1}–{endIdx} de {total}
        </span>
      </div>

      {openFiltros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg md:max-w-xl lg:max-w-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-medium">Filtros de Compras</h2>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => setOpenFiltros(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Fecha desde</span>
                <input type="date" className="rounded border px-2 py-1"
                  value={desde}
                  onChange={(e)=>{ setDesde(e.target.value); setPage(1); }} />
                <span className="text-gray-600">hasta</span>
                <input type="date" className="rounded border px-2 py-1"
                  value={hasta}
                  onChange={(e)=>{ setHasta(e.target.value); setPage(1); }} />
                <span className="text-gray-600 ml-auto">Orden</span>
                <select className="rounded border px-2 py-1"
                  value={sortDir}
                  onChange={(e)=> setSortDir(e.target.value as "asc"|"desc")}>
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button
                className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm"
                onClick={() => { setDesde(""); setHasta(""); setSortDir("desc"); setPage(1); setQ(""); }}
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
          <div className="flex items-center justify-between mt-2 text-sm">
            <div className="flex items-center gap-2">
              <button className="border px-2 py-1 rounded disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}>
                Anterior
              </button>
              <button className="border px-2 py-1 rounded disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}>
                Siguiente
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span>Página</span>
              <input
                className="w-16 rounded border px-2 py-1"
                type="number" min={1} max={totalPages}
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
        <CompraForm
          id={openForm || undefined}
          onClose={async (reload?: boolean) => {
            setOpenForm(null);
            if (reload) await load();
          }}
        />
      )}

      {openView !== null && (
        <CompraView
          id={openView}
          onClose={async () => {
            setOpenView(null);
          }}
        />
      )}
    </section>
  );
}

/* ===== Modal Ver ===== */
function CompraView({ id, onClose }: { id: number; onClose: (reload?: boolean) => void; }) {
  const [compra, setCompra] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/compras/${id}`);
      setCompra(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]);

  const items: any[] = compra?.detalles ?? [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => onClose()} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto w-full max-w-3xl md:rounded-2xl border bg-white shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">Detalle de Compra #{id}</h3>
            <button onClick={() => onClose()} className="p-2 rounded hover:bg-gray-100" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-auto px-4 py-3 text-sm space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-gray-500">Fecha</p>
                <p className="font-medium">{loading ? "..." : String(compra?.fechaComprobanteCompra ?? "").slice(0,10)}</p>
              </div>
              <div><p className="text-gray-500">Factura</p>
                <p className="font-medium">{loading ? "..." : compra?.nroFactura ?? "-"}</p>
              </div>
              <div className="col-span-2"><p className="text-gray-500">Proveedor</p>
                <p className="font-medium">{loading ? "..." : compra?.Proveedor?.nombreProveedor ?? "-"}</p>
              </div>
              <div><p className="text-gray-500">Método de pago</p>
                <p className="font-medium">{loading ? "..." : compra?.MetodoPago?.tipoPago ?? "-"}</p>
              </div>
              <div><p className="text-gray-500">Moneda</p>
                <p className="font-medium">{loading ? "..." : compra?.Moneda?.moneda ?? compra?.Moneda?.codigo ?? "-"}</p>
              </div>
              <div className="col-span-2"><p className="text-gray-500">Observación</p>
                <p className="font-normal">{loading ? "..." : compra?.observacion ?? "-"}</p>
              </div>
              <div><p className="text-gray-500">Estado</p>
                <span className="rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                  {loading ? "..." : compra?.estado ?? "-"}
                </span>
              </div>
              <div><p className="text-gray-500">Total</p>
                <p className="font-medium">{loading ? "..." : `$${Number(compra?.total ?? 0).toFixed(2)}`}</p>
              </div>
            </div>

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
                    {loading ? (
                      <tr><td className="px-2 py-4 text-center text-gray-500" colSpan={4}>Cargando…</td></tr>
                    ) : items.length > 0 ? (
                      items.map((d:any, idx:number) => {
                        const cant = Number(d.cantidad ?? 0);
                        const pu   = Number(d.precioUnit ?? 0);
                        const sub  = cant * pu;
                        return (
                          <tr key={`${d.idDetalleCompra ?? d.idProducto}-${idx}`} className="border-t">
                            <td className="px-2 py-2">
                              {d.Producto?.codigoProducto ?? ""} — {d.Producto?.nombreProducto ?? ""}
                            </td>
                            <td className="px-2 py-2 text-center">{cant}</td>
                            <td className="px-2 py-2 text-center">${pu.toFixed(2)}</td>
                            <td className="px-2 py-2 text-center">${sub.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td className="px-2 py-4 text-center text-gray-500" colSpan={4}>Sin items</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
            <button onClick={() => onClose()} className="rounded-lg border px-3 py-2 text-xs font-medium bg-white">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ===== Modal Crear / Editar ===== */
const IVA_PCT_DEFAULT = 21;
function CompraForm({ id, onClose }: { id?: number; onClose: (reload?: boolean) => void; }) {
  const isEdit = !!id;

  // catálogos
  const [proveedores, setProveedores] = useState<Opt[]>([]);
  const [metodos, setMetodos] = useState<Opt[]>([]);
  const [monedas, setMonedas] = useState<Opt[]>([]);

  // cabecera
  const [idProveedor, setIdProveedor] = useState<string>("");
  const [idMetodoPago, setIdMetodoPago] = useState<string>("");
  const [idMoneda, setIdMoneda] = useState<string>("");
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const [fecha, setFecha] = useState<string>(todayStr);
  const [nroFactura, setNroFactura] = useState<string>("");
  const [obs, setObs] = useState<string>("");

  // productos
  const [prodQ, setProdQ] = useState("");
  const [prodOpts, setProdOpts] = useState<ProdOpt[]>([]);
  const [prodSel, setProdSel] = useState<ProdOpt | null>(null);
  const [cant, setCant] = useState<number>(0);
  const [precioUnit, setPrecioUnit] = useState<number>(0);
  const [items, setItems] = useState<Item[]>([]);

  // errores
  const [err, setErr] = useState<string>("");

  // IVA informativo (solo visual)
  const [ivaPctView, setIvaPctView] = useState<number>(IVA_PCT_DEFAULT);
  const [verIVAInfo, setVerIVAInfo] = useState<boolean>(true);

  function splitIVA(pu: number, ivaPct: number) {
    const base = pu / (1 + ivaPct / 100);
    const iva  = pu - base;
    return { base, iva };
  }

  /* Cargas iniciales */
  useEffect(() => {
    (async () => {
      // Proveedores: paginar respetando pageSize <= 100
      const pageSize = 100;
      const provAll: any[] = [];
      let pg = 1;
      while (true) {
        const { data } = await api.get("/proveedores", { params: { page: pg, pageSize } });
        const chunk = (data?.rows ?? data ?? []) as any[];
        provAll.push(...chunk);
        if (chunk.length < pageSize) break;
        pg += 1;
        if (pg > 100) break; // tope de seguridad
      }
      const [mp, mn] = await Promise.all([
        api.get("/metodos-pago"),
        api.get("/monedas")
      ]);
      setProveedores(provAll.map((x:any)=>({ id:x.idProveedor ?? x.id, label:x.nombreProveedor })));
      setMetodos((mp.data ?? []).map((x:any)=>({ id:x.idMetodoPago, label:x.metodoPago })));
      setMonedas((mn.data ?? []).map((x:any)=>({ id:x.idMoneda, label:x.moneda ?? x.codigo })));
    })();
  }, []);

  /* Edición, cargar compra */
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data } = await api.get(`/compras/${id}`);
      setIdProveedor(String(data.idProveedor));
      setIdMetodoPago(String(data.idMetodoPago));
      setIdMoneda(String(data.idMoneda));
      setFecha(String(data.fechaComprobanteCompra ?? "").slice(0,10) || todayStr);
      setNroFactura(String(data.nroFactura ?? ""));
      setObs(data.observacion ?? "");
      const det: Item[] = (data.detalles ?? []).map((d:any) => ({
        idProducto: d.idProducto,
        nombre: `${d.Producto?.codigoProducto ?? ""} — ${d.Producto?.nombreProducto ?? ""}`,
        cantidad: Number(d.cantidad ?? 0),
        precioUnit: Number(d.precioUnit ?? 0),
      }));
      setItems(det);
    })();
  }, [isEdit, id, todayStr]);

  /* Buscar productos */
  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await api.get("/products", { params: prodQ ? { q: prodQ } : undefined });
      const opts: ProdOpt[] = (data ?? []).map((p:any) => ({
        id: p.id ?? p.idProducto,
        label: `${p.sku ?? p.codigoProducto} — ${p.nombre ?? p.nombreProducto}`,
        precio: Number(p.precio ?? p.precioVentaPublicoProducto ?? 0),
      }));
      setProdOpts(opts);
      if (prodSel) {
        const found = opts.find(o => o.id === prodSel.id);
        if (found) setPrecioUnit(found.precio);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [prodQ]); // eslint-disable-line

  function pickProduct(o: ProdOpt) {
    setProdSel(o);
    setProdQ(o.label);
    setPrecioUnit(o.precio);
    setProdOpts([]);
    setCant(0);
  }

  function addItem() {
    if (!prodSel) return;
    if (cant <= 0 || precioUnit < 0) return;
    setItems(prev => [...prev, {
      idProducto: prodSel.id,
      nombre: prodSel.label,
      cantidad: Number(cant),
      precioUnit: Number(precioUnit),
    }]);
    setProdSel(null);
    setProdQ("");
    setCant(0);
    setPrecioUnit(0);
  }

  function delItem(idProducto: number) {
    setItems(prev => prev.filter(i => i.idProducto !== idProducto));
  }

  function setItemCantidad(idProducto: number, cantidad: number) {
    setItems(prev => prev.map(i => i.idProducto === idProducto ? { ...i, cantidad: Math.max(0, cantidad) } : i));
  }

  // totales
  const totalCalc = items.reduce((a,i)=> a + i.cantidad * i.precioUnit, 0);
  const info = items.reduce((acc, i) => {
    const { base, iva } = splitIVA(i.precioUnit, ivaPctView);
    acc.base += i.cantidad * base;
    acc.iva  += i.cantidad * iva;
    acc.bruto += i.cantidad * i.precioUnit;
    return acc;
  }, { base: 0, iva: 0, bruto: 0 });

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setErr("");
    if (!idProveedor) return setErr("Seleccioná un proveedor.");
    if (!idMetodoPago) return setErr("Seleccioná método de pago.");
    if (!idMoneda) return setErr("Seleccioná moneda.");
    if (!nroFactura.trim()) return setErr("Ingresá número de factura.");
    if (items.length === 0) return setErr("Agregá al menos un producto.");

    const payload = {
      idProveedor: Number(idProveedor),
      idMetodoPago: Number(idMetodoPago),
      idMoneda: Number(idMoneda),
      fechaComprobanteCompra: new Date(fecha),
      nroFactura: nroFactura.trim(),
      observacion: obs || null,
      items: items.map(i => ({
        idProducto: Number(i.idProducto),
        cantidad: Number(i.cantidad),
        precioUnit: Number(i.precioUnit),
      })),
    };

    try {
      if (isEdit) {
        await api.put(`/compras/${id}`, payload);
      } else {
        await api.post("/compras", payload);
      }
      onClose(true);
    } catch (e:any) {
      setErr(e?.response?.data?.error || "Error al guardar");
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => onClose()} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-7xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">{isEdit ? "Editar Compra" : "Nueva Compra"}</h3>
            <button onClick={() => onClose()} className="p-2 rounded hover:bg-gray-100" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="p-4 overflow-auto flex-1 space-y-6">
            {/* Cabecera */}
            <div className="rounded-2xl border bg-white p-4 space-y-4">
              <h4 className="text-sm font-medium text-gray-700">Datos de la compra</h4>
              {err && <div className="text-sm text-red-600">{err}</div>}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Proveedor</Label>
                  <Select value={idProveedor} onChange={(e)=> setIdProveedor(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {proveedores.map(p => <option key={p.id} value={String(p.id)}>{p.label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Método de pago</Label>
                  <Select value={idMetodoPago} onChange={(e)=> setIdMetodoPago(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {metodos.map(t => <option key={t.id} value={String(t.id)}>{t.label}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Moneda</Label>
                  <Select value={idMoneda} onChange={(e)=> setIdMoneda(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {monedas.map(m => <option key={m.id} value={String(m.id)}>{m.label}</option>)}
                  </Select>
                </div>

                <div>
                  <Label>Fecha comprobante</Label>
                  <Input type="date" value={fecha} onChange={e=> setFecha(e.target.value)} />
                </div>
                <div>
                  <Label>Nro. Factura</Label>
                  <Input value={nroFactura} onChange={e=> setNroFactura(e.target.value)} />
                </div>
                <div className="lg:col-span-1">
                  <Label>Observación</Label>
                  <Input value={obs} onChange={e=> setObs(e.target.value)} placeholder="Opcional" />
                </div>

                <div className="lg:col-span-3 flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={verIVAInfo} onChange={e=>setVerIVAInfo(e.target.checked)} />
                    Ver desglose informativo de IVA
                  </label>
                  {verIVAInfo && (
                    <>
                      <span className="text-gray-500">IVA %</span>
                      <Input type="number" className="w-24" value={ivaPctView}
                        onChange={e=> setIvaPctView(Math.max(0, Number(e.target.value) || 0))}/>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Agregar productos */}
            <div className="rounded-2xl border bg-white p-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Agregar producto</h4>
              <div className="grid grid-cols-1 md:grid-cols-20 gap-3">
                <div className="md:col-span-10">
                  <Label className="mb-1 block">Producto</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                    <input
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
                            onClick={() => { pickProduct(o); setProdQ(o.label); }}
                          >
                            {o.label} — ${o.precio.toFixed(2)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-3">
                  <Label className="mb-1 block">Cantidad</Label>
                  <Input type="number" inputMode="numeric" value={cant}
                    onChange={(e)=> setCant(Math.max(0, Number(e.target.value) || 0))} />
                </div>

                <div className="md:col-span-3">
                  <Label className="mb-1 block">Precio unit.</Label>
                  <Input type="number" inputMode="decimal" step="0.01" value={precioUnit}
                    onChange={(e)=> setPrecioUnit(Math.max(0, Number(e.target.value) || 0))} />
                </div>

                <button type="button" onClick={addItem}
                  disabled={!prodSel}
                  className="self-end inline-flex items-center justify-center rounded-lg bg-black text-white p-2 disabled:opacity-50"
                  title="Agregar" aria-label="Agregar">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tabla items */}
            <div className="rounded-2xl border bg-white p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Productos cargados</h4>
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col style={{ width: verIVAInfo ? "40%" : "45%" }} />
                  <col style={{ width: verIVAInfo ? "12%" : "15%" }} />
                  <col style={{ width: verIVAInfo ? "16%" : "20%" }} />
                  {verIVAInfo && <col style={{ width: "16%" }} />}
                  <col style={{ width: verIVAInfo ? "8%" : "10%" }} />
                  <col style={{ width: verIVAInfo ? "8%" : "10%" }} />
                </colgroup>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-center">Cant.</th>
                    <th className="px-3 py-2 text-center">P.Unit.</th>
                    {verIVAInfo && <th className="px-3 py-2 text-center">Sin IVA</th>}
                    <th className="px-3 py-2 text-center">Subtotal</th>
                    <th className="px-3 py-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => {
                    const { base, iva } = splitIVA(i.precioUnit, ivaPctView);
                    return (
                      <tr key={`${i.idProducto}-${idx}`} className="border-t">
                        <td className="px-3 py-2">{i.nombre}</td>
                        <td className="px-3 py-2 text-center">
                          <Input type="number" inputMode="numeric" value={i.cantidad}
                            onChange={(e)=> setItemCantidad(i.idProducto, Number(e.target.value) || 0)}
                            className="w-24 text-center" />
                        </td>
                        <td className="px-3 py-2 text-center">${i.precioUnit.toFixed(2)}</td>
                        {verIVAInfo && (
                          <td className="px-3 py-2 text-center">
                            ${ (i.cantidad * base).toFixed(2) }
                            <div className="text-[11px] text-gray-500">
                              IVA: ${ (i.cantidad * iva).toFixed(2) }
                            </div>
                          </td>
                        )}
                        <td className="px-3 py-2 text-center">
                          ${(i.cantidad * i.precioUnit).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button type="button" className="inline-flex items-center gap-1 border px-2 py-1 text-xs"
                            onClick={() => delItem(i.idProducto)}>
                            <Trash2 className="h-3.5 w-3.5" /> Quitar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={verIVAInfo ? 6 : 5}>Sin productos agregados</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Resumen */}
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="font-medium">Resumen de la compra</h2>
                <span className="rounded-full px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800">
                  Estado: PendientePago
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Ítems</p>
                  <p className="text-2xl font-semibold">{items.length}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Total bruto (con IVA)</p>
                  <p className="text-2xl font-semibold">${info.bruto.toFixed(2)}</p>
                </div>
                {verIVAInfo && (
                  <>
                    <div className="rounded-xl border p-4">
                      <p className="text-sm text-gray-500">Base neta (sin IVA)</p>
                      <p className="text-2xl font-semibold">${info.base.toFixed(2)}</p>
                    </div>
                    <div className="rounded-xl border p-4">
                      <p className="text-sm text-gray-500">IVA informativo</p>
                      <p className="text-2xl font-semibold">${info.iva.toFixed(2)}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t">
                <button type="button" onClick={() => onClose()} className="rounded-lg border px-3 py-2 text-sm">
                  Cancelar
                </button>
                <button type="submit" className="rounded-lg bg-black text-white px-3 py-2 text-sm">
                  {isEdit ? "Guardar cambios" : "Guardar compra"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
