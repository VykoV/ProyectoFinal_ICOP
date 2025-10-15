// prisma/seed.ts
import { PrismaClient, Prisma } from '@prisma/client'
const prisma = new PrismaClient()

async function upsertBy<T>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
  update?: () => Promise<T>
): Promise<T> {
  const row = await find()
  if (row) return update ? update() : row
  return create()
}

// helpers
const onlyDigits = (s: string | null) => s ? s.replace(/\D/g, '') : null
const toBigIntOrNull = (s: string | null) => {
  const d = onlyDigits(s)
  return d && d.length > 0 ? BigInt(d) : null
}
const D = (n: number | string) => new Prisma.Decimal(n)

async function resetAll() {
  // Nombres reales por @@map (con mayúsculas). Postgres requiere comillas.
  await prisma.$executeRawUnsafe(`
    TRUNCATE
      "DetalleVenta",
      "Venta",
      "EstadoVenta",
      "TipoPago",
      "DetalleCompra",
      "Compra",
      "MetodoPago",
      "Moneda",
      "ProveedorProducto",
      "Stock",
      "Producto",
      "SubFamilia",
      "Familia",
      "Cliente",
      "Localidad",
      "Provincia",
      "UsuarioRol",
      "Rol",
      "Usuario",
      "TipoCliente",
      "NivelCliente"
    RESTART IDENTITY CASCADE;
  `)
}

