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
import { useAuth } from "../context/AuthContext";

// tipos locales
type Familia = { id: number; nombre: string };
type Subfamilia = { id: number; nombre: string; familiaId: number };
// Proveedor eliminado del formulario de alta/edición

// helpers
const pad2 = (n?: string | number) => String(n ?? "").padStart(2, "0");
const todayISO = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);

// esquema del form (sin código interno, proveedor ni campo de stock)
const schema = z.object({
  codigoBarras: z.string().optional(),
  nombre: z.string().min(1, "Requerido"),
  descripcion: z.string().optional(),
  familia: z.string().min(1, "Requerido"),
  subfamilia: z.string().min(1, "Requerido"),
  precioCosto: z.coerce.number().nonnegative(">= 0"),
  utilidad: z.coerce.number().nonnegative(">= 0"),
  precioVenta: z.coerce.number().nonnegative(">= 0"),
  bajoMinimoStock: z.coerce.number().int().nonnegative(">= 0"),
  ultimaModificacionStock: z
    .string()
    .min(1, "Requerido")
    .refine((v) => {
      const d = new Date(v);
      return !Number.isNaN(d.valueOf()) && v <= todayISO;
    }, "No puede ser posterior a hoy"),
  oferta: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

export default function Productos() {
  const { hasRole } = useAuth();
  const isVendedor = hasRole("Vendedor");
  const isCajero = hasRole("Cajero");
  const [rows, setRows] = useState<Producto[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [subfamilias, setSubfamilias] = useState<Subfamilia[]>([]);
  // proveedores ya no se usan en el popup de producto
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Producto | null>(null);

  const [openView, setOpenView] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filtros
  const [q, setQ] = useState("");
  const [fFamiliaId, setFFamiliaId] = useState<number | "">("");
  const [fSubfamiliaId, setFSubfamiliaId] = useState<number | "">("");
  const [fOferta, setFOferta] = useState<"todos" | "oferta" | "normal">("todos");
  const [sortKey, setSortKey] = useState<"nombre" | "precio" | "estado">("nombre");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
    const [f, s] = await Promise.all([
      api.get("/familias"),
      api.get("/subfamilias"),
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

    setFamilias(fams);
    setSubfamilias(subs);
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
          {!(isVendedor || isCajero) && (
            <button
              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
              onClick={() => onEdit(row.original as Producto)}
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          )}
          {!(isVendedor || isCajero) && (
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
                    alert(
                      "No se puede eliminar: tiene movimientos relacionados."
                    );
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
          )}
        </div>
      ),
      size: 220,
    },
  ];

  const filteredRows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const famId = typeof fFamiliaId === "number" ? fFamiliaId : null;
    const subId = typeof fSubfamiliaId === "number" ? fSubfamiliaId : null;

    let out = rows.filter((r: any) => {
      const matchQuery = query
        ? (
            String(r.nombre ?? "").toLowerCase().includes(query) ||
            String(r.sku ?? "").toLowerCase().includes(query) ||
            String(r.descripcion ?? "").toLowerCase().includes(query)
          )
        : true;
      const matchOferta = fOferta === "todos"
        ? true
        : fOferta === "oferta" ? !!r.oferta : !r.oferta;
      const matchFam = famId != null ? Number(r.familiaId ?? -1) === famId : true;
      const matchSub = subId != null ? Number(r.subFamiliaId ?? -1) === subId : true;
      return matchQuery && matchOferta && matchFam && matchSub;
    });

    out = out.sort((a: any, b: any) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "precio") {
        const pa = Number(a.precio ?? 0);
        const pb = Number(b.precio ?? 0);
        return pa === pb ? 0 : (pa < pb ? -1 : 1) * dir;
      }
      if (sortKey === "estado") {
        const ea = a.oferta ? "En oferta" : "Normal";
        const eb = b.oferta ? "En oferta" : "Normal";
        return ea.localeCompare(eb) * dir;
      }
      const na = String(a.nombre ?? "");
      const nb = String(b.nombre ?? "");
      return na.localeCompare(nb) * dir;
    });
    return out;
  }, [rows, q, fFamiliaId, fSubfamiliaId, fOferta, sortKey, sortDir]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Productos</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Buscador global (nombre, código, descripción) */}
          <div className="relative w-64 sm:w-72 md:w-80 lg:w-96 xl:w-[32rem] flex-1 min-w-[14rem]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
              placeholder="Buscar por nombre, código o descripción…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if ((e as React.KeyboardEvent<HTMLInputElement>).key === "Escape") setQ("");
              }}
            />
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2"
            onClick={() => setShowFilters(true)}
          >
            <Search className="h-4 w-4" />
            <span>Filtros</span>
          </button>
          {!(isVendedor || isCajero) && (
            <button
              onClick={onNew}
              className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6 text-sm">Cargando…</div>
      ) : (
        <DataTable columns={columns} data={filteredRows} />
      )}

      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Filtros de productos</h3>
              <button className="inline-flex items-center gap-1 px-2 py-1 text-sm" onClick={() => setShowFilters(false)}>
                <X className="h-4 w-4" /> Cerrar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Familia</Label>
                <Select
                  value={typeof fFamiliaId === "number" ? String(fFamiliaId) : ""}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : "";
                    setFFamiliaId(v);
                    setFSubfamiliaId("");
                  }}
                >
                  <option value="">Todas</option>
                  {familias.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.nombre}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Subfamilia</Label>
                <Select
                  value={typeof fSubfamiliaId === "number" ? String(fSubfamiliaId) : ""}
                  onChange={(e) => setFSubfamiliaId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Todas</option>
                  {subfamilias
                    .filter((s) => (typeof fFamiliaId === "number" ? s.familiaId === fFamiliaId : true))
                    .map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.nombre}
                      </option>
                    ))}
                </Select>
              </div>
              <div>
                <Label>Oferta</Label>
                <Select value={fOferta} onChange={(e) => setFOferta(e.target.value as any)}>
                  <option value="todos">Todos</option>
                  <option value="oferta">En oferta</option>
                  <option value="normal">Normal</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Ordenar por</Label>
                  <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as any)}>
                    <option value="nombre">Nombre</option>
                    <option value="precio">Precio</option>
                    <option value="estado">Estado</option>
                  </Select>
                </div>
                <div>
                  <Label>Dirección</Label>
                  <Select value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}>
                    <option value="asc">Ascendente</option>
                    <option value="desc">Descendente</option>
                  </Select>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-between">
              <button
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2"
                onClick={() => {
                  setQ("");
                  setFFamiliaId("");
                  setFSubfamiliaId("");
                  setFOferta("todos");
                  setSortKey("nombre");
                  setSortDir("asc");
                }}
              >
                Limpiar
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
                onClick={() => setShowFilters(false)}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <ProductoPopup
          initial={editItem}
          familias={familias}
          subfamilias={subfamilias}
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

/* Popup alta/edición */
function ProductoPopup({
  onClose,
  familias,
  subfamilias,
  initial,
}: {
  onClose: (reload?: boolean) => void;
  familias: Familia[];
  subfamilias: Subfamilia[];
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
      codigoBarras: "",
      nombre: "",
      descripcion: "",
      familia: "",
      subfamilia: "",
      precioCosto: 0,
      utilidad: 0,
      precioVenta: 0,
      bajoMinimoStock: 0,
      ultimaModificacionStock: todayISO,
      oferta: false,
    },
  });

  const isEdit = !!initial?.id;

  useEffect(() => {
    if (!initial?.id) return;
    (async () => {
      const { data } = await api.get(`/products/${initial.id}`);
      const sfId: number | undefined = data?.subFamiliaId ?? data?.idSubFamilia;
      const famId =
        subfamilias.find((sf) => sf.id === sfId)?.familiaId ?? undefined;

      const rawDate = data?.ultimaModificacionStock
        ? String(data.ultimaModificacionStock).slice(0, 10)
        : todayISO;
      const fechaClamp = rawDate > todayISO ? todayISO : rawDate;

      reset({
        codigoBarras: data?.codigoBarras ?? data?.codigoBarrasProducto ?? "",
        nombre: data?.nombre ?? data?.nombreProducto ?? "",
        descripcion: data?.descripcion ?? data?.descripcionProducto ?? "",
        familia: famId ? String(famId) : "",
        subfamilia: sfId ? String(sfId) : "",
        precioCosto: Number(data?.precioCosto ?? 0),
        utilidad: Number(data?.utilidad ?? data?.utilidadProducto ?? 0),
        precioVenta: Number(
          data?.precio ?? data?.precioVentaPublicoProducto ?? 0
        ),
        bajoMinimoStock: Number(data?.bajoMinimoStock ?? 0),
        ultimaModificacionStock: fechaClamp,
        oferta: !!data?.oferta,
      });
    })();
  }, [initial, reset, subfamilias]);

  // cálculo de precio de venta
  const calcVenta = (c?: number, u?: number) => {
    const costo = c ?? Number(watch("precioCosto") || 0);
    const util = u ?? Number(watch("utilidad") || 0);
    setValue("precioVenta", Number((costo * (1 + util / 100)).toFixed(2)), {
      shouldValidate: true,
    });
  };
  const onCostoChange = (e: any) =>
    calcVenta(Number(e.target.value), undefined);
  const onUtilChange = (e: any) => calcVenta(undefined, Number(e.target.value));

  // dependencias de selects
  const familiaSelected = watch("familia");
  const subfamiliaSelected = watch("subfamilia");

  // constantes/ayudas
  const FAMILIA_VARIOS_SENTINEL = "-999"; // opción UI sintética para "Varios"
  const allowedFamilias = ["HILADOS", "MERCERIA", "MADERA", "VARIOS"];

  // lista de familias para mostrar en el UI, filtradas y con opción sintética "Varios" si falta
  const familiasDisplay = useMemo(() => {
    const base = familias.filter((f) =>
      allowedFamilias.includes(String(f.nombre).toUpperCase())
    );
    const hasVarios = base.some(
      (f) => String(f.nombre).toUpperCase() === "VARIOS"
    );
    // Si encontramos alguna de las familias esperadas, usamos ese subconjunto y añadimos "Varios" si falta.
    if (base.length > 0) {
      return hasVarios
        ? base
        : [...base, { id: Number(FAMILIA_VARIOS_SENTINEL), nombre: "Varios" }];
    }
    // Si no hay coincidencias (por ejemplo, datos con nombres distintos), mostramos la lista original completa.
    return familias;
  }, [familias]);

  // nombre (normalizado) de la familia seleccionada
  const familiaNameSelected = useMemo(() => {
    if (!familiaSelected) return "";
    if (String(familiaSelected) === FAMILIA_VARIOS_SENTINEL) return "VARIOS";
    const f = familias.find(
      (x) => String(x.id) === String(familiaSelected || "")
    );
    return String(f?.nombre || "").toUpperCase();
  }, [familiaSelected, familias]);

  useEffect(() => {
    if (!familiaSelected) return;
    const sel = subfamilias.find(
      (sf) => String(sf.id) === String(subfamiliaSelected || "")
    );
    const ok = sel
      ? String(familiaSelected) === FAMILIA_VARIOS_SENTINEL
        ? String(sel.nombre).toUpperCase() === "VARIOS"
        : String(sel.familiaId) === String(familiaSelected)
      : false;
    if (!ok) setValue("subfamilia", "");
  }, [familiaSelected, subfamiliaSelected, subfamilias, setValue]);

  // código interno eliminado: se autogenera en backend, no se muestra ni valida

  const subfamiliasFiltradas = useMemo(() => {
    if (!familiaSelected) return [] as Subfamilia[];
    let items: Subfamilia[];
    if (String(familiaSelected) === FAMILIA_VARIOS_SENTINEL) {
      // opción sintética: mostrar solo subfamilias "VARIOS" de cualquier familia
      items = subfamilias.filter(
        (sf) => String(sf.nombre).toUpperCase() === "VARIOS"
      );
    } else {
      items = subfamilias.filter(
        (sf) => String(sf.familiaId) === String(familiaSelected)
      );
    }

    // reglas específicas por familia
    if (familiaNameSelected === "HILADOS") {
      // sacar Aguja y Varios
      items = items.filter(
        (sf) =>
          !["AGUJA", "VARIOS"].includes(String(sf.nombre).toUpperCase())
      );
    } else if (familiaNameSelected === "MERCERIA") {
      // solo Aguja, Hilos y Varios (si existen)
      items = items.filter((sf) =>
        ["AGUJA", "HILOS", "VARIOS"].includes(
          String(sf.nombre).toUpperCase()
        )
      );
    }
    return items;
  }, [subfamilias, familiaSelected, familiaNameSelected]);

  const onSubmit: SubmitHandler<FormData> = async (v) => {
    const base = {
      nombre: v.nombre,
      precio: v.precioVenta,
      precioCosto: v.precioCosto,
      utilidad: v.utilidad,
      descripcion: v.descripcion || null,
      codigoBarras: v.codigoBarras?.trim() || null,
      oferta: !!v.oferta,
      bajoMinimoStock: v.bajoMinimoStock,
      ultimaModificacionStock: v.ultimaModificacionStock,
      subFamiliaId: Number(v.subfamilia),
    } as any;
    const payload = isEdit ? base : { ...base, stock: 0 };

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
        alert(
          `Valor duplicado en: ${data.fields?.join(", ") || "campo único"}`
        );
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
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={() => onClose()}
      />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-3xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">
              {isEdit ? "Editar Producto" : "Agregar Nuevo Producto"}
            </h3>
            <button
              onClick={() => onClose()}
              className="p-2 rounded hover:bg-gray-100"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 overflow-auto flex-1 space-y-4">
            <form
              id="producto-form"
              onSubmit={handleSubmit(onSubmit)}
              className="grid gap-3"
            >
              {/* 1) Familia / Subfamilia */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="familia">Familia</Label>
                  <Select id="familia" {...register("familia")}>
                    <option value="">Seleccionar familia</option>
                    {familiasDisplay.map((f, i) => (
                      <option
                        key={`fam-${f.id ?? `i${i}`}`}
                        value={String(f.id)}
                      >
                        {String(f.nombre).charAt(0).toUpperCase() +
                          String(f.nombre).slice(1).toLowerCase()}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={errors.familia?.message} />
                </div>
                <div>
                  <Label htmlFor="subfamilia">Subfamilia</Label>
                  <Select id="subfamilia" {...register("subfamilia")}>
                    <option value="">Seleccionar subfamilia</option>
                    {subfamiliasFiltradas.map((sf, i) => (
                      <option
                        key={`sub-${sf.id ?? `i${i}`}`}
                        value={String(sf.id)}
                      >
                        {sf.nombre}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={errors.subfamilia?.message} />
                </div>
              </div>

              {/* 2) Código de Barras */}
              <div>
                <Label htmlFor="codigoBarras">Código de Barras</Label>
                <Input
                  id="codigoBarras"
                  placeholder="7791234567890"
                  {...register("codigoBarras")}
                />
                <FieldError message={errors.codigoBarras?.message} />
              </div>

              {/* 3) Nombre */}
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  placeholder="Ovillo Merino 100 g"
                  {...register("nombre")}
                />
                <FieldError message={errors.nombre?.message} />
              </div>

              {/* 4) Descripción */}
              <div>
                <Label htmlFor="descripcion">Descripción</Label>
                <textarea
                  id="descripcion"
                  className="w-full rounded-lg border px-3 py-2 text-sm min-h-[80px]"
                  placeholder="Madeja de lana merino suave para agujas 4–5 mm"
                  {...(register("descripcion") as any)}
                />
              </div>

              {/* 5) Precios */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="precioCosto">Precio de Costo</Label>
                  <Input
                    id="precioCosto"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="2500"
                    {...register("precioCosto", {
                      valueAsNumber: true,
                      onChange: onCostoChange,
                    })}
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
                    {...register("utilidad", {
                      valueAsNumber: true,
                      onChange: onUtilChange,
                    })}
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

              {/* 6) Umbral y última modificación (sin campo de stock) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bajoMinimoStock">Bajo mínimo</Label>
                  <Input
                    id="bajoMinimoStock"
                    type="number"
                    inputMode="numeric"
                    {...register("bajoMinimoStock", { valueAsNumber: true })}
                  />
                  <FieldError message={errors.bajoMinimoStock?.message} />
                </div>
                <div>
                  <Label htmlFor="ultimaModificacionStock">Última modificación</Label>
                  <Input
                    id="ultimaModificacionStock"
                    type="date"
                    max={todayISO}
                    {...register("ultimaModificacionStock")}
                  />
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
                <button
                  onClick={() => onClose()}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  form="producto-form"
                  disabled={isSubmitting}
                  className="rounded-lg bg-black text-white px-3 py-2 text-sm"
                >
                  {isEdit ? "Guardar Cambios" : "Guardar Producto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* MODAL "VER" */
function ProductoView({ id, onClose }: { id: number; onClose: () => void }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [stockDet, setStockDet] = useState<any | null>(null);
  const [loadingStock, setLoadingStock] = useState(true);
  const [histRows, setHistRows] = useState<any[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const [histPage, setHistPage] = useState(1);
  const [histLimit, setHistLimit] = useState(10);

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

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/products/${id}/stock`);
        setStockDet(data);
      } catch (e) {
        setStockDet(null);
      } finally {
        setLoadingStock(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/products/${id}/historico-precio?limit=${histLimit}&page=${histPage}`);
        setHistRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setHistRows([]);
      } finally {
        setLoadingHist(false);
      }
    })();
  }, [id, histPage, histLimit]);

  const precioFmt = (n: any) =>
    typeof n === "number"
      ? new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 2,
        }).format(n)
      : "-";

  // Reversión a versión anterior: sin cálculo dinámico de columna de código proveedor

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-2xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">Detalle de Producto</h3>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-100"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 text-sm overflow-auto flex-1">
            {loading ? (
              <div className="text-gray-600">Cargando…</div>
            ) : (
              <>
                {/* Resumen */}
                <div className="space-y-2 mb-4">
                  <p className="text-lg font-semibold text-gray-900">
                    {data?.nombre ?? data?.nombreProducto ?? "-"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-700 bg-gray-50">
                      SKU: {data?.sku ?? data?.codigoProducto ?? "-"}
                    </span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-700 bg-gray-50">
                      Código barras: {data?.codigoBarras ?? data?.codigoBarrasProducto ?? "-"}
                    </span>
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

                {/* Precio principal */}
                <div className="rounded-xl border bg-white p-3 mb-4">
                  <p className="text-gray-500">Precio venta público</p>
                  <p className="text-2xl font-semibold">
                    {precioFmt(data?.precio ?? data?.precioVentaPublicoProducto)}
                  </p>
                </div>

                {/* Información agrupada y con mismo estilo de tarjetas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Descripción */}
                  <div className="rounded-xl border bg-white p-3">
                    <p className="text-gray-500">Descripción</p>
                    <p className="font-normal">
                      {data?.descripcion ?? data?.descripcionProducto ?? "-"}
                    </p>
                  </div>

                  {/* Proveedor */}
                  <div className="rounded-xl border bg-white p-3">
                    <p className="text-gray-500">Proveedor</p>
                    <p className="font-medium">
                      {data?.proveedor?.nombre ?? data?.nombreProveedor ?? "-"}
                    </p>
                  </div>

                  {/* Familia + Subfamilia */}
                  <div className="rounded-xl border bg-white p-3">
                    <p className="text-gray-500">Categoría</p>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <p className="text-gray-500 text-xs">Familia</p>
                        <p className="font-medium">
                          {data?.familia?.nombre ?? data?.nombreFamilia ?? "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Subfamilia</p>
                        <p className="font-medium">
                          {data?.subfamilia?.nombre ?? data?.nombreSubfamilia ?? "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stock + Última modificación */}
                  <div className="rounded-xl border bg-white p-3">
                    <p className="text-gray-500">Stock</p>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <p className="text-gray-500 text-xs">Actual</p>
                        <p className={"font-medium " + ((data?.stock ?? 0) <= (data?.bajoMinimoStock ?? -1) && (data?.bajoMinimoStock ?? -1) >= 0 ? "text-red-600" : "") }>
                          {data?.stock ?? 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Última mod.</p>
                        <p className="font-medium">
                          {data?.ultimaModificacionStock
                            ? String(data.ultimaModificacionStock).slice(0, 10)
                            : "-"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <p className="text-gray-500 text-xs">Real</p>
                        <p className="font-medium">{loadingStock ? "..." : Number(stockDet?.real ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Comprometido</p>
                        <p className="font-medium">{loadingStock ? "..." : Number(stockDet?.comprometido ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Bajo mínimo</p>
                        <p className="font-medium">{loadingStock ? "..." : Number(stockDet?.minimo ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">Actualizado</p>
                        <p className="font-medium">
                          {loadingStock
                            ? "..."
                            : stockDet?.actualizadoEn
                            ? String(stockDet.actualizadoEn).slice(0, 10)
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Histórico de precio */}
                <div className="rounded-xl border bg-white p-3 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-500">Histórico de precio</p>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-600">Pág.</label>
                      <input
                        className="w-12 border rounded px-2 py-1 text-xs"
                        type="number"
                        min={1}
                        value={histPage}
                        onChange={(e) => setHistPage(Number(e.target.value) || 1)}
                      />
                      <label className="text-xs text-gray-600">Limite</label>
                      <input
                        className="w-14 border rounded px-2 py-1 text-xs"
                        type="number"
                        min={1}
                        max={100}
                        value={histLimit}
                        onChange={(e) => setHistLimit(Number(e.target.value) || 10)}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-2 py-2 text-left">Fecha</th>
                          <th className="px-2 py-2 text-left">Proveedor</th>
                          <th className="px-2 py-2 text-right">Precio</th>
                          <th className="px-2 py-2 text-left">Código prov.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingHist ? (
                          <tr>
                            <td className="px-2 py-3 text-gray-600" colSpan={4}>Cargando…</td>
                          </tr>
                        ) : histRows.length === 0 ? (
                          <tr>
                            <td className="px-2 py-3 text-gray-600" colSpan={4}>Sin registros</td>
                          </tr>
                        ) : (
                          histRows.map((h, idx) => (
                            <tr key={idx} className={idx % 2 ? "bg-gray-50" : undefined}>
                              <td className="px-2 py-2">{String(h.fechaIngreso ?? "-").slice(0, 10)}</td>
                              <td className="px-2 py-2">{h.nombreProveedor ?? "-"}</td>
                              <td className="px-2 py-2 text-right">
                                {typeof h.precio === "number"
                                  ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 }).format(h.precio)
                                  : "-"}
                              </td>
                              <td className="px-2 py-2">{h.codigoArticuloProveedor ?? ""}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
