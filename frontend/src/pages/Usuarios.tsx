import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Search, Plus, Pencil, Trash } from "lucide-react";

type Usuario = { id: number; nombre: string; email: string; rol: string };

const data: Usuario[] = [
  { id: 1, nombre: "Juan Pérez", email: "juan@correo.com", rol: "Administrador" },
  { id: 2, nombre: "Ana Gómez", email: "ana@correo.com", rol: "Vendedor" },
];

export default function Usuarios() {
  const columns: ColumnDef<Usuario>[] = [
    { header: "ID", accessorKey: "id" },
    { header: "Nombre", accessorKey: "nombre" },
    { header: "Email", accessorKey: "email" },
    { header: "Rol", accessorKey: "rol" },
    {
      header: "Acción",
      id: "accion",
      cell: () => (
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
            <Trash className="h-3.5 w-3.5" /> Eliminar
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm" placeholder="Buscar" />
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2">
            <Plus className="h-4 w-4" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data} />
    </section>
  );
}
