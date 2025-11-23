import { useEffect, useState } from "react";
import { api } from "../lib/api";

export type NotificationType = "info" | "warning" | "error" | "success";

export type NotificationItem = {
  id: string;
  code?: string;
  type: NotificationType;
  title?: string;
  message: string;
  createdAt: number;
  read?: boolean;
};

type Listener = (list: NotificationItem[]) => void;

let notifications: NotificationItem[] = [];
const listeners = new Set<Listener>();
const MAX_ITEMS = 100;

function emit() {
  for (const fn of Array.from(listeners)) fn([...notifications]);
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  fn([...notifications]);
  // cleanup debe devolver void, no boolean
  return () => {
    listeners.delete(fn);
  };
}

export function getAll() {
  return [...notifications];
}

export function publish(n: Omit<NotificationItem, "id" | "createdAt"> & { id?: string }) {
  const item: NotificationItem = {
    id: n.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    code: n.code,
    type: n.type,
    title: n.title,
    message: n.message,
    createdAt: Date.now(),
    read: false,
  };
  notifications = [item, ...notifications].slice(0, MAX_ITEMS);
  emit();
  try {
    api.post("/notificaciones", { code: n.code, type: n.type, title: n.title, message: n.message }).then((res) => {
      const server = res?.data;
      if (server && server.idNotificacion) {
        notifications = notifications.map((nn) => nn.id === item.id ? {
          ...nn,
          id: String(server.idNotificacion),
          createdAt: new Date(server.createdAt).getTime(),
          read: !!server.leido,
        } : nn);
        emit();
      }
    }).catch(() => {});
  } catch {}
  return item.id;
}

export function markAllRead() {
  notifications = notifications.map((n) => ({ ...n, read: true }));
  emit();
  try { api.put("/notificaciones/mark-all-read").catch(() => {}); } catch {}
}

export async function markRead(id: string) {
  notifications = notifications.map((n) => n.id === id ? { ...n, read: true } : n);
  emit();
  try { await api.put(`/notificaciones/${id}/read`); } catch {}
}

export function remove(id: string) {
  notifications = notifications.filter((n) => n.id !== id);
  emit();
}

export function clear() {
  notifications = [];
  emit();
}

export function useNotifications() {
  const [list, setList] = useState<NotificationItem[]>(getAll());
  useEffect(() => subscribe(setList), []);
  const unreadCount = list.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
  return {
    list,
    unreadCount,
    publish,
    markAllRead,
    markRead,
    remove,
    clear,
    sync,
  };
}

function nivelToType(n: string): NotificationType {
  const s = String(n || "").toLowerCase();
  if (s === "error") return "error";
  if (s === "warn" || s === "warning") return "warning";
  return "info";
}

export async function sync() {
  try {
    const { data } = await api.get("/notificaciones");
    const list = Array.isArray(data) ? data : [];
    notifications = list.map((row: any) => ({
      id: String(row.idNotificacion),
      code: String(row?.data?.code ?? ""),
      type: nivelToType(row.nivel),
      title: row?.data?.title ?? undefined,
      message: String(row.mensaje ?? ""),
      createdAt: new Date(row.createdAt).getTime(),
      read: !!row.leido,
    }));
    emit();
  } catch {}
}