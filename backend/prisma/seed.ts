import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function upsertByName<T>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
  update?: () => Promise<T>
): Promise<T> {
  const row = await find()
  if (row) return update ? update() : row
  return create()
}

async function main() {
  console.log('DB:', process.env.DATABASE_URL)

  // ---------- Usuario base ----------
  const admin = await upsertByName(
    () => prisma.usuario.findUnique({ where: { idUsuario: 1 } }),
    () => prisma.usuario.create({
      data: { nombreUsuario: 'admin', emailUsuario: 'admin@admin.com', contrasenaUsuario: 'admin' }
    })
  )

  // ---------- Provincias y Localidades ----------
  const provincias: Array<{ nombreProvincia: string; localidades: string[] }> = [
    { nombreProvincia: 'Ciudad Autónoma de Buenos Aires', localidades: ['CABA'] },
    { nombreProvincia: 'Buenos Aires', localidades: ['La Plata', 'Mar del Plata', 'Bahía Blanca', 'Tandil'] },
    { nombreProvincia: 'Catamarca', localidades: ['San Fernando del Valle de Catamarca'] },
    { nombreProvincia: 'Chaco', localidades: ['Resistencia', 'Barranqueras'] },
    { nombreProvincia: 'Chubut', localidades: ['Rawson', 'Comodoro Rivadavia', 'Trelew'] },
    { nombreProvincia: 'Córdoba', localidades: ['Córdoba', 'Río Cuarto', 'Villa Carlos Paz'] },
    { nombreProvincia: 'Corrientes', localidades: ['Corrientes', 'Goya'] },
    { nombreProvincia: 'Entre Ríos', localidades: ['Paraná', 'Concordia', 'Gualeguaychú'] },
    { nombreProvincia: 'Formosa', localidades: ['Formosa', 'Clorinda'] },
    { nombreProvincia: 'Jujuy', localidades: ['San Salvador de Jujuy', 'Palpalá'] },
    { nombreProvincia: 'La Pampa', localidades: ['Santa Rosa', 'General Pico'] },
    { nombreProvincia: 'La Rioja', localidades: ['La Rioja', 'Chilecito'] },
    { nombreProvincia: 'Mendoza', localidades: ['Mendoza', 'San Rafael', 'Godoy Cruz'] },
    { nombreProvincia: 'Misiones', localidades: ['Posadas', 'Oberá', 'Eldorado'] },
    { nombreProvincia: 'Neuquén', localidades: ['Neuquén', 'San Martín de los Andes', 'Plottier'] },
    { nombreProvincia: 'Río Negro', localidades: ['Viedma', 'San Carlos de Bariloche', 'General Roca'] },
    { nombreProvincia: 'Salta', localidades: ['Salta', 'Tartagal', 'Orán'] },
    { nombreProvincia: 'San Juan', localidades: ['San Juan', 'Rawson (SJ)'] },
    { nombreProvincia: 'San Luis', localidades: ['San Luis', 'Villa Mercedes'] },
    { nombreProvincia: 'Santa Cruz', localidades: ['Río Gallegos', 'Caleta Olivia'] },
    { nombreProvincia: 'Santa Fe', localidades: ['Santa Fe', 'Rosario', 'Rafaela'] },
    { nombreProvincia: 'Santiago del Estero', localidades: ['Santiago del Estero', 'La Banda'] },
    { nombreProvincia: 'Tierra del Fuego', localidades: ['Ushuaia', 'Río Grande'] },
    { nombreProvincia: 'Tucumán', localidades: ['San Miguel de Tucumán', 'Tafí Viejo', 'Yerba Buena'] },
  ]

  for (const p of provincias) {
    const provincia = await upsertByName(
      () => prisma.provincia.findFirst({ where: { nombreProvincia: p.nombreProvincia } }),
      () => prisma.provincia.create({ data: { nombreProvincia: p.nombreProvincia } })
    )

    for (const nombre of p.localidades) {
      await upsertByName(
        () => prisma.localidad.findFirst({
          where: { nombreLocalidad: nombre, idProvincia: provincia.idProvincia }
        }),
        () => prisma.localidad.create({
          data: { nombreLocalidad: nombre, idProvincia: provincia.idProvincia }
        })
      )
    }
  }

  // ---------- Moneda ----------
  for (const m of [
    { moneda: 'ARS', precio: 1 },
    { moneda: 'USD', precio: 1460 },
  ]) {
    await upsertByName(
      () => prisma.moneda.findFirst({ where: { moneda: m.moneda } }),
      () => prisma.moneda.create({ data: m }),
      () => prisma.moneda.updateMany({ where: { moneda: m.moneda }, data: { precio: m.precio } }).then(() => prisma.moneda.findFirst({ where: { moneda: m.moneda } }) as any)
    )
  }

  // ---------- Tipo de Cliente ----------
  await upsertByName(
    () => prisma.tipoCliente.findFirst({ where: { tipoCliente: 'Consumidor Final' } }),
    () => prisma.tipoCliente.create({ data: { tipoCliente: 'Consumidor Final' } })
  )

  // ---------- Nivel de Cliente ----------
  for (const n of [0, 5, 10]) {
    await upsertByName(
      () => prisma.nivelCliente.findFirst({ where: { indiceBeneficio: n } }),
      () => prisma.nivelCliente.create({ data: { indiceBeneficio: n } })
    )
  }

  // ---------- Tipo de Pago ----------
  for (const t of [
    { tipoPago: 'Efectivo', recargo: 0 },
    { tipoPago: 'Transferencia', recargo: 0 },
    { tipoPago: 'Débito', recargo: 0 },
    { tipoPago: 'Crédito 5%', recargo: 5 },
    { tipoPago: 'Crédito 7%', recargo: 7 },
    { tipoPago: 'QR 5%', recargo: 5 },
    { tipoPago: 'QR 7%', recargo: 7 },
  ]) {
    await upsertByName(
      () => prisma.tipoPago.findFirst({ where: { tipoPago: t.tipoPago } }),
      () => prisma.tipoPago.create({ data: t }),
      () => prisma.tipoPago.updateMany({ where: { tipoPago: t.tipoPago }, data: { recargo: t.recargo } }).then(() => prisma.tipoPago.findFirst({ where: { tipoPago: t.tipoPago } }) as any)
    )
  }

  // ---------- Estado de Venta ----------
  for (const e of ['Pendiente', 'Finalizada']) {
    await upsertByName(
      () => prisma.estadoVenta.findFirst({ where: { nombreEstadoVenta: e } }),
      () => prisma.estadoVenta.create({ data: { nombreEstadoVenta: e } })
    )
  }

  // ---------- Roles ----------
  for (const r of ['Administrador', 'Vendedor', 'Cajero']) {
    await upsertByName(
      () => prisma.rol.findFirst({ where: { nombreRol: r } }),
      () => prisma.rol.create({ data: { nombreRol: r } })
    )
  }

  // ---------- Método de Pago ----------
  for (const m of ['Efectivo', 'Transferencia']) {
    await upsertByName(
      () => prisma.metodoPago.findFirst({ where: { metodoPago: m } }),
      () => prisma.metodoPago.create({ data: { metodoPago: m } })
    )
  }

  // ---------- Asignar rol Administrador al admin ----------
  const rolAdmin = await prisma.rol.findFirst({ where: { nombreRol: 'Administrador' } })
  if (rolAdmin) {
    await upsertByName(
      () => prisma.usuarioRol.findFirst({ where: { idUsuario: admin.idUsuario, idRol: rolAdmin.idRol } }),
      () => prisma.usuarioRol.create({ data: { idUsuario: admin.idUsuario, idRol: rolAdmin.idRol } })
    )
  }


  const catalogo = [
  { fam: 'Hilados',   subs: ['Algodon', 'Lanas', 'Fantasia', 'Mezcla'] },
  { fam: 'Merceria',  subs: ['Aguja', 'Hilos'] },
  { fam: 'Maderas',   subs: ['Telar Madera', 'Telar Plástico'] },
  { fam: 'Varios',    subs: ['Varios'] },
]

for (const { fam, subs } of catalogo) {
  const familia = await prisma.familia.upsert({
    where: { tipoFamilia: fam },
    update: {},
    create: { tipoFamilia: fam },
  })
  await prisma.subFamilia.createMany({
    data: subs.map(s => ({ tipoSubFamilia: s, idFamilia: familia.idFamilia })),
    skipDuplicates: true,
  })
  
}


// Crear 1 producto demo para verificar
const fam = await prisma.familia.findUnique({ where: { tipoFamilia: 'Hilados' } })
const sub = await prisma.subFamilia.findFirst({
  where: { idFamilia: fam!.idFamilia, tipoSubFamilia: 'Algodon' }
})

const p = await prisma.producto.create({
  data: {
    codigoBarrasProducto: null,
    codigoProducto: 'tmp',                // se ajusta luego
    nombreProducto: 'Ovillo Algodón 100g',
    descripcionProducto: 'Semilla',
    ofertaProducto: false,
    precioProducto: new Prisma.Decimal(100),
    precioVentaPublicoProducto: new Prisma.Decimal(150),
    utilidadProducto: new Prisma.Decimal(50),
    idSubFamilia: sub!.idSubFamilia,
  }
})

// actualizar código = Familia-Subfamilia-id
await prisma.producto.update({
  where: { idProducto: p.idProducto },
  data: {
    codigoProducto: `${fam!.tipoFamilia}-${sub!.tipoSubFamilia}-${p.idProducto}`.slice(0, 50)
  }
})

// stock
await prisma.stock.create({
  data: {
    idProducto: p.idProducto,
    bajoMinimoStock: 0,
    cantidadStock: new Prisma.Decimal(10),
    ultimaModificacionStock: Math.floor(Date.now() / 1000),
  }
})

  console.log('Seed completado')

}



main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

