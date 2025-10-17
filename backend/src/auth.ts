import { Router, type Request, type Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { z } from "zod";

const prisma = new PrismaClient();
const r = Router();

const creds = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
const reg = creds.extend({ nombre: z.string().min(1) });

async function findByEmail(email: string) {
  return prisma.usuario.findFirst({ where: { emailUsuario: email } });
}

r.post("/register", async (req: Request, res: Response) => {
  const { email, password, nombre } = reg.parse(req.body);

  const exists = await findByEmail(email);
  if (exists) return res.status(409).json({ error: "EMAIL_TAKEN" });

  const hash = await bcrypt.hash(password, 12);
  const u = await prisma.usuario.create({
    data: {
      emailUsuario: email,
      contrasenaUsuario: hash,
      nombreUsuario: nombre,
    },
    select: { idUsuario: true, emailUsuario: true },
  });

  req.session.userId = u.idUsuario;
  res.json({ id: u.idUsuario, email: u.emailUsuario });
});

r.post("/login", async (req: Request, res: Response) => {
  const { email, password } = creds.parse(req.body);

  const u = await findByEmail(email);
  if (!u) return res.status(401).json({ error: "CREDENCIALES" });

  const ok = await bcrypt.compare(password, u.contrasenaUsuario);
  if (!ok) return res.status(401).json({ error: "CREDENCIALES" });

  req.session.userId = u.idUsuario;
  res.json({ id: u.idUsuario, email: u.emailUsuario, nombre: u.nombreUsuario });
});

r.get("/me", (req: Request, res: Response) => {
  if (!req.session.userId) return res.status(401).json({ error: "UNAUTHORIZED" });
  res.json({ id: req.session.userId });
});

r.post("/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {});
  res.clearCookie("sid");
  res.json({ ok: true });
});

export default r;