async function seed() {
  console.log('DB:', process.env.DATABASE_URL)

  // ---------- Reset total ----------
  await resetAll()

  // ---------- Usuario base (obligatorios) ----------
  const admin = await upsertBy(
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
    const provincia = await upsertBy(
      () => prisma.provincia.findFirst({ where: { nombreProvincia: p.nombreProvincia } }),
      () => prisma.provincia.create({ data: { nombreProvincia: p.nombreProvincia } })
    )
    for (const nombre of p.localidades) {
      await upsertBy(
        () => prisma.localidad.findFirst({ where: { nombreLocalidad: nombre, idProvincia: provincia.idProvincia } }),
        () => prisma.localidad.create({ data: { nombreLocalidad: nombre, idProvincia: provincia.idProvincia } })
      )
    }
  }

  // ---------- Moneda ----------
  for (const m of [
    { moneda: 'ARS', precio: D(1) },
    { moneda: 'USD', precio: D(1460) },
  ]) {
    await upsertBy(
      () => prisma.moneda.findFirst({ where: { moneda: m.moneda } }),
      () => prisma.moneda.create({ data: m }),
      () => prisma.moneda.updateMany({ where: { moneda: m.moneda }, data: { precio: m.precio } })
        .then(() => prisma.moneda.findFirst({ where: { moneda: m.moneda } }) as any)
    )
  }

  // ---------- Tipo de Cliente ----------
  await upsertBy(
    () => prisma.tipoCliente.findFirst({ where: { tipoCliente: 'Consumidor Final' } }),
    () => prisma.tipoCliente.create({ data: { tipoCliente: 'Consumidor Final' } })
  )

  // ---------- Nivel de Cliente ----------
  for (const n of [0, 5, 10]) {
    await upsertBy(
      () => prisma.nivelCliente.findFirst({ where: { indiceBeneficio: n } }),
      () => prisma.nivelCliente.create({ data: { indiceBeneficio: n } })
    )
  }

  // ---------- Tipo de Pago ----------
  for (const t of [
    { tipoPago: 'Efectivo', recargo: D(0) },
    { tipoPago: 'Transferencia', recargo: D(0) },
    { tipoPago: 'Débito', recargo: D(0) },
    { tipoPago: 'Crédito 5%', recargo: D(5) },
    { tipoPago: 'Crédito 7%', recargo: D(7) },
    { tipoPago: 'QR 5%', recargo: D(5) },
    { tipoPago: 'QR 7%', recargo: D(7) },
  ]) {
    await upsertBy(
      () => prisma.tipoPago.findFirst({ where: { tipoPago: t.tipoPago } }),
      () => prisma.tipoPago.create({ data: t }),
      () => prisma.tipoPago.updateMany({ where: { tipoPago: t.tipoPago }, data: { recargo: t.recargo } })
        .then(() => prisma.tipoPago.findFirst({ where: { tipoPago: t.tipoPago } }) as any)
    )
  }

  // ---------- Estado de Venta ----------
  for (const e of ['Pendiente', 'Finalizada']) {
    await upsertBy(
      () => prisma.estadoVenta.findFirst({ where: { nombreEstadoVenta: e } }),
      () => prisma.estadoVenta.create({ data: { nombreEstadoVenta: e } })
    )
  }

  // ---------- Roles ----------
  for (const r of ['Administrador', 'Vendedor', 'Cajero']) {
    await upsertBy(
      () => prisma.rol.findFirst({ where: { nombreRol: r } }),
      () => prisma.rol.create({ data: { nombreRol: r } })
    )
  }

  // ---------- Método de Pago ----------
  for (const m of ['Efectivo', 'Transferencia']) {
    await upsertBy(
      () => prisma.metodoPago.findFirst({ where: { metodoPago: m } }),
      () => prisma.metodoPago.create({ data: { metodoPago: m } })
    )
  }

  // ---------- Asignar rol Admin ----------
  const rolAdmin = await prisma.rol.findFirst({ where: { nombreRol: 'Administrador' } })
  if (rolAdmin) {
    await upsertBy(
      () => prisma.usuarioRol.findFirst({ where: { idUsuario: admin.idUsuario, idRol: rolAdmin.idRol } }),
      () => prisma.usuarioRol.create({ data: { idUsuario: admin.idUsuario, idRol: rolAdmin.idRol } })
    )
  }

  // ---------- Familias y Subfamilias ----------
const catalogo = [
  { fam: 'Hilados',   subs: ['Algodon', 'Lanas', 'Fantasia', 'Mezcla', 'Acrilico'] },
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

  // ---------- Clientes (BigInt sanitizado) ----------
  const clientes = [
    {
      nombreCliente: 'Camilo',
      apellidoCliente: 'Valli',
      cuil: toBigIntOrNull('20-41656829-2'),
      emailCliente: 'Prueba@gmail.com',
      telefonoCliente: toBigIntOrNull('0342-502-4601'),
    },
    {
      nombreCliente: 'Victoria',
      apellidoCliente: 'Valli',
      cuil: toBigIntOrNull('27-42611589-1'),
      emailCliente: 'Prueba2@gmail.com',
      telefonoCliente: toBigIntOrNull('12345678'),
    },
    {
      nombreCliente: 'Luz',
      apellidoCliente: 'Guinea',
      cuil: toBigIntOrNull('42-611282'),
      emailCliente: 'Luz_Mascota@gmail.com',
      telefonoCliente: toBigIntOrNull('87654321'),
    },
  ]

  for (const c of clientes) {
    await upsertBy(
      () => prisma.cliente.findFirst({ where: { emailCliente: c.emailCliente } }),
      () => prisma.cliente.create({ data: c }),
      () => prisma.cliente.updateMany({ where: { emailCliente: c.emailCliente }, data: c })
        .then(() => prisma.cliente.findFirst({ where: { emailCliente: c.emailCliente } }) as any)
    )
  }

  // ---------- Proveedores (coincide con schema) ----------
  const proveedores = [
    {
      CIF_NIFProveedor: toBigIntOrNull('30-58962149-9'),
      nombreProveedor: 'Makor',
      telefonoProveedor: toBigIntOrNull('3415045131'),
      mailProveedor: 'administración@makorsa.com.ar',
      observacionProveedor: 'Alvear (2130), Santa Fe',
    },
    {
      CIF_NIFProveedor: toBigIntOrNull('30-71122736-5'),
      nombreProveedor: 'Scolari Distribuciones SRL',
      telefonoProveedor: toBigIntOrNull('3425689525'),
      mailProveedor: 'ventas@scolaridistribuciones.com.ar',
      observacionProveedor: '1º de Mayo 2278, S3000 Santa Fe de la Vera Cruz, Santa Fe',
    },
    {
      CIF_NIFProveedor: toBigIntOrNull('30-52117965-8'),
      nombreProveedor: 'Scolari Hermanos',
      telefonoProveedor: toBigIntOrNull('0342 522-2504'),
      mailProveedor: null,
      observacionProveedor: '1º de Mayo 2277, S3000 Santa Fe de la Vera Cruz, Santa Fe',
    },
  ]

  for (const prov of proveedores) {
    await upsertBy(
      () => prisma.proveedor.findFirst({ where: { CIF_NIFProveedor: prov.CIF_NIFProveedor } }),
      () => prisma.proveedor.create({ data: prov }),
      () => prisma.proveedor.updateMany({ where: { CIF_NIFProveedor: prov.CIF_NIFProveedor }, data: prov })
        .then(() => prisma.proveedor.findFirst({ where: { CIF_NIFProveedor: prov.CIF_NIFProveedor } }) as any)
    )
  }

  // ---------- Usuarios adicionales ----------
  const usuarios = [
    { nombreUsuario: 'Victor Luis Valli', emailUsuario: 'Victor_jefe01@gmail.com',  contrasenaUsuario: '1235' },
    { nombreUsuario: 'Mirta Griselda',    emailUsuario: 'Mirta_jefa02@gmail.com',  contrasenaUsuario: '4455' },
    { nombreUsuario: 'Giuliano Valli',    emailUsuario: 'Empleado01@gmail.com',    contrasenaUsuario: '1998' },
  ]

  for (const u of usuarios) {
    await upsertBy(
      () => prisma.usuario.findFirst({ where: { emailUsuario: u.emailUsuario } }),
      () => prisma.usuario.create({ data: u }),
      () => prisma.usuario.updateMany({ where: { emailUsuario: u.emailUsuario }, data: u })
        .then(() => prisma.usuario.findFirst({ where: { emailUsuario: u.emailUsuario } }) as any)
    )
  }

  console.log('Seed completado (sin producto demo)')
}

seed()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
