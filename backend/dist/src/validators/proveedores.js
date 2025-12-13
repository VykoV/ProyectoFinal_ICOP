"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginadoQuery = exports.proveedorIn = void 0;
const zod_1 = require("zod");
const emailUnicode = (value) => {
    if (value == null)
        return true;
    const v = String(value).trim();
    if (v === "")
        return true;
    const re = /^(?!\.)(?!.*\.\.)([\p{L}\p{N}_'+-\.])*[\p{L}\p{N}_+-]@([\p{L}\p{N}][\p{L}\p{N}-]*\.)+[\p{L}]{2,}$/u;
    return re.test(v);
};
exports.proveedorIn = zod_1.z.object({
    CIF_NIFProveedor: zod_1.z
        .union([zod_1.z.string(), zod_1.z.number(), zod_1.z.bigint()])
        .nullish()
        .transform((v) => (v === undefined ? null : BigInt(String(v).replace(/\D/g, "")))),
    nombreProveedor: zod_1.z.string().min(2).max(100).trim(),
    mailProveedor: zod_1.z
        .string()
        .trim()
        .max(100)
        .nullish()
        .transform((v) => (v == null ? null : v.trim() === "" ? null : v))
        .refine((v) => emailUnicode(v), { message: "Invalid email address" }),
    telefonoProveedor: zod_1.z
        .union([zod_1.z.string(), zod_1.z.number(), zod_1.z.bigint()])
        .nullish()
        .transform((v) => (v === undefined ? null : BigInt(String(v).replace(/\D/g, "")))),
    observacionProveedor: zod_1.z.string().max(10_000).nullish(),
    idLocalidad: zod_1.z.number().int().positive().nullish(),
});
exports.paginadoQuery = zod_1.z.object({
    search: zod_1.z.string().trim().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(10),
});
