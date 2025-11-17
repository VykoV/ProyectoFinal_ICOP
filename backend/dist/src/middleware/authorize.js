"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = authorize;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Uso:
 *  app.post("/api/preventas", requireAuth, authorize(["Vendedor","Administrador"]), handler)
 *  app.put("/api/preventas/:id", requireAuth, authorize(["Vendedor","Cajero","Administrador"]), handler)
 */
function authorize(allowed) {
    const set = new Set(allowed.map((s) => s.toLowerCase().trim()));
    return async (req, res, next) => {
        const uid = req.session?.userId;
        if (!uid)
            return res.status(401).json({ error: "No autenticado" });
        const roles = await prisma.usuarioRol.findMany({
            where: { idUsuario: uid },
            include: { Rol: true },
        });
        const ok = roles.some((r) => set.has((r.Rol?.nombreRol || "").toLowerCase().trim()));
        if (!ok)
            return res.status(403).json({ error: "Sin permiso" });
        next();
    };
}
