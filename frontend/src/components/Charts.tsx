import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export function SalesLineChart() {
  const data = {
    labels: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
    datasets: [{ label: "Ventas", data: [12, 19, 7, 15, 22, 30, 18] }],
  };
  const options = {
    responsive: true,
    plugins: { legend: { position: "top" as const } },
  };
  return (
    <div className="rounded-2xl border bg-white p-4">
      <h3 className="text-sm text-gray-600 mb-2">Ventas semanales</h3>
      <Line data={data} options={options} />
    </div>
  );
}

export function StockBarChart() {
  const data = {
    labels: ["A", "B", "C", "D", "E"],
    datasets: [{ label: "Stock", data: [50, 80, 40, 95, 60] }],
  };
  const options = {
    responsive: true,
    plugins: { legend: { position: "top" as const } },
  };
  return (
    <div className="rounded-2xl border bg-white p-4">
      <h3 className="text-sm text-gray-600 mb-2">Stock por categoría</h3>
      <Bar data={data} options={options} />
    </div>
  );
}
