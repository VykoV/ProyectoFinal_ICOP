import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { Search, Pencil, Trash, Plus, X } from "lucide-react";
import { DataTable } from "../components/DataTable";
import { api } from "../lib/api";

// =============== Modal ===============
type NuevoUsuarioModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  submitLabel: string;
  form: {
    nombreUsuario: string;
    emailUsuario: string;
    contrasenaUsuario: string;
    idRol: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      nombreUsuario: string;
      emailUsuario: string;
      contrasenaUsuario: string;
      idRol: string;
    }>
  >;
  roles: { id: number; nombre: string; comentario: string | null }[];
  comentarioRol: string;
  setComentarioRol: React.Dispatch<React.SetStateAction<string>>;
  handleSubmit: (e: React.FormEvent) => void;
};

function NuevoUsuarioModal({
  open,
  onClose,
  title,
  submitLabel,
  form,
  setForm,
  roles,
  comentarioRol,
  setComentarioRol,
  handleSubmit,
}: NuevoUsuarioModalProps): React.ReactElement | null {
  if (!open) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (name === "idRol") {
      const r = roles.find((x) => String(x.id) === value);
      setComentarioRol(r?.comentario ?? "");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3">×</button>
        <h2 className="text-lg font-semibold mb-4">{title}</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            name="nombreUsuario"
            placeholder="Nombre"
            className="w-full border rounded px-3 py-2"
            value={form.nombreUsuario}
            onChange={handleChange}
            required
          />
          <input
            type="email"
            name="emailUsuario"
            placeholder="Email"
            className="w-full border rounded px-3 py-2"
            value={form.emailUsuario}
            onChange={handleChange}
            required
          />
          <input
            type="password"
            name="contrasenaUsuario"
            placeholder="Contraseña (deja vacío para no cambiar)"
            className="w-full border rounded px-3 py-2"
            value={form.contrasenaUsuario}
            onChange={handleChange}
          />
          <select
            name="idRol"
            className="w-full border rounded px-3 py-2"
            value={form.idRol}
            onChange={handleChange}
          >
            <option value="">Seleccione rol</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
          {comentarioRol && (
            <p className="text-xs text-gray-500 border rounded p-2 bg-gray-50">
              {comentarioRol}
            </p>
          )}

          <button type="submit" className="w-full bg-black text-white rounded-lg py-2 mt-2">
            {submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

// =============== Página ===============
type Rol = { id: number; nombre: string; comentario: string | null };
type Usuario = { id: number; nombre: string; email: string; roles: Rol[] };

export default function Usuarios() {
  const [rows, setRows] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [openFiltros, setOpenFiltros] = useState(false);
  const [fRolId, setFRolId] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [roles, setRoles] = useState<Rol[]>([]);
  const [form, setForm] = useState({
    nombreUsuario: "",
    emailUsuario: "",
    contrasenaUsuario: "",
    idRol: "",
  });
  const [comentarioRol, setComentarioRol] = useState("");

  async function loadUsers() {
    setLoading(true);
    try {
      const { data } = await api.get("/usuarios");
      setRows(data as Usuario[]);
    } finally {
      setLoading(false);
    }
  }
  async function loadRoles() {
    const { data } = await api.get("/roles");
    setRoles(data);
  }
  useEffect(() => { loadUsers(); loadRoles(); }, []);

  const filtered = (() => {
    const qmatch = (r: Usuario) =>
      q
        ? [r.nombre, r.email, r.roles.map((x) => x.nombre).join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(q.toLowerCase())
        : true;
    const rmatch = (r: Usuario) => (fRolId ? r.roles.some((x) => String(x.id) === fRolId) : true);
    const base = rows.filter((r) => qmatch(r) && rmatch(r));
    const dir = sortDir === "asc" ? 1 : -1;
    return base.sort((a, b) => a.nombre.localeCompare(b.nombre) * dir);
  })();

  // create or update
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      await api.put(`/usuarios/${editId}`, form);
      setEditId(null);
    } else {
      await api.post("/usuarios", form);
    }
    setForm({ nombreUsuario: "", emailUsuario: "", contrasenaUsuario: "", idRol: "" });
    setOpen(false);
    loadUsers();
  }

  // columnas
  const columns: ColumnDef<Usuario>[] = [
    { header: "Nombre", accessorKey: "nombre" },
    { header: "Email", accessorKey: "email" },
    {
      header: "Roles",
      accessorKey: "roles",
      cell: ({ row }) => (row.original.roles?.map((r) => r.nombre).join(", ") || "-"),
    },
    {
      header: "Acciones",
      id: "acciones",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
            title="Editar"
            onClick={() => {
              const u = row.original;
              setEditId(u.id);
              setForm({
                nombreUsuario: u.nombre,
                emailUsuario: u.email,
                contrasenaUsuario: "",
                idRol: String(u.roles[0]?.id ?? ""),
              });
              setComentarioRol(u.roles[0]?.comentario ?? "");
              setOpen(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>

          <button
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
            title="Eliminar"
            onClick={async () => {
              if (!confirm("¿Eliminar usuario?")) return;
              await api.delete(`/usuarios/${row.original.id}`);
              loadUsers();
            }}
          >
            <Trash className="h-3.5 w-3.5" /> Eliminar
          </button>
        </div>
      ),
      size: 200,
    },
  ];

  return (
    <section className="space-y-4">
      {/* Título + botón Nuevo */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <button
          onClick={() => {
            setEditId(null);
            setForm({ nombreUsuario: "", emailUsuario: "", contrasenaUsuario: "", idRol: "" });
            setComentarioRol("");
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
        >
          <Plus className="h-4 w-4" />
          <span>Nuevo usuario</span>
        </button>
      </div>

      {/* Buscador + botón Filtros + contador */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="relative w-64 sm:w-72 md:w-80 lg:w-96 xl:w-[32rem] flex-1 min-w-[14rem]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
            placeholder="Buscar por nombre, email o rol…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if ((e as React.KeyboardEvent<HTMLInputElement>).key === "Escape") setQ(""); }}
          />
        </div>
        <button className="rounded border px-3 py-2" onClick={() => setOpenFiltros(true)}>Filtros</button>
        <span className="ml-auto text-xs text-gray-600">{`Mostrando ${filtered.length === 0 ? 0 : 1}–${filtered.length} de ${filtered.length}`}</span>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6 text-sm">Cargando…</div>
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {/* Popup de filtros */}
      {openFiltros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg md:max-w-xl lg:max-w-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-medium">Filtros de Usuarios</h2>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => setOpenFiltros(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Rol</span>
                <select className="rounded border px-2 py-1" value={fRolId} onChange={(e) => setFRolId(e.target.value)}>
                  <option value="">Todos</option>
                  {roles.map((r) => (
                    <option key={r.id} value={String(r.id)}>{r.nombre}</option>
                  ))}
                </select>
                <span className="text-gray-600 ml-auto">Orden</span>
                <select className="rounded border px-2 py-1" value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}>
                  <option value="asc">Ascendente</option>
                  <option value="desc">Descendente</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm" onClick={() => { setFRolId(""); setSortDir("asc"); setQ(""); }}>
                <X className="h-3.5 w-3.5" /> Borrar filtros
              </button>
              <button className="rounded border px-3 py-1 text-sm" onClick={() => setOpenFiltros(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <NuevoUsuarioModal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Editar usuario" : "Nuevo usuario"}
        submitLabel={editId ? "Guardar cambios" : "Guardar"}
        form={form}
        setForm={setForm}
        roles={roles}
        comentarioRol={comentarioRol}
        setComentarioRol={setComentarioRol}
        handleSubmit={handleSubmit}
      />
    </section>
  );
}
