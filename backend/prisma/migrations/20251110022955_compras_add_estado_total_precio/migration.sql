/*
  Warnings:

  - A unique constraint covering the columns `[idProveedor,nroFactura]` on the table `Compra` will be added. If there are existing duplicate values, this will fail.
  - Made the column `idProveedor` on table `Compra` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `precioUnit` to the `DetalleCompra` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('PendientePago', 'Finalizado');

-- DropForeignKey
ALTER TABLE "public"."Compra" DROP CONSTRAINT "Compra_idProveedor_fkey";

-- DropForeignKey
ALTER TABLE "public"."DetalleCompra" DROP CONSTRAINT "DetalleCompra_idCompra_fkey";

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "estado" "EstadoCompra" NOT NULL DEFAULT 'PendientePago',
ADD COLUMN     "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
ALTER COLUMN "nroFactura" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "observacion" DROP NOT NULL,
ALTER COLUMN "observacion" SET DATA TYPE TEXT,
ALTER COLUMN "idProveedor" SET NOT NULL;

-- AlterTable
ALTER TABLE "DetalleCompra" ADD COLUMN     "precioUnit" DECIMAL(12,2) NOT NULL;

-- CreateIndex
CREATE INDEX "Compra_fechaComprobanteCompra_idx" ON "Compra"("fechaComprobanteCompra");

-- CreateIndex
CREATE UNIQUE INDEX "Compra_idProveedor_nroFactura_key" ON "Compra"("idProveedor", "nroFactura");

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_idProveedor_fkey" FOREIGN KEY ("idProveedor") REFERENCES "Proveedor"("idProveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_idCompra_fkey" FOREIGN KEY ("idCompra") REFERENCES "Compra"("idCompra") ON DELETE CASCADE ON UPDATE CASCADE;
