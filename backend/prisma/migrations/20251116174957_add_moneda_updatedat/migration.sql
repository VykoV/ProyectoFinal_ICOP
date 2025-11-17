-- CreateEnum
CREATE TYPE "EstadoPagoVenta" AS ENUM ('PENDIENTE', 'PAGADO', 'PARCIAL', 'RESERVA');

-- AlterTable
ALTER TABLE "DetalleVenta" ADD COLUMN     "descuentoItem" DECIMAL(7,2) NOT NULL DEFAULT 0,
ADD COLUMN     "precioUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "recargoItem" DECIMAL(7,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Moneda" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN     "estadoPago" "EstadoPagoVenta" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "fechaReservaLimite" DATE;
