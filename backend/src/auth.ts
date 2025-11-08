import express from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { loginSchema } from "./validators/auth";
import { requireAuth } from "./middleware/requireAuth";

const router = express.Router();
const prisma = new PrismaClient();

// ===============================
// LOGIN
// ===============================
router.post("/login", async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: "Payload inválido" });
  const { email, password } = parse.data;

  const user = await prisma.usuario.findFirst({
    where: { emailUsuario: { equals: email, mode: "insensitive" } },
    include: { roles: { include: { Rol: true } } },
  });
  if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

  const ok = user.contrasenaUsuario.startsWith("$2")
    ? await bcrypt.compare(password, user.contrasenaUsuario)
    : password === user.contrasenaUsuario;
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  req.session.userId = user.idUsuario;

  return res.json({
    id: user.idUsuario,
    nombre: user.nombreUsuario,
    email: user.emailUsuario,
    roles: user.roles.map((r) => r.Rol?.nombreRol).filter(Boolean),
  });
});

// ===============================
// LOGOUT
// ===============================
router.post("/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ===============================
// AUTH/ME
// ===============================
router.get("/me", async (req, res) => {
  const uid = req.session?.userId;
  if (!uid) return res.status(200).json(null);
  const u = await prisma.usuario.findUnique({
    where: { idUsuario: uid },
    include: { roles: { include: { Rol: true } } },
  });
  if (!u) return res.status(200).json(null);
  res.json({
    id: u.idUsuario,
    nombre: u.nombreUsuario,
    email: u.emailUsuario,
    roles: u.roles.map((r) => r.Rol?.nombreRol).filter(Boolean),
  });
});

export default router;
