/*
  Warnings:

  - Made the column `nombreUsuario` on table `Usuario` required. This step will fail if there are existing NULL values in that column.
  - Made the column `emailUsuario` on table `Usuario` required. This step will fail if there are existing NULL values in that column.
  - Made the column `contraseñaUsuario` on table `Usuario` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Compra" DROP CONSTRAINT "Compra_idProveedor_fkey";

-- DropForeignKey
ALTER TABLE "public"."Proveedor" DROP CONSTRAINT "Proveedor_idLocalidad_fkey";

-- AlterTable
ALTER TABLE "Compra" ALTER COLUMN "idProveedor" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Proveedor" ALTER COLUMN "CIF_NIFProveedor" DROP NOT NULL,
ALTER COLUMN "mailProveedor" DROP NOT NULL,
ALTER COLUMN "telefonoProveedor" DROP NOT NULL,
ALTER COLUMN "idLocalidad" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Stock" ALTER COLUMN "ultimaModificacionStock" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "nombreUsuario" SET NOT NULL,
ALTER COLUMN "emailUsuario" SET NOT NULL,
ALTER COLUMN "contraseñaUsuario" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_idLocalidad_fkey" FOREIGN KEY ("idLocalidad") REFERENCES "Localidad"("idLocalidad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_idProveedor_fkey" FOREIGN KEY ("idProveedor") REFERENCES "Proveedor"("idProveedor") ON DELETE SET NULL ON UPDATE CASCADE;
