import axios from "axios";
import { publish } from "../store/notifications";
import { showAlert } from "../lib/alerts";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Intercepta respuestas para publicar notificaciones
api.interceptors.response.use(
  (res) => {
    try {
      const headers: Record<string, any> = (res as any)?.headers ?? {};
      const msg = headers["x-alert"] ?? headers["x-notification"] ?? headers["x-message"];
      const rawType = String(headers["x-alert-type"] ?? headers["x-notification-type"] ?? "").toLowerCase();
      const type: "info" | "warning" | "error" | "success" =
        rawType === "error" ? "error" : rawType === "warning" || rawType === "warn" ? "warning" : rawType === "success" ? "success" : "info";
      if (msg) {
        const title = type === "error" ? "Error" : type === "warning" ? "Alerta" : type === "success" ? "Éxito" : "Aviso";
        publish({ type, title, message: String(msg) });
        showAlert({ type: (type as any), title, message: String(msg) });
      }
    } catch {}
    return res;
  },
  (err) => {
    try {
      const status = (err as any)?.response?.status;
      const data = (err as any)?.response?.data ?? {};
      const message = data?.message || data?.error || (err as any)?.message || "Error en la solicitud";
      const title = status ? `Error ${status}` : "Error de servidor";
      publish({ type: "error", title, message });
      showAlert({ type: "error", title, message });
    } catch {}
    return Promise.reject(err);
  }
);