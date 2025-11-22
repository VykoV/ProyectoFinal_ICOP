import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
const url = process.env.DATABASE_URL
if (!url || typeof url !== 'string' || !url.trim()) {
  console.error('DATABASE_URL no está definido. Configure su conexión en .env')
  process.exit(1)
}
const pool = new Pool({ connectionString: url })
const db = new PrismaClient({ adapter: new PrismaPg(pool) })
async function main() {
  console.log('DB:', url)
  console.log('Producto count =', await db.producto.count())
}
main().finally(()=>db.$disconnect())