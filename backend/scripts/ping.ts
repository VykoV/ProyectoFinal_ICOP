import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  console.log('DB:', process.env.DATABASE_URL)
  console.log('Producto count =', await db.producto.count())
}
main().finally(()=>db.$disconnect())