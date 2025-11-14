import { useEffect, useState } from "react";
import { fmtPrice } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { listMonedas, updatePrecioMoneda, updateMoneda, createMoneda, deleteMoneda } from "../lib/api/monedas";
import type { MonedaRow } from "../lib/api/monedas";
import Modal from "../components/Modal";
import { Label, Input, FieldError } from "../components/ui/Form";
import { Plus, Pencil, Trash } from "lucide-react";

function HoursBadge({ updatedAt }: { updatedAt?: string | null }) {
  if (!updatedAt) return null;
  const diffMs = Date.now() - new Date(updatedAt).getTime();
  const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${hours >= 24 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
      Actualizada hace {hours} h
    </span>
  );
}

export default function Monedas() {
  const [rows, setRows] = useState<MonedaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasRole } = useAuth();

  // Estado para formulario de nueva moneda
  const [openNew, setOpenNew] = useState(false);
  const [nombreNew, setNombreNew] = useState("");
  const [precioNew, setPrecioNew] = useState("");
  const [errNew, setErrNew] = useState<string | null>(null);
  const [savingNew, setSavingNew] = useState(false);

  // Estado para edición de moneda
  const [openEdit, setOpenEdit] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editPrecio, setEditPrecio] = useState("");
  const [errEdit, setErrEdit] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [current, setCurrent] = useState<MonedaRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listMonedas();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function abrirEditar(r: MonedaRow) {
    setCurrent(r);
    setEditNombre(r.nombre);
    setEditPrecio(String(r.precio));
    setErrEdit(null);
    setOpenEdit(true);
  }

  async function agregarMoneda() {
    setErrNew(null);
    setNombreNew("");
    setPrecioNew("");
    setOpenNew(true);
  }

  async function eliminarMoneda(r: MonedaRow) {
    const ok = window.confirm(`¿Eliminar moneda ${r.nombre}?`);
    if (!ok) return;
    try {
      await deleteMoneda(r.id);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || "No se pudo eliminar la moneda");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Monedas</h1>
        {hasRole("Administrador") && (
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
            onClick={agregarMoneda}
          >
            <Plus className="h-4 w-4" />
            <span>Agregar moneda</span>
          </button>
        )}
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">Moneda</th>
              <th className="px-3 py-2 text-right">Precio</th>
              <th className="px-3 py-2 text-left">Actualización</th>
              <th className="px-3 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-3 text-gray-600" colSpan={4}>Cargando…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-gray-600" colSpan={4}>Sin monedas</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.nombre}</td>
                  <td className="px-3 py-2 text-right">${fmtPrice(r.precio, { minFraction: 2, maxFraction: 2 })}</td>
                  <td className="px-3 py-2"><HoursBadge updatedAt={r.updatedAt} /></td>
                  <td className="px-3 py-2 text-center">
                    {hasRole("Administrador") ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="rounded border px-2 py-1 text-xs inline-flex items-center gap-1"
                          onClick={() => abrirEditar(r)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          className="rounded border px-2 py-1 text-xs inline-flex items-center gap-1"
                          onClick={() => eliminarMoneda(r)}
                        >
                          <Trash className="h-3.5 w-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">Solo lectura</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal nueva moneda */}
      <Modal
        open={openNew}
        title="Nueva moneda"
        onClose={() => setOpenNew(false)}
        centered
        footer={
          <div className="flex items-center justify-end gap-2">
            <button className="rounded border px-3 py-1 text-sm" onClick={() => setOpenNew(false)}>
              Cancelar
            </button>
            <button
              className="rounded bg-black text-white px-3 py-1 text-sm"
              disabled={savingNew}
              onClick={async () => {
                setErrNew(null);
                const nombre = nombreNew.trim();
                const precio = Number(precioNew);
                if (!nombre) {
                  setErrNew("Nombre requerido");
                  return;
                }
                if (!Number.isFinite(precio) || precio < 0) {
                  setErrNew("Precio inválido");
                  return;
                }
                try {
                  setSavingNew(true);
                  await createMoneda(nombre, precio);
                  setOpenNew(false);
                  await load();
                } catch (e: any) {
                  setErrNew(e?.response?.data?.error || e?.message || "No se pudo crear la moneda");
                } finally {
                  setSavingNew(false);
                }
              }}
            >
              Guardar
            </button>
          </div>
        }
      >
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <div>
            <Label htmlFor="mNombre">Nombre</Label>
            <Input id="mNombre" value={nombreNew} onChange={(e) => setNombreNew(e.target.value)} placeholder="Ej: USD" />
          </div>
          <div>
            <Label htmlFor="mPrecio">Precio</Label>
            <Input id="mPrecio" type="number" step="0.01" value={precioNew} onChange={(e) => setPrecioNew(e.target.value)} />
          </div>
          <FieldError message={errNew ?? undefined} />
        </form>
      </Modal>

      {/* Modal editar moneda */}
      <Modal
        open={openEdit}
        title="Editar moneda"
        onClose={() => setOpenEdit(false)}
        centered
        footer={
          <div className="flex items-center justify-end gap-2">
            <button className="rounded border px-3 py-1 text-sm" onClick={() => setOpenEdit(false)}>
              Cancelar
            </button>
            <button
              className="rounded bg-black text-white px-3 py-1 text-sm"
              disabled={savingEdit}
              onClick={async () => {
                setErrEdit(null);
                const nombre = editNombre.trim();
                const precio = Number(editPrecio);
                if (!current) return;
                if (!nombre) {
                  setErrEdit("Nombre requerido");
                  return;
                }
                if (!Number.isFinite(precio) || precio < 0) {
                  setErrEdit("Precio inválido");
                  return;
                }
                try {
                  setSavingEdit(true);
                  await updateMoneda(current.id, { nombre, precio });
                  setOpenEdit(false);
                  await load();
                } catch (e: any) {
                  setErrEdit(e?.response?.data?.error || e?.message || "No se pudo actualizar la moneda");
                } finally {
                  setSavingEdit(false);
                }
              }}
            >
              Guardar
            </button>
          </div>
        }
      >
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <div>
            <Label htmlFor="eNombre">Nombre</Label>
            <Input id="eNombre" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ePrecio">Precio</Label>
            <Input id="ePrecio" type="number" step="0.01" value={editPrecio} onChange={(e) => setEditPrecio(e.target.value)} />
          </div>
          <FieldError message={errEdit ?? undefined} />
        </form>
      </Modal>
    </section>
  );
}