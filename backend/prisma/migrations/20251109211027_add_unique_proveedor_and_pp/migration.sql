/*
  Warnings:

  - You are about to alter the column `cantidad` on the `DetalleVenta` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,3)` to `Decimal(10,3)`.
  - A unique constraint covering the columns `[CIF_NIFProveedor]` on the table `Proveedor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idProveedor,idProducto]` on the table `ProveedorProducto` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DetalleVenta" ALTER COLUMN "cantidad" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "ajusteVenta" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "descuentoGeneralVenta" DECIMAL(7,2) NOT NULL DEFAULT 0,
ADD COLUMN     "recargoPagoVenta" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_CIF_NIFProveedor_key" ON "Proveedor"("CIF_NIFProveedor");

-- CreateIndex
CREATE INDEX "ProveedorProducto_idProducto_idx" ON "ProveedorProducto"("idProducto");

-- CreateIndex
CREATE UNIQUE INDEX "ProveedorProducto_idProveedor_idProducto_key" ON "ProveedorProducto"("idProveedor", "idProducto");
