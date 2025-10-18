import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.get("/auth/me").then(r => r.data),
    retry: false,
  });

  if (isLoading) return null;
  if (error) return <Navigate to="/login" replace />;
  return data ? <Outlet /> : <Navigate to="/login" replace />;
}
