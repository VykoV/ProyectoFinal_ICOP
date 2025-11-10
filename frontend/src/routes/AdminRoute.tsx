import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute() {
  const { loading, hasRole } = useAuth();
  if (loading) return null;
  return hasRole("Administrador") ? <Outlet /> : <Navigate to="/dashboard" replace />;
}