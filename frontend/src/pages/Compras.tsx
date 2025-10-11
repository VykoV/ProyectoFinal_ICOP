import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Search, Plus, Eye } from "lucide-react";

type Compra = {
  id: number;
  proveedor: string;
  fecha: string;
  metodoPago: string;
  estado: "Pagado" | "Pendiente";
  total: number;
};

const data: Compra[] = [
  { id: 1, proveedor: "Textiles SA", fecha: "2025-10-12", metodoPago: "Transferencia", estado: "Pagado", total: 310.5 },
  { id: 2, proveedor: "Calzados SRL", fecha: "2025-10-13", metodoPago: "Efectivo", estado: "Pendiente", total: 129.9 },
];

export default function Compras() {
  const columns: ColumnDef<Compra>[] = [
    { header: "N° Compra", accessorKey: "id" },
    { header: "Proveedor", accessorKey: "proveedor" },
    { header: "Fecha", accessorKey: "fecha" },
    { header: "Método de Pago", accessorKey: "metodoPago" },
    {
      header: "Estado",
      cell: ({ row }) => (
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            row.original.estado === "Pagado" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {row.original.estado}
        </span>
      ),
    },
    {
      header: "Total",
      accessorKey: "total",
      cell: ({ getValue }) => `$${getValue<number>().toFixed(2)}`,
    },
    {
      header: "Acciones",
      id: "acciones",
      cell: () => (
        <button className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
          <Eye className="h-3.5 w-3.5" /> Ver
        </button>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Compras</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm" placeholder="Buscar compras..." />
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2">
            <Plus className="h-4 w-4" />
            <span>Nueva Compra</span>
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data} />
    </section>
  );
}
