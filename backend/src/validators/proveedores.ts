import { z } from "zod";

const emailUnicode = (value: string | null | undefined) => {
  if (value == null) return true;
  const v = String(value).trim();
  if (v === "") return true;
  const re = /^(?!\.)(?!.*\.\.)([\p{L}\p{N}_'+-\.])*[\p{L}\p{N}_+-]@([\p{L}\p{N}][\p{L}\p{N}-]*\.)+[\p{L}]{2,}$/u;
  return re.test(v);
};

export const proveedorIn = z.object({
  CIF_NIFProveedor: z
    .union([z.string(), z.number(), z.bigint()])
    .nullish()
    .transform((v) => (v === undefined ? null : BigInt(String(v).replace(/\D/g, "")))),
  nombreProveedor: z.string().min(2).max(100).trim(),
  mailProveedor: z
    .string()
    .trim()
    .max(100)
    .nullish()
    .transform((v) => (v == null ? null : v.trim() === "" ? null : v))
    .refine((v) => emailUnicode(v), { message: "Invalid email address" }),
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
