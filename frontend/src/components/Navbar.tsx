import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { User, Menu, LogOut, ChevronDown } from "lucide-react";
import { useUI } from "../store/ui";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
    const { toggleSidebar } = useUI();
    const [open, setOpen] = useState(false);
    const pop = useRef<HTMLDivElement>(null);
    const nav = useNavigate();
    const qc = useQueryClient();
    const { user, refresh } = useAuth();

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (!pop.current?.contains(e.target as Node)) setOpen(false);
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
        </nav>
    );
}
