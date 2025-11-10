import { useEffect, useMemo, useState } from "react";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { api } from "../lib/api";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend);

type DateRange = { desde: string; hasta: string };
type Familia = { id: number; nombre: string };

export default function Estadisticas() {
  const hoy = new Date().toISOString().slice(0, 10);
  const inicioMes = new Date();
  inicioMes.setDate(1);
  const defaultRange: DateRange = {
    desde: inicioMes.toISOString().slice(0, 10),
    hasta: hoy,
  };
  // Rangos independientes por tarjeta
  const [productsRange, setProductsRange] = useState<DateRange>({ ...defaultRange });
  const [customersRange, setCustomersRange] = useState<DateRange>({ ...defaultRange });
  const [monthsRange, setMonthsRange] = useState<DateRange>({ ...defaultRange });
  const [spRange, setSpRange] = useState<DateRange>({ ...defaultRange });
  const [providersRange, setProvidersRange] = useState<DateRange>({ ...defaultRange });

  const [loading, setLoading] = useState(false);
  const [prodStats, setProdStats] = useState<Array<{ idProducto: number; nombre: string; cantidad: number }>>([]);
  const [topCustomers, setTopCustomers] = useState<Array<{ idCliente: number; nombre: string; compras: number; productos?: number; monto?: number }>>([]);
  const [customerMetric, setCustomerMetric] = useState<"compras" | "productos" | "monto">("compras");
  const [months, setMonths] = useState<{ series: Array<{ month: string; monto: number }>; bestMonth: string | null; bestAmount: number }>({ series: [], bestMonth: null, bestAmount: 0 });
  const [monthsCount, setMonthsCount] = useState<number>(6);
  const [salesPurchases, setSalesPurchases] = useState<{ series: Array<{ month: string; ventas: number; compras: number }> }>({ series: [] });
  const [providers, setProviders] = useState<Array<{ idProveedor: number; nombre: string; total: number }>>([]);
  // Buscar clientes (se mueve al popup) y exclusión
  const [customerSearch, setCustomerSearch] = useState<string>(""); // deprecado en encabezado
  const [customerExcludeQuery, setCustomerExcludeQuery] = useState<string>("");
  const [excludedCustomerIds, setExcludedCustomerIds] = useState<number[]>([]);
  // Histórico de precios
  const [priceProductQuery, setPriceProductQuery] = useState<string>("");
  const [priceProductOpts, setPriceProductOpts] = useState<Array<{ id: number; label: string }>>([]);
  const [priceProductId, setPriceProductId] = useState<number | null>(null);
  const [priceHistory, setPriceHistory] = useState<Array<{ fechaIngreso: string; precio: number; proveedor?: string }>>([]);
  const [priceRange, setPriceRange] = useState<DateRange>({ ...defaultRange });
  const [priceFiltersOpen, setPriceFiltersOpen] = useState(false);

  // Controles para productos
  const [order, setOrder] = useState<"desc" | "asc">("desc"); // desc=Más vendidos, asc=Menos vendidos
  const [limit, setLimit] = useState<number>(10);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [familiaId, setFamiliaId] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [customersFiltersOpen, setCustomersFiltersOpen] = useState(false);
  const [monthsFiltersOpen, setMonthsFiltersOpen] = useState(false);
  const [spFiltersOpen, setSpFiltersOpen] = useState(false);
  const [providersFiltersOpen, setProvidersFiltersOpen] = useState(false);

  function resetFilters() {
    const today = new Date();
    const startMonth = new Date();
    startMonth.setDate(1);
    const r = {
      desde: startMonth.toISOString().slice(0, 10),
      hasta: today.toISOString().slice(0, 10),
    };
    setProductsRange({ ...r });
    setCustomersRange({ ...r });
    setMonthsRange({ ...r });
    setSpRange({ ...r });
    setProvidersRange({ ...r });
    setOrder("desc");
    setLimit(10);
    setFamiliaId("");
    setCustomerMetric("compras");
    setCustomerSearch("");
    setMonthsCount(6);
    setPriceProductQuery("");
    setPriceProductOpts([]);
    setPriceProductId(null);
    setPriceHistory([]);
  }

  async function load() {
    setLoading(true);
    try {
      const qp = `?desde=${encodeURIComponent(productsRange.desde)}&hasta=${encodeURIComponent(productsRange.hasta)}`;
      const qc = `?desde=${encodeURIComponent(customersRange.desde)}&hasta=${encodeURIComponent(customersRange.hasta)}`;
      const qm = `?desde=${encodeURIComponent(monthsRange.desde)}&hasta=${encodeURIComponent(monthsRange.hasta)}`;
      const qsp = `?desde=${encodeURIComponent(spRange.desde)}&hasta=${encodeURIComponent(spRange.hasta)}`;
      const qprov = `?desde=${encodeURIComponent(providersRange.desde)}&hasta=${encodeURIComponent(providersRange.hasta)}`;
      const fam = familiaId ? `&familiaId=${encodeURIComponent(familiaId)}` : "";
      const [pStats, cTop, mSeries, spSeries, provRows] = await Promise.all([
        api.get(`/stats/products${qp}&order=${order}&limit=${limit}${fam}`),
        api.get(`/stats/customers${qc}&limit=10&metric=${customerMetric}`),
        api.get(`/stats/months${qm}`),
        api.get(`/stats/sales-vs-purchases${qsp}&months=${monthsCount}`),
        api.get(`/stats/proveedores${qprov}&limit=10`),
      ]);
      setProdStats(pStats.data ?? []);
      setTopCustomers(cTop.data ?? []);
      setMonths(mSeries.data ?? { series: [], bestMonth: null, bestAmount: 0 });
      setSalesPurchases(spSeries.data ?? { series: [] });
      setProviders(provRows.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // cargar familias para el filtro
    (async () => {
      try {
        const { data } = await api.get<Familia[]>("/familias");
        setFamilias((data ?? []).map((f: any) => ({ id: f.id ?? f.idFamilia ?? f.id, nombre: f.nombre ?? f.tipoFamilia })));
      } catch {
        setFamilias([]);
      }
    })();
  }, []);

  const pieColors = useMemo(() => {
    const base = [
      "#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa",
      "#f472b6", "#22d3ee", "#84cc16", "#fb923c", "#93c5fd",
    ];
    return prodStats.map((_, i) => base[i % base.length]);
  }, [prodStats]);

  const productsPieData = useMemo(() => ({
    labels: prodStats.map((p) => p.nombre),
    datasets: [
      {
        label: order === "desc" ? "Más vendidos" : "Menos vendidos",
        data: prodStats.map((p) => p.cantidad),
        backgroundColor: pieColors,
      },
    ],
  }), [prodStats, order, pieColors]);

  const productsPieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true } },
  }), []);

  const topCustomersData = useMemo(() => ({
    labels: topCustomers.filter((c) => !excludedCustomerIds.includes(c.idCliente)).map((c) => c.nombre),
    datasets: [
      {
        label:
          customerMetric === "monto"
            ? "Monto gastado"
            : customerMetric === "productos"
            ? "Cantidad de productos"
            : "Cantidad de compras",
        data:
          customerMetric === "monto"
            ? topCustomers.filter((c) => !excludedCustomerIds.includes(c.idCliente)).map((c) => Number(c.monto ?? 0))
            : customerMetric === "productos"
            ? topCustomers.filter((c) => !excludedCustomerIds.includes(c.idCliente)).map((c) => Number(c.productos ?? 0))
            : topCustomers.filter((c) => !excludedCustomerIds.includes(c.idCliente)).map((c) => Number(c.compras ?? 0)),
        backgroundColor: "rgba(59, 130, 246, 0.6)", // blue-500
      },
    ],
  }), [topCustomers, customerMetric, excludedCustomerIds]);

  const customersOptions = useMemo(() => ({
    responsive: true,
    plugins: { legend: { display: true } },
    scales: {
      x: { title: { display: true, text: "Cliente" } },
      y: {
        title: {
          display: true,
          text:
            customerMetric === "monto"
              ? "Monto gastado"
              : customerMetric === "productos"
              ? "Cantidad de productos"
              : "Cantidad de compras",
        },
        beginAtZero: true,
      },
    },
  }), [customerMetric]);

  const monthsData = useMemo(() => ({
    labels: months.series.map((m) => m.month),
    datasets: [
      {
        label: "Monto de ventas",
        data: months.series.map((m) => m.monto),
        backgroundColor: "rgba(234, 179, 8, 0.6)", // yellow-500
      },
    ],
  }), [months]);

  const monthsOptions = useMemo(() => ({
    responsive: true,
    plugins: { legend: { display: true } },
    scales: {
      x: { title: { display: true, text: "Mes" } },
      y: { title: { display: true, text: "Monto de ventas" }, beginAtZero: true },
    },
  }), []);

  const salesPurchasesData = useMemo(() => ({
    labels: salesPurchases.series.map((s) => s.month),
    datasets: [
      {
        label: "Ventas (monto)",
        data: salesPurchases.series.map((s) => s.ventas),
        backgroundColor: "rgba(16, 185, 129, 0.6)", // green-500
      },
      {
        label: "Compras (monto)",
        data: salesPurchases.series.map((s) => s.compras),
        backgroundColor: "rgba(59, 130, 246, 0.6)", // blue-500
      },
    ],
  }), [salesPurchases]);

  const salesPurchasesOptions = useMemo(() => ({
    responsive: true,
    plugins: { legend: { display: true } },
    scales: {
      x: { title: { display: true, text: "Mes" } },
      y: { title: { display: true, text: "Monto" }, beginAtZero: true },
    },
  }), []);

  const providersData = useMemo(() => ({
    labels: providers.map((p) => p.nombre),
    datasets: [
      {
        label: "Monto comprado",
        data: providers.map((p) => Number(p.total ?? 0)),
        backgroundColor: "rgba(234, 179, 8, 0.6)", // yellow-500
      },
    ],
  }), [providers]);

  const providersOptions = useMemo(() => ({
    responsive: true,
    plugins: { legend: { display: true } },
    scales: {
      x: { title: { display: true, text: "Proveedor" } },
      y: { title: { display: true, text: "Monto comprado" }, beginAtZero: true },
    },
  }), []);

  // Búsqueda de productos para histórico
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/products", {
          params: priceProductQuery ? { q: priceProductQuery } : undefined,
        });
        setPriceProductOpts((data ?? []).slice(0, 20).map((p: any) => ({
          id: p.idProducto ?? p.id,
          label: `${p.codigoProducto ?? p.codigo ?? ""} — ${p.nombreProducto ?? p.nombre ?? ""}`,
        })));
      } catch {
        setPriceProductOpts([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [priceProductQuery]);

  // Cargar histórico de precio al seleccionar producto o cambiar periodo
  useEffect(() => {
    (async () => {
      if (!priceProductId) return setPriceHistory([]);
      try {
        const { data } = await api.get(`/products/${priceProductId}/historico-precio`, {
          params: { limit: 100, desde: priceRange.desde, hasta: priceRange.hasta },
        });
        const rows = Array.isArray(data) ? data : [];
        // ordenar por fecha ascendente para la línea
        rows.sort((a: any, b: any) => String(a.fechaIngreso).localeCompare(String(b.fechaIngreso)));
        setPriceHistory(rows.map((r: any) => ({
          fechaIngreso: String(r.fechaIngreso).slice(0, 10),
          precio: Number(r.precio ?? 0),
          proveedor: r.nombreProveedor ?? undefined,
        })));
      } catch {
        setPriceHistory([]);
      }
    })();
  }, [priceProductId, priceRange.desde, priceRange.hasta]);

  const priceHistoryData = useMemo(() => ({
    labels: priceHistory.map((r) => r.fechaIngreso),
    datasets: [
      {
        label: "Precio",
        data: priceHistory.map((r) => r.precio),
        borderColor: "#60a5fa", // blue-400
        backgroundColor: "rgba(96, 165, 250, 0.2)",
        tension: 0.3,
        pointRadius: 2,
        fill: false,
      },
    ],
  }), [priceHistory]);

  const priceHistoryOptions = useMemo(() => ({
    responsive: true,
    plugins: { legend: { display: true } },
    scales: {
      x: { title: { display: true, text: "Fecha" } },
      y: { title: { display: true, text: "Precio" }, beginAtZero: false },
    },
  }), []);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Estadísticas</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-700">Productos vendidos</h2>
            <button
              onClick={() => setFiltersOpen(true)}
              className="rounded-lg border px-2 py-1 text-xs bg-white hover:bg-gray-50"
            >
              Filtros
            </button>
          </div>
          <div className="h-64">
            <Pie data={productsPieData} options={productsPieOptions} />
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-700">Clientes que más vinieron</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Ver</label>
              <select
                className="rounded border px-2 py-1 text-xs"
                value={customerMetric}
                onChange={(e) => setCustomerMetric(e.target.value as any)}
              >
                <option value="compras">Cantidad de compras</option>
                <option value="productos">Cantidad de productos</option>
                <option value="monto">Monto gastado</option>
              </select>
              <button
                onClick={() => setCustomersFiltersOpen(true)}
                className="rounded-lg border px-2 py-1 text-xs bg-white hover:bg-gray-50"
              >
                Filtros
              </button>
            </div>
          </div>
          <Bar data={topCustomersData} options={customersOptions} />
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-700">Ventas por mes</h2>
            {months.bestMonth && (
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-gray-700 bg-gray-50">
                Mejor mes: {months.bestMonth} ({months.bestAmount})
              </span>
            )}
            <button
              onClick={() => setMonthsFiltersOpen(true)}
              className="rounded-lg border px-2 py-1 text-xs bg-white hover:bg-gray-50"
            >
              Filtros
            </button>
          </div>
          <Bar data={monthsData} options={monthsOptions} />
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-700">Precio histórico de producto</h2>
            <button
              onClick={() => setPriceFiltersOpen(true)}
              className="rounded-lg border px-2 py-1 text-xs bg-white hover:bg-gray-50"
            >
              Filtros
            </button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-gray-600">Producto</label>
            <input
              type="text"
              placeholder="Buscar producto"
              className="rounded border px-2 py-1 text-xs"
              value={priceProductQuery}
              onChange={(e) => setPriceProductQuery(e.target.value)}
            />
            <select
              className="rounded border px-2 py-1 text-xs"
              value={priceProductId ?? ""}
              onChange={(e) => setPriceProductId(Number(e.target.value) || null)}
            >
              <option value="">Seleccione</option>
              {priceProductOpts.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="h-64">
            <Line data={priceHistoryData} options={priceHistoryOptions} />
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-700">Ventas vs Compras</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Meses</label>
              <input
                type="number"
                min={1}
                max={24}
                className="rounded border px-2 py-1 text-xs w-20"
                value={monthsCount}
                onChange={(e) => setMonthsCount(Math.max(1, Math.min(24, Number(e.target.value) || 6)))}
              />
              <button
                onClick={() => setSpFiltersOpen(true)}
                className="rounded-lg border px-2 py-1 text-xs bg-white hover:bg-gray-50"
              >
                Filtros
              </button>
            </div>
          </div>
          <Bar data={salesPurchasesData} options={salesPurchasesOptions} />
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-700">Análisis de proveedores</h2>
            <button
              onClick={() => setProvidersFiltersOpen(true)}
              className="rounded-lg border px-2 py-1 text-xs bg-white hover:bg-gray-50"
            >
              Filtros
            </button>
          </div>
          <Bar data={providersData} options={providersOptions} />
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-md rounded-2xl border bg-white shadow-2xl">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-medium">Filtros de productos vendidos</h3>
                <button
                  className="rounded border px-2 py-1 text-xs bg-white"
                  onClick={() => setFiltersOpen(false)}
                  type="button"
                >
                  Cerrar
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Desde</label>
                    <input
                      type="date"
                      className="w-full rounded border px-2 py-1 text-sm"
                      value={productsRange.desde}
                      onChange={(e) => setProductsRange((r) => ({ ...r, desde: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                    <input
                      type="date"
                      className="w-full rounded border px-2 py-1 text-sm"
                      value={productsRange.hasta}
                      onChange={(e) => setProductsRange((r) => ({ ...r, hasta: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Ver</label>
                    <select
                      className="w-full rounded border px-2 py-1 text-sm"
                      value={order}
                      onChange={(e) => setOrder(e.target.value === "asc" ? "asc" : "desc")}
                    >
                      <option value="desc">Más vendidos</option>
                      <option value="asc">Menos vendidos</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Items</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      className="w-full rounded border px-2 py-1 text-sm"
                      value={limit}
                      onChange={(e) => setLimit(Math.max(1, Math.min(50, Number(e.target.value) || 10)))}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">Familia</label>
                    <select
                      className="w-full rounded border px-2 py-1 text-sm"
                      value={familiaId}
                      onChange={(e) => setFamiliaId(e.target.value)}
                    >
                      <option value="">Todas</option>
                      {familias.map((f) => (
                        <option key={f.id} value={String(f.id)}>{f.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">
                <button
                  className="rounded-lg border px-3 py-2 text-xs bg-white"
                  onClick={() => setFiltersOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="rounded-lg bg-black text-white px-3 py-2 text-xs"
                  onClick={async () => { await load(); setFiltersOpen(false); }}
                  type="button"
                  disabled={loading}
                >
                  {loading ? "Aplicando…" : "Aplicar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {customersFiltersOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCustomersFiltersOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-md rounded-2xl border bg-white shadow-2xl">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-medium">Filtros de clientes</h3>
                <button className="rounded border px-2 py-1 text-xs bg-white" onClick={() => setCustomersFiltersOpen(false)} type="button">Cerrar</button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Desde</label>
                    <input type="date" className="w-full rounded border px-2 py-1 text-sm" value={customersRange.desde} onChange={(e) => setCustomersRange((r) => ({ ...r, desde: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                    <input type="date" className="w-full rounded border px-2 py-1 text-sm" value={customersRange.hasta} onChange={(e) => setCustomersRange((r) => ({ ...r, hasta: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Buscar cliente para excluir</label>
                  <input type="text" className="w-full rounded border px-2 py-1 text-sm" placeholder="Nombre del cliente" value={customerExcludeQuery} onChange={(e) => setCustomerExcludeQuery(e.target.value)} />
                  <div className="mt-2 max-h-32 overflow-auto border rounded">
                    {topCustomers.filter(c => c.nombre.toLowerCase().includes(customerExcludeQuery.toLowerCase())).slice(0, 8).map(c => (
                      <div key={c.idCliente} className="flex items-center justify-between px-2 py-1 text-sm">
                        <span>{c.nombre}</span>
                        <button type="button" className="text-xs rounded border px-2 py-0.5" onClick={() => {
                          if (!excludedCustomerIds.includes(c.idCliente)) setExcludedCustomerIds(ids => [...ids, c.idCliente]);
                        }}>Excluir</button>
                      </div>
                    ))}
                  </div>
                  {excludedCustomerIds.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {excludedCustomerIds.map(id => {
                        const found = topCustomers.find(c => c.idCliente === id);
                        const name = found?.nombre ?? String(id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs bg-gray-50">
                            {name}
                            <button type="button" className="text-red-600" onClick={() => setExcludedCustomerIds(ids => ids.filter(x => x !== id))}>✕</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">
                <button className="rounded-lg border px-3 py-2 text-xs bg-white" onClick={() => setCustomersFiltersOpen(false)} type="button">Cancelar</button>
                <button className="rounded-lg bg-black text-white px-3 py-2 text-xs" onClick={async () => { await load(); setCustomersFiltersOpen(false); }} type="button" disabled={loading}>{loading ? "Aplicando…" : "Aplicar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {monthsFiltersOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMonthsFiltersOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-md rounded-2xl border bg-white shadow-2xl">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-medium">Filtros de ventas por mes</h3>
                <button className="rounded border px-2 py-1 text-xs bg-white" onClick={() => setMonthsFiltersOpen(false)} type="button">Cerrar</button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Desde (mes)</label>
                    <input type="month" className="w-full rounded border px-2 py-1 text-sm" onChange={(e) => {
                      const val = e.target.value; // YYYY-MM
                      if (!val) return;
                      const [yy, mm] = val.split('-').map(Number);
                      const first = new Date(yy, (mm - 1), 1);
                      setMonthsRange((r) => ({ ...r, desde: first.toISOString().slice(0, 10) }));
                    }} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hasta (mes)</label>
                    <input type="month" className="w-full rounded border px-2 py-1 text-sm" onChange={(e) => {
                      const val = e.target.value; // YYYY-MM
                      if (!val) return;
                      const [yy, mmRaw] = val.split('-').map(Number);
                      const last = new Date(yy, mmRaw, 0); // último día del mes seleccionado
                      setMonthsRange((r) => ({ ...r, hasta: last.toISOString().slice(0, 10) }));
                    }} />
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">
                <button className="rounded-lg border px-3 py-2 text-xs bg-white" onClick={() => setMonthsFiltersOpen(false)} type="button">Cancelar</button>
                <button className="rounded-lg bg-black text-white px-3 py-2 text-xs" onClick={async () => { await load(); setMonthsFiltersOpen(false); }} type="button" disabled={loading}>{loading ? "Aplicando…" : "Aplicar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {spFiltersOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSpFiltersOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-md rounded-2xl border bg-white shadow-2xl">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-medium">Filtros de Ventas vs Compras</h3>
                <button className="rounded border px-2 py-1 text-xs bg-white" onClick={() => setSpFiltersOpen(false)} type="button">Cerrar</button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Desde</label>
                    <input type="date" className="w-full rounded border px-2 py-1 text-sm" value={spRange.desde} onChange={(e) => setSpRange((r) => ({ ...r, desde: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                    <input type="date" className="w-full rounded border px-2 py-1 text-sm" value={spRange.hasta} onChange={(e) => setSpRange((r) => ({ ...r, hasta: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">
                <button className="rounded-lg border px-3 py-2 text-xs bg-white" onClick={() => setSpFiltersOpen(false)} type="button">Cancelar</button>
                <button className="rounded-lg bg-black text-white px-3 py-2 text-xs" onClick={async () => { await load(); setSpFiltersOpen(false); }} type="button" disabled={loading}>{loading ? "Aplicando…" : "Aplicar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {providersFiltersOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setProvidersFiltersOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-md rounded-2xl border bg-white shadow-2xl">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-medium">Filtros de proveedores</h3>
                <button className="rounded border px-2 py-1 text-xs bg-white" onClick={() => setProvidersFiltersOpen(false)} type="button">Cerrar</button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Desde</label>
                    <input type="date" className="w-full rounded border px-2 py-1 text-sm" value={providersRange.desde} onChange={(e) => setProvidersRange((r) => ({ ...r, desde: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                    <input type="date" className="w-full rounded border px-2 py-1 text-sm" value={providersRange.hasta} onChange={(e) => setProvidersRange((r) => ({ ...r, hasta: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">
                <button className="rounded-lg border px-3 py-2 text-xs bg-white" onClick={() => setProvidersFiltersOpen(false)} type="button">Cancelar</button>
                <button className="rounded-lg bg-black text-white px-3 py-2 text-xs" onClick={async () => { await load(); setProvidersFiltersOpen(false); }} type="button" disabled={loading}>{loading ? "Aplicando…" : "Aplicar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {priceFiltersOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setPriceFiltersOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-full max-w-md rounded-2xl border bg-white shadow-2xl">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-medium">Filtros de precio histórico</h3>
                <button className="rounded border px-2 py-1 text-xs bg-white" onClick={() => setPriceFiltersOpen(false)} type="button">Cerrar</button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Desde</label>
                    <input type="date" className="w-full rounded border px-2 py-1 text-sm" value={priceRange.desde} onChange={(e) => setPriceRange((r: DateRange) => ({ ...r, desde: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hasta</label>
                    <input type="date" className="w-full rounded border px-2 py-1 text-sm" value={priceRange.hasta} onChange={(e) => setPriceRange((r: DateRange) => ({ ...r, hasta: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">
                <button className="rounded-lg border px-3 py-2 text-xs bg-white" onClick={() => setPriceFiltersOpen(false)} type="button">Cancelar</button>
                <button className="rounded-lg bg-black text-white px-3 py-2 text-xs" onClick={() => setPriceFiltersOpen(false)} type="button">Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}