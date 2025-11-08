import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Uso:
 *  app.post("/api/preventas", requireAuth, authorize(["Vendedor","Administrador"]), handler)
 *  app.put("/api/preventas/:id", requireAuth, authorize(["Vendedor","Cajero","Administrador"]), handler)
 */
export function authorize(allowed: string[]) {
  const set = new Set(allowed.map((s) => s.toLowerCase().trim()));
  return async (req: Request, res: Response, next: NextFunction) => {
    const uid = req.session?.userId;
    if (!uid) return res.status(401).json({ error: "No autenticado" });

    const roles = await prisma.usuarioRol.findMany({
      where: { idUsuario: uid },
      include: { Rol: true },
    });

    const ok = roles.some((r) => set.has((r.Rol?.nombreRol || "").toLowerCase().trim()));
    if (!ok) return res.status(403).json({ error: "Sin permiso" });

    next();
  };
}