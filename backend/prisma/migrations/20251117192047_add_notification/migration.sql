/*
  Warnings:

  - The values [MONEDA] on the enum `TipoNotificacion` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `destinatario` to the `Notificacion` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DestinatarioNotificacion" AS ENUM ('ADMIN', 'CAJERO', 'VENDEDOR', 'TODOS');

-- AlterEnum
BEGIN;
CREATE TYPE "TipoNotificacion_new" AS ENUM ('MONEDA_DESACTUALIZADA', 'STOCK_BAJO', 'CIERRE_CAJA_PENDIENTE', 'CIERRE_CAJA_GENERADO', 'CLIENTE_IMPORTANTE', 'OFERTA_PRODUCTO', 'COMPRA_PAGO_PENDIENTE', 'RESERVA_POR_VENCER', 'RESERVA_VENCIDA', 'PRESUPUESTOS_PENDIENTES', 'OTRO');
ALTER TABLE "Notificacion" ALTER COLUMN "tipo" TYPE "TipoNotificacion_new" USING ("tipo"::text::"TipoNotificacion_new");
ALTER TYPE "TipoNotificacion" RENAME TO "TipoNotificacion_old";
ALTER TYPE "TipoNotificacion_new" RENAME TO "TipoNotificacion";
DROP TYPE "public"."TipoNotificacion_old";
COMMIT;

-- AlterTable
ALTER TABLE "Notificacion" ADD COLUMN     "destinatario" "DestinatarioNotificacion" NOT NULL;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "fechaVencimiento" DATE;
