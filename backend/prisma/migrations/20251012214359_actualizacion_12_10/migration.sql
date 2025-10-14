/*
  Warnings:

  - You are about to drop the column `idProvincia` on the `Cliente` table. All the data in the column will be lost.
  - You are about to drop the column `idFamilia` on the `Producto` table. All the data in the column will be lost.
  - You are about to drop the column `idProvincia` on the `Proveedor` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[idProvincia,nombreLocalidad]` on the table `Localidad` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Cliente" DROP CONSTRAINT "Cliente_idProvincia_fkey";

-- DropForeignKey
ALTER TABLE "public"."Producto" DROP CONSTRAINT "Producto_idFamilia_fkey";

-- DropForeignKey
ALTER TABLE "public"."Proveedor" DROP CONSTRAINT "Proveedor_idProvincia_fkey";

-- AlterTable
ALTER TABLE "public"."Cliente" DROP COLUMN "idProvincia";

-- AlterTable
ALTER TABLE "public"."Producto" DROP COLUMN "idFamilia",
ADD COLUMN     "idSubFamilia" INTEGER;

-- AlterTable
ALTER TABLE "public"."Proveedor" DROP COLUMN "idProvincia";

-- CreateIndex
CREATE UNIQUE INDEX "Localidad_idProvincia_nombreLocalidad_key" ON "public"."Localidad"("idProvincia", "nombreLocalidad");

-- AddForeignKey
ALTER TABLE "public"."Producto" ADD CONSTRAINT "Producto_idSubFamilia_fkey" FOREIGN KEY ("idSubFamilia") REFERENCES "public"."SubFamilia"("idSubFamilia") ON DELETE SET NULL ON UPDATE CASCADE;
