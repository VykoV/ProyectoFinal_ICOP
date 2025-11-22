"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const bcrypt_1 = __importDefault(require("bcrypt"));
const auth_1 = require("./validators/auth");
const requireAuth_1 = require("./middleware/requireAuth");
const router = express_1.default.Router();
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter: new adapter_pg_1.PrismaPg(pool) });
// ===============================
// LOGIN
// ===============================
router.post("/login", async (req, res) => {
    const parse = auth_1.loginSchema.safeParse(req.body);
    if (!parse.success)
        return res.status(400).json({ error: "Payload inválido" });
    const { email, password } = parse.data;
    const user = await prisma.usuario.findFirst({
        where: { emailUsuario: { equals: email, mode: "insensitive" } },
        include: { roles: { include: { Rol: true } } },
    });
    if (!user)
        return res.status(401).json({ error: "Credenciales inválidas" });
    const ok = user.contrasenaUsuario.startsWith("$2")
        ? await bcrypt_1.default.compare(password, user.contrasenaUsuario)
        : password === user.contrasenaUsuario;
    if (!ok)
        return res.status(401).json({ error: "Credenciales inválidas" });
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
router.post("/logout", requireAuth_1.requireAuth, (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});
// ===============================
// AUTH/ME
// ===============================
router.get("/me", async (req, res) => {
    const uid = req.session?.userId;
    if (!uid)
        return res.status(200).json(null);
    const u = await prisma.usuario.findUnique({
        where: { idUsuario: uid },
        include: { roles: { include: { Rol: true } } },
    });
    if (!u)
        return res.status(200).json(null);
    res.json({
        id: u.idUsuario,
        nombre: u.nombreUsuario,
        email: u.emailUsuario,
        roles: u.roles.map((r) => r.Rol?.nombreRol).filter(Boolean),
    });
});
exports.default = router;
