import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

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
