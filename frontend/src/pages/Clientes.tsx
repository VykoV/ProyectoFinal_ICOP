import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Label, Input, FieldError, Select } from "../components/ui/Form";
import { Search, Plus, Pencil, Trash, X, Eye } from "lucide-react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

/* ===== Tipos ===== */
type ClienteRow = {
  id: number;
  nombre: string;
  apellido: string;
  cuil?: string;
  email?: string;
  telefono?: string;
};

type Tipo = { id: number; nombre: string };
type Nivel = { id: number; indice: number };
type Provincia = { id: number; nombre: string };
type Localidad = { id: number; nombre: string; provinciaId: number };

const schema = z.object({
  cuil: z
    .string()
    .trim()
    .optional()
    .refine(v => !v || /^\d{2}-?\d{8}-?\d$/.test(v), "CUIL/CUIT inválido"),
  nombre: z.string().min(1, "Requerido"),
  apellido: z.string().min(1, "Requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefono: z.string().optional(),
  observacion: z.string().optional(),
  tipoId: z.string().optional(),
  nivelId: z.string().optional(),
  provinciaId: z.string().optional(),
  localidadId: z.string().optional(),
  fechaRegistro: z
    .string()
    .refine(v => {
      const d = new Date(v);
      const hoyFin = new Date(); hoyFin.setHours(23, 59, 59, 999);
      return d <= hoyFin;
    }, "Debe ser hoy o anterior"),
});
type FormData = z.infer<typeof schema>;

/* ===== Página ===== */
export default function Clientes() {
  const { hasRole } = useAuth();
  const isVendedor = hasRole("Vendedor");
  const isCajero = hasRole("Cajero");
  const [rows, setRows] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openEdit, setOpenEdit] = useState<null | number>(null); // id o null
  const [openView, setOpenView] = useState<null | number>(null);
  const [q, setQ] = useState("");
  const [openFiltros, setOpenFiltros] = useState(false);

  useEffect(() => {
    const h = setTimeout(() => { load(q); }, 300);
    return () => clearTimeout(h);
  }, [q]);

  async function load(query?: string) {
  setLoading(true);
  try {
    const { data } = await api.get("/clientes", {
      params: query ? { q: query } : undefined,
    });
    setRows(
      (data ?? []).map((c: any) => ({
        id: c.id ?? c.idCliente,
        nombre: c.nombre ?? c.nombreCliente,
        apellido: c.apellido ?? c.apellidoCliente,
        cuil: c.cuil ?? null,
        email: c.email ?? c.emailCliente ?? "",
        telefono: c.telefono ?? c.telefonoCliente ?? "",
      }))
    );
  } finally {
    setLoading(false);
  }
}


  useEffect(() => {
    load();
  }, []);

  const columns: ColumnDef<ClienteRow>[] = [
    { header: "ID", accessorKey: "id", size: 60 },
    { header: "CUIL/CUIT", accessorKey: "cuil" },
    {
      header: "Nombre",
      cell: ({ row }) => `${row.original.apellido}, ${row.original.nombre}`,
    },
    { header: "Email", accessorKey: "email" },
    { header: "Teléfono", accessorKey: "telefono" },
    {
      header: "Acciones",
      id: "acciones",
      size: 220,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
            onClick={() => setOpenView(row.original.id)}
            title="Ver"
          >
            <Eye className="h-3.5 w-3.5" /> Ver
          </button>
          {!isVendedor && (
            <button
              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
              onClick={() => setOpenEdit(row.original.id)}
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          )}
          {!(isVendedor || isCajero) && (
            <button
              className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
              onClick={async () => {
                if (!confirm("¿Eliminar cliente?")) return;
                await api.delete(`/clientes/${row.original.id}`);
                await load();
              }}
              title="Eliminar"
            >
              <Trash className="h-3.5 w-3.5" /> Eliminar
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      {/* Título + botón Nuevo */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Clientes</h1>
        {!isVendedor && (
          <button
            onClick={() => setOpenEdit(0)} // 0 = alta
            className="inline-flex items-center gap-2 rounded-lg bg-black text-white px-3 py-2"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo cliente</span>
          </button>
        )}
      </div>

      {/* Buscador + botón Filtros + contador */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="relative w-64 sm:w-72 md:w-80 lg:w-96 xl:w-[32rem] flex-1 min-w-[14rem]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            className="w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm"
            placeholder="Buscar por nombre, apellido, email o CUIL/Teléfono"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
          />
        </div>
        <button className="rounded border px-3 py-2" onClick={() => setOpenFiltros(true)}>Filtros</button>
        <span className="ml-auto text-xs text-gray-600">{`Mostrando ${rows.length === 0 ? 0 : 1}–${rows.length} de ${rows.length}`}</span>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6 text-sm">Cargando…</div>
      ) : (
        <DataTable columns={columns} data={rows} />
      )}

      {openEdit !== null && (
        <ClienteFormModal
          id={openEdit || undefined}
          onClose={async (reload?: boolean) => {
            setOpenEdit(null);
            if (reload) await load();
          }}
        />
      )}

      {openView !== null && (
        <ClienteView id={openView} onClose={() => setOpenView(null)} />
      )}

      {/* Popup de filtros */}
      {openFiltros && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg md:max-w-xl lg:max-w-2xl">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-medium">Filtros de Clientes</h2>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => setOpenFiltros(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Orden</span>
                <select className="rounded border px-2 py-1" defaultValue="asc">
                  <option value="asc">Ascendente (Apellido, Nombre)</option>
                  <option value="desc">Descendente (Apellido, Nombre)</option>
                </select>
                <span className="text-gray-600 ml-auto">Contacto</span>
                <select className="rounded border px-2 py-1" defaultValue="todas">
                  <option value="todas">Todos</option>
                  <option value="con">Con Email/Teléfono</option>
                  <option value="sin">Sin Email/Teléfono</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
              <button className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm" onClick={() => setQ("")}> 
                <X className="h-3.5 w-3.5" /> Borrar filtros
              </button>
              <button className="rounded border px-3 py-1 text-sm" onClick={() => setOpenFiltros(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ===== Modal Alta/Edición ===== */
function ClienteFormModal({
  id,
  onClose,
}: {
  id?: number; // undefined = alta
  onClose: (reload?: boolean) => void;
}) {
  const isEdit = !!id;

  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [provincias, setProvincias] = useState<Provincia[]>([]);
  const [localidades, setLocalidades] = useState<Localidad[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      cuil: "",
      nombre: "",
      apellido: "",
      email: "",
      telefono: "",
      observacion: "",
      tipoId: "",
      nivelId: "",
      provinciaId: "",
      localidadId: "",
      fechaRegistro: new Date().toISOString().split("T")[0],
    },
  });

  const provinciaId = watch("provinciaId");

  useEffect(() => {
    (async () => {
      const [t, n, p] = await Promise.all([
        api.get("/tipos-cliente"),
        api.get("/niveles-cliente"),
        api.get("/provincias"),
      ]);
      setTipos(
        (t.data ?? []).map((x: any) => ({
          id: x.idTipoCliente ?? x.id,
          nombre: x.tipoCliente ?? x.nombre,
        }))
      );
      setNiveles(
        (n.data ?? []).map((x: any) => ({
          id: x.idNivelCliente ?? x.id,
          indice: x.indiceBeneficio ?? x.indice,
        }))
      );
      setProvincias(
        (p.data ?? []).map((x: any) => ({
          id: x.idProvincia ?? x.id,
          nombre: x.nombreProvincia ?? x.nombre,
        }))
      );
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!provinciaId) {
        setLocalidades([]);
        return;
      }
      const { data } = await api.get(`/localidades?provinciaId=${provinciaId}`);
      setLocalidades(
        (data ?? []).map((x: any) => ({
          id: x.idLocalidad ?? x.id,
          nombre: x.nombreLocalidad ?? x.nombre,
          provinciaId: x.idProvincia ?? x.provinciaId,
        }))
      );
    })();
  }, [provinciaId]);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data } = await api.get(`/clientes/${id}`);
      reset({
        cuil: data?.cuil ? String(data.cuil) : "",
        nombre: data?.nombreCliente ?? data?.nombre ?? "",
        apellido: data?.apellidoCliente ?? data?.apellido ?? "",
        email: data?.emailCliente ?? data?.email ?? "",
        telefono: data?.telefonoCliente ? String(data.telefonoCliente) : "",
        observacion: data?.observacion ?? "",
        tipoId: data?.idTipoCliente ? String(data.idTipoCliente) : "",
        nivelId: data?.idNivelCliente ? String(data.idNivelCliente) : "",
        provinciaId: data?.Localidad?.idProvincia
          ? String(data.Localidad.idProvincia)
          : "",
        localidadId: data?.idLocalidad ? String(data.idLocalidad) : "",
        fechaRegistro: data?.fechaRegistro
          ? data.fechaRegistro.split("T")[0]
          : new Date().toISOString().split("T")[0],
      });
      if (data?.Localidad?.idProvincia) {
        const { data: locs } = await api.get(
          `/localidades?provinciaId=${data.Localidad.idProvincia}`
        );
        setLocalidades(
          (locs ?? []).map((x: any) => ({
            id: x.idLocalidad ?? x.id,
            nombre: x.nombreLocalidad ?? x.nombre,
            provinciaId: x.idProvincia ?? x.provinciaId,
          }))
        );
      }
    })();
  }, [isEdit, id, reset]);

  const onSubmit: SubmitHandler<FormData> = async (v) => {
    const payload = {
      cuil: v.cuil?.replace(/-/g, "") || null,
      nombreCliente: v.nombre,
      apellidoCliente: v.apellido,
      emailCliente: v.email || null,
      telefonoCliente: v.telefono ? Number(v.telefono) : null,
      observacion: v.observacion || null,
      idTipoCliente: v.tipoId ? Number(v.tipoId) : null,
      idNivelCliente: v.nivelId ? Number(v.nivelId) : null,
      idLocalidad: v.localidadId ? Number(v.localidadId) : null,
      fechaRegistro: v.fechaRegistro ? new Date(v.fechaRegistro) : new Date(),
    };
    if (isEdit) await api.put(`/clientes/${id}`, payload);
    else await api.post("/clientes", payload);
    onClose(true);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={() => onClose()}
      />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto h-dvh md:h-[90vh] w-full max-w-3xl md:rounded-2xl border bg-white shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">
              {isEdit ? "Editar Cliente" : "Nuevo Cliente"}
            </h3>
            <button
              onClick={() => onClose()}
              className="p-2 rounded hover:bg-gray-100"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 overflow-auto flex-1">
            <form
              id="cliente-form"
              onSubmit={handleSubmit(onSubmit)}
              className="grid gap-4"
            >
              {/* Identificación */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="cuil">CUIL/CUIT</Label>
                  <Input
                    id="cuil"
                    placeholder="20-12345678-3"
                    {...register("cuil")}
                  />
                  <FieldError message={errors.cuil?.message} />
                </div>
                <div>
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input id="nombre" {...register("nombre")} />
                  <FieldError message={errors.nombre?.message} />
                </div>
                <div>
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input id="apellido" {...register("apellido")} />
                  <FieldError message={errors.apellido?.message} />
                </div>
              </div>

              {/* Clasificación */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="tipo">Tipo de cliente</Label>
                  <Select id="tipo" {...register("tipoId")}>
                    <option value="">Sin especificar</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="nivel">Nivel</Label>
                  <Select id="nivel" {...register("nivelId")}>
                    <option value="">Sin especificar</option>
                    {niveles.map((n) => (
                      <option key={n.id} value={String(n.id)}>
                        {n.indice}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Ubicación */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="provincia">Provincia</Label>
                  <Select id="provincia" {...register("provinciaId")}>
                    <option value="">Seleccionar</option>
                    {provincias.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="localidad">Localidad</Label>
                  <Select id="localidad" {...register("localidadId")}>
                    <option value="">Seleccionar</option>
                    {localidades
                      .filter(
                        (l) =>
                          String(l.provinciaId) === String(provinciaId || "")
                      )
                      .map((l) => (
                        <option key={l.id} value={String(l.id)}>
                          {l.nombre}
                        </option>
                      ))}
                  </Select>
                </div>
              </div>
              {/* Fecha de registro */}
              <div>
                <Label htmlFor="fechaRegistro">Fecha de registro</Label>
                <Input
                  id="fechaRegistro"
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  {...register("fechaRegistro")}
                />
                <FieldError message={errors.fechaRegistro?.message} />
              </div>

              {/* Contacto */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="tel">Teléfono</Label>
                  <Input id="tel" {...register("telefono")} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register("email")} />
                  <FieldError message={errors.email?.message as any} />
                </div>
              </div>

              {/* Observación */}
              <div>
                <Label htmlFor="obs">Observaciones</Label>
                <textarea
                  id="obs"
                  className="w-full rounded-lg border px-3 py-2 text-sm min-h-24"
                  {...(register("observacion") as any)}
                />
              </div>
            </form>
          </div>

          <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-end gap-2">
            <button
              onClick={() => onClose()}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Cancelar
            </button>
            <button
              form="cliente-form"
              disabled={isSubmitting}
              className="rounded-lg bg-black text-white px-3 py-2 text-sm"
            >
              {isEdit ? "Guardar cambios" : "Guardar cliente"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ===== Modal Ver ===== */
function ClienteView({ id, onClose }: { id: number; onClose: () => void }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get(`/clientes/${id}`);
      setData(data);
    })();
  }, [id]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-0 z-50 p-0 md:p-4">
        <div className="mx-auto w-full max-w-2xl md:rounded-2xl border bg-white shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-base font-semibold">Detalle de Cliente</h3>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-100"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 text-sm grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-500">ID</p>
              <p className="font-medium">
                {data?.idCliente ?? data?.id ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">CUIL/CUIT</p>
              <p className="font-medium">{data?.cuil ?? "-"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Nombre</p>
              <p className="font-medium">
                {(data?.apellidoCliente ?? data?.apellido ?? "-") +
                  ", " +
                  (data?.nombreCliente ?? data?.nombre ?? "-")}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium">
                {data?.emailCliente ?? data?.email ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Teléfono</p>
              <p className="font-medium">
                {data?.telefonoCliente ?? data?.telefono ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Tipo</p>
              <p className="font-medium">
                {data?.TipoCliente?.tipoCliente ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Nivel</p>
              <p className="font-medium">
                {data?.NivelCliente?.indiceBeneficio ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Provincia</p>
              <p className="font-medium">
                {data?.Localidad?.Provincia?.nombreProvincia ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Localidad</p>
              <p className="font-medium">
                {data?.Localidad?.nombreLocalidad ?? "-"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Observación</p>
              <p className="font-normal">{data?.observacion ?? "-"}</p>
            </div>
          </div>

          <div className="px-4 py-3 border-t bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
