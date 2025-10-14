/*
  Warnings:

  - You are about to alter the column `precio` on the `Moneda` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(12,4)`.
  - You are about to alter the column `utilidadProducto` on the `Producto` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(6,2)`.
  - You are about to alter the column `recargo` on the `TipoPago` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(6,2)`.

*/
-- AlterTable
ALTER TABLE "public"."Moneda" ALTER COLUMN "precio" SET DATA TYPE DECIMAL(12,4);

-- AlterTable
ALTER TABLE "public"."Producto" ALTER COLUMN "precioProducto" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "precioVentaPublicoProducto" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "utilidadProducto" SET DATA TYPE DECIMAL(6,2);

-- AlterTable
ALTER TABLE "public"."ProveedorProducto" ALTER COLUMN "precioHistorico" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "public"."Stock" ALTER COLUMN "cantidadStock" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "public"."TipoPago" ALTER COLUMN "recargo" SET DATA TYPE DECIMAL(6,2);
