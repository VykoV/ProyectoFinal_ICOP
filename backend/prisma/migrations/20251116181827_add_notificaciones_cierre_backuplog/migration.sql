/*
  Warnings:

  - A unique constraint covering the columns `[cuil]` on the table `Cliente` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('MONEDA', 'STOCK_BAJO', 'RESERVA_VENCIDA', 'OTRO');

-- CreateEnum
CREATE TYPE "NivelNotificacion" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "ResultadoBackup" AS ENUM ('OK', 'ERROR');

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Notificacion" (
    "idNotificacion" SERIAL NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "nivel" "NivelNotificacion" NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idUsuario" INTEGER,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("idNotificacion")
);

-- CreateTable
CREATE TABLE "CierreCaja" (
    "idCierre" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "totalVentas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCobros" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCompras" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldoInicial" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "saldoFinal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "idUsuario" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CierreCaja_pkey" PRIMARY KEY ("idCierre")
);

-- CreateTable
CREATE TABLE "BackupLog" (
    "idBackup" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rutaArchivo" VARCHAR(255),
    "descripcion" TEXT,
    "resultado" "ResultadoBackup" NOT NULL,
    "detalleError" TEXT,

    CONSTRAINT "BackupLog_pkey" PRIMARY KEY ("idBackup")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cuil_key" ON "Cliente"("cuil");

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CierreCaja" ADD CONSTRAINT "CierreCaja_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;
