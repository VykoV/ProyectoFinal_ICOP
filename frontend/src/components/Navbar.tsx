import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User, Menu, LogOut, ChevronDown, Bell, AlertCircle, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { useUI } from "../store/ui";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../store/notifications";
import { showAlert } from "../lib/alerts";

export default function Navbar() {
    const { toggleSidebar } = useUI();
    const [open, setOpen] = useState(false);
    const pop = useRef<HTMLDivElement>(null);
    const [notifOpen, setNotifOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const nav = useNavigate();
    const qc = useQueryClient();
    const { user, refresh } = useAuth();
    const { list, unreadCount, markAllRead, clear } = useNotifications();

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!pop.current?.contains(target)) setOpen(false);
            if (!notifRef.current?.contains(target)) setNotifOpen(false);
        };
        window.addEventListener("click", onClick);
        return () => window.removeEventListener("click", onClick);
    }, []);

    async function logout() {
        try {
            await api.post("/auth/logout");
        } finally {
            await refresh(null);
            qc.removeQueries({ queryKey: ["me"], exact: false });
            nav("/login", { replace: true });
        }
    }

    return (
        <nav className="relative z-50 flex items-center justify-between h-14 px-4 border-b bg-white">
            <button
                onClick={toggleSidebar}
                className="p-2 rounded hover:bg-gray-100"
                aria-label="Abrir/Cerrar sidebar"
            >
                <Menu className="h-5 w-5" />
            </button>

            <Logo />

            {/* Agrupar notificaciones y usuario al lado derecho */}
            <div className="flex items-center gap-1">
                {/* Notificaciones */}
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setNotifOpen((v) => !v);
                        }}
                        className="relative p-2 rounded-full hover:bg-gray-100"
                        aria-label="Notificaciones"
                        aria-haspopup="menu"
                        aria-expanded={notifOpen}
                    >
                        <Bell className="w-5 h-5 text-gray-700" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] h-4 min-w-[1rem] px-1">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {notifOpen && (
                        <div
                            role="menu"
                            className="absolute right-0 mt-2 w-80 rounded-xl border bg-white shadow-lg py-2 z-50"
                        >
                            <div className="px-3 pb-2 border-b flex items-center justify-between">
                                <span className="text-sm font-medium">Notificaciones</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={markAllRead} className="text-xs text-gray-600 hover:underline">Marcar leídas</button>
                                    <button onClick={clear} className="text-xs text-gray-600 hover:underline">Limpiar</button>
                                </div>
                            </div>
                            <div className="max-h-80 overflow-auto">
                                {list.length === 0 ? (
                                    <div className="px-3 py-3 text-xs text-gray-500">Sin notificaciones</div>
                                ) : (
                                    list.slice(0, 8).map((n) => (
                                        <div
                                            key={n.id}
                                            className="px-3 py-2 flex items-start gap-2 hover:bg-gray-50 cursor-pointer"
                                            onClick={() =>
                                                showAlert({ type: (n.type as any), title: n.title, message: n.message })
                                            }
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
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs ${n.read ? "text-gray-500" : "text-gray-800 font-medium"}`}>
                                                        {n.title ?? (n.type === "error" ? "Error" : n.type === "warning" ? "Alerta" : n.type === "success" ? "Éxito" : "Aviso")}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">
                                                        {new Date(n.createdAt).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-700 truncate">{n.message}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Menú de usuario */}
                <div className="relative" ref={pop}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen((v) => !v);
                        }}
                        className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100"
                        aria-haspopup="menu"
                        aria-expanded={open}
                    >
                        <User className="w-5 h-5 text-gray-700" />
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>

                {open && (
                    <div
                        role="menu"
                        className="absolute right-0 mt-2 w-44 rounded-xl border bg-white shadow-lg py-1 z-50"
                    >
                        <div className="px-3 py-2 border-b">
                            <div className="text-sm font-medium truncate">
                                {user ? user.nombre : "Invitado"}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                                {user && user.roles?.length
                                    ? user.roles.join(", ")
                                    : user
                                      ? "Sin rol"
                                      : "No autenticado"}
                            </div>
                        </div>
                        {/* Si luego querés más opciones, agrégalas aquí */}
                        <button
                            onClick={logout}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                            role="menuitem"
                        >
                            <LogOut className="w-4 h-4" />
                            Cerrar sesión
                        </button>
                    </div>
                )}
                </div>
            </div>
        </nav>
    );
}
