import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

export type AlertType = "success" | "error" | "warning" | "info" | "question";

export function showAlert({
  type,
  title,
  message,
}: {
  type: AlertType;
  title?: string;
  message: string;
}) {
  const defaultTitle =
    type === "error" ? "Error" : type === "warning" ? "Alerta" : type === "success" ? "Éxito" : "Aviso";
  return Swal.fire({
    icon: type,
    title: title ?? defaultTitle,
    text: message,
    confirmButtonText: "Aceptar",
    confirmButtonColor: "#2563eb",
    showCloseButton: true,
    allowOutsideClick: true,
    customClass: {
      popup: "rounded-lg",
      title: "text-base font-semibold",
      htmlContainer: "text-sm",
      actions: "mt-4",
    },
  });
}

export async function askText({
  title,
  label,
  placeholder,
  confirmText,
  cancelText,
  required,
}: {
  title: string;
  label?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
}): Promise<string | null> {
  const res = await Swal.fire({
    title,
    input: "text",
    inputLabel: label,
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText: confirmText ?? "Aceptar",
    cancelButtonText: cancelText ?? "Cancelar",
    confirmButtonColor: "#2563eb",
    showCloseButton: true,
    inputValidator: (value) => {
      if (required && !String(value ?? "").trim()) {
        return "Por favor ingresa un motivo";
      }
      return undefined as any;
    },
    customClass: {
      popup: "rounded-lg",
      title: "text-base font-semibold",
      input: "text-sm",
      actions: "mt-4",
    },
  });
  if (res.isDismissed) return null;
  return String(res.value ?? "").trim();
}

export async function askConfirm({
  title,
  message,
  confirmText,
  cancelText,
  type,
}: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: AlertType;
}): Promise<boolean> {
  const res = await Swal.fire({
    icon: type ?? "warning",
    title,
    text: message,
    showCancelButton: true,
    confirmButtonText: confirmText ?? "Eliminar",
    cancelButtonText: cancelText ?? "Cancelar",
    confirmButtonColor: "#dc2626",
    showCloseButton: true,
    customClass: {
      popup: "rounded-lg",
      title: "text-base font-semibold",
      htmlContainer: "text-sm",
      actions: "mt-4",
    },
  });
  return res.isConfirmed === true;
}