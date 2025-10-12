// src/pages/PreVentas.tsx
import { useState } from "react";
import { Eye, Search, Plus, Trash2, X, Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Label, Input, Select } from "../components/ui/Form";

type Pre = {
  id: number;
  cliente: string;
  fecha: string;
  estado: "Pendiente" | "Finalizado";
  total: number;
};
const rows: Pre[] = [
  {
    id: 2,
    cliente: "María López",
    fecha: "2025-10-12",
    estado: "Pendiente",
    total: 245,
  },
];

export default function PreVentas() {
  const [open, setOpen] = useState(false);

  const columns: ColumnDef<Pre>[] = [
    { header: "N°", accessorKey: "id" },
    { header: "Cliente", accessorKey: "cliente" },
    { header: "Fecha", accessorKey: "fecha" },
    {
      header: "Estado",
      cell: ({ row }) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            row.original.estado === "Finalizado"
              ? "bg-green-100 text-green-800"
              : "bg-yellow-100 text-yellow-800"
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
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1 border px-2 py-1 text-xs">
            <Eye className="h-3.5 w-3.5" /> Ver
          </button>
          <button className="inline-flex items-center gap-1 border border-green-700 text-green-700 px-2 py-1 text-xs">
            Finalizar
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
              placeholder="Buscar pre-ventas..."
            />
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
          >
            <Plus className="h-4 w-4" /> Nueva Pre-venta
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={rows} />

      {open && <NuevaPreVenta onClose={() => setOpen(false)} />}
    </section>
  );
}

/* Popup pantalla completa */
function NuevaPreVenta({ onClose }: { onClose: () => void }) {
  type Item = {
    id: number;
    producto: string;
    cantidad: number;
    precio: number;
    descuento: number;
  };
  const [items] = useState<Item[]>([
    { id: 1, producto: "Camiseta", cantidad: 2, precio: 7999, descuento: 0 },
    { id: 2, producto: "Pantalón", cantidad: 1, precio: 15999, descuento: 10 },
  ]);

  const descuentosCliente: Record<string, number> = {
    "Juan Pérez": 5,
    "Ana Gómez": 0,
    "María López": 12,
  };
  const [cliente, setCliente] = useState("Juan Pérez");
  const clienteDesc = descuentosCliente[cliente] ?? 0;

  const [descGeneral, setDescGeneral] = useState<number>(0);

  // Cálculos con IVA incluido y extracción en resumen
  const IVA = 0.21;
  const rawIncl = items.reduce((a, i) => a + i.cantidad * i.precio, 0);
  const lineDisc = items.reduce(
    (a, i) => a + i.cantidad * i.precio * ((i.descuento || 0) / 100),
    0
  );
  const afterLine = rawIncl - lineDisc;
  const clientDiscAmt = afterLine * (clienteDesc / 100);
  const afterClient = afterLine - clientDiscAmt;
  const generalDiscAmt = afterClient * (descGeneral / 100);
  const total = afterClient - generalDiscAmt; // con IVA
  const subtotal = total / (1 + IVA); // sin IVA
  const impuestos = total - subtotal; // IVA extraído
  const totalDescuentos = lineDisc + clientDiscAmt + generalDiscAmt;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-7xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">Nueva Pre-venta</h3>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-100"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 overflow-auto flex-1 space-y-6">
            {/* Datos principales */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="cliente">Cliente</Label>
                  {clienteDesc > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-md border bg-green-50 text-green-700 px-2 py-0.5 text-xs">
                      Descuento cliente:{" "}
                      <span className="ml-1 font-medium">{clienteDesc}%</span>
                    </span>
                  )}
                </div>
                <Select
                  id="cliente"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                >
                  {Object.keys(descuentosCliente).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="pago">Método de pago</Label>
                <Select id="pago" defaultValue="Efectivo">
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>Tarjeta</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="obs">Observaciones</Label>
                <Input id="obs" placeholder="Opcional" />
              </div>
            </div>

            {/* Agregar productos */}
            <div className="rounded-2xl border bg-white p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-20 gap-3">
                <div className="relative md:col-span-10">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
                    placeholder="Buscar producto"
                  />
                </div>
                <div className="relative md:col-span-3">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Cantidad"
                  />
                </div>
                <div className="relative md:col-span-3">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="Precio"
                  />
                </div>

                <div className="relative md:col-span-3">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="Descuento %"
                  />
                </div>
                <button
                  className="inline-flex items-center justify-center rounded-lg bg-black text-white p-2"
                  aria-label="Agregar"
                  title="Agregar"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Registros */}
            <div className="rounded-2xl border bg-white p-4">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col style={{ width: "40%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-center">Producto</th>
                    <th className="px-3 py-2 text-center">Cant.</th>
                    <th className="px-3 py-2 text-center">Precio</th>
                    <th className="px-3 py-2 text-center">Desc %</th>
                    <th className="px-3 py-2 text-center">Total</th>
                    <th className="px-3 py-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="px-3 py-2 text-center">{i.producto}</td>
                      <td className="px-3 py-2 text-center">{i.cantidad}</td>
                      <td className="px-3 py-2 text-center">
                        ${i.precio.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">{i.descuento}%</td>
                      <td className="px-3 py-2 text-center">
                        $
                        {(
                          i.cantidad *
                          i.precio *
                          (1 - (i.descuento || 0) / 100)
                        ).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <button className="inline-flex items-center gap-1 border px-2 py-1 text-xs">
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button className="inline-flex items-center gap-1 border px-2 py-1 text-xs">
                            <Trash2 className="h-3.5 w-3.5" /> Quitar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td
                        className="px-3 py-6 text-center text-gray-500"
                        colSpan={6}
                      >
                        Sin productos agregados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Resumen: 1 Subtotal, 2 Impuestos, 3 Descuento general, 4 Descuentos totales, 5 Total */}
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="font-medium">Resumen de la Pre-Venta</h2>
                <span className="rounded-full px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800">
                  Estado: Pendiente
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
                {/* 1) Subtotal */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">
                    Subtotal (sin impuestos)
                  </p>
                  <p className="text-2xl font-semibold">
                    ${subtotal.toFixed(2)}
                  </p>
                </div>

                {/* 2) Impuestos extraídos */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Impuestos extraídos</p>
                  <p className="text-2xl font-semibold">
                    ${impuestos.toFixed(2)}
                  </p>
                </div>

                {/* 3) Descuento general */}
                <div className="rounded-xl border p-4">
                  <label className="block text-xs mb-1 text-gray-600">
                    Descuento general (%)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={descGeneral}
                    onChange={(e) =>
                      setDescGeneral(Number(e.target.value) || 0)
                    }
                    className="w-full rounded-lg border px-2 py-1 text-sm"
                    placeholder="0"
                  />
                </div>

                {/* 4) Descuentos totales realizados */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">
                    Descuentos totales realizados
                  </p>
                  <p className="text-xl font-semibold">
                    ${totalDescuentos.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Ítems: ${lineDisc.toFixed(2)} · Cliente: $
                    {clientDiscAmt.toFixed(2)} · General: $
                    {generalDiscAmt.toFixed(2)}
                  </p>
                </div>

                {/* 5) Total final */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">
                    Total (c/ impuestos y descuentos)
                  </p>
                  <p className="text-2xl font-semibold">${total.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button className="rounded-lg bg-black text-white px-4 py-2">
                Guardar Pre-venta
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
