import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "../src/components/Login.tsx";
import Dashboard from "./pages/Dashboard";
import Productos from "./pages/Productos";
import Clientes from "./pages/Clientes";
import Proveedores from "./pages/Proveedores";
import NotFound from "./pages/NotFound";
import Ventas from "./pages/Ventas";
import Usuarios from "./pages/Usuarios";
import Compras from "./pages/Compras";

export default function App() {
    const isAuthenticated = true; // solo diseño

    return (
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route
            path="/"
            element={
            isAuthenticated ? <Layout /> : <Navigate to="/login" replace />
            }
        >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="productos" element={<Productos />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="proveedores" element={<Proveedores />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="compras" element={<Compras />} />
            <Route path="usuarios" element={<Usuarios />} />
        </Route>
        <Route path="*" element={<NotFound />} /></Routes>
    );
}
