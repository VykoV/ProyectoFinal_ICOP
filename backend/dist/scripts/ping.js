"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const db = new client_1.PrismaClient({ adapter: new adapter_pg_1.PrismaPg(pool) });
async function main() {
    console.log('DB:', process.env.DATABASE_URL);
    console.log('Producto count =', await db.producto.count());
}
main().finally(() => db.$disconnect());
