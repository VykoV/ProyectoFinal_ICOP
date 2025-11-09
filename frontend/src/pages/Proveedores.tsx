import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Label, Input } from "../components/ui/Form";
import * as svc from "../lib/api/proveedores";
import { Button } from "@/components/ui/button";

type FormState = Partial<svc.Proveedor>;

export default function ProveedoresPage() {
  const [rows, setRows] = useState<svc.Proveedor[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function load() {
    const res = await svc.getPage({ search, page, pageSize });
    setRows(res.rows);
    setTotal(res.total);
  }
  useEffect(() => {
    load();
  }, [search, page]);

  const cols = useMemo<ColumnDef<svc.Proveedor>[]>(
    () => [
      { accessorKey: "nombreProveedor", header: "Nombre" },
      { accessorKey: "CIF_NIFProveedor", header: "CIF/NIF" },
      { accessorKey: "telefonoProveedor", header: "Teléfono" },
      { accessorKey: "mailProveedor", header: "Email" },
      {
        id: "acciones",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => openEdit(row.original)}>Editar</Button>
            <Button variant="destructive" onClick={() => onDelete(row.original.idProveedor)}>Borrar</Button>
          </div>
        ),
      },
    ],
    []
  );

  function openCreate() {
    setEditing({
      nombreProveedor: "",
      CIF_NIFProveedor: null,
      mailProveedor: null,
      telefonoProveedor: null,
      observacionProveedor: null,
      idLocalidad: null,
    });
    setErrors({});
    setShowModal(true);
  }
  function openEdit(p: svc.Proveedor) {
    setEditing(p);
    setErrors({});
    setShowModal(true);
  }

  async function onDelete(id: number) {
    if (!confirm("¿Eliminar proveedor?")) return;
    try {
      await svc.remove(id);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || "No se pudo eliminar");
    }
  }

  async function onSubmit() {
    if (!editing) return;
    setErrors({});
    const payload = {
      ...editing,
      // normaliza string vacíos a null
      mailProveedor: editing.mailProveedor || null,
      observacionProveedor: editing.observacionProveedor || null,
    };
    try {
      if (editing.idProveedor) {
        await svc.update(editing.idProveedor, payload);
      } else {
        await svc.create(payload);
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.error;
      if (msg) setErrors({ form: msg });
      else setErrors({ form: "Error al guardar" });
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <Label>Buscar</Label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nombre, email u observación"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
        </div>
        <Button onClick={openCreate}>Nuevo proveedor</Button>
      </div>

      <DataTable
        columns={cols}
        data={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl space-y-3">
            <h2 className="text-xl font-semibold">
              {editing.idProveedor ? "Editar proveedor" : "Nuevo proveedor"}
            </h2>
            {errors.form && <div className="text-red-600 text-sm">{errors.form}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={editing.nombreProveedor || ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s!, nombreProveedor: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>CIF/NIF</Label>
                <Input
                  value={editing.CIF_NIFProveedor?.toString() || ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s!, CIF_NIFProveedor: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={editing.telefonoProveedor?.toString() || ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s!, telefonoProveedor: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editing.mailProveedor || ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s!, mailProveedor: e.target.value }))
                  }
                />
              </div>
              <div className="col-span-2">
                <Label>Observación</Label>
                <Input
                  value={editing.observacionProveedor || ""}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s!, observacionProveedor: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button onClick={onSubmit}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
