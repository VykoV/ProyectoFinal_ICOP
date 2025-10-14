/*
  Warnings:

  - A unique constraint covering the columns `[tipoFamilia]` on the table `Familia` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idFamilia,tipoSubFamilia]` on the table `SubFamilia` will be added. If there are existing duplicate values, this will fail.
  - Made the column `idSubFamilia` on table `Producto` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Producto" DROP CONSTRAINT "Producto_idSubFamilia_fkey";

-- AlterTable
ALTER TABLE "Producto" ALTER COLUMN "idSubFamilia" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Familia_tipoFamilia_key" ON "Familia"("tipoFamilia");

-- CreateIndex
CREATE UNIQUE INDEX "SubFamilia_idFamilia_tipoSubFamilia_key" ON "SubFamilia"("idFamilia", "tipoSubFamilia");

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_idSubFamilia_fkey" FOREIGN KEY ("idSubFamilia") REFERENCES "SubFamilia"("idSubFamilia") ON DELETE RESTRICT ON UPDATE CASCADE;
