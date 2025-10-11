import { SalesLineChart, StockBarChart } from "../components/Charts";

export default function Dashboard() {
  const cards = [
    { title: "Stock total", value: 1240 },
    { title: "Ventas hoy", value: 27 },
    { title: "Clientes", value: 312 },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="rounded-2xl border bg-white p-4">
            <p className="text-sm text-gray-500">{c.title}</p>
            <p className="text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <SalesLineChart />
        <StockBarChart />
      </div>
    </div>
  );
}