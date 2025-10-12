import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import Modal from "../components/Modal";
import { Label, Input, Select } from "../components/ui/Form";
import { Search, Plus } from "lucide-react";

type Cliente = { id: number; cuil: string; nombre: string; apellido: string; email: string; telefono: string };
type ClienteForm = {
  cuil: string;
  nombre: string;
  apellido: string;
  tipo: "Minorista" | "Mayorista" | "Empresa";
  nivel: "Bronce" | "Plata" | "Oro";
  provincia: string;
  localidad: string;
  telefono: string;
  email: string;
  observaciones: string;
};

const data: Cliente[] = [
  { id: 1, cuil: "20-12345678-3", nombre: "Juan", apellido: "Pérez", email: "juan@correo.com", telefono: "11 5555-5555" },
];

export default function Clientes() {
  const [open, setOpen] = useState(false);
  const columns: ColumnDef<Cliente>[] = [
    { header: "ID", accessorKey: "id" },
    { header: "CUIL/CUIT", accessorKey: "cuil" },
    { header: "Nombre", cell: ({ row }) => `${row.original.nombre} ${row.original.apellido}` },
    { header: "Email", accessorKey: "email" },
    { header: "Teléfono", accessorKey: "telefono" },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm" placeholder="Buscar clientes..." />
          </div>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2">
            <Plus className="h-4 w-4" />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      <DataTable columns={columns} data={data} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo Cliente"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm">Cancelar</button>
            <button className="rounded-lg bg-black text-white px-3 py-2 text-sm">Guardar Cliente</button>
          </div>
        }
      >
        <form className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="cuil">CUIL/CUIT</Label>
              <Input id="cuil" placeholder="20-12345678-3" />
            </div>
            <div>
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" placeholder="Nombre" />
            </div>
            <div>
              <Label htmlFor="apellido">Apellido</Label>
              <Input id="apellido" placeholder="Apellido" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="tipo">Tipo de cliente</Label>
              <Select id="tipo" defaultValue="Minorista">
                <option>Minorista</option>
                <option>Mayorista</option>
                <option>Empresa</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="nivel">Nivel de cliente</Label>
              <Select id="nivel" defaultValue="Bronce">
                <option>Bronce</option>
                <option>Plata</option>
                <option>Oro</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="provincia">Provincia</Label>
              <Select id="provincia" defaultValue="Buenos Aires">
                <option>Buenos Aires</option>
                <option>Córdoba</option>
                <option>Santa Fe</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="localidad">Localidad</Label>
              <Select id="localidad" defaultValue="La Plata">
                <option>La Plata</option>
                <option>Rosario</option>
                <option>Córdoba Capital</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="tel">Teléfono</Label>
              <Input id="tel" placeholder="11 5555-5555" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" placeholder="correo@dominio.com" />
            </div>
          </div>

          <div>
            <Label htmlFor="obs">Observaciones</Label>
            <textarea id="obs" className="w-full rounded-lg border px-3 py-2 text-sm min-h-24" placeholder="Notas u observaciones..." />
          </div>
        </form>
      </Modal>
    </section>
  );
}
