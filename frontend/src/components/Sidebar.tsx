import { NavLink } from "react-router-dom";
import {
  Boxes,
  Users,
  Factory,
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  ShoppingBag,
} from "lucide-react";
import { useUI } from "../store/ui";

const items = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/ventas", icon: ShoppingCart, label: "Ventas" },
  { to: "/pre-ventas", icon: ClipboardList, label: "Presupuestos" },
  { to: "/compras", icon: ShoppingBag, label: "Compras" },
  { to: "/productos", icon: Boxes, label: "Productos" },
  { to: "/clientes", icon: Users, label: "Clientes" },
  { to: "/proveedores", icon: Factory, label: "Proveedores" },
  { to: "/usuarios", icon: Users, label: "Usuarios" },
] as const;

export default function Sidebar() {
  const { sidebarOpen } = useUI();

  return (
    <aside
      className={`h-full shrink-0 border-r bg-white -mt-px ${
        sidebarOpen ? "w-60" : "w-14"
      }`}
    >
      <nav className="p-2 space-y-1">
        {items.map(({ to, icon: Icon, label }) => (
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
      </nav>
    </aside>
  );
}
