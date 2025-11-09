import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./components/Login";
import Dashboard from "./pages/Dashboard";
import Productos from "./pages/Productos";
import Clientes from "./pages/Clientes";
import Proveedores from "./pages/Proveedores";
import ProveedorProductos from "./pages/ProveedorProductos";
import NotFound from "./pages/NotFound";
import Ventas from "./pages/Ventas";
import PreVentas from "./pages/PreVentas";
import Usuarios from "./pages/Usuarios";
import Compras from "./pages/Compras";
import ProtectedRoute from "./routes/ProtectedRoute";

export default function App() {
    const isAuthenticated = false; // false al inicio: fuerza el login

    return (
        <Routes>
            {/* redirección inicial */}
            <Route
                path="/"
                element={
                    isAuthenticated ? (
                        <Navigate to="/dashboard" replace />
                    ) : (
                        <Navigate to="/login" replace />
                    )
                }
            />

            {/* login público */}
            <Route path="/login" element={<Login />} />

            {/* rutas protegidas */}
            <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/productos" element={<Productos />} />
                    <Route path="/clientes" element={<Clientes />} />
                    <Route path="/proveedores" element={<Proveedores />} />
                    <Route path="/proveedores/:id/productos" element={<ProveedorProductos />} />
                    <Route path="/ventas" element={<Ventas />} />
                    <Route path="/pre-ventas" element={<PreVentas />} />
                    <Route path="/compras" element={<Compras />} />
                    <Route path="/usuarios" element={<Usuarios />} />
                </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}
