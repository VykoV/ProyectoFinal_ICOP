import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Search, Plus, Pencil, Trash } from "lucide-react";

type Proveedor = { id: number; nombre: string; cuit: string };

const data: Proveedor[] = [
  { id: 1, nombre: "Textiles SA", cuit: "30-61234567-8" },
  { id: 2, nombre: "Calzados SRL", cuit: "30-60987654-3" },
];

export default function Proveedores() {
  const columns: ColumnDef<Proveedor>[] = [
    { header: "ID", accessorKey: "id" },
    { header: "Nombre", accessorKey: "nombre" },
    { header: "CUIT", accessorKey: "cuit" },
    {
      header: "Acción",
      id: "accion",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
            <Trash className="h-3.5 w-3.5" /> Eliminar
          </button>
        </div>
      ),
      size: 160,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Proveedores</h1>

        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm" placeholder="Buscar" />
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2">
            <Plus className="h-4 w-4" />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data} />
    </section>
  );
}
