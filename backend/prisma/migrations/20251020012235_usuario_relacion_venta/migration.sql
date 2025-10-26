-- DropForeignKey
ALTER TABLE "public"."Producto" DROP CONSTRAINT "Producto_idUsuario_fkey";

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "idUsuario" INTEGER;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;
