"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const db = new client_1.PrismaClient();
async function main() {
    console.log('DB:', process.env.DATABASE_URL);
    console.log('Producto count =', await db.producto.count());
}
main().finally(() => db.$disconnect());
