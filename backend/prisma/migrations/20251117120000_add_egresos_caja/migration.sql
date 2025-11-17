-- Add totalEgresos to CierreCaja and create EgresoCaja table

ALTER TABLE "CierreCaja" ADD COLUMN "totalEgresos" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE "EgresoCaja" (
  "idEgreso" SERIAL NOT NULL,
  "fecha" DATE NOT NULL,
  "monto" DECIMAL(12,2) NOT NULL,
  "comentario" TEXT,
  "idUsuario" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EgresoCaja_pkey" PRIMARY KEY ("idEgreso")
);

ALTER TABLE "EgresoCaja" ADD CONSTRAINT "EgresoCaja_idUsuario_fkey"
  FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario")
  ON DELETE RESTRICT ON UPDATE CASCADE;