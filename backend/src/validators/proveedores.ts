import { z } from "zod";

export const proveedorIn = z.object({
  CIF_NIFProveedor: z
    .union([z.string(), z.number(), z.bigint()])
    .nullish()
    .transform((v) => (v === undefined ? null : BigInt(String(v).replace(/\D/g, "")))),
  nombreProveedor: z.string().min(2).max(100).trim(),
  mailProveedor: z.string().email().max(100).nullish(),
  telefonoProveedor: z
    .union([z.string(), z.number(), z.bigint()])
    .nullish()
    .transform((v) => (v === undefined ? null : BigInt(String(v).replace(/\D/g, "")))),
  observacionProveedor: z.string().max(10_000).nullish(),
  idLocalidad: z.number().int().positive().nullish(),
});

export type ProveedorIn = z.infer<typeof proveedorIn>;

export const paginadoQuery = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});