import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { useDailyReminder } from "../hooks/useDailyReminder";

export default function Layout() {
  const { hasRole } = useAuth();
  // Recordatorio diario para actualizar monedas a las 11:00 (solo Administrador)
  useDailyReminder({
    hour: 11,
    minute: 0,
    message: "Recordatorio diario: actualizar el precio de las monedas",
    type: "warning",
    enabled: hasRole("Administrador"),
    title: "Monedas",
  });
  return (
    <div className="h-dvh flex flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0 -mt-px">
        <Sidebar />
        <main className="flex-1 bg-gray-50 overflow-auto p-4 md:p-6 -mt-px">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
