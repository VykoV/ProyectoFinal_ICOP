import { NavLink } from "react-router-dom";
import {
  Boxes,
  Users,
  Factory,
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  ShoppingBag,
  BarChart3,
  Coins,
  Bell,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import { useUI } from "../store/ui";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../store/notifications";
import { showAlert } from "../lib/alerts";

const items = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/ventas", icon: ShoppingCart, label: "Ventas" },
  { to: "/pre-ventas", icon: ClipboardList, label: "Presupuestos" },
  { to: "/compras", icon: ShoppingBag, label: "Compras" },
  { to: "/monedas", icon: Coins, label: "Monedas" },
  { to: "/productos", icon: Boxes, label: "Productos" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/proveedores", icon: Factory, label: "Proveedores" },
  { to: "/usuarios", icon: Users, label: "Usuarios" },
  { to: "/estadisticas", icon: BarChart3, label: "Estadísticas" },
] as const;

export default function Sidebar() {
  const { sidebarOpen } = useUI();
  const { hasRole } = useAuth();
  const { list, unreadCount } = useNotifications();

  const blocked = new Set<string>();
  if (hasRole("Vendedor")) {
    [
      "/usuarios",
      "/proveedores",
      "/compras",
      "/monedas",
      "/ventas",
      "/dashboard",
      "/estadisticas",
    ].forEach((r) => blocked.add(r));
  }
  if (hasRole("Cajero")) {
    [
      "/usuarios",
      "/proveedores",
      "/compras",
      "/monedas",
      "/pre-ventas",
      "/estadisticas",
    ].forEach((r) => blocked.add(r));
  }

  return (
    <aside
      className={`h-full shrink-0 border-r bg-white -mt-px ${
        sidebarOpen ? "w-60" : "w-14"
      }`}
    >
      <nav className="p-2 space-y-1">
        {items
          .filter(({ to }) => !blocked.has(to))
          .map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100 ${
                isActive ? "bg-gray-100 font-medium" : ""
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className={`${sidebarOpen ? "block" : "hidden"}`}>
              {label}
            </span>
          </NavLink>
        ))}

        {/* Sección de notificaciones */}
        {sidebarOpen ? (
          <div className="mt-2 rounded-xl border">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <span className="text-sm">Notificaciones</span>
              </div>
              {unreadCount > 0 && (
                <span className="text-xs rounded-full bg-red-600 text-white px-2 py-0.5">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="max-h-40 overflow-auto">
              {list.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-500">Sin notificaciones</div>
              ) : (
                list.slice(0, 5).map((n) => (
                  <div
                    key={n.id}
                    className="px-3 py-2 flex items-start gap-2 hover:bg-gray-50 cursor-pointer"
                    onClick={() => showAlert({ type: (n.type as any), title: n.title, message: n.message })}
                  >
                    {n.type === "error" ? (
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                    ) : n.type === "warning" ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                    ) : n.type === "success" ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className={`text-xs ${n.read ? "text-gray-500" : "text-gray-800"}`}>
                        {n.title ?? (n.type === "error" ? "Error" : n.type === "warning" ? "Alerta" : n.type === "success" ? "Éxito" : "Aviso")}
                      </div>
                      <div className="text-xs text-gray-700 truncate">{n.message}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-center">
            <div className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] h-4 min-w-[1rem] px-1">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
