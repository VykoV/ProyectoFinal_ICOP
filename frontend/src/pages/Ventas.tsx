import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Search, Eye, Plus, X, Trash2, Pencil } from "lucide-react";
import { Label, Input, Select } from "../components/ui/Form";

/* ─────────── Tipos y data de tabla ─────────── */
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

/* ─────────── Página ─────────── */
export default function Ventas() {
  const [tab, setTab] = useState<"ventas" | "preventas">("ventas");
  const [open, setOpen] = useState(false);

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
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
        >
          <Plus className="h-4 w-4" />
          <span>Registrar Nueva Venta</span>
        </button>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab("ventas")}
          className={`px-4 py-2 text-sm font-medium ${tab === "ventas" ? "border-b-2 border-black text-black" : "text-gray-500"}`}
        >
          Ventas
        </button>
        <button
          onClick={() => setTab("preventas")}
          className={`px-4 py-2 text-sm font-medium ${tab === "preventas" ? "border-b-2 border-black text-black" : "text-gray-500"}`}
        >
          Pre-Ventas Pendientes
        </button>
      </div>

      <div className="relative w-64">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm" placeholder="Buscar ventas..." />
      </div>

      <DataTable columns={tab === "ventas" ? columnsVentas : columnsPreVentas} data={tab === "ventas" ? ventas : preVentas} />

      {open && <VentaPopup onClose={() => setOpen(false)} />}
    </section>
  );
}

