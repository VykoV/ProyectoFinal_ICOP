import { User, Menu } from "lucide-react";
import { useUI } from "../store/ui";
import Logo from "./Logo";

export default function Navbar() {
    const { toggleSidebar } = useUI();
    return (
        <nav className="flex items-center justify-between h-14 px-4 border-b bg-white">
        <button
            onClick={toggleSidebar}
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Abrir/Cerrar sidebar"
        >
            <Menu className="h-5 w-5" />
        </button>
        <Logo />
        <div className="flex items-center gap-2">
            <button
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Usuario"
            >
            <User className="w-5 h-5 text-gray-700" />
            </button>
        </div>
        </nav>
    );
}
