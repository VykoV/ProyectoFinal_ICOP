/*
  Warnings:

  - You are about to drop the column `estadoPago` on the `EstadoVenta` table. All the data in the column will be lost.
  - Added the required column `nombreEstadoVenta` to the `EstadoVenta` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."EstadoVenta" DROP COLUMN "estadoPago",
ADD COLUMN     "nombreEstadoVenta" CHAR(100) NOT NULL;