/* ─────────── Popup: Registrar Nueva Venta (con desc. cliente y desc. general) ─────────── */
function VentaPopup({ onClose }: { onClose: () => void }) {
  type Item = { id:number; producto:string; cantidad:number; precio:number; descuento:number }; // % por ítem
  const [items] = useState<Item[]>([
    { id:1, producto:"Ovillo Merino 100 g", cantidad:2, precio:3999, descuento:0 },
    { id:2, producto:"Agujas 4 mm", cantidad:1, precio:1999, descuento:5 },
  ]);

  // Cliente + descuento por cliente
  const descuentosCliente: Record<string, number> = { "Juan Pérez": 5, "Ana Gómez": 0, "María López": 12 };
  const [cliente, setCliente] = useState("Juan Pérez");
  const clienteDesc = descuentosCliente[cliente] ?? 0;

  const [metodo, setMetodo] = useState("Efectivo");
  const [estadoPago, setEstadoPago] = useState<"Pendiente"|"Finalizado">("Pendiente");
  const [moneda, setMoneda] = useState("ARS");
  const [ajuste, setAjuste] = useState<number>(0);
  const [descGeneral, setDescGeneral] = useState<number>(0);
  const [obs, setObs] = useState("");

  // Cálculos: precios con IVA incluido; extraer IVA y aplicar descuentos
  const IVA = 0.21;
  const rawIncl = items.reduce((a,i)=> a + i.cantidad * i.precio, 0);
  const lineDisc = items.reduce((a,i)=> a + i.cantidad * i.precio * ((i.descuento||0)/100), 0);
  const afterLine = rawIncl - lineDisc;
  const clientDiscAmt = afterLine * (clienteDesc/100);
  const afterClient = afterLine - clientDiscAmt;
  const generalDiscAmt = afterClient * (descGeneral/100);
  const afterAllDiscounts = afterClient - generalDiscAmt; // aún con IVA
  const totalFinal = afterAllDiscounts + ajuste;          // ajuste ±

  const subtotal = totalFinal / (1 + IVA); // sin IVA
  const impuestos = totalFinal - subtotal; // IVA extraído
  const descuentosTotales = lineDisc + clientDiscAmt + generalDiscAmt;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-6xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">Registrar Nueva Venta</h3>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-auto flex-1 space-y-6">
            {/* Datos principales */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cliente">Cliente</Label>
                  {clienteDesc > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-md border bg-green-50 text-green-700 px-2 py-0.5 text-xs">
                      Descuento cliente: <span className="ml-1 font-medium">{clienteDesc}%</span>
                    </span>
                  )}
                </div>
                <Select id="cliente" value={cliente} onChange={(e)=>setCliente(e.target.value)}>
                  {Object.keys(descuentosCliente).map(n=> <option key={n}>{n}</option>)}
                </Select>
              </div>

              <div>
                <Label htmlFor="pago">Método de pago</Label>
                <Select id="pago" value={metodo} onChange={(e)=>setMetodo(e.target.value)}>
                  <option>Efectivo</option>
                  <option>Transferencia</option>
                  <option>Tarjeta</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="estado">Estado de pago</Label>
                <Select id="estado" value={estadoPago} onChange={(e)=>setEstadoPago(e.target.value as "Pendiente"|"Finalizado")}>
                  <option>Pendiente</option>
                  <option>Finalizado</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="moneda">Unidad monetaria</Label>
                <Select id="moneda" value={moneda} onChange={(e)=>setMoneda(e.target.value)}>
                  <option>ARS</option>
                  <option>USD</option>
                  <option>EUR</option>
                </Select>
              </div>

              <div className="lg:col-span-3">
                <Label htmlFor="obs">Observaciones</Label>
                <Input id="obs" placeholder="Opcional" value={obs} onChange={(e)=>setObs(e.target.value)} />
              </div>
            </div>

            {/* Div 1: Agregar productos */}
            <div className="rounded-2xl border bg-white p-4 space-y-3">
              <h2 className="sr-only">Agregar Productos</h2>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm" placeholder="Buscar producto" />
                </div>
                <Input type="number" inputMode="numeric" placeholder="Cantidad" />
                <Input type="number" inputMode="decimal" step="0.01" placeholder="Precio" />
                <Input type="number" inputMode="decimal" step="0.01" placeholder="Descuento %" />
                <button className="inline-flex items-center justify-center rounded-lg bg-black text-white p-2" aria-label="Agregar" title="Agregar">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Div 2: Registros */}
            <div className="rounded-2xl border bg-white p-4">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col style={{ width: "48%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
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
                  {items.map((i)=>(
                    <tr key={i.id} className="border-t">
                      <td className="px-3 py-2 text-center">{i.producto}</td>
                      <td className="px-3 py-2 text-center">{i.cantidad}</td>
                      <td className="px-3 py-2 text-center">${i.precio.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">{i.descuento}%</td>
                      <td className="px-3 py-2 text-center">
                        ${(i.cantidad*i.precio*(1-(i.descuento||0)/100)).toFixed(2)}
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
                  {items.length===0 && (
                    <tr><td className="px-3 py-6 text-center text-gray-500" colSpan={6}>Sin productos agregados</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Resumen de la venta */}
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="font-medium">Resumen de la Venta</h2>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${estadoPago==="Finalizado" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                  Estado de pago: {estadoPago}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
                {/* 1) Subtotal */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Subtotal (sin impuestos)</p>
                  <p className="text-2xl font-semibold">{moneda} ${subtotal.toFixed(2)}</p>
                </div>

                {/* 2) Impuestos */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Impuestos extraídos</p>
                  <p className="text-2xl font-semibold">{moneda} ${impuestos.toFixed(2)}</p>
                </div>

                {/* 3) Descuento general (%) */}
                <div className="rounded-xl border p-4">
                  <label className="block text-xs mb-1 text-gray-600">Descuento general (%)</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={descGeneral}
                    onChange={(e)=>setDescGeneral(Number(e.target.value)||0)}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Aplica sobre el total tras descuentos de ítems y de cliente.
                  </p>
                </div>

                {/* 4) Ajuste ± */}
                <div className="rounded-xl border p-4">
                  <label className="block text-xs mb-1">Ajuste (±)</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={ajuste}
                    onChange={(e)=>setAjuste(Number(e.target.value)||0)}
                    placeholder="Ej: -5 o 10"
                  />
                  <p className="mt-1 text-xs text-gray-500">Positivo suma. Negativo resta.</p>
                </div>

                {/* 5) Total */}
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Total (c/ impuestos, descuentos y ajuste)</p>
                  <p className="text-2xl font-semibold">{moneda} ${totalFinal.toFixed(2)}</p>
                </div>
              </div>

              {/* Nota breve de descuentos */}
              <p className="mt-3 text-xs text-gray-500">
                Descuentos aplicados · Ítems: ${lineDisc.toFixed(2)} · Cliente: ${clientDiscAmt.toFixed(2)} · General: ${generalDiscAmt.toFixed(2)} · Total desc.: ${descuentosTotales.toFixed(2)}
              </p>
            </div>

            {/* Guardar */}
            <div className="flex items-center justify-end">
              <button className="rounded-lg bg-black text-white px-4 py-2">Guardar Venta</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
