import { z } from "zod";

const item = z.object({
  idProducto: z.number().int().positive(),
  cantidad: z.number().int().positive(),
  precioUnit: z.coerce.number().positive(),
});

export const compraCreate = z.object({
  idProveedor: z.number().int().positive(),
  idMetodoPago: z.number().int().positive(),
  idMoneda: z.number().int().positive(),
  fechaComprobanteCompra: z.coerce.date(),
  nroFactura: z.string().min(1).max(50).trim(),
  observacion: z.string().max(10000).nullish(),
  items: z.array(item).min(1),
});

export const compraUpdate = compraCreate.partial().extend({
  // no cambio proveedor ni nroFactura por defecto
  idProveedor: z.never().optional(),
  nroFactura: z.never().optional(),
  accion: z.enum(["lock", "unlock"]).optional(),
});

export const comprasQuery = z.object({
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  proveedor: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
