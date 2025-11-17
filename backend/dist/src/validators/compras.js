"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.comprasQuery = exports.compraUpdate = exports.compraCreate = void 0;
const zod_1 = require("zod");
const item = zod_1.z.object({
    idProducto: zod_1.z.number().int().positive(),
    cantidad: zod_1.z.number().int().positive(),
    precioUnit: zod_1.z.coerce.number().positive(),
});
exports.compraCreate = zod_1.z.object({
    idProveedor: zod_1.z.number().int().positive(),
    idMetodoPago: zod_1.z.number().int().positive(),
    idMoneda: zod_1.z.number().int().positive(),
    fechaComprobanteCompra: zod_1.z.coerce.date(),
    nroFactura: zod_1.z.string().min(1).max(50).trim(),
    observacion: zod_1.z.string().max(10000).nullish(),
    items: zod_1.z.array(item).min(1),
});
exports.compraUpdate = exports.compraCreate.partial().extend({
    // no cambio proveedor ni nroFactura por defecto
    idProveedor: zod_1.z.never().optional(),
    nroFactura: zod_1.z.never().optional(),
    accion: zod_1.z.enum(["lock", "unlock"]).optional(),
});
exports.comprasQuery = zod_1.z.object({
    desde: zod_1.z.coerce.date().optional(),
    hasta: zod_1.z.coerce.date().optional(),
    proveedor: zod_1.z.coerce.number().int().positive().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(10),
});
