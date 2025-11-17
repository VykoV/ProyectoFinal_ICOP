-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "fechaFinOferta" TIMESTAMP(3),
ADD COLUMN     "fechaInicioOferta" TIMESTAMP(3),
ADD COLUMN     "porcentajeOfertaProducto" DECIMAL(7,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OfertaProductoHistorial" (
    "idOfertaProductoHistorial" SERIAL NOT NULL,
    "idProducto" INTEGER NOT NULL,
    "ofertaProducto" BOOLEAN NOT NULL,
    "porcentajeOfertaProducto" DECIMAL(7,2) NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),
    "creadoPor" INTEGER,

    CONSTRAINT "OfertaProductoHistorial_pkey" PRIMARY KEY ("idOfertaProductoHistorial")
);

-- CreateIndex
CREATE INDEX "OfertaProductoHistorial_idProducto_idx" ON "OfertaProductoHistorial"("idProducto");

-- AddForeignKey
ALTER TABLE "OfertaProductoHistorial" ADD CONSTRAINT "OfertaProductoHistorial_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;
