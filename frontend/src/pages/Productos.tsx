// src/pages/Productos.tsx
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Search, Plus, Pencil, Trash, X } from "lucide-react";
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

// Esquema del form (UI)
const schema = z.object({
  codigoInterno: z.string().min(1, "Requerido"),
  codigoBarras: z.string().optional(),
  nombre: z.string().min(1, "Requerido"),
  descripcion: z.string().optional(),
  familia: z.string().min(1, "Requerido"),     // guarda id en string
  subfamilia: z.string().min(1, "Requerido"),  // guarda id en string
  precioCosto: z.coerce.number().nonnegative(">= 0"),
  utilidad: z.coerce.number().nonnegative(">= 0"),
  precioVenta: z.coerce.number().nonnegative(">= 0"),
  oferta: z.boolean().optional(),
});
type FormData = z.infer<typeof schema>;

export default function Productos() {
  const [rows, setRows] = useState<Producto[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [subfamilias, setSubfamilias] = useState<Subfamilia[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Producto | null>(null);

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
    const [f, s] = await Promise.all([api.get("/familias"), api.get("/subfamilias")]);

    const fams = (f.data as any[])
      .map((x) => ({
        id: Number(x.id ?? x.idFamilia),
        nombre: String(x.nombre ?? x.tipoFamilia ?? x.nombreFamilia ?? ""),
      }))
      .filter((x) => Number.isFinite(x.id) && x.nombre);

    const subs = (s.data as any[])
      .map((x) => ({
        id: Number(x.id ?? x.idSubFamilia),
        nombre: String(x.nombre ?? x.tipoSubFamilia ?? x.nombreSubFamilia ?? ""),
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

  const columns: ColumnDef<Producto>[] = [
    { header: "ID", accessorKey: "id" },
    { header: "Nombre", accessorKey: "nombre" },
    { header: "SKU", accessorKey: "sku" },
    { header: "Stock", accessorKey: "stock" },
    { header: "Precio", accessorKey: "precio" },
    {
      header: "Acción",
      id: "accion",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
            onClick={() => onEdit(row.original as Producto)}
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
          >
            <Trash className="h-3.5 w-3.5" /> Eliminar
          </button>
        </div>
      ),
      size: 180,
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
              placeholder="Buscar"
              onChange={() => {}}
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
        <DataTable columns={columns} data={rows} />
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
      codigoInterno: "",
      codigoBarras: "",
      nombre: "",
      descripcion: "",
      familia: "",
      subfamilia: "",
      precioCosto: 0,
      utilidad: 0,
      precioVenta: 0,
      oferta: false,
    },
  });

  // si edita, traer datos completos y precargar
  useEffect(() => {
    if (!initial?.id) return;
    (async () => {
      const { data } = await api.get(`/products/${initial.id}`);
      const sfId: number | undefined = data?.subFamiliaId;
      const famId =
        subfamilias.find((sf) => sf.id === sfId)?.familiaId ?? undefined;

      reset({
        codigoInterno: data?.sku ?? "",
        codigoBarras: data?.codigoBarras ?? "",
        nombre: data?.nombre ?? "",
        descripcion: data?.descripcion ?? "",
        familia: famId ? String(famId) : "",
        subfamilia: sfId ? String(sfId) : "",
        precioCosto: Number(data?.precioCosto ?? 0),
        utilidad: Number(data?.utilidad ?? 0),
        precioVenta: Number(data?.precio ?? 0),
        oferta: !!data?.oferta,
      });
    })();
  }, [initial, reset, subfamilias]);

  // cálculo de precio venta
  const calcVenta = (c?: number, u?: number) => {
    const costo = c ?? Number(watch("precioCosto") || 0);
    const util = u ?? Number(watch("utilidad") || 0);
    setValue("precioVenta", Number((costo * (1 + util / 100)).toFixed(2)), {
      shouldValidate: true,
    });
  };
  const onCostoChange = (e: any) => calcVenta(Number(e.target.value), undefined);
  const onUtilChange = (e: any) => calcVenta(undefined, Number(e.target.value));

  // dependencias de selects
  const familiaSelected = watch("familia"); // string id
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
      sku: v.codigoInterno, // UNIQUE
      precio: v.precioVenta,
      precioCosto: v.precioCosto,
      utilidad: v.utilidad,
      descripcion: v.descripcion || null,
      codigoBarras: v.codigoBarras?.trim() || null,
      oferta: !!v.oferta,
      subFamiliaId: Number(v.subfamilia),
    };

    try {
      if (initial?.id) {
        await api.put(`/products/${initial.id}`, payload); // EDIT
      } else {
        await api.post("/products", payload); // CREATE
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
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">
              {initial?.id ? "Editar Producto" : "Agregar Nuevo Producto"}
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
          <div className="p-4 overflow-auto flex-1 space-y-4">
            <form id="producto-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
              {/* Código Interno + Código de Barras */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="codigoInterno">Código Interno</Label>
                  <Input id="codigoInterno" placeholder="LAN-MER-001" {...register("codigoInterno")} />
                  <p className="text-[11px] text-gray-500 mt-1">Formato: Familia-Subfamilia-ID</p>
                  <FieldError message={errors.codigoInterno?.message} />
                </div>
                <div>
                  <Label htmlFor="codigoBarras">Código de Barras</Label>
                  <Input id="codigoBarras" placeholder="7791234567890" {...register("codigoBarras")} />
                  <FieldError message={errors.codigoBarras?.message} />
                </div>
              </div>

              {/* Nombre */}
              <div>
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" placeholder="Ovillo Merino 100 g" {...register("nombre")} />
                <FieldError message={errors.nombre?.message} />
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
                    <option key="empty-fam" value="">
                      Seleccionar familia
                    </option>
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
                    <option key="empty-sub" value="">
                      Seleccionar subfamilia
                    </option>
                    {subfamiliasFiltradas.map((sf, i) => (
                      <option key={`sub-${sf.id ?? `i${i}`}`} value={String(sf.id)}>
                        {sf.nombre}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={errors.subfamilia?.message} />
                </div>
              </div>

              {/* Precio costo / Utilidad / Precio venta */}
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
            </form>
          </div>

          {/* Footer */}
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
