// src/pages/Productos.tsx
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Search, Plus, Pencil, Trash, X, Eye } from "lucide-react";
import { useForm, type SubmitHandler, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label, Input, FieldError, Select } from "../components/ui/Form";
import type { Producto } from "../types";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

// tipos simples locales para selects
type Familia = { id: number; nombre: string };
type Subfamilia = { id: number; nombre: string; familiaId: number };
type Proveedor = { id: number; nombre: string };

// Esquema del form (UI) + nuevos campos
const schema = z.object({
  codigoInterno: z.string().min(1, "Requerido"),
  codigoBarras: z.string().optional(),
  nombre: z.string().min(1, "Requerido"),
  descripcion: z.string().optional(),
  familia: z.string().min(1, "Requerido"),
  subfamilia: z.string().min(1, "Requerido"),
  proveedor: z.string().min(1, "Requerido"),
  precioCosto: z.coerce.number().nonnegative(">= 0"),
  utilidad: z.coerce.number().nonnegative(">= 0"),
  precioVenta: z.coerce.number().nonnegative(">= 0"),
  stock: z.coerce.number().int().nonnegative(">= 0"),
  bajoMinimoStock: z.coerce.number().int().nonnegative(">= 0"),
  ultimaModificacionStock: z.string().min(1, "Requerido"),
  oferta: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

export default function Productos() {
  const [rows, setRows] = useState<Producto[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [subfamilias, setSubfamilias] = useState<Subfamilia[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Producto | null>(null);

  // buscador
  const [q, setQ] = useState("");
  const norm = (s: any) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const filteredRows = useMemo(() => {
    const nq = norm(q);
    if (!nq) return rows;
    return rows.filter(
      (r) => norm(r.nombre).includes(nq) || norm((r as any).sku).includes(nq)
    );
  }, [rows, q]);

  // "Ver"
  const [openView, setOpenView] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);

  async function loadProducts() {
    setLoading(true);
    try {
      const { data } = await api.get("/products");
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadTaxonomies() {
    const [f, s, p] = await Promise.all([
      api.get("/familias"),
      api.get("/subfamilias"),
      api.get("/proveedores"),
    ]);

    const fams = (f.data as any[])
      .map((x) => ({
        id: Number(x.id ?? x.idFamilia),
        nombre: String(x.nombre ?? x.tipoFamilia ?? x.nombreFamilia ?? ""),
      }))
      .filter((x) => Number.isFinite(x.id) && x.nombre);

    const subs = (s.data as any[])
      .map((x) => ({
        id: Number(x.id ?? x.idSubFamilia),
        nombre: String(
          x.nombre ?? x.tipoSubFamilia ?? x.nombreSubFamilia ?? ""
        ),
        familiaId: Number(x.familiaId ?? x.idFamilia),
      }))
      .filter(
        (x) => Number.isFinite(x.id) && Number.isFinite(x.familiaId) && x.nombre
      );

    const provs = (p.data as any[])
      .map((x) => ({
        id: Number(x.id ?? x.idProveedor),
        nombre: String(x.nombre ?? x.razonSocial ?? x.nombreProveedor ?? ""),
      }))
      .filter((x) => Number.isFinite(x.id) && x.nombre);

    setFamilias(fams);
    setSubfamilias(subs);
    setProveedores(provs);
  }

  useEffect(() => {
    loadProducts();
    loadTaxonomies();
  }, []);

  function onNew() {
    setEditItem(null);
    setOpen(true);
  }
  function onEdit(p: Producto) {
    setEditItem(p);
    setOpen(true);
  }
  function onView(p: Producto) {
    setViewId((p as any).id);
    setOpenView(true);
  }

  const columns: ColumnDef<Producto>[] = [
    { header: "Código", accessorKey: "sku" },
    { header: "Nombre", accessorKey: "nombre" },
    { header: "Stock", accessorKey: "stock" },
    {
      header: "Precio",
      accessorKey: "precio",
      cell: ({ getValue }) => {
        const v = Number(getValue());
        return isNaN(v)
          ? "-"
          : new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency: "ARS",
              maximumFractionDigits: 2,
            }).format(v);
      },
    },
    {
      header: "Estado",
      accessorKey: "oferta",
      cell: ({ getValue }) => {
        const oferta = !!getValue();
        return (
          <span
            className={
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
              (oferta
                ? "bg-green-100 text-green-700 border border-green-200"
                : "bg-gray-100 text-gray-700 border border-gray-200")
            }
          >
            {oferta ? "En oferta" : "Normal"}
          </span>
        );
      },
      size: 120,
    },
    {
      header: "Acciones",
      id: "accion",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
            onClick={() => onView(row.original as Producto)}
            title="Ver"
          >
            <Eye className="h-3.5 w-3.5" /> Ver
          </button>
          <button
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
            onClick={() => onEdit(row.original as Producto)}
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
            onClick={async () => {
              try {
                const id = (row.original as any).id;
                await api.delete(`/products/${id}`);
                await loadProducts();
              } catch (err: any) {
                const s = err?.response?.status;
                const e = err?.response?.data;
                if (s === 409 && e?.error === "FK_CONSTRAINT_IN_USE") {
                  alert("No se puede eliminar: tiene movimientos relacionados.");
                  return;
                }
                alert("No se pudo eliminar");
                console.error(err);
              }
            }}
            title="Eliminar"
          >
            <Trash className="h-3.5 w-3.5" /> Eliminar
          </button>
        </div>
      ),
      size: 220,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Productos</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
              placeholder="Buscar por código o nombre"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6 text-sm">Cargando…</div>
      ) : (
        <DataTable columns={columns} data={filteredRows} />
      )}

      {open && (
        <ProductoPopup
          initial={editItem}
          familias={familias}
          subfamilias={subfamilias}
          proveedores={proveedores}
          onClose={async (reload?: boolean) => {
            setOpen(false);
            if (reload) await loadProducts();
          }}
        />
      )}

      {openView && viewId != null && (
        <ProductoView
          id={viewId}
          onClose={() => {
            setOpenView(false);
            setViewId(null);
          }}
        />
      )}
    </section>
  );
}

/* Popup alta/edición (sin cambios relevantes para el buscador) */
function ProductoPopup({
  onClose,
  familias,
  subfamilias,
  proveedores,
  initial,
}: {
  onClose: (reload?: boolean) => void;
  familias: Familia[];
  subfamilias: Subfamilia[];
  proveedores: Proveedor[];
  initial?: Producto | null;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      codigoInterno: "",
      codigoBarras: "",
      nombre: "",
      descripcion: "",
      familia: "",
      subfamilia: "",
      proveedor: "",
      precioCosto: 0,
      utilidad: 0,
      precioVenta: 0,
      stock: 0,
      bajoMinimoStock: 0,
      ultimaModificacionStock: new Date().toISOString().slice(0, 10),
      oferta: false,
    },
  });

  useEffect(() => {
    if (!initial?.id) return;
    (async () => {
      const { data } = await api.get(`/products/${initial.id}`);
      const sfId: number | undefined = data?.subFamiliaId ?? data?.idSubFamilia;
      const famId =
        subfamilias.find((sf) => sf.id === sfId)?.familiaId ?? undefined;

      reset({
        codigoInterno: data?.sku ?? data?.codigoProducto ?? "",
        codigoBarras: data?.codigoBarras ?? data?.codigoBarrasProducto ?? "",
        nombre: data?.nombre ?? data?.nombreProducto ?? "",
        descripcion: data?.descripcion ?? data?.descripcionProducto ?? "",
        familia: famId ? String(famId) : "",
        subfamilia: sfId ? String(sfId) : "",
        proveedor: data?.proveedorId ? String(data.proveedorId) : "",
        precioCosto: Number(data?.precioCosto ?? 0),
        utilidad: Number(data?.utilidad ?? data?.utilidadProducto ?? 0),
        precioVenta: Number(
          data?.precio ?? data?.precioVentaPublicoProducto ?? 0
        ),
        stock: Number(data?.stock ?? 0),
        bajoMinimoStock: Number(data?.bajoMinimoStock ?? 0),
        ultimaModificacionStock: data?.ultimaModificacionStock
          ? String(data.ultimaModificacionStock).slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        oferta: !!data?.oferta,
      });
    })();
  }, [initial, reset, subfamilias]);

  const calcVenta = (c?: number, u?: number) => {
    const costo = c ?? Number(watch("precioCosto") || 0);
    const util = u ?? Number(watch("utilidad") || 0);
    setValue("precioVenta", Number((costo * (1 + util / 100)).toFixed(2)), {
      shouldValidate: true,
    });
  };
  const onCostoChange = (e: any) => calcVenta(Number(e.target.value), undefined);
  const onUtilChange = (e: any) => calcVenta(undefined, Number(e.target.value));

  const familiaSelected = watch("familia");
  const subfamiliasFiltradas = useMemo(
    () =>
      subfamilias.filter(
        (sf) => String(sf.familiaId) === String(familiaSelected || "")
      ),
    [subfamilias, familiaSelected]
  );

  const onSubmit: SubmitHandler<FormData> = async (v) => {
    const payload = {
      nombre: v.nombre,
      sku: v.codigoInterno,
      precio: v.precioVenta,
      precioCosto: v.precioCosto,
      utilidad: v.utilidad,
      descripcion: v.descripcion || null,
      codigoBarras: v.codigoBarras?.trim() || null,
      oferta: !!v.oferta,
      stock: v.stock,
      bajoMinimoStock: v.bajoMinimoStock,
      ultimaModificacionStock: v.ultimaModificacionStock,
      subFamiliaId: Number(v.subfamilia),
      proveedorId: Number(v.proveedor),
    };

    try {
      if (initial?.id) {
        await api.put(`/products/${initial.id}`, payload);
      } else {
        await api.post("/products", payload);
      }
      reset();
      onClose(true);
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 409 && data?.error === "UNIQUE_CONSTRAINT") {
        alert(`Valor duplicado en: ${data.fields?.join(", ") || "campo único"}`);
        return;
      }
      if (status === 409 && data?.error === "FK_CONSTRAINT_IN_USE") {
        alert("No se puede editar: tiene movimientos relacionados.");
        return;
      }
      alert("Operación fallida");
      console.error(err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => onClose()} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-3xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">
              {initial?.id ? "Editar Producto" : "Agregar Nuevo Producto"}
            </h3>
            <button onClick={() => onClose()} className="p-2 rounded hover:bg-gray-100" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 overflow-auto flex-1 space-y-4">
            <form id="producto-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
              {/* Código Interno + Código de Barras */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="codigoInterno">Código Interno</Label>
                  <Input id="codigoInterno" placeholder="FF-SS-0001" {...register("codigoInterno")} />
                  <p className="text-[11px] text-gray-500 mt-1">Formato: Familia-Subfamilia-ID</p>
                  <FieldError message={errors.codigoInterno?.message} />
                </div>
                <div>
                  <Label htmlFor="codigoBarras">Código de Barras</Label>
                  <Input id="codigoBarras" placeholder="7791234567890" {...register("codigoBarras")} />
                  <FieldError message={errors.codigoBarras?.message} />
                </div>
              </div>

              {/* Nombre y Proveedor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input id="nombre" placeholder="Ovillo Merino 100 g" {...register("nombre")} />
                  <FieldError message={errors.nombre?.message} />
                </div>
                <div>
                  <Label htmlFor="proveedor">Proveedor</Label>
                  <Select id="proveedor" {...register("proveedor")}>
                    <option value="">Seleccionar proveedor</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={String(p.id)}>{p.nombre}</option>
                    ))}
                  </Select>
                  <FieldError message={errors.proveedor?.message} />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <Label htmlFor="descripcion">Descripción</Label>
                <textarea
                  id="descripcion"
                  className="w-full rounded-lg border px-3 py-2 text-sm min-h-[80px]"
                  placeholder="Madeja de lana merino suave para agujas 4–5 mm"
                  {...(register("descripcion") as any)}
                />
              </div>

              {/* Familia / Subfamilia */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="familia">Familia</Label>
                  <Select id="familia" {...register("familia")}>
                    <option key="empty-fam" value="">Seleccionar familia</option>
                    {familias.map((f, i) => (
                      <option key={`fam-${f.id ?? `i${i}`}`} value={String(f.id)}>
                        {f.nombre}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={errors.familia?.message} />
                </div>
                <div>
                  <Label htmlFor="subfamilia">Subfamilia</Label>
                  <Select id="subfamilia" {...register("subfamilia")}>
                    <option key="empty-sub" value="">Seleccionar subfamilia</option>
                    {subfamiliasFiltradas.map((sf, i) => (
                      <option key={`sub-${sf.id ?? `i${i}`}`} value={String(sf.id)}>
                        {sf.nombre}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={errors.subfamilia?.message} />
                </div>
              </div>

              {/* Precios */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="precioCosto">Precio de Costo</Label>
                  <Input
                    id="precioCosto"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="2500"
                    {...register("precioCosto", { valueAsNumber: true, onChange: onCostoChange })}
                  />
                  <FieldError message={errors.precioCosto?.message} />
                </div>
                <div>
                  <Label htmlFor="utilidad">Utilidad (%)</Label>
                  <Input
                    id="utilidad"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="60"
                    {...register("utilidad", { valueAsNumber: true, onChange: onUtilChange })}
                  />
                  <FieldError message={errors.utilidad?.message} />
                </div>
                <div>
                  <Label htmlFor="precioVenta">Precio de Venta</Label>
                  <Input
                    id="precioVenta"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="4000"
                    readOnly
                    {...register("precioVenta", { valueAsNumber: true })}
                  />
                  <FieldError message={errors.precioVenta?.message} />
                </div>
              </div>

              {/* Stock */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="stock">Stock</Label>
                  <Input id="stock" type="number" inputMode="numeric" {...register("stock", { valueAsNumber: true })} />
                  <FieldError message={errors.stock?.message} />
                </div>
                <div>
                  <Label htmlFor="bajoMinimoStock">Bajo mínimo</Label>
                  <Input id="bajoMinimoStock" type="number" inputMode="numeric" {...register("bajoMinimoStock", { valueAsNumber: true })} />
                  <FieldError message={errors.bajoMinimoStock?.message} />
                </div>
                <div>
                  <Label htmlFor="ultimaModificacionStock">Última modificación</Label>
                  <Input id="ultimaModificacionStock" type="date" {...register("ultimaModificacionStock")} />
                  <FieldError message={errors.ultimaModificacionStock?.message} />
                </div>
              </div>
            </form>
          </div>

          <div className="px-4 py-3 border-t bg-gray-50">
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("oferta")} />
                Producto en oferta
              </label>
              <div className="flex items-center gap-2">
                <button onClick={() => onClose()} className="rounded-lg border px-3 py-2 text-sm">
                  Cancelar
                </button>
                <button form="producto-form" disabled={isSubmitting} className="rounded-lg bg-black text-white px-3 py-2 text-sm">
                  {initial?.id ? "Guardar Cambios" : "Guardar Producto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* MODAL "VER" detalle completo (sin cambios para el buscador) */
function ProductoView({ id, onClose }: { id: number; onClose: () => void }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/products/${id}`);
        setData(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const precioFmt = (n: any) =>
    typeof n === "number"
      ? new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 2,
        }).format(n)
      : "-";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto w-full max-w-2xl md:rounded-2xl border bg-white shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">Detalle de Producto</h3>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 text-sm">
            {loading ? (
              <div className="text-gray-600">Cargando…</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-gray-500">ID Producto</p>
                    <p className="font-medium">{data?.id ?? data?.idProducto ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Código (SKU)</p>
                    <p className="font-medium">{data?.sku ?? data?.codigoProducto ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Código de barras</p>
                    <p className="font-medium">{data?.codigoBarras ?? data?.codigoBarrasProducto ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Nombre</p>
                    <p className="font-medium">{data?.nombre ?? data?.nombreProducto ?? "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Descripción</p>
                    <p className="font-normal">{data?.descripcion ?? data?.descripcionProducto ?? "-"}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Precio costo</p>
                    <p className="font-medium">{precioFmt(data?.precioCosto)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Precio venta público</p>
                    <p className="font-medium">{precioFmt(data?.precio ?? data?.precioVentaPublicoProducto)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Utilidad (%)</p>
                    <p className="font-medium">{data?.utilidad ?? data?.utilidadProducto ?? 0}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Stock</p>
                    <p className="font-medium">{data?.stock ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Bajo mínimo</p>
                    <p className="font-medium">{data?.bajoMinimoStock ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Última mod. stock</p>
                    <p className="font-medium">
                      {data?.ultimaModificacionStock
                        ? String(data.ultimaModificacionStock).slice(0, 10)
                        : "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Familia</p>
                    <p className="font-medium">{data?.familia?.nombre ?? data?.nombreFamilia ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Subfamilia</p>
                    <p className="font-medium">{data?.subfamilia?.nombre ?? data?.nombreSubfamilia ?? "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-500">Proveedor</p>
                    <p className="font-medium">{data?.proveedor?.nombre ?? data?.nombreProveedor ?? "-"}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Estado</p>
                    <span
                      className={
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
                        (data?.oferta
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200")
                      }
                    >
                      {data?.oferta ? "En oferta" : "Normal"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
            <button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
