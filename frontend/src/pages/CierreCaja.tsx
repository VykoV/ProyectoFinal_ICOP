import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import toast from "react-hot-toast";

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

export default function CierreCajaPage() {
  const [tab, setTab] = useState<"generar" | "listado">("generar");

  // Generar / Preview
  const [fecha, setFecha] = useState<string>(todayStr());
  const [saldoInicialInput, setSaldoInicialInput] = useState<string>("");
  const [preview, setPreview] = useState<CierrePreview | null>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [saving, setSaving] = useState(false);

  async function calcular() {
    setLoadingPrev(true);
    try {
      const params = new URLSearchParams();
      params.set("fecha", fecha);
      if (saldoInicialInput.trim() !== "") params.set("saldoInicial", saldoInicialInput.trim());
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
    setSaving(true);
    try {
      const body: any = { fecha };
      if (saldoInicialInput.trim() !== "") body.saldoInicial = Number(saldoInicialInput);
      await api.post(`/cierres-caja`, body, { withCredentials: true });
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
  // paginación locales
  const pageSize = 5;
  const [ventasPage, setVentasPage] = useState<number>(1);
  const [comprasPage, setComprasPage] = useState<number>(1);
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

  useEffect(() => { cargarListado(); }, []);
  useEffect(() => { cargarEgresosDelDia(); }, [fecha]);
  // resetear páginas cuando cambia la fecha o se recalcula preview
  useEffect(() => { setVentasPage(1); setComprasPage(1); }, [fecha, preview]);

  const previewRows = useMemo(() => {
    if (!preview) return [] as Array<[string, string]>;
    return [
      ["Total Ventas", preview.totalVentas.toFixed(2)],
      ["Total Cobros", preview.totalCobros.toFixed(2)],
      ["Total Compras", preview.totalCompras.toFixed(2)],
      ["Total Egresos", preview.totalEgresos.toFixed(2)],
      ["Saldo Inicial", preview.saldoInicial.toFixed(2)],
      ["Saldo Final", preview.saldoFinal.toFixed(2)],
    ];
  }, [preview]);

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-600 block">Fecha</label>
                  <input type="date" className="rounded border px-2 py-1 w-40"
                    value={fecha}
                    onChange={(e)=> setFecha(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-600 block">Saldo inicial (opcional)</label>
                  <input type="number" step="0.01" className="rounded border px-2 py-1 w-40"
                    value={saldoInicialInput}
                    onChange={(e)=> setSaldoInicialInput(e.target.value)} />
                </div>
                <button
                  onClick={calcular}
                  className="rounded border px-3 py-2 text-sm"
                  disabled={loadingPrev}
                >
                  {loadingPrev ? "Calculando…" : "Calcular"}
                </button>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <h3 className="text-sm font-medium mb-2">Resultado</h3>
              {preview ? (
                <div className="space-y-1 text-sm">
                  {previewRows.map(([k, v]) => {
                    const numeric = parseFloat(v);
                    const conceptNegative = k === "Total Compras" || k === "Total Egresos";
                    const isNegative = conceptNegative || numeric < 0;
                    return (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-gray-600">{k}</span>
                        <span className={`font-medium ${isNegative ? "text-red-600" : ""}`}>{v}</span>
                      </div>
                    );
                  })}
                  {!!preview.ventasPorMetodo?.length && (
                    <div className="mt-3">
                      <p className="text-sm font-medium">Ventas por método de pago</p>
                      <div className="space-y-1 mt-1">
                        {preview.ventasPorMetodo!.map((r) => (
                          <div key={r.metodo} className="flex items-center justify-between">
                            <span className="text-gray-600">{r.metodo}</span>
                            <span className="font-medium">{r.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!preview.ventasDelDia?.length && (
                    <div className="mt-4">
                      <p className="text-sm font-medium">Ventas del día</p>
                      {(() => {
                        const total = preview.ventasDelDia!.length;
                        const totalPages = Math.max(1, Math.ceil(total / pageSize));
                        const safePage = Math.min(Math.max(1, ventasPage), totalPages);
                        const start = (safePage - 1) * pageSize;
                        const end = Math.min(start + pageSize, total);
                        const pageRows = preview.ventasDelDia!.slice(start, end);
                        return (
                      <div className="overflow-auto mt-1">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left">
                              <th className="py-1 border-b">#</th>
                              <th className="py-1 border-b">Cliente</th>
                              <th className="py-1 border-b">Método</th>
                              <th className="py-1 border-b">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageRows.map((v) => (
                              <tr key={v.idVenta}>
                                <td className="py-1 border-b">{v.idVenta}</td>
                                <td className="py-1 border-b">{v.cliente}</td>
                                <td className="py-1 border-b">{v.metodoPago}</td>
                                <td className="py-1 border-b">{v.total.toFixed(2)}</td>
                              </tr>
                            ))}
                            {total === 0 && (
                              <tr>
                                <td className="py-1 border-b text-gray-600" colSpan={4}>Sin ventas.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        {/* Controles de paginación */}
                        {total > pageSize && (
                          <div className="flex items-center justify-between mt-2 text-xs">
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
                      })()}
                    </div>
                  )}
                  {!!preview.comprasDelDia?.length && (
                    <div className="mt-4">
                      <p className="text-sm font-medium">Compras del día</p>
                      {(() => {
                        const total = preview.comprasDelDia!.length;
                        const totalPages = Math.max(1, Math.ceil(total / pageSize));
                        const safePage = Math.min(Math.max(1, comprasPage), totalPages);
                        const start = (safePage - 1) * pageSize;
                        const end = Math.min(start + pageSize, total);
                        const pageRows = preview.comprasDelDia!.slice(start, end);
                        return (
                      <div className="overflow-auto mt-1">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left">
                              <th className="py-1 border-b">#</th>
                              <th className="py-1 border-b">Proveedor</th>
                              <th className="py-1 border-b">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageRows.map((c) => (
                              <tr key={c.idCompra}>
                                <td className="py-1 border-b">{c.idCompra}</td>
                                <td className="py-1 border-b">{c.proveedor}</td>
                                <td className="py-1 border-b">{c.total.toFixed(2)}</td>
                              </tr>
                            ))}
                            {total === 0 && (
                              <tr>
                                <td className="py-1 border-b text-gray-600" colSpan={3}>Sin compras.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        {/* Controles de paginación */}
                        {total > pageSize && (
                          <div className="flex items-center justify-between mt-2 text-xs">
                            <div className="flex items-center gap-2">
                              <button
                                className="border px-2 py-1 rounded disabled:opacity-50"
                                onClick={() => setComprasPage((p) => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                              >
                                Anterior
                              </button>
                              <button
                                className="border px-2 py-1 rounded disabled:opacity-50"
                                onClick={() => setComprasPage((p) => Math.min(totalPages, p + 1))}
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
                                  setComprasPage(v);
                                }}
                              />
                              <span>de {totalPages}</span>
                            </div>
                          </div>
                        )}
                      </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">Sin cálculo. Seleccione fecha y presione Calcular.</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={confirmar}
                disabled={saving || !preview}
                className="rounded-lg bg-black text-white px-3 py-2 text-sm"
              >
                {saving ? "Confirmando…" : "Confirmar cierre"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Egresos del día */}
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <h3 className="text-sm font-medium">Egresos del día</h3>
              <EgresosForm fecha={fecha} onSaved={async()=>{ await cargarEgresosDelDia(); await calcular(); }} />
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="py-2 border-b">Monto</th>
                      <th className="py-2 border-b">Comentario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {egresosDia.map((e) => (
                      <tr key={e.idEgreso}>
                        <td className="py-2 border-b text-red-600">{Number(e.monto).toFixed(2)}</td>
                        <td className="py-2 border-b">{e.comentario ?? "-"}</td>
                      </tr>
                    ))}
                    {egresosDia.length === 0 && (
                      <tr>
                        <td className="py-2 border-b text-gray-600" colSpan={2}>Sin egresos.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                        <th className="py-2 border-b">Total Cobros</th>
                        <th className="py-2 border-b">Total Compras</th>
                        <th className="py-2 border-b">Saldo Final</th>
                        <th className="py-2 border-b">Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((c) => (
                        <tr key={c.idCierre}>
                          <td className="py-2 border-b">{new Date(c.fecha).toLocaleDateString()}</td>
                          <td className="py-2 border-b">{Number(c.totalVentas).toFixed(2)}</td>
                          <td className="py-2 border-b">{Number(c.totalCobros).toFixed(2)}</td>
                          <td className="py-2 border-b">{Number(c.totalCompras).toFixed(2)}</td>
                          <td className={`py-2 border-b ${Number(c.saldoFinal) < 0 ? "text-red-600" : ""}`}>{Number(c.saldoFinal).toFixed(2)}</td>
                          <td className="py-2 border-b">{c.Usuario?.nombre ?? "-"}</td>
                        </tr>
                      ))}
                      {total === 0 && (
                        <tr>
                          <td className="py-2 border-b text-gray-600" colSpan={6}>No hay cierres.</td>
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

function EgresosForm({ fecha, onSaved }: { fecha: string; onSaved: () => void }) {
  const [monto, setMonto] = useState<string>("");
  const [comentario, setComentario] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    if (!monto.trim()) return toast.error("Monto requerido");
    setSaving(true);
    try {
      await api.post(`/egresos-caja`, { fecha, monto: Number(monto), comentario }, { withCredentials: true });
      toast.success("Egreso registrado");
      setMonto("");
      setComentario("");
      onSaved();
    } catch (err) {
      console.error(err);
      const msg = (err as any)?.response?.data?.error || (err as any)?.message || "Error al registrar egreso";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs text-gray-600 block">Monto</label>
        <input type="number" step="0.01" className="rounded border px-2 py-1 w-32"
          value={monto} onChange={(e)=> setMonto(e.target.value)} />
      </div>
      <div className="space-y-1 flex-1">
        <label className="text-xs text-gray-600">Comentario</label>
        <input type="text" className="rounded border px-2 py-1 w-full"
          value={comentario} onChange={(e)=> setComentario(e.target.value)} />
      </div>
      <button
        onClick={guardar}
        disabled={saving}
        className="rounded border px-3 py-2 text-sm"
      >
        {saving ? "Guardando…" : "Agregar egreso"}
      </button>
    </div>
  );
}