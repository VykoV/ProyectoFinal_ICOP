"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const bcrypt_1 = __importDefault(require("bcrypt"));
const url = process.env.DATABASE_URL;
if (!url || typeof url !== 'string' || !url.trim()) {
    console.error("DATABASE_URL no está definido. Configure su conexión en .env");
    process.exit(1);
}
const pool = new pg_1.Pool({ connectionString: url });
const prisma = new client_1.PrismaClient({ adapter: new adapter_pg_1.PrismaPg(pool) });
function isBcrypt(v) {
    return typeof v === "string" && v.startsWith("$2");
}
async function main() {
    const users = await prisma.usuario.findMany({
        select: { idUsuario: true, contrasenaUsuario: true, emailUsuario: true }
    });
    let updated = 0;
    for (const u of users) {
        const pwd = u.contrasenaUsuario;
        if (!isBcrypt(pwd)) {
            const hash = await bcrypt_1.default.hash(pwd, 12);
            await prisma.usuario.update({
                where: { idUsuario: u.idUsuario },
                data: { contrasenaUsuario: hash }
            });
            updated++;
            console.log(`Hasheado: ${u.emailUsuario}`);
        }
    }
    console.log(`Listo. Actualizados: ${updated}`);
}
main().finally(() => prisma.$disconnect());
