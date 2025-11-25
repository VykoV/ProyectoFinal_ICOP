import type { ReactNode } from "react";


type ModalProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  centered?: boolean;
  size?: "md" | "lg" | "xl" | "2xl" | "3xl";
};

export default function Modal({ open, title, onClose, children, footer, centered = false, size = "md" }: ModalProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      {/* Panel */}
      {centered ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className={`w-full ${size === "md" ? "max-w-md" : size === "lg" ? "max-w-lg" : size === "xl" ? "max-w-xl" : size === "2xl" ? "max-w-2xl" : "max-w-3xl"} rounded-xl border bg-white shadow-lg animate-in fade-in slide-in-from-top-2`}>
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="text-sm font-semibold">{title}</h3>
              <button onClick={onClose} className="text-sm text-gray-600 hover:underline">Cerrar</button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto">{children}</div>
            {footer && <div className="px-4 py-3 border-t bg-gray-50">{footer}</div>}
          </div>
        </div>
      ) : (
        <div className={`fixed right-4 top-4 z-50 w-full ${size === "md" ? "max-w-md" : size === "lg" ? "max-w-lg" : size === "xl" ? "max-w-xl" : size === "2xl" ? "max-w-2xl" : "max-w-3xl"} rounded-xl border bg-white shadow-lg animate-in fade-in slide-in-from-top-2`}>
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <h3 className="text-sm font-semibold">{title}</h3>
            <button onClick={onClose} className="text-sm text-gray-600 hover:underline">Cerrar</button>
          </div>
          <div className="p-4 max-h-[70vh] overflow-auto">{children}</div>
          {footer && <div className="px-4 py-3 border-t bg-gray-50">{footer}</div>}
        </div>
      )}
    </>
  );
}
