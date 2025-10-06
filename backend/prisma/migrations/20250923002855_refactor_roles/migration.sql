/*
  Warnings:

  - You are about to drop the column `idUsuario` on the `Rol` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nombreRol]` on the table `Rol` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."Rol" DROP CONSTRAINT "Rol_idUsuario_fkey";

-- AlterTable
ALTER TABLE "public"."Rol" DROP COLUMN "idUsuario",
ALTER COLUMN "nombreRol" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "public"."UsuarioRol" (
    "idUsuario" INTEGER NOT NULL,
    "idRol" INTEGER NOT NULL,

    CONSTRAINT "UsuarioRol_pkey" PRIMARY KEY ("idUsuario","idRol")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioRol_idUsuario_idRol_key" ON "public"."UsuarioRol"("idUsuario", "idRol");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombreRol_key" ON "public"."Rol"("nombreRol");

-- AddForeignKey
ALTER TABLE "public"."UsuarioRol" ADD CONSTRAINT "UsuarioRol_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "public"."Usuario"("idUsuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UsuarioRol" ADD CONSTRAINT "UsuarioRol_idRol_fkey" FOREIGN KEY ("idRol") REFERENCES "public"."Rol"("idRol") ON DELETE RESTRICT ON UPDATE CASCADE;
