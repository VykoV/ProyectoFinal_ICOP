import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const router = express.Router();
const prisma = new PrismaClient();

// ===============================
// LOGIN
// ===============================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "FALTAN_DATOS" });

  const user = await prisma.usuario.findFirst({
    where: { emailUsuario: { equals: email, mode: "insensitive" } },
  });

  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const ok = await bcrypt.compare(password, user.contrasenaUsuario);
  if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  // guardar sesión
  (req.session as any).userId = user.idUsuario;

  res.json({
    id: user.idUsuario,
    nombre: user.nombreUsuario,
    email: user.emailUsuario,
  });
});

// ===============================
// LOGOUT
// ===============================
router.post("/logout", (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

// ===============================
// AUTH/ME
// ===============================
router.get("/me", async (req, res) => {
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHORIZED" });

  const user = await prisma.usuario.findUnique({
    where: { idUsuario: userId },
    select: { idUsuario: true, nombreUsuario: true, emailUsuario: true },
  });

  if (!user) return res.status(401).json({ error: "NOT_FOUND" });

  res.json({
    id: user.idUsuario,
    nombre: user.nombreUsuario,
    email: user.emailUsuario,
  });
});

export default router;
