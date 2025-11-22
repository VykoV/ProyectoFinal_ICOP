import 'dotenv/config'
import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const url = process.env.DATABASE_URL;
if (!url || typeof url !== 'string' || !url.trim()) {
  console.error("DATABASE_URL no está definido. Configure su conexión en .env");
  process.exit(1);
}
const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function isBcrypt(v: string) {
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
            const hash = await bcrypt.hash(pwd, 12);
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
