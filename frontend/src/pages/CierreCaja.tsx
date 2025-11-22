import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { askConfirm, askText } from "../lib/alerts";

const numberFormatter = new Intl.NumberFormat("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmt(n: number | string) {
  const num = Number(n);
  if (!isFinite(num)) return String(n);
  return numberFormatter.format(num);
}

type CierrePreview = {
  fecha: string;
  totalVentas: number;
  totalCobros: number;
  totalCompras: number;
  totalEgresos: number;
  saldoInicial: number;
  saldoFinal: number;
  ventasPorMetodo?: Array<{ metodo: string; total: number }>;
  egresos?: Array<{ monto: string | number; comentario?: string | null }>;
  ventasDelDia?: Array<{ idVenta: number; cliente: string; metodoPago: string; total: number }>;
  comprasDelDia?: Array<{ idCompra: number; proveedor: string; total: number }>;
};

type CierreCaja = {
  idCierre: number;
  fecha: string;
  totalVentas: string;
  totalCobros: string;
  totalCompras: string;
  saldoInicial: string;
  saldoFinal: string;
  Usuario?: { nombre?: string } | null;
};

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Formatea fechas preservando el día original (evita desfase por zona horaria)
function toYmd(dateInput: string | Date) {
  if (typeof dateInput === "string") {
    const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CierreCajaPage() {
  const [tab, setTab] = useState<"generar" | "listado">("generar");

  // Generar / Preview
  const [fecha, setFecha] = useState<string>(todayStr());
  // Saldo inicial se obtiene del día anterior (sin input manual)
  const [preview, setPreview] = useState<CierrePreview | null>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movimientosBloqueados, setMovimientosBloqueados] = useState(false);
  const [ventasMetodoExpanded, setVentasMetodoExpanded] = useState(false);
  const [ventasDiaExpanded, setVentasDiaExpanded] = useState<boolean>(true);
  

  async function calcular() {
    // Al recalcular, desbloquear acciones de movimientos
    setMovimientosBloqueados(false);
    setLoadingPrev(true);
    try {
      const params = new URLSearchParams();
      params.set("fecha", fecha);
      const res = await api.get(`/cierres-caja/preview?${params.toString()}`, { withCredentials: true });
      setPreview(res.data);
    } catch (err) {
      console.error(err);
      const msg = (err as any)?.response?.data?.error || (err as any)?.message || "Error al calcular";
      toast.error(msg);
    } finally {
      setLoadingPrev(false);
    }
  }

  async function confirmar() {
    if (!fecha) return;
    const ok = await askConfirm({
      title: "Confirmar cierre de caja",
      message: "¿Seguro que quiere cerrar la caja del día?",
      confirmText: "Aceptar",
      cancelText: "Cancelar",
      type: "warning",
    });
    if (!ok) return;
    // Bloquear ingresos/egresos tras aceptar
    setMovimientosBloqueados(true);
    setSaving(true);
    try {
      await api.post(`/cierres-caja`, { fecha }, { withCredentials: true });
      toast.success("Cierre generado");
      setPreview(null);
      // refrescar listado
      await cargarListado();
      setTab("listado");
    } catch (err) {
      console.error(err);
      const msg = (err as any)?.response?.data?.error || (err as any)?.message || "Error al confirmar el cierre";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  // Listado
  const [cierres, setCierres] = useState<CierreCaja[]>([]);
  const [egresosDia, setEgresosDia] = useState<Array<{ idEgreso: number; fecha: string; monto: string | number; comentario?: string; Usuario?: { nombre?: string } }>>([]);
  const [loadingList, setLoadingList] = useState(false);
  // Bloqueo automático si ya existe un cierre para la fecha seleccionada
  const yaCerrada = useMemo(() => {
    try {
      return cierres.some((c) => toYmd((c as any).fecha) === fecha);
    } catch {
      return false;
    }
  }, [cierres, fecha]);
  const bloqueado = movimientosBloqueados || yaCerrada;
  // Totales locales de ingresos/egresos del día (efectivo)
  const totalIngresosEfectivo = useMemo(() => {
    return egresosDia.reduce((acc, e) => {
      const n = Number(e.monto);
      const isIngreso = n > 0 || String(e.comentario || "").toLowerCase().includes("ajuste saldo inicial");
      return acc + (isIngreso ? n : 0);
    }, 0);
  }, [egresosDia]);
  // paginación locales
  const pageSize = 5;
  const [ventasPage, setVentasPage] = useState<number>(1);
  const [cierresPage, setCierresPage] = useState<number>(1);
  async function cargarListado() {
    setLoadingList(true);
    try {
      const res = await api.get(`/cierres-caja`, { withCredentials: true });
      setCierres(res.data);
    } catch (err) {
      console.error(err);
      const msg = (err as any)?.response?.data?.error || (err as any)?.message || "Error al listar cierres";
      toast.error(msg);
    } finally {
      setLoadingList(false);
    }
  }

  async function cargarEgresosDelDia() {
    try {
      const params = new URLSearchParams();
      params.set("fecha", fecha);
      const res = await api.get(`/egresos-caja?${params.toString()}`, { withCredentials: true });
      setEgresosDia(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  // Acciones rápidas: Ingresos y Egresos mediante notificación
  async function agregarIngreso() {
    if (bloqueado || saving) {
      return toast.error("Caja bloqueada: ya existe cierre o en confirmación");
    }
    try {
      const valorStr = await askText({
        title: "Agregar ingreso",
        label: "Monto",
        placeholder: "0.00",
        // validación manual de monto
      });
      if (!valorStr) return;
      const motivo = await askText({
        title: "Motivo del ingreso",
        label: "Motivo",
        placeholder: "Ej: ajuste por conteo",
        required: true,
      });
      if (!motivo) return;
      const montoNum = Number(valorStr);
      if (Number.isNaN(montoNum) || montoNum <= 0) {
        return toast.error("Ingresa un monto válido y positivo");
      }
      await api.post(`/egresos-caja`, { fecha, monto: montoNum, comentario: `ajuste saldo inicial: ${motivo}` }, { withCredentials: true });
      toast.success("Ingreso registrado");
      await cargarEgresosDelDia();
      await calcular();
    } catch (err) {
      console.error(err);
      const msg = (err as any)?.response?.data?.error || (err as any)?.message || "Error al registrar ingreso";
      toast.error(msg);
    }
  }

  async function agregarEgreso() {
    if (bloqueado || saving) {
      return toast.error("Caja bloqueada: ya existe cierre o en confirmación");
    }
    try {
      const valorStr = await askText({
        title: "Agregar egreso",
        label: "Monto (usar negativo)",
        placeholder: "-0.00",
      });
      if (!valorStr) return;
      const motivo = await askText({
        title: "Motivo del egreso",
        label: "Motivo",
        placeholder: "Ej: compra de insumos",
        required: true,
      });
      if (!motivo) return;
      let montoNum = Number(valorStr);
      if (Number.isNaN(montoNum)) {
        return toast.error("Ingresa un monto válido");
      }
      // Asegurar que sea negativo como solicitaste
      if (montoNum > 0) montoNum = -montoNum;
      await api.post(`/egresos-caja`, { fecha, monto: montoNum, comentario: motivo }, { withCredentials: true });
      toast.success("Egreso registrado");
      await cargarEgresosDelDia();
      await calcular();
    } catch (err) {
      console.error(err);
      const msg = (err as any)?.response?.data?.error || (err as any)?.message || "Error al registrar egreso";
      toast.error(msg);
    }
  }

  useEffect(() => { cargarListado(); }, []);
  useEffect(() => { cargarEgresosDelDia(); }, [fecha]);
  // resetear páginas cuando cambia la fecha o se recalcula preview
  useEffect(() => { setVentasPage(1); }, [fecha, preview]);

  

  

  const previewRows = useMemo(() => {
    if (!preview) return [] as Array<[string, string]>;
    const rows: Array<[string, string]> = [
      ["Saldo Inicial", fmt(preview.saldoInicial)],
      ["Total Ventas", fmt(preview.totalVentas)],
      ["Total Egresos Efectivo", fmt(preview.totalEgresos)],
      ["Total Ingresos Efectivo", fmt(totalIngresosEfectivo)],
      ["Saldo Final Efectivo", fmt(preview.saldoFinal)],
    ];
    return rows;
  }, [preview, totalIngresosEfectivo]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Cierre de caja</h1>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            className={`rounded border px-3 py-1 ${tab === "generar" ? "bg-gray-100" : ""}`}
            onClick={() => setTab("generar")}
          >
            Generar cierre
          </button>
          <button
            className={`rounded border px-3 py-1 ${tab === "listado" ? "bg-gray-100" : ""}`}
            onClick={() => setTab("listado")}
          >
            Listado
          </button>
        </div>
      </div>

      {tab === "generar" ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-end gap-3 mb-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-600 block">Fecha</label>
                    <input type="date" className="rounded border px-2 py-1 w-40"
                      value={fecha}
                      onChange={(e)=> setFecha(e.target.value)} />
                  </div>
                  <button
                    onClick={calcular}
                    className="rounded border px-3 py-2 text-sm"
                    disabled={loadingPrev}
                  >
                    {loadingPrev ? "Calculando…" : "Calcular"}
                  </button>
                </div>
                <h3 className="text-sm font-medium mb-2">Resultado</h3>
                {preview ? (
                  <div className="space-y-1 text-sm">
                  {(() => {
                    const rawByKey: Record<string, number> = {
                      "Saldo Inicial": preview.saldoInicial,
                      "Total Ventas": preview.totalVentas,
                      "Total Egresos Efectivo": preview.totalEgresos,
                      "Total Ingresos Efectivo": totalIngresosEfectivo,
                      "Saldo Final Efectivo": preview.saldoFinal,
                    };
                    return previewRows.map(([k, v]) => {
                      const numeric = rawByKey[k] ?? 0;
                      const conceptNegative = k === "Total Egresos Efectivo";
                      const isNegative = conceptNegative || numeric < 0;
                      const hasVentasMetodo = k === "Total Ventas" && !!preview.ventasPorMetodo?.length;
                      return (
                        <div key={k} className="space-y-1">
                          <div className={`flex items-center justify-between`}>
                            <span className="text-gray-600 flex items-center gap-2">
                              {k}
                              {hasVentasMetodo && (
                                <button
                                  type="button"
                                  className="text-xs leading-none px-1"
                                  aria-label="Mostrar ventas por método"
                                  onClick={() => setVentasMetodoExpanded((v2) => !v2)}
                                >
                                  {ventasMetodoExpanded ? "▾" : "▸"}
                                </button>
                              )}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${k === "Total Ingresos Efectivo" ? "text-green-600" : isNegative ? "text-red-600" : ""}`}>{v}</span>
                            </div>
                          </div>
                          {hasVentasMetodo && ventasMetodoExpanded && (
                            <div className="pl-6 text-xs">
                              {preview.ventasPorMetodo!.map((r) => (
                                <div key={r.metodo} className="flex items-center justify-between">
                                  <span className="text-gray-600">{r.metodo}</span>
                                  <span className="font-medium">{fmt(r.total)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}

                </div>
              ) : (
                <p className="text-sm text-gray-600">Sin cálculo. Seleccione fecha y presione Calcular.</p>
              )}
              </div>

              {/* Ventas del día */}
              <div className="rounded-xl border bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Ventas del día</h3>
                  <button
                    type="button"
                    className="text-xs border px-2 py-1 rounded"
                    onClick={() => setVentasDiaExpanded((b) => !b)}
                    aria-label="Mostrar/Ocultar ventas del día"
                  >
                    {ventasDiaExpanded ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                {preview ? (
                  ventasDiaExpanded ? (
                    (() => {
                      const total = preview.ventasDelDia?.length ?? 0;
                      if (total === 0) {
                        return <p className="text-sm text-gray-600">Sin ventas.</p>;
                      }
                      const totalPages = Math.max(1, Math.ceil(total / pageSize));
                      const safePage = Math.min(Math.max(1, ventasPage), totalPages);
                      const start = (safePage - 1) * pageSize;
                      const end = Math.min(start + pageSize, total);
                      const pageRows = preview.ventasDelDia!.slice(start, end);
                      return (
                        <div className="overflow-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left">
                                <th className="py-2 border-b">#</th>
                                <th className="py-2 border-b">Cliente</th>
                                <th className="py-2 border-b">Método</th>
                                <th className="py-2 border-b">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageRows.map((v) => (
                                <tr key={v.idVenta}>
                                  <td className="py-2 border-b">{v.idVenta}</td>
                                  <td className="py-2 border-b">{v.cliente}</td>
                                  <td className="py-2 border-b">{v.metodoPago}</td>
                                  <td className="py-2 border-b">{fmt(v.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {/* Controles de paginación */}
                          {total > pageSize && (
                            <div className="flex items-center justify-between mt-2 text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  className="border px-2 py-1 rounded disabled:opacity-50"
                                  onClick={() => setVentasPage((p) => Math.max(1, p - 1))}
                                  disabled={safePage <= 1}
                                >
                                  Anterior
                                </button>
                                <button
                                  className="border px-2 py-1 rounded disabled:opacity-50"
                                  onClick={() => setVentasPage((p) => Math.min(totalPages, p + 1))}
                                  disabled={safePage >= totalPages}
                                >
                                  Siguiente
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span>Página</span>
                                <input
                                  className="w-14 rounded border px-2 py-1"
                                  type="number"
                                  min={1}
                                  max={totalPages}
                                  value={safePage}
                                  onChange={(e) => {
                                    const v = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                                    setVentasPage(v);
                                  }}
                                />
                                <span>de {totalPages}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : null
                ) : (
                  <p className="text-sm text-gray-600">Sin cálculo. Seleccione fecha y presione Calcular.</p>
                )}
              </div>

              <div className="flex items-center gap-2">
              <button
                onClick={confirmar}
                disabled={saving || !preview || bloqueado}
                className="rounded-lg bg-black text-white px-3 py-2 text-sm"
              >
                {saving ? "Confirmando…" : "Confirmar cierre"}
              </button>
              </div>
            </div>

            <div className="space-y-3">
              {/* Ingreso/Egresos */}
              <div className="rounded-xl border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Ingreso/Egresos</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="border px-2 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={bloqueado || saving}
                      onClick={agregarIngreso}
                    >
                      Ingresos
                    </button>
                    <button
                      className="border px-2 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={bloqueado || saving}
                      onClick={agregarEgreso}
                    >
                      Egresos
                    </button>
                  </div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="py-2 border-b">Monto</th>
                      <th className="py-2 border-b">Comentario</th>
                      <th className="py-2 border-b">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {egresosDia.map((e) => (
                      <EgresoRow
                        key={e.idEgreso}
                        egreso={e}
                        movimientosBloqueados={bloqueado}
                        onChanged={async () => {
                          await cargarEgresosDelDia();
                          await calcular();
                        }}
                      />
                    ))}
                    {egresosDia.length === 0 && (
                      <tr>
                         <td className="py-2 border-b text-gray-600" colSpan={3}>Sin movimientos.</td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-4 overflow-auto">
          {loadingList ? (
            <div className="text-sm">Cargando…</div>
          ) : (
            (() => {
              const total = cierres.length;
              const totalPages = Math.max(1, Math.ceil(total / pageSize));
              const safePage = Math.min(Math.max(1, cierresPage), totalPages);
              const start = (safePage - 1) * pageSize;
              const end = Math.min(start + pageSize, total);
              const pageRows = cierres.slice(start, end);
              return (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="py-2 border-b">Fecha</th>
                        <th className="py-2 border-b">Total Ventas</th>
                        <th className="py-2 border-b">Saldo final efectivo</th>
                        <th className="py-2 border-b">Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((c) => (
                        <tr key={c.idCierre}>
                          <td className="py-2 border-b">{toYmd((c as any).fecha)}</td>
                          <td className="py-2 border-b">{fmt(c.totalVentas)}</td>
                          <td className={`py-2 border-b ${Number(c.saldoFinal) < 0 ? "text-red-600" : ""}`}>{fmt(c.saldoFinal)}</td>
                          <td className="py-2 border-b">{c.Usuario?.nombre ?? "-"}</td>
                        </tr>
                      ))}
                      {total === 0 && (
                        <tr>
                          <td className="py-2 border-b text-gray-600" colSpan={4}>No hay cierres.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {/* Controles de paginación */}
                  {total > pageSize && (
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          className="border px-2 py-1 rounded disabled:opacity-50"
                          onClick={() => setCierresPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                        >
                          Anterior
                        </button>
                        <button
                          className="border px-2 py-1 rounded disabled:opacity-50"
                          onClick={() => setCierresPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
                        >
                          Siguiente
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Página</span>
                        <input
                          className="w-16 rounded border px-2 py-1"
                          type="number"
                          min={1}
                          max={totalPages}
                          value={safePage}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                            setCierresPage(v);
                          }}
                        />
                        <span>de {totalPages}</span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>
      )}
    </section>
  );
}

 

function EgresoRow({ egreso, onChanged, movimientosBloqueados }: { egreso: { idEgreso: number; monto: number | string; comentario?: string | null }; onChanged: () => void; movimientosBloqueados: boolean }) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const comentarioLc = (egreso.comentario ?? "").toLowerCase();
  const esRetiro = comentarioLc.includes("retiro en efectivo caja");
  const esAjusteSaldoInicial = comentarioLc.includes("ajuste saldo inicial");

  async function editarPorNotificacion() {
    try {
      const montoStr = await askText({
        title: "Editar egreso",
        label: "Monto",
        placeholder: String(egreso.monto),
        // validación manual
      });
      if (!montoStr) return;
      const motivo = await askText({
        title: "Editar egreso",
        label: "Motivo",
        placeholder: egreso.comentario ?? "",
        required: true,
      });
      if (!motivo) return;
      const montoNum = Number(montoStr);
      if (Number.isNaN(montoNum)) return toast.error("Ingresa un monto válido");
      setSaving(true);
      await api.put(`/egresos-caja/${egreso.idEgreso}`, { monto: montoNum, comentario: motivo }, { withCredentials: true });
      toast.success("Egreso actualizado");
      onChanged();
    } catch (err) {
      console.error(err);
      const msg = (err as any)?.response?.data?.error || (err as any)?.message || "Error al actualizar egreso";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    const ok = await askConfirm({
      title: "Eliminar egreso",
      message: "¿Confirmas eliminar este egreso?",
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      type: "warning",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/egresos-caja/${egreso.idEgreso}`, { withCredentials: true });
      toast.success("Egreso eliminado");
      onChanged();
    } catch (err) {
      console.error(err);
      const msg = (err as any)?.response?.data?.error || (err as any)?.message || "Error al eliminar egreso";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <tr>
      <td className={`py-2 border-b ${Number(egreso.monto) < 0 ? "text-red-600" : "text-green-600"}`}>
        {fmt(egreso.monto)}
      </td>
      <td className="py-2 border-b">
        <span className="flex items-center gap-1 text-gray-700">
          {esRetiro && <span title="Retiro en efectivo caja">★</span>}
          {esAjusteSaldoInicial && <span title="Ajuste saldo inicial">★</span>}
          {egreso.comentario ?? "-"}
        </span>
      </td>
      <td className="py-2 border-b">
        <div className="flex items-center gap-2">
          <button
            className="border px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={editarPorNotificacion}
            disabled={saving || movimientosBloqueados}
          >
            {saving ? "Guardando…" : "Editar"}
          </button>
          <button
            className="border px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={eliminar}
            disabled={deleting || movimientosBloqueados}
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </td>
    </tr>
  );
}