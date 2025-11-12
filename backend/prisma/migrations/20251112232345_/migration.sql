-- CreateEnum
CREATE TYPE "UiDensity" AS ENUM ('COMPACT', 'COZY', 'COMFORTABLE');

-- CreateTable
CREATE TABLE "ConfigUI" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "primaryHex" TEXT NOT NULL DEFAULT '#0ea5e9',
    "radiusPx" INTEGER NOT NULL DEFAULT 12,
    "fontScale" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "density" "UiDensity" NOT NULL DEFAULT 'COZY',
    "darkDefault" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigUI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioUI" (
    "idUsuario" INTEGER NOT NULL,
    "primaryHex" TEXT,
    "radiusPx" INTEGER,
    "fontScale" DOUBLE PRECISION,
    "density" "UiDensity",
    "dark" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuarioUI_pkey" PRIMARY KEY ("idUsuario")
);

-- AddForeignKey
ALTER TABLE "UsuarioUI" ADD CONSTRAINT "UsuarioUI_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;
