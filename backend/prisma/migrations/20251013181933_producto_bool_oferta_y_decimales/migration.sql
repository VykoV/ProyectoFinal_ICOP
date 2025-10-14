/*
  Warnings:

  - The `ofertaProducto` column on the `Producto` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[codigoBarrasProducto]` on the table `Producto` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[codigoProducto]` on the table `Producto` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Producto" DROP COLUMN "ofertaProducto",
ADD COLUMN     "ofertaProducto" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarrasProducto_key" ON "Producto"("codigoBarrasProducto");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoProducto_key" ON "Producto"("codigoProducto");

-- CreateIndex
CREATE INDEX "Producto_idSubFamilia_idx" ON "Producto"("idSubFamilia");
