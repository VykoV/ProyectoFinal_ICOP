import { z } from "zod";

export const creaPreventaSchema = z.object({
  idCliente: z.number().int().positive(),
  idTipoPago: z.number().int().positive(),
  observacion: z.string().nullable().optional(),
  // permitir tanto "detalles" como "items" en creación
  detalles: z
    .array(
      z.object({
        idProducto: z.number().int().positive(),
        cantidad: z.number().positive(),
      })
    )
    .min(1),
  items: z
    .array(
      z.object({
        idProducto: z.number().int().positive(),
        cantidad: z.number().positive(),
      })
    )
    .optional(),
  descuentoGeneral: z.number().min(0).max(100).default(0),
  recargoPago: z.number().min(0).max(100).default(0).optional(),
  fechaFacturacion: z.string().optional(),
  fechaCobro: z.string().optional(),
});

export const editaPreventaSchema = z.object({
  accion: z.enum(["guardar", "lock", "finalizar", "cancelar"]),
  items: z
    .array(
      z.object({
        idProducto: z.number().int().positive(),
        cantidad: z.number().positive(),
      })
    )
    .optional(), // requerido solo en "guardar"
  idCliente: z.number().int().positive().nullable().optional(),
  idTipoPago: z.number().int().positive().nullable().optional(),
  idMoneda: z.number().int().positive().nullable().optional(),
  fechaFacturacion: z.string().optional(),
  fechaCobro: z.string().optional(),
  observacion: z.string().nullable().optional(),
  descuentoGeneral: z.number().min(0).max(100).optional(),
  ajuste: z.number().optional(),
  recargoPago: z.number().min(0).optional(),
  motivoCancelacion: z.string().nullable().optional(),
});