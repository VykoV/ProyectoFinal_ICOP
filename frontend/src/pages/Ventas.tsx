import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Search, Eye } from "lucide-react";

type Venta = {
  id: number;
  cliente: string;
  fecha: string;
  metodoPago: string;
  estado: string;
  total: number;
};

const ventas: Venta[] = [
  { id: 1, cliente: "Juan Pérez", fecha: "2025-10-11", metodoPago: "Efectivo", estado: "Pagado", total: 559.63 },
];

const preVentas: Venta[] = [
  { id: 2, cliente: "María López", fecha: "2025-10-12", metodoPago: "Pendiente", estado: "Pendiente", total: 245.0 },
];

export default function Ventas() {
  const [tab, setTab] = useState<"ventas" | "preventas">("ventas");

  const columnsVentas: ColumnDef<Venta>[] = [
    { header: "N° Venta", accessorKey: "id" },
    { header: "Cliente", accessorKey: "cliente" },
    { header: "Fecha", accessorKey: "fecha" },
    { header: "Método de Pago", accessorKey: "metodoPago" },
    {
      header: "Estado",
      cell: ({ row }) => (
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            row.original.estado === "Pagado" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
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
      cell: () => (
        <button className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
          <Eye className="h-3.5 w-3.5" /> Ver
        </button>
      ),
    },
  ];

  const columnsPreVentas: ColumnDef<Venta>[] = [
    { header: "N° Venta", accessorKey: "id" },
    { header: "Cliente", accessorKey: "cliente" },
    { header: "Fecha", accessorKey: "fecha" },
    {
      header: "Estado",
      cell: ({ row }) => (
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            row.original.estado === "Finalizado" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
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
      cell: () => (
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
            <Eye className="h-3.5 w-3.5" /> Ver
          </button>
          <button className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-green-700 border-green-700">
            Finalizar
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Gestión de Ventas</h1>
        <button className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2">
          <span>+ Nueva Venta</span>
        </button>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab("ventas")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "ventas" ? "border-b-2 border-black text-black" : "text-gray-500"
          }`}
        >
          Ventas
        </button>
        <button
          onClick={() => setTab("preventas")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "preventas" ? "border-b-2 border-black text-black" : "text-gray-500"
          }`}
        >
          Pre-Ventas Pendientes
        </button>
      </div>

      <div className="relative w-64">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm" placeholder="Buscar ventas..." />
      </div>

      <DataTable columns={tab === "ventas" ? columnsVentas : columnsPreVentas} data={tab === "ventas" ? ventas : preVentas} />
    </section>
  );
}
