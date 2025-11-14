import { useEffect, useRef } from "react";
import { publish, type NotificationType } from "../store/notifications";
import { showAlert } from "../lib/alerts";

type Options = {
  hour: number; // 0-23
  minute: number; // 0-59
  message: string;
  type?: NotificationType; // default: "info"
  enabled?: boolean; // default: true
  title?: string;
};

export function useDailyReminder(opts: Options) {
  const { hour, minute, message, type = "info", enabled = true, title } = opts;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function clearTimer() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function nextTriggerTime(): number {
      const now = new Date();
      const target = new Date(now);
      target.setHours(hour, minute, 0, 0);
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      return target.getTime();
    }

    function scheduleNext() {
      const now = Date.now();
      const next = nextTriggerTime();
      const delay = Math.max(0, next - now);
      timerRef.current = window.setTimeout(() => {
        // Publicar notificación y toast
        publish({ type, title: title ?? "Recordatorio", message });
        // Mostrar modal estético con SweetAlert
        showAlert({ type: (type as any), title: title ?? "Recordatorio", message });
        // Programar siguiente día
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hour, minute, message, type, enabled, title]);
}