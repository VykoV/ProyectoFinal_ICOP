"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const url = process.env.DATABASE_URL;
if (!url || typeof url !== 'string' || !url.trim()) {
    console.error('DATABASE_URL no está definido. Configure su conexión en .env');
    process.exit(1);
}
const pool = new pg_1.Pool({ connectionString: url });
const db = new client_1.PrismaClient({ adapter: new adapter_pg_1.PrismaPg(pool) });
async function main() {
    console.log('DB:', url);
    console.log('Producto count =', await db.producto.count());
}
main().finally(() => db.$disconnect());
