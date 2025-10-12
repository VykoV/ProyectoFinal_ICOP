import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Search, Plus, Pencil, Trash } from "lucide-react";
import Modal from "../components/Modal.tsx"; 
import { useState } from "react";
import { useForm, type SubmitHandler, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label, Input, FieldError } from "../components/ui/Form";
import type { Producto } from "../types";

const schema = z.object({
  nombre: z.string().min(1, "Requerido"),
  sku: z.string().min(1, "Requerido"),
  stock: z.coerce.number().int().nonnegative(">= 0"),
  precio: z.coerce.number().nonnegative(">= 0"),
});
type FormData = z.infer<typeof schema>;

const seed: Producto[] = [
  { id: 1, nombre: "Camiseta", sku: "CAM-001", stock: 25, precio: 7999 },
  { id: 2, nombre: "Pantalón", sku: "PAN-002", stock: 12, precio: 15999 },
  { id: 3, nombre: "Zapatillas", sku: "ZAP-003", stock: 7, precio: 34999 },
];

export default function Productos() {
  const [rows] = useState<Producto[]>(seed); // solo UI
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);

  const {
  register,
  handleSubmit,
  reset,
  formState: { errors, isSubmitting },
} = useForm<FormData>({
  resolver: zodResolver(schema) as Resolver<FormData>,
  defaultValues: { nombre: "", sku: "", stock: 0, precio: 0 },
});

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
            onClick={() => {
              setEditing(row.original);
              reset({ nombre: row.original.nombre, sku: row.original.sku, stock: row.original.stock, precio: row.original.precio });
              setOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
            <Trash className="h-3.5 w-3.5" /> Eliminar
          </button>
        </div>
      ),
      size: 180,
    },
  ];

  function onNew() {
    setEditing(null);
    reset({ nombre: "", sku: "", stock: 0, precio: 0 });
    setOpen(true);
  }

  const onSubmit: SubmitHandler<FormData> = (_) => {
  setOpen(false);
};

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Productos</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm" placeholder="Buscar" />
          </div>
          <button onClick={onNew} className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2">
            <Plus className="h-4 w-4" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={rows} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Editar producto" : "Nuevo producto"}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm">Cancelar</button>
            <button form="producto-form" disabled={isSubmitting} className="rounded-lg bg-black text-white px-3 py-2 text-sm">
              Guardar
            </button>
          </div>
        }
      >
        <form id="producto-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
          <div>
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...register("nombre")} />
            <FieldError message={errors.nombre?.message} />
          </div>
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" {...register("sku")} />
            <FieldError message={errors.sku?.message} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="stock">Stock</Label>
              <Input id="stock" type="number" inputMode="numeric" {...register("stock", { valueAsNumber: true })} />
              <FieldError message={errors.stock?.message} />
            </div>
            <div>
              <Label htmlFor="precio">Precio</Label>
              <Input id="precio" type="number" step="0.01" inputMode="decimal" {...register("precio", { valueAsNumber: true })} />
              <FieldError message={errors.precio?.message} />
            </div>
          </div>
        </form>
      </Modal>
    </section>
  );
}

