import type { ReactNode } from "react";


type ModalProps = {
open: boolean;
title?: string;
onClose: () => void;
children: ReactNode;
footer?: ReactNode;
};


export default function Modal({ open, title, onClose, children, footer }: ModalProps) {
if (!open) return null;


return (
<div className="absolute right-4 top-4 z-40 w-full max-w-md rounded-xl border bg-white shadow-lg animate-in fade-in slide-in-from-top-2">
<div className="flex items-center justify-between px-4 py-2 border-b">
<h3 className="text-sm font-semibold">{title}</h3>
<button onClick={onClose} className="text-sm text-gray-600 hover:underline">Cerrar</button>
</div>
<div className="p-4 max-h-[70vh] overflow-auto">{children}</div>
{footer && <div className="px-4 py-3 border-t bg-gray-50">{footer}</div>}
</div>
);
}
