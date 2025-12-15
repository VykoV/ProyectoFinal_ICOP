import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { fmtPrice } from "../lib/format";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole("Administrador");
  const isVendedor = hasRole("Vendedor");
  const isCajero = hasRole("Cajero");

  const {
    data: ofertas,
    isLoading: ofertasLoading,
    error: ofertasError,
  } = useQuery({
    queryKey: ["dashboard", "ofertas"],
    queryFn: async () => {
      const { data } = await api.get("/products/ofertas");
      return Array.isArray(data) ? data : [];
    },
  });

  const {
    data: stockBajo,
    isLoading: stockLoading,
    error: stockError,
  } = useQuery({
    queryKey: ["dashboard", "stock-bajo-real"],
    queryFn: async () => {
      const { data } = await api.get("/products/stock-bajo-real");
      return Array.isArray(data) ? data : [];
    },
  });

  const {
    data: adminStats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ["dashboard", "admin-stats"],
    queryFn: async () => {
      if (!isAdmin) return null;
      const { data } = await api.get("/stats/dashboard-admin");
      return data;
    },
    enabled: isAdmin,
  });

  const todayYmd = new Date().toISOString().slice(0, 10);
  const desde30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const {
    data: topMas,
    isLoading: topMasLoading,
    error: topMasError,
  } = useQuery({
    queryKey: ["dashboard", "top5-mas", desde30, todayYmd],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data } = await api.get("/stats/products", {
        params: { desde: desde30, hasta: todayYmd, limit: 5, order: "desc" },
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: isAdmin,
  });

  const {
    data: topMenos,
    isLoading: topMenosLoading,
    error: topMenosError,
  } = useQuery({
    queryKey: ["dashboard", "top5-menos", desde30, todayYmd],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data } = await api.get("/stats/products", {
        params: { desde: desde30, hasta: todayYmd, limit: 5, order: "asc" },
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: isAdmin,
  });

  const {
    data: pendCobro,
    isLoading: pendLoading,
    error: pendError,
  } = useQuery({
    queryKey: ["dashboard", "pendientes-cobro"],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data } = await api.get("/ventas/pendientes-cobro");
      return Array.isArray(data) ? data : [];
    },
    enabled: isAdmin,
  });

  const [vencPage, setVencPage] = useState(1);
  const {
    data: vencidas,
    isLoading: vencLoading,
    error: vencError,
  } = useQuery({
    queryKey: ["dashboard", "preventas-vencidas", vencPage],
    queryFn: async () => {
      if (!isAdmin) return [];
      const { data } = await api.get("/preventas/vencidos", {
        params: { page: vencPage, pageSize: 5 },
      });
      return Array.isArray(data) ? data : [];
    },
    enabled: isAdmin,
  });

  const {
    data: cajeroPendCobro,
    isLoading: cajeroPendLoading,
    error: cajeroPendError,
  } = useQuery({
    queryKey: ["dashboard", "cajero-pendientes-cobro"],
    queryFn: async () => {
      if (!isCajero) return [];
      const { data } = await api.get("/ventas/pendientes-cobro");
      const rows = Array.isArray(data) ? data : [];
      return rows.slice(0, 15);
    },
    enabled: isCajero,
  });

  const {
    data: cajeroListoCaja,
    isLoading: cajeroListoLoading,
    error: cajeroListoError,
  } = useQuery({
    queryKey: ["dashboard", "cajero-listocaja"],
    queryFn: async () => {
      if (!isCajero) return [];
      const { data } = await api.get("/preventas", {
        params: { estado: "listocaja" },
      });
      const rows = Array.isArray(data) ? data : [];
      return rows.slice(0, 15);
    },
    enabled: isCajero,
  });

  const {
    data: cierrePreview,
    isLoading: cierreLoading,
    error: cierreError,
  } = useQuery({
    queryKey: ["dashboard", "cajero-cierre-preview", todayYmd],
    queryFn: async () => {
      if (!isCajero) return null;
      const { data } = await api.get("/cierres-caja/preview", {
        params: { fecha: todayYmd },
      });
      return data;
    },
    enabled: isCajero,
  });

  const {
    data: ventasHoyFinalizadas,
    isLoading: ventasHoyLoading,
    error: ventasHoyError,
  } = useQuery({
    queryKey: ["dashboard", "cajero-ventas-finalizadas-hoy", todayYmd],
    queryFn: async () => {
      if (!isCajero) return [];
      const { data } = await api.get("/ventas");
      const rows = Array.isArray(data) ? data : [];
      return rows.filter(
        (v: any) =>
          String(v.fecha || "").slice(0, 10) === todayYmd &&
          String(v.estado || "")
            .toLowerCase()
            .includes("finaliz")
      );
    },
    enabled: isCajero,
  });

  const {
    data: misPendientes,
    isLoading: misLoading,
    error: misError,
  } = useQuery({
    queryKey: ["dashboard", "mis-preventas-pendientes", user?.id],
    queryFn: async () => {
      if (!isVendedor || !user?.id) return [];
      const { data } = await api.get("/preventas", {
        params: { estado: "pendiente" },
      });
      const rows = Array.isArray(data) ? data : [];
      return rows.filter(
        (r: any) =>
          Number(r.idUsuario ?? r.Usuario?.idUsuario ?? -1) === Number(user.id)
      );
    },
    enabled: isVendedor && !!user?.id,
  });

  const {
    data: globalPendientes,
    isLoading: globalLoading,
    error: globalError,
  } = useQuery({
    queryKey: ["dashboard", "preventas-pendientes-global"],
    queryFn: async () => {
      if (!isVendedor) return [];
      const { data } = await api.get("/preventas", {
        params: { estado: "pendiente" },
      });
      const rows = Array.isArray(data) ? data : [];
      return rows.slice(0, 10);
    },
    enabled: isVendedor,
  });

  // (sección Vendedor removida)

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border bg-white p-4">
            <div className="text-xs text-gray-600">Ventas hoy</div>
            {statsLoading ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : statsError ? (
              <div className="text-sm text-red-700">Error</div>
            ) : (
              <div className="mt-2">
                <div className="text-2xl font-semibold">
                  {adminStats?.ventasHoy?.cantidad ?? 0}
                </div>
                <div className="text-sm text-gray-700">
                  $
                  {fmtPrice(adminStats?.ventasHoy?.total ?? 0, {
                    minFraction: 2,
                    maxFraction: 2,
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-xs text-gray-600">Ventas mes</div>
            {statsLoading ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : statsError ? (
              <div className="text-sm text-red-700">Error</div>
            ) : (
              <div className="mt-2">
                <div className="text-2xl font-semibold">
                  {adminStats?.ventasMes?.cantidad ?? 0}
                </div>
                <div className="text-sm text-gray-700">
                  $
                  {fmtPrice(adminStats?.ventasMes?.total ?? 0, {
                    minFraction: 2,
                    maxFraction: 2,
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-xs text-gray-600">Presupuestos pendientes</div>
            {statsLoading ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : statsError ? (
              <div className="text-sm text-red-700">Error</div>
            ) : (
              <div className="mt-2">
                <div className="text-2xl font-semibold">
                  {adminStats?.preventasPendientes?.cantidad ?? 0}
                </div>
              </div>
            )}
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="text-xs text-gray-600">Precios desactualizados</div>
            {statsLoading ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : statsError ? (
              <div className="text-sm text-red-700">Error</div>
            ) : (
              <div className="mt-2">
                <div className="text-2xl font-semibold">
                  {adminStats?.preciosDesactualizados?.cantidad ?? 0}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isVendedor && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <h3 className="text-sm font-medium">
                Mis presupuestos pendientes
              </h3>
              {misLoading ? (
                <div className="text-sm text-gray-600">Cargando…</div>
              ) : misError ? (
                <div className="text-sm text-red-700">Error</div>
              ) : misPendientes && misPendientes.length > 0 ? (
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {misPendientes.map((v: any) => (
                      <tr key={v.id ?? v.idVenta} className="border-t">
                        <td className="px-3 py-2">
                          {v.id ?? v.idVenta ?? "-"}
                        </td>
                        <td className="px-3 py-2">{v.cliente ?? "-"}</td>
                        <td className="px-3 py-2">
                          {v.fecha
                            ? new Date(v.fecha).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-gray-600">Sin datos</div>
              )}
            </div>
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <h3 className="text-sm font-medium">
                Presupuestos pendientes globales
              </h3>
              {globalLoading ? (
                <div className="text-sm text-gray-600">Cargando…</div>
              ) : globalError ? (
                <div className="text-sm text-red-700">Error</div>
              ) : globalPendientes && globalPendientes.length > 0 ? (
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalPendientes.map((v: any) => (
                      <tr key={v.id ?? v.idVenta} className="border-t">
                        <td className="px-3 py-2">
                          {v.id ?? v.idVenta ?? "-"}
                        </td>
                        <td className="px-3 py-2">{v.cliente ?? "-"}</td>
                        <td className="px-3 py-2">
                          {v.fecha
                            ? new Date(v.fecha).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-gray-600">Sin datos</div>
              )}
            </div>
          </div>
        </div>
      )}

      {isCajero && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <h3 className="text-sm font-medium">
                Ventas pendientes de cobro
              </h3>
              {cajeroPendLoading ? (
                <div className="text-sm text-gray-600">Cargando…</div>
              ) : cajeroPendError ? (
                <div className="text-sm text-red-700">Error</div>
              ) : cajeroPendCobro && cajeroPendCobro.length > 0 ? (
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cajeroPendCobro.map((v: any) => (
                      <tr key={v.idVenta} className="border-t">
                        <td className="px-3 py-2">{v.idVenta}</td>
                        <td className="px-3 py-2">{v.cliente}</td>
                        <td className="px-3 py-2 text-right">
                          $
                          {fmtPrice(v.total, {
                            minFraction: 2,
                            maxFraction: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-gray-600">Sin datos</div>
              )}
            </div>
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <h3 className="text-sm font-medium">Presupuestos ListoCaja</h3>
              {cajeroListoLoading ? (
                <div className="text-sm text-gray-600">Cargando…</div>
              ) : cajeroListoError ? (
                <div className="text-sm text-red-700">Error</div>
              ) : cajeroListoCaja && cajeroListoCaja.length > 0 ? (
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cajeroListoCaja.map((v: any) => (
                      <tr key={v.id ?? v.idVenta} className="border-t">
                        <td className="px-3 py-2">
                          {v.id ?? v.idVenta ?? "-"}
                        </td>
                        <td className="px-3 py-2">{v.cliente ?? "-"}</td>
                        <td className="px-3 py-2">
                          {v.fecha
                            ? new Date(v.fecha).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-gray-600">Sin datos</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <h3 className="text-sm font-medium">
                Total cobrado hoy por método de pago
              </h3>
              {cierreLoading ? (
                <div className="text-sm text-gray-600">Cargando…</div>
              ) : cierreError ? (
                <div className="text-sm text-red-700">Error</div>
              ) : cierrePreview?.ventasPorMetodo &&
                cierrePreview.ventasPorMetodo.length > 0 ? (
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Método</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cierrePreview.ventasPorMetodo.map(
                      (r: any, idx: number) => (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{r.metodo}</td>
                          <td className="px-3 py-2 text-right">
                            $
                            {fmtPrice(r.total, {
                              minFraction: 2,
                              maxFraction: 2,
                            })}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-gray-600">Sin datos</div>
              )}
            </div>
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <h3 className="text-sm font-medium">Ventas finalizadas hoy</h3>
              {ventasHoyLoading ? (
                <div className="text-sm text-gray-600">Cargando…</div>
              ) : ventasHoyError ? (
                <div className="text-sm text-red-700">Error</div>
              ) : ventasHoyFinalizadas && ventasHoyFinalizadas.length > 0 ? (
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasHoyFinalizadas.map((v: any) => (
                      <tr key={v.id} className="border-t">
                        <td className="px-3 py-2">{v.id}</td>
                        <td className="px-3 py-2">{v.cliente}</td>
                        <td className="px-3 py-2 text-right">
                          $
                          {fmtPrice(v.total, {
                            minFraction: 2,
                            maxFraction: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-sm text-gray-600">Sin datos</div>
              )}
            </div>
          </div>
        </div>
      )}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-medium">
              Top 5 productos más vendidos (30 días)
            </h2>
            {topMasLoading ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : topMasError ? (
              <div className="text-sm text-red-700">Error</div>
            ) : topMas && topMas.length > 0 ? (
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {topMas.map((r: any) => (
                    <tr key={r.idProducto} className="border-t">
                      <td className="px-3 py-2">{r.nombre}</td>
                      <td className="px-3 py-2 text-right">{r.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-sm text-gray-600">Sin datos</div>
            )}
          </div>
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-medium">
              Top 5 productos menos vendidos (30 días)
            </h2>
            {topMenosLoading ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : topMenosError ? (
              <div className="text-sm text-red-700">Error</div>
            ) : topMenos && topMenos.length > 0 ? (
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {topMenos.map((r: any) => (
                    <tr key={r.idProducto} className="border-t">
                      <td className="px-3 py-2">{r.nombre}</td>
                      <td className="px-3 py-2 text-right">{r.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-sm text-gray-600">Sin datos</div>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-medium">Ventas pendientes de cobro</h2>
            {pendLoading ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : pendError ? (
              <div className="text-sm text-red-700">Error</div>
            ) : pendCobro && pendCobro.length > 0 ? (
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pendCobro.map((v: any) => (
                    <tr key={v.idVenta} className="border-t">
                      <td className="px-3 py-2">{v.idVenta}</td>
                      <td className="px-3 py-2">{v.cliente}</td>
                      <td className="px-3 py-2 text-right">
                        ${fmtPrice(v.total, { minFraction: 2, maxFraction: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-sm text-gray-600">Sin datos</div>
            )}
          </div>
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-sm font-medium">
              Reservas/Presupuestos vencidos
            </h2>
            {vencLoading ? (
              <div className="text-sm text-gray-600">Cargando…</div>
            ) : vencError ? (
              <div className="text-sm text-red-700">Error</div>
            ) : vencidas && vencidas.length > 0 ? (
              <>
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vencidas.map((v: any) => (
                      <tr key={v.id ?? v.idVenta} className="border-t">
                        <td className="px-3 py-2">
                          {v.id ?? v.idVenta ?? "-"}
                        </td>
                        <td className="px-3 py-2">{v.cliente ?? "-"}</td>
                        <td className="px-3 py-2">
                          {v.fecha
                            ? new Date(v.fecha).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(vencPage > 1 || (vencidas?.length ?? 0) === 5) && (
                  <div className="flex items-center gap-2 mt-2">
                    {vencPage > 1 && (
                      <button
                        className="px-1.5 py-0.5 text-xs text-gray-600 hover:text-black disabled:opacity-50"
                        onClick={() => setVencPage((p) => Math.max(1, p - 1))}
                        disabled={vencPage <= 1}
                      >
                        Anterior
                      </button>
                    )}
                    {(vencidas?.length ?? 0) === 5 && (
                      <button
                        className="px-1.5 py-0.5 text-xs text-gray-600 hover:text-black disabled:opacity-50"
                        onClick={() => setVencPage((p) => p + 1)}
                        disabled={(vencidas?.length ?? 0) < 5}
                      >
                        Siguiente
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-600">Sin datos</div>
            )}
          </div>
        </div>
      )}

      {/* sección Vendedor removida */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Productos en oferta</h2>
          </div>
          {ofertasLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : ofertasError ? (
            <div className="text-sm text-red-700">Error al cargar ofertas</div>
          ) : ofertas && ofertas.length > 0 ? (
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-right">Precio</th>
                  <th className="px-3 py-2 text-left">Código</th>
                </tr>
              </thead>
              <tbody>
                {ofertas.map((p: any) => (
                  <tr key={p.idProducto} className="border-t">
                    <td className="px-3 py-2">{p.idProducto}</td>
                    <td className="px-3 py-2">{p.nombreProducto}</td>
                    <td className="px-3 py-2 text-right">
                      $
                      {fmtPrice(p.precioVentaPublicoProducto, {
                        minFraction: 2,
                        maxFraction: 2,
                      })}
                    </td>
                    <td className="px-3 py-2">{p.codigoProducto ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-gray-600">Sin productos en oferta</div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Stock bajo / crítico</h2>
          </div>
          {stockLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : stockError ? (
            <div className="text-sm text-red-700">Error al cargar stock</div>
          ) : stockBajo && stockBajo.length > 0 ? (
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-right">Stock actual</th>
                  <th className="px-3 py-2 text-right">Mínimo</th>
                  <th className="px-3 py-2 text-left">Última modificación</th>
                </tr>
              </thead>
              <tbody>
                {stockBajo.map((s: any) => (
                  <tr key={s.idProducto} className="border-t">
                    <td className="px-3 py-2">{s.nombreProducto}</td>
                    <td className="px-3 py-2 text-right">
                      {fmtPrice(s.stockActual, {
                        minFraction: 2,
                        maxFraction: 2,
                      })}{" "}
                      g
                    </td>
                    <td className="px-3 py-2 text-right">
                      {fmtPrice(s.minimo, { minFraction: 2, maxFraction: 2 })} g
                    </td>
                    <td className="px-3 py-2">
                      {s.actualizadoEn
                        ? new Date(s.actualizadoEn).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-gray-600">
              Sin productos con stock bajo
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
