export type Producto = { id: number; nombre: string; sku: string; stock: number; precio: number };
export type Cliente = { id: number; nombre: string; email: string };
export type Proveedor = { id: number; nombre: string; cuit: string };
export type Usuario = { id: number; nombre: string; email: string; rol: string };
export type Venta = { id: number; cliente: string; fecha: string; metodoPago: string; estado: string; total: number };
export type PreVenta = { id: number; cliente: string; fecha: string; estado: "Pendiente" | "Finalizado"; total: number };
