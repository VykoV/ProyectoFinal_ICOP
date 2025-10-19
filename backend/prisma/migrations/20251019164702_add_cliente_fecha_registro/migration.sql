/*
  Warnings:

  - Changed the type of `emailUsuario` on the `Usuario` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
-- saneo por si hay NULLs (evita NOT NULL errors)
UPDATE "Usuario"
SET "emailUsuario" = CONCAT('temp+', "idUsuario", '@local.invalid')
WHERE "emailUsuario" IS NULL;

-- volver a VARCHAR
ALTER TABLE "Usuario"
  ALTER COLUMN "emailUsuario" TYPE VARCHAR(320);

-- Cliente.fechaRegistro (idempotente)
ALTER TABLE "Cliente"
  ADD COLUMN IF NOT EXISTS "fechaRegistro" TIMESTAMP DEFAULT NOW();
ALTER TABLE "Cliente"
  ALTER COLUMN "fechaRegistro" SET NOT NULL;
