"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editaPreventaSchema = exports.creaPreventaSchema = void 0;
const zod_1 = require("zod");
exports.creaPreventaSchema = zod_1.z.object({
    idCliente: zod_1.z.number().int().positive(),
    idTipoPago: zod_1.z.number().int().positive(),
    observacion: zod_1.z.string().nullable().optional(),
    // permitir tanto "detalles" como "items" en creación
    detalles: zod_1.z
        .array(zod_1.z.object({
        idProducto: zod_1.z.number().int().positive(),
        cantidad: zod_1.z.number().positive(),
    }))
        .min(1),
    items: zod_1.z
        .array(zod_1.z.object({
        idProducto: zod_1.z.number().int().positive(),
        cantidad: zod_1.z.number().positive(),
    }))
        .optional(),
    descuentoGeneral: zod_1.z.number().min(0).max(100).default(0),
    recargoPago: zod_1.z.number().min(0).max(100).default(0).optional(),
    fechaFacturacion: zod_1.z.string().optional(),
    fechaCobro: zod_1.z.string().optional(),
});
exports.editaPreventaSchema = zod_1.z.object({
    accion: zod_1.z.enum(["guardar", "lock", "finalizar", "cancelar"]),
    items: zod_1.z
        .array(zod_1.z.object({
        idProducto: zod_1.z.number().int().positive(),
        cantidad: zod_1.z.number().positive(),
    }))
        .optional(), // requerido solo en "guardar"
    idCliente: zod_1.z.number().int().positive().nullable().optional(),
    idTipoPago: zod_1.z.number().int().positive().nullable().optional(),
    idMoneda: zod_1.z.number().int().positive().nullable().optional(),
    fechaFacturacion: zod_1.z.string().optional(),
    fechaCobro: zod_1.z.string().optional(),
    observacion: zod_1.z.string().nullable().optional(),
    descuentoGeneral: zod_1.z.number().min(0).max(100).optional(),
    ajuste: zod_1.z.number().optional(),
    recargoPago: zod_1.z.number().min(0).optional(),
    motivoCancelacion: zod_1.z.string().nullable().optional(),
});
