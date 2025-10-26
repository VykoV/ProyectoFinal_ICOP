/*
  Warnings:

  - You are about to drop the column `cantidadStock` on the `Stock` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[idProducto]` on the table `Stock` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cantidadRealStock` to the `Stock` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PapelEnVenta" AS ENUM ('CREADOR', 'CAJERO', 'ANULADOR', 'EDITOR');

-- DropIndex
DROP INDEX "public"."Producto_idSubFamilia_idx";

-- DropIndex
DROP INDEX "public"."UsuarioRol_idUsuario_idRol_key";

-- AlterTable
ALTER TABLE "Stock" DROP COLUMN "cantidadStock",
ADD COLUMN     "cantidadRealStock" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "stockComprometido" DECIMAL(12,2) NOT NULL DEFAULT 0,
ALTER COLUMN "bajoMinimoStock" SET DATA TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE "VwStock" (
    "idProducto" INTEGER NOT NULL,
    "cantidadRealStock" DECIMAL(12,2) NOT NULL,
    "stockComprometido" DECIMAL(12,2) NOT NULL,
    "stockDisponible" DECIMAL(12,2) NOT NULL
);

-- CreateTable
CREATE TABLE "VentaActor" (
    "idVenta" INTEGER NOT NULL,
    "idUsuario" INTEGER NOT NULL,
    "papel" "PapelEnVenta" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaActor_pkey" PRIMARY KEY ("idVenta","idUsuario","papel")
);

-- CreateTable
CREATE TABLE "VentaEvento" (
    "idVentaEvento" SERIAL NOT NULL,
    "idVenta" INTEGER NOT NULL,
    "idUsuario" INTEGER NOT NULL,
    "estadoDesde" INTEGER,
    "estadoHasta" INTEGER NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaEvento_pkey" PRIMARY KEY ("idVentaEvento")
);

-- CreateTable
CREATE TABLE "VentaComentario" (
    "idVentaComentario" SERIAL NOT NULL,
    "idVenta" INTEGER NOT NULL,
    "idUsuario" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaComentario_pkey" PRIMARY KEY ("idVentaComentario")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stock_idProducto_key" ON "Stock"("idProducto");

-- AddForeignKey
ALTER TABLE "VentaActor" ADD CONSTRAINT "VentaActor_idVenta_fkey" FOREIGN KEY ("idVenta") REFERENCES "Venta"("idVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaActor" ADD CONSTRAINT "VentaActor_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaEvento" ADD CONSTRAINT "VentaEvento_idVenta_fkey" FOREIGN KEY ("idVenta") REFERENCES "Venta"("idVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaEvento" ADD CONSTRAINT "VentaEvento_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaEvento" ADD CONSTRAINT "VentaEvento_estadoDesde_fkey" FOREIGN KEY ("estadoDesde") REFERENCES "EstadoVenta"("idEstadoVenta") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaEvento" ADD CONSTRAINT "VentaEvento_estadoHasta_fkey" FOREIGN KEY ("estadoHasta") REFERENCES "EstadoVenta"("idEstadoVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaComentario" ADD CONSTRAINT "VentaComentario_idVenta_fkey" FOREIGN KEY ("idVenta") REFERENCES "Venta"("idVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaComentario" ADD CONSTRAINT "VentaComentario_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;
