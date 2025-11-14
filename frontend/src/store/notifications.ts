import { useEffect, useState } from "react";

export type NotificationType = "info" | "warning" | "error" | "success";

export type NotificationItem = {
  id: string;
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
    type: n.type,
    title: n.title,
    message: n.message,
    createdAt: Date.now(),
    read: false,
  };
  notifications = [item, ...notifications].slice(0, MAX_ITEMS);
  emit();
  return item.id;
}

export function markAllRead() {
  notifications = notifications.map((n) => ({ ...n, read: true }));
  emit();
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
    remove,
    clear,
  };
}