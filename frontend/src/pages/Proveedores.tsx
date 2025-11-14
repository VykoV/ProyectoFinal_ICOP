import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Label, Input } from "../components/ui/Form";
import * as svc from "../lib/api/proveedores";
import { Button } from "@/components/ui/button";
import { X, Pencil, Trash2, Search, Plus, Eye, Phone, Mail, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import { showAlert, askConfirm } from "../lib/alerts";

type FormState = Partial<svc.Proveedor>;

export default function ProveedoresPage() {
  const [rows, setRows] = useState<svc.Proveedor[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [openFiltros, setOpenFiltros] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openView, setOpenView] = useState(false);
  const [viewItem, setViewItem] = useState<svc.Proveedor | null>(null);

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
      { accessorKey: "telefonoProveedor", header: "Teléfono" },
      { accessorKey: "mailProveedor", header: "Email" },
      {
        id: "acciones",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-black text-black px-2 py-1 text-xs hover:bg-black hover:text-white"
              onClick={() => onView(row.original.idProveedor)}
            >
              <Eye className="h-3 w-3" />
              Ver
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-black text-black px-2 py-1 text-xs hover:bg-black hover:text-white"
              onClick={() => openEdit(row.original)}
            >
              <Pencil className="h-3 w-3" />
              Editar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-black text-black px-2 py-1 text-xs hover:bg-black hover:text-white"
              onClick={() => onDelete(row.original)}
            >
              <Trash2 className="h-3 w-3" />
              Borrar
            </button>
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
  async function onView(id: number) {
    try {
      const p = await svc.getOne(id);
      setViewItem(p);
      setOpenView(true);
    } catch (e) {
      console.error(e);
    }
  }
  function openEdit(p: svc.Proveedor) {
    setEditing(p);
    setErrors({});
    setShowModal(true);
  }

  async function onDelete(item: svc.Proveedor) {
    const ok = await askConfirm({
      title: "Eliminar proveedor",
      message: `¿Deseas eliminar al proveedor "${item.nombreProveedor}"?`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      type: "warning",
    });
    if (!ok) return;
    try {
      await svc.remove(item.idProveedor!);
      await load();
    } catch (e: any) {
      const msg: string | undefined = e?.response?.data?.error;
      const status: number | undefined = e?.response?.status;
      const message = status === 409 || (msg && /compra/i.test(msg))
        ? "No se puede eliminar el proveedor porque tiene compras realizadas."
        : (msg || "No se pudo eliminar el proveedor");
      await showAlert({ type: "error", title: "No se puede eliminar", message });
    }
  }

  async function onSubmit() {
    if (!editing) return;
    setErrors({});
    // Validaciones: requeridos y duplicados
    const nextErrors: Record<string, string> = {};
    const missing: string[] = [];
    const nombreKey = (editing.nombreProveedor || "").trim();
    if (!nombreKey) {
      nextErrors.nombreProveedor = "required";
      missing.push("Nombre");
    }
    if (missing.length > 0) {
      setErrors(nextErrors);
      toast.error(`Faltan completar: ${missing.join(", ")}`);
      return;
    }

    // Duplicados: nombre y email (si email presente). Observación se permite duplicar.
    const nombreKeyLower = nombreKey.toLowerCase();
    const emailKeyLower = (editing.mailProveedor || "").trim().toLowerCase();
    const conflictNombre = rows.some(
      (r) => r.nombreProveedor.trim().toLowerCase() === nombreKeyLower && (editing.idProveedor ? r.idProveedor !== editing.idProveedor : true)
    );
    const conflictEmail = emailKeyLower
      ? rows.some(
          (r) => (r.mailProveedor || "").trim().toLowerCase() === emailKeyLower && (editing.idProveedor ? r.idProveedor !== editing.idProveedor : true)
        )
      : false;
    if (conflictNombre || conflictEmail) {
      const mensajes = [
        conflictNombre ? "El nombre de proveedor ya está registrado" : null,
        conflictEmail ? "El correo de proveedor ya está registrado" : null,
      ]
        .filter(Boolean)
        .join("\n");
      await showAlert({ type: "error", title: "Datos duplicados", message: mensajes || "Nombre o correo ya registrados" });
      return;
    }
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
    <section className="space-y-4">
      {/* Título + botón Nuevo proveedor (como Presupuestos) */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Proveedores</h1>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
        >
          <Plus className="h-4 w-4" /> Nuevo proveedor
        </button>
      </div>

      {/* Buscador + botón de filtros + contador (como Presupuestos) */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="relative w-64 sm:w-72 md:w-80 lg:w-96 xl:w-[32rem] flex-1 min-w-[14rem]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
            placeholder="Buscar por nombre, email u observación…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearch("");
            }}
          />
        </div>
        <button className="rounded border px-3 py-2" onClick={() => setOpenFiltros(true)}>Filtros</button>
        <span className="ml-auto text-xs text-gray-600">
          {(() => {
            const startIdx = (Math.max(1, page) - 1) * pageSize;
            const endIdx = Math.min(startIdx + rows.length, total);
            const from = total === 0 ? 0 : startIdx + 1;
            return `Mostrando ${from}–${endIdx} de ${total}`;
          })()}
        </span>
      </div>

      <DataTable
        columns={cols}
        data={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      {/* Popup de filtros (estilo Presupuestos) */}
      {openFiltros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg md:max-w-xl lg:max-w-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-medium">Filtros de Proveedores</h2>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => setOpenFiltros(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Orden</span>
                <select className="rounded border px-2 py-1" defaultValue="asc">
                  <option value="asc">Ascendente (Nombre)</option>
                  <option value="desc">Descendente (Nombre)</option>
                </select>
                <span className="text-gray-600 ml-auto">Email</span>
                <select className="rounded border px-2 py-1" defaultValue="todas">
                  <option value="todas">Todos</option>
                  <option value="con">Con Email</option>
                  <option value="sin">Sin Email</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm" onClick={() => {}}>
                <X className="h-3.5 w-3.5" /> Borrar filtros
              </button>
              <button className="rounded border px-3 py-1 text-sm" onClick={() => setOpenFiltros(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

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
                  className={errors.nombreProveedor ? "border-red-500" : undefined}
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

      {openView && viewItem && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpenView(false)} />
          <div className="fixed inset-0 z-50 p-0 md:p-4">
            <div className="h-full flex items-center justify-center">
              <div className="mx-auto w-full max-w-2xl md:rounded-2xl border bg-white shadow-xl">
                {/* Header estilizado */}
                <div className="relative px-6 py-5 border-b bg-gradient-to-r from-slate-50 to-white">
                  <button onClick={() => setOpenView(false)} className="absolute right-3 top-3 p-2 rounded hover:bg-gray-100" aria-label="Cerrar">
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center font-semibold">
                      {(viewItem.nombreProveedor || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{viewItem.nombreProveedor}</h3>
                      <p className="text-xs text-gray-500">Proveedor</p>
                    </div>
                  </div>
                </div>

                {/* Contenido con mejor estética */}
                <div className="p-6 space-y-6">
                  {/* Contacto */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Phone className="h-4 w-4" />
                        <span className="text-sm font-medium">Teléfono</span>
                      </div>
                      <p className={`mt-2 text-sm ${viewItem.telefonoProveedor ? "text-gray-900" : "text-gray-400"}`}>
                        {viewItem.telefonoProveedor || "No especificado"}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Mail className="h-4 w-4" />
                        <span className="text-sm font-medium">Email</span>
                      </div>
                      <p className={`mt-2 text-sm ${viewItem.mailProveedor ? "text-gray-900" : "text-gray-400"}`}>
                        {viewItem.mailProveedor || "No especificado"}
                      </p>
                    </div>
                  </div>

                  {/* Observación */}
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Info className="h-4 w-4" />
                      <span className="text-sm font-medium">Observación</span>
                    </div>
                    <p className={`mt-2 text-sm ${viewItem.observacionProveedor ? "text-gray-900" : "text-gray-400"}`}>
                      {viewItem.observacionProveedor || "Sin observaciones"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
