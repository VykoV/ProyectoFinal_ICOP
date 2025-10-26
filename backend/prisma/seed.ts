// prisma/seed.ts
/*import { PrismaClient, Prisma } from '@prisma/client'
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
      data: { nombreUsuario: 'admin', emailUsuario: 'admin@admin.com', contrasenaUsuario: 'adminadmin' }
    })
  )

  // ---------- Provincias y Localidades (completo) ----------
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

  // ---------- Familias y Subfamilias (catálogo inicial) ----------
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
      cuil: toBigIntOrNull('20416568292'),
      emailCliente: 'Prueba@gmail.com',
      telefonoCliente: toBigIntOrNull('03425024601'),
    },
    {
      nombreCliente: 'Victoria',
      apellidoCliente: 'Valli',
      cuil: toBigIntOrNull('20426115891'),
      emailCliente: 'Prueba2@gmail.com',
      telefonoCliente: toBigIntOrNull('12345678'),
    },
    {
      nombreCliente: 'Luz',
      apellidoCliente: 'Guinea',
      cuil: toBigIntOrNull('42611282'),
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
      CIF_NIFProveedor: toBigIntOrNull('30589621499'),
      nombreProveedor: 'Makor',
      telefonoProveedor: toBigIntOrNull('3415045131'),
      mailProveedor: 'administración@makorsa.com.ar',
      observacionProveedor: 'Alvear (2130), Santa Fe',
    },
    {
      CIF_NIFProveedor: toBigIntOrNull('30711227365'),
      nombreProveedor: 'Scolari Distribuciones SRL',
      telefonoProveedor: toBigIntOrNull('3425689525'),
      mailProveedor: 'ventas@scolaridistribuciones.com.ar',
      observacionProveedor: '1º de Mayo 2278, S3000 Santa Fe de la Vera Cruz, Santa Fe',
    },
    {
      CIF_NIFProveedor: toBigIntOrNull('30521179658'),
      nombreProveedor: 'Scolari Hermanos',
      telefonoProveedor: toBigIntOrNull('03425222504'),
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
    { nombreUsuario: 'Victor Luis Valli', emailUsuario: 'Victor_jefe01@gmail.com',  contrasenaUsuario: '123456' },
    { nombreUsuario: 'Mirta Griselda',    emailUsuario: 'Mirta_jefa02@gmail.com',  contrasenaUsuario: '445566' },
    { nombreUsuario: 'Giuliano Valli',    emailUsuario: 'Empleado01@gmail.com',    contrasenaUsuario: '199899' },
  ]
  for (const u of usuarios) {
    await upsertBy(
      () => prisma.usuario.findFirst({ where: { emailUsuario: u.emailUsuario } }),
      () => prisma.usuario.create({ data: u }),
      () => prisma.usuario.updateMany({ where: { emailUsuario: u.emailUsuario }, data: u })
        .then(() => prisma.usuario.findFirst({ where: { emailUsuario: u.emailUsuario } }) as any)
    )
  }

  // ---------- Bloque extra del original ----------
  // Familias en MAYÚSCULAS
  await prisma.familia.createMany({
    data: [
      { tipoFamilia: 'MERCERIA' },
      { tipoFamilia: 'HILADOS' },
      { tipoFamilia: 'MADERA' },
    ],
    skipDuplicates: true,
  })
  // Subfamilias adicionales
  await prisma.subFamilia.createMany({
    data: [
      { tipoSubFamilia: 'AGUJA', idFamilia: 1 },
      { tipoSubFamilia: 'VARIOS', idFamilia: 1 },
      { tipoSubFamilia: 'ACRILICO', idFamilia: 2 },
      { tipoSubFamilia: 'ALGODON', idFamilia: 2 },
      { tipoSubFamilia: 'FANTASIA', idFamilia: 2 },
      { tipoSubFamilia: 'TELAR', idFamilia: 3 },
    ],
    skipDuplicates: true,
  })
  // Proveedores adicionales
  await prisma.proveedor.createMany({
    data: [
      { nombreProveedor: 'SCOLARI HNOS.' },
      { nombreProveedor: 'SCOLARI I' },
      { nombreProveedor: 'MAKOR' },
      { nombreProveedor: 'OTROS' },
      { nombreProveedor: 'NUBE' },
    ],
    skipDuplicates: true,
  })
  // Productos seleccionados
  await prisma.producto.createMany({
    data: [
      {
        codigoProducto: 'ART-001',
        nombreProducto: 'AGUJA CROCHET LOTUS',
        descripcionProducto: 'Aguja crochet marca Lotus de alta calidad',
        ofertaProducto: false,
        precioProducto: 108309.00,
        precioVentaPublicoProducto: 216618.00,
        utilidadProducto: 100.00,
        idSubFamilia: 1, // AGUJA
      },
      {
        codigoProducto: 'ART-002',
        nombreProducto: 'LHO – AMALFI OVILLO',
        descripcionProducto: 'Hilado acrílico Amalfi en ovillo',
        ofertaProducto: false,
        precioProducto: 1000.00,
        precioVentaPublicoProducto: 32000.00,
        utilidadProducto: 3100.00,
        idSubFamilia: 3, // ACRILICO
      },
      {
        codigoProducto: 'ART-003',
        nombreProducto: 'CONO HILO ALGODON CRUDO X 1 KG Nº 27 HEBRAS',
        descripcionProducto: 'Cono de hilo de algodón crudo 1kg para tejido',
        ofertaProducto: false,
        precioProducto: 8887.00,
        precioVentaPublicoProducto: 17774.00,
        utilidadProducto: 100.00,
        idSubFamilia: 4, // ALGODON
      },
      {
        codigoProducto: 'ART-004',
        nombreProducto: 'TELAR SUREÑO 110 CON 1 PEINE',
        descripcionProducto: 'Telar sureño profesional de 110cm con peine incluido',
        ofertaProducto: false,
        precioProducto: 130000.00,
        precioVentaPublicoProducto: 260000.00,
        utilidadProducto: 100.00,
        idSubFamilia: 6, // TELAR
      },
      {
        codigoProducto: 'ART-005',
        nombreProducto: 'FANTASIA TWITY RAMIREZ',
        descripcionProducto: 'Hilado de fantasía multicolor Twity Ramirez',
        ofertaProducto: false,
        precioProducto: 29000.00,
        precioVentaPublicoProducto: 58000.00,
        utilidadProducto: 100.00,
        idSubFamilia: 5, // FANTASIA
      },
      {
        codigoProducto: 'ART-006',
        nombreProducto: 'CENTIMETRO CBX AUTOMATICO *150CM',
        descripcionProducto: 'Centímetro automático de 150cm para costura',
        ofertaProducto: false,
        precioProducto: 2500.00,
        precioVentaPublicoProducto: 5000.00,
        utilidadProducto: 100.00,
        idSubFamilia: 2, // VARIOS
      },
      {
        codigoProducto: 'ART-007',
        nombreProducto: 'LHO-ALGODON 8/3 y 7/8  OSCURO',
        descripcionProducto: 'Hilado de algodón oscuro para tejido',
        ofertaProducto: false,
        precioProducto: 19968.00,
        precioVentaPublicoProducto: 32500.00,
        utilidadProducto: 62.80,
        idSubFamilia: 4, // ALGODON
      },
      {
        codigoProducto: 'ART-008',
        nombreProducto: 'AGUJA TRICOT  5',
        descripcionProducto: 'Aguja tricot número 5 para tejer',
        ofertaProducto: false,
        precioProducto: 12.00,
        precioVentaPublicoProducto: 2400.00,
        utilidadProducto: 19900.00,
        idSubFamilia: 1, // AGUJA
      },
      {
        codigoProducto: 'ART-009',
        nombreProducto: 'MIA - LANA 100% PURA-AMANDA 5484/5542',
        descripcionProducto: 'Lana 100% pura de primera calidad',
        ofertaProducto: false,
        precioProducto: 16006.00,
        precioVentaPublicoProducto: 32000.00,
        utilidadProducto: 99.88,
        idSubFamilia: 3, // ACRILICO
      },
      {
        codigoProducto: 'ART-010',
        nombreProducto: 'BASTIDOR BORDADO F/FACIL 30 CHINO',
        descripcionProducto: 'Bastidor para bordado chino de 30cm',
        ofertaProducto: false,
        precioProducto: 15000.00,
        precioVentaPublicoProducto: 30000.00,
        utilidadProducto: 100.00,
        idSubFamilia: 2, // VARIOS
      }
    ],
    skipDuplicates: true,
  })
  // Stock
  await prisma.stock.createMany({
    data: [
      { idProducto: 1, bajoMinimoStock: 5, cantidadStock: 42.00 },
      { idProducto: 2, bajoMinimoStock: 10, cantidadStock: 46.14 },
      { idProducto: 3, bajoMinimoStock: 3, cantidadStock: 21.30 },
      { idProducto: 4, bajoMinimoStock: 2, cantidadStock: -2.00 },
      { idProducto: 5, bajoMinimoStock: 5, cantidadStock: 5834.30 },
      { idProducto: 6, bajoMinimoStock: 5, cantidadStock: 3.00 },
      { idProducto: 7, bajoMinimoStock: 10, cantidadStock: 99.33 },
      { idProducto: 8, bajoMinimoStock: 10, cantidadStock: 891.00 },
      { idProducto: 9, bajoMinimoStock: 5, cantidadStock: 5264.64 },
      { idProducto: 10, bajoMinimoStock: 3, cantidadStock: 1.00 },
    ],
  })

  // --------- Normalización por CHAR(100) en EstadoVenta ----------
  await prisma.$executeRawUnsafe(`
    UPDATE "EstadoVenta"
    SET "nombreEstadoVenta" = TRIM(BOTH FROM "nombreEstadoVenta");
  `)

  // --------- PREVENTAS DEMO con estado Pendiente ----------
  const pendiente = await prisma.estadoVenta.findFirst({
    where: { nombreEstadoVenta: { startsWith: 'Pendiente', mode: 'insensitive' } },
    select: { idEstadoVenta: true }
  })
  const tipoEfectivo = await prisma.tipoPago.findFirst({
    where: { tipoPago: { startsWith: 'Efectivo', mode: 'insensitive' } },
    select: { idTipoPago: true }
  })
  const tipoDebito = await prisma.tipoPago.findFirst({
    where: { tipoPago: { startsWith: 'Débito', mode: 'insensitive' } },
    select: { idTipoPago: true }
  })
  const ars = await prisma.moneda.findFirst({ where: { moneda: 'ARS' }, select: { idMoneda: true } })
  const camilo = await prisma.cliente.findFirst({ where: { nombreCliente: 'Camilo', apellidoCliente: 'Valli' } })
  const luz    = await prisma.cliente.findFirst({ where: { nombreCliente: 'Luz' } })
  if (pendiente && tipoEfectivo && tipoDebito && ars && camilo && luz) {
    const hoy = new Date()
    await prisma.venta.create({
      data: {
        fechaVenta: hoy,
        fechaCobroVenta: hoy,
        observacion: null,
        idCliente: camilo.idCliente,
        idEstadoVenta: pendiente.idEstadoVenta,
        idTipoPago: tipoEfectivo.idTipoPago,
        idMoneda: ars.idMoneda,
        detalles: {
          create: [
            { idProducto: 1, cantidad: 1 },
            { idProducto: 2, cantidad: 2 },
          ],
        },
      },
    })
    await prisma.venta.create({
      data: {
        fechaVenta: hoy,
        fechaCobroVenta: hoy,
        observacion: 'preventa demo',
        idCliente:   luz.idCliente,
        idEstadoVenta: pendiente.idEstadoVenta,
        idTipoPago:    tipoDebito.idTipoPago,
        idMoneda:      ars.idMoneda,
        detalles: { create: [{ idProducto: 3, cantidad: 3 }] },
      },
    })
  }

  console.log('Seed completado')
}

seed()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
*/

// prisma/seed.ts
import { PrismaClient, Prisma, PapelEnVenta } from '@prisma/client'
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

// full truncate (respeta tablas nuevas)
async function resetAll() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE
      "VentaComentario",
      "VentaEvento",
      "VentaActor",
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

  // 1. reset
  await resetAll()

  // 2. usuario admin base
  const admin = await upsertBy(
    () => prisma.usuario.findUnique({ where: { idUsuario: 1 } }),
    () => prisma.usuario.create({
      data: {
        nombreUsuario: 'admin',
        emailUsuario: 'admin@admin.com',
        contrasenaUsuario: 'adminadmin',
      }
    })
  )

  // 3. provincias y localidades
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
        () => prisma.localidad.findFirst({
          where: { nombreLocalidad: nombre, idProvincia: provincia.idProvincia }
        }),
        () => prisma.localidad.create({
          data: { nombreLocalidad: nombre, idProvincia: provincia.idProvincia }
        })
      )
    }
  }

  // 4. moneda
  for (const m of [
    { moneda: 'ARS', precio: D(1) },
    { moneda: 'USD', precio: D(1460) },
  ]) {
    await upsertBy(
      () => prisma.moneda.findFirst({ where: { moneda: m.moneda } }),
      () => prisma.moneda.create({ data: m }),
      () => prisma.moneda.updateMany({
        where: { moneda: m.moneda },
        data: { precio: m.precio }
      }).then(() =>
        prisma.moneda.findFirst({ where: { moneda: m.moneda } }) as any
      )
    )
  }

  // 5. tipoCliente
  await upsertBy(
    () => prisma.tipoCliente.findFirst({ where: { tipoCliente: 'Consumidor Final' } }),
    () => prisma.tipoCliente.create({ data: { tipoCliente: 'Consumidor Final' } })
  )

  // 6. nivelCliente
  for (const n of [0, 5, 10]) {
    await upsertBy(
      () => prisma.nivelCliente.findFirst({ where: { indiceBeneficio: n } }),
      () => prisma.nivelCliente.create({ data: { indiceBeneficio: n } })
    )
  }

  // 7. tipoPago (venta)
  for (const t of [
    { tipoPago: 'Efectivo',      recargo: D(0) },
    { tipoPago: 'Transferencia', recargo: D(0) },
    { tipoPago: 'Débito',        recargo: D(0) },
    { tipoPago: 'Crédito 5%',    recargo: D(5) },
    { tipoPago: 'Crédito 7%',    recargo: D(7) },
    { tipoPago: 'QR 5%',         recargo: D(5) },
    { tipoPago: 'QR 7%',         recargo: D(7) },
  ]) {
    await upsertBy(
      () => prisma.tipoPago.findFirst({ where: { tipoPago: t.tipoPago } }),
      () => prisma.tipoPago.create({ data: t }),
      () => prisma.tipoPago.updateMany({
        where: { tipoPago: t.tipoPago },
        data: { recargo: t.recargo }
      }).then(() =>
        prisma.tipoPago.findFirst({ where: { tipoPago: t.tipoPago } }) as any
      )
    )
  }

  // 8. estadoVenta (incluye Cancelada ahora)
  for (const e of ['Pendiente', 'Finalizada', 'Cancelada']) {
    await upsertBy(
      () => prisma.estadoVenta.findFirst({ where: { nombreEstadoVenta: e } }),
      () => prisma.estadoVenta.create({ data: { nombreEstadoVenta: e } })
    )
  }

  // 9. metodoPago (compra)
  for (const m of ['Efectivo', 'Transferencia']) {
    await upsertBy(
      () => prisma.metodoPago.findFirst({ where: { metodoPago: m } }),
      () => prisma.metodoPago.create({ data: { metodoPago: m } })
    )
  }

  // 10. roles globales
  for (const r of ['Administrador', 'Vendedor', 'Cajero']) {
    await upsertBy(
      () => prisma.rol.findFirst({ where: { nombreRol: r } }),
      () => prisma.rol.create({ data: { nombreRol: r } })
    )
  }

  // 11. asignar rol admin al usuario admin
  const rolAdmin = await prisma.rol.findFirst({ where: { nombreRol: 'Administrador' } })
  if (rolAdmin) {
    await upsertBy(
      () => prisma.usuarioRol.findFirst({
        where: { idUsuario: admin.idUsuario, idRol: rolAdmin.idRol }
      }),
      () => prisma.usuarioRol.create({
        data: { idUsuario: admin.idUsuario, idRol: rolAdmin.idRol }
      })
    )
  }

  // 12. familias y subfamilias (catálogo inicial)
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
      data: subs.map(s => ({
        tipoSubFamilia: s,
        idFamilia: familia.idFamilia,
      })),
      skipDuplicates: true,
    })
  }

  // 13. clientes
  const clientes = [
    {
      nombreCliente: 'Camilo',
      apellidoCliente: 'Valli',
      cuil: toBigIntOrNull('20416568292'),
      emailCliente: 'Prueba@gmail.com',
      telefonoCliente: toBigIntOrNull('03425024601'),
    },
    {
      nombreCliente: 'Victoria',
      apellidoCliente: 'Valli',
      cuil: toBigIntOrNull('20426115891'),
      emailCliente: 'Prueba2@gmail.com',
      telefonoCliente: toBigIntOrNull('12345678'),
    },
    {
      nombreCliente: 'Luz',
      apellidoCliente: 'Guinea',
      cuil: toBigIntOrNull('42611282'),
      emailCliente: 'Luz_Mascota@gmail.com',
      telefonoCliente: toBigIntOrNull('87654321'),
    },
  ]

  for (const c of clientes) {
    await upsertBy(
      () => prisma.cliente.findFirst({ where: { emailCliente: c.emailCliente } }),
      () => prisma.cliente.create({ data: c }),
      () => prisma.cliente.updateMany({
        where: { emailCliente: c.emailCliente },
        data: c
      }).then(() =>
        prisma.cliente.findFirst({ where: { emailCliente: c.emailCliente } }) as any
      )
    )
  }

  // 14. proveedores
  const proveedores = [
    {
      CIF_NIFProveedor: toBigIntOrNull('30589621499'),
      nombreProveedor: 'Makor',
      telefonoProveedor: toBigIntOrNull('3415045131'),
      mailProveedor: 'administración@makorsa.com.ar',
      observacionProveedor: 'Alvear (2130), Santa Fe',
    },
    {
      CIF_NIFProveedor: toBigIntOrNull('30711227365'),
      nombreProveedor: 'Scolari Distribuciones SRL',
      telefonoProveedor: toBigIntOrNull('3425689525'),
      mailProveedor: 'ventas@scolaridistribuciones.com.ar',
      observacionProveedor: '1º de Mayo 2278, S3000 Santa Fe de la Vera Cruz, Santa Fe',
    },
    {
      CIF_NIFProveedor: toBigIntOrNull('30521179658'),
      nombreProveedor: 'Scolari Hermanos',
      telefonoProveedor: toBigIntOrNull('03425222504'),
      mailProveedor: null,
      observacionProveedor: '1º de Mayo 2277, S3000 Santa Fe de la Vera Cruz, Santa Fe',
    },
  ]

  for (const prov of proveedores) {
    await upsertBy(
      () => prisma.proveedor.findFirst({
        where: { CIF_NIFProveedor: prov.CIF_NIFProveedor }
      }),
      () => prisma.proveedor.create({ data: prov }),
      () => prisma.proveedor.updateMany({
        where: { CIF_NIFProveedor: prov.CIF_NIFProveedor },
        data: prov
      }).then(() =>
        prisma.proveedor.findFirst({
          where: { CIF_NIFProveedor: prov.CIF_NIFProveedor }
        }) as any
      )
    )
  }

  // 15. usuarios adicionales
  const usuarios = [
    { nombreUsuario: 'Victor Luis Valli', emailUsuario: 'Victor_jefe01@gmail.com',  contrasenaUsuario: '123456' },
    { nombreUsuario: 'Mirta Griselda',    emailUsuario: 'Mirta_jefa02@gmail.com',  contrasenaUsuario: '445566' },
    { nombreUsuario: 'Giuliano Valli',    emailUsuario: 'Empleado01@gmail.com',    contrasenaUsuario: '199899' },
  ]

  for (const u of usuarios) {
    await upsertBy(
      () => prisma.usuario.findFirst({ where: { emailUsuario: u.emailUsuario } }),
      () => prisma.usuario.create({ data: u }),
      () => prisma.usuario.updateMany({
        where: { emailUsuario: u.emailUsuario },
        data: u
      }).then(() =>
        prisma.usuario.findFirst({ where: { emailUsuario: u.emailUsuario } }) as any
      )
    )
  }

  // 16. familias extra en mayúsculas
  await prisma.familia.createMany({
    data: [
      { tipoFamilia: 'MERCERIA' },
      { tipoFamilia: 'HILADOS' },
      { tipoFamilia: 'MADERA' },
    ],
    skipDuplicates: true,
  })

  await prisma.subFamilia.createMany({
    data: [
      { tipoSubFamilia: 'AGUJA',    idFamilia: 1 },
      { tipoSubFamilia: 'VARIOS',   idFamilia: 1 },
      { tipoSubFamilia: 'ACRILICO', idFamilia: 2 },
      { tipoSubFamilia: 'ALGODON',  idFamilia: 2 },
      { tipoSubFamilia: 'FANTASIA', idFamilia: 2 },
      { tipoSubFamilia: 'TELAR',    idFamilia: 3 },
    ],
    skipDuplicates: true,
  })

  await prisma.proveedor.createMany({
    data: [
      { nombreProveedor: 'SCOLARI HNOS.' },
      { nombreProveedor: 'SCOLARI I' },
      { nombreProveedor: 'MAKOR' },
      { nombreProveedor: 'OTROS' },
      { nombreProveedor: 'NUBE' },
    ],
    skipDuplicates: true,
  })

  // 17. productos
  await prisma.producto.createMany({
    data: [
      {
        codigoProducto: 'ART-001',
        nombreProducto: 'AGUJA CROCHET LOTUS',
        descripcionProducto: 'Aguja crochet marca Lotus de alta calidad',
        ofertaProducto: false,
        precioProducto: D(108309.00),
        precioVentaPublicoProducto: D(216618.00),
        utilidadProducto: D(100.00),
        idSubFamilia: 1, // AGUJA
      },
      {
        codigoProducto: 'ART-002',
        nombreProducto: 'LHO – AMALFI OVILLO',
        descripcionProducto: 'Hilado acrílico Amalfi en ovillo',
        ofertaProducto: false,
        precioProducto: D(1000.00),
        precioVentaPublicoProducto: D(32000.00),
        utilidadProducto: D(3100.00),
        idSubFamilia: 3, // ACRILICO
      },
      {
        codigoProducto: 'ART-003',
        nombreProducto: 'CONO HILO ALGODON CRUDO X 1 KG Nº 27 HEBRAS',
        descripcionProducto: 'Cono de hilo de algodón crudo 1kg para tejido',
        ofertaProducto: false,
        precioProducto: D(8887.00),
        precioVentaPublicoProducto: D(17774.00),
        utilidadProducto: D(100.00),
        idSubFamilia: 4, // ALGODON
      },
      {
        codigoProducto: 'ART-004',
        nombreProducto: 'TELAR SUREÑO 110 CON 1 PEINE',
        descripcionProducto: 'Telar sureño profesional de 110cm con peine incluido',
        ofertaProducto: false,
        precioProducto: D(130000.00),
        precioVentaPublicoProducto: D(260000.00),
        utilidadProducto: D(100.00),
        idSubFamilia: 6, // TELAR
      },
      {
        codigoProducto: 'ART-005',
        nombreProducto: 'FANTASIA TWITY RAMIREZ',
        descripcionProducto: 'Hilado de fantasía multicolor Twity Ramirez',
        ofertaProducto: false,
        precioProducto: D(29000.00),
        precioVentaPublicoProducto: D(58000.00),
        utilidadProducto: D(100.00),
        idSubFamilia: 5, // FANTASIA
      },
      {
        codigoProducto: 'ART-006',
        nombreProducto: 'CENTIMETRO CBX AUTOMATICO *150CM',
        descripcionProducto: 'Centímetro automático de 150cm para costura',
        ofertaProducto: false,
        precioProducto: D(2500.00),
        precioVentaPublicoProducto: D(5000.00),
        utilidadProducto: D(100.00),
        idSubFamilia: 2, // VARIOS
      },
      {
        codigoProducto: 'ART-007',
        nombreProducto: 'LHO-ALGODON 8/3 y 7/8  OSCURO',
        descripcionProducto: 'Hilado de algodón oscuro para tejido',
        ofertaProducto: false,
        precioProducto: D(19968.00),
        precioVentaPublicoProducto: D(32500.00),
        utilidadProducto: D(62.80),
        idSubFamilia: 4, // ALGODON
      },
      {
        codigoProducto: 'ART-008',
        nombreProducto: 'AGUJA TRICOT  5',
        descripcionProducto: 'Aguja tricot número 5 para tejer',
        ofertaProducto: false,
        precioProducto: D(12.00),
        precioVentaPublicoProducto: D(2400.00),
        utilidadProducto: D(19900.00),
        idSubFamilia: 1, // AGUJA
      },
      {
        codigoProducto: 'ART-009',
        nombreProducto: 'MIA - LANA 100% PURA-AMANDA 5484/5542',
        descripcionProducto: 'Lana 100% pura de primera calidad',
        ofertaProducto: false,
        precioProducto: D(16006.00),
        precioVentaPublicoProducto: D(32000.00),
        utilidadProducto: D(99.88),
        idSubFamilia: 3, // ACRILICO
      },
      {
        codigoProducto: 'ART-010',
        nombreProducto: 'BASTIDOR BORDADO F/FACIL 30 CHINO',
        descripcionProducto: 'Bastidor para bordado chino de 30cm',
        ofertaProducto: false,
        precioProducto: D(15000.00),
        precioVentaPublicoProducto: D(30000.00),
        utilidadProducto: D(100.00),
        idSubFamilia: 2, // VARIOS
      }
    ],
    skipDuplicates: true,
  })

  // 18. stock según nuevo schema
  await prisma.stock.createMany({
    data: [
      { idProducto: 1,  bajoMinimoStock: D(5),  cantidadRealStock: D(42.00),    stockComprometido: D(0) },
      { idProducto: 2,  bajoMinimoStock: D(10), cantidadRealStock: D(46.14),    stockComprometido: D(0) },
      { idProducto: 3,  bajoMinimoStock: D(3),  cantidadRealStock: D(21.30),    stockComprometido: D(0) },
      { idProducto: 4,  bajoMinimoStock: D(2),  cantidadRealStock: D(-2.00),    stockComprometido: D(0) },
      { idProducto: 5,  bajoMinimoStock: D(5),  cantidadRealStock: D(5834.30),  stockComprometido: D(0) },
      { idProducto: 6,  bajoMinimoStock: D(5),  cantidadRealStock: D(3.00),     stockComprometido: D(0) },
      { idProducto: 7,  bajoMinimoStock: D(10), cantidadRealStock: D(99.33),    stockComprometido: D(0) },
      { idProducto: 8,  bajoMinimoStock: D(10), cantidadRealStock: D(891.00),   stockComprometido: D(0) },
      { idProducto: 9,  bajoMinimoStock: D(5),  cantidadRealStock: D(5264.64),  stockComprometido: D(0) },
      { idProducto: 10, bajoMinimoStock: D(3),  cantidadRealStock: D(1.00),     stockComprometido: D(0) },
    ],
  })

  // 19. normalizar EstadoVenta (por si hay espacios)
  await prisma.$executeRawUnsafe(`
    UPDATE "EstadoVenta"
    SET "nombreEstadoVenta" = TRIM(BOTH FROM "nombreEstadoVenta");
  `)

  // 20. crear preventas demo (estado Pendiente)
  const pendiente = await prisma.estadoVenta.findFirst({
    where: { nombreEstadoVenta: { startsWith: 'Pendiente', mode: 'insensitive' } },
    select: { idEstadoVenta: true }
  })
  const tipoEfectivo = await prisma.tipoPago.findFirst({
    where: { tipoPago: { startsWith: 'Efectivo', mode: 'insensitive' } },
    select: { idTipoPago: true }
  })
  const tipoDebito = await prisma.tipoPago.findFirst({
    where: { tipoPago: { startsWith: 'Débito', mode: 'insensitive' } },
    select: { idTipoPago: true }
  })
  const ars = await prisma.moneda.findFirst({
    where: { moneda: 'ARS' },
    select: { idMoneda: true }
  })
  const camilo = await prisma.cliente.findFirst({
    where: { nombreCliente: 'Camilo', apellidoCliente: 'Valli' }
  })
  const luz = await prisma.cliente.findFirst({
    where: { nombreCliente: 'Luz' }
  })

  const creatorUserId = admin.idUsuario

  if (pendiente && tipoEfectivo && tipoDebito && ars && camilo && luz) {
    const hoy = new Date()

    const venta1 = await prisma.venta.create({
      data: {
        fechaVenta: hoy,
        fechaCobroVenta: hoy,
        observacion: null,
        idCliente: camilo.idCliente,
        idEstadoVenta: pendiente.idEstadoVenta,
        idTipoPago: tipoEfectivo.idTipoPago,
        idMoneda: ars.idMoneda,
        idUsuario: creatorUserId,
        detalles: {
          create: [
            { idProducto: 1, cantidad: D(1) },
            { idProducto: 2, cantidad: D(2) },
          ],
        },
      },
    })

    await prisma.ventaActor.create({
      data: {
        idVenta: venta1.idVenta,
        idUsuario: creatorUserId,
        papel: PapelEnVenta.CREADOR,
      },
    })

    await prisma.ventaEvento.create({
      data: {
        idVenta: venta1.idVenta,
        idUsuario: creatorUserId,
        estadoDesde: null,
        estadoHasta: pendiente.idEstadoVenta,
        motivo: 'Creación de preventa',
      },
    })

    const venta2 = await prisma.venta.create({
      data: {
        fechaVenta: hoy,
        fechaCobroVenta: hoy,
        observacion: 'preventa demo',
        idCliente: luz.idCliente,
        idEstadoVenta: pendiente.idEstadoVenta,
        idTipoPago: tipoDebito.idTipoPago,
        idMoneda: ars.idMoneda,
        idUsuario: creatorUserId,
        detalles: {
          create: [
            { idProducto: 3, cantidad: D(3) },
          ],
        },
      },
    })

    await prisma.ventaActor.create({
      data: {
        idVenta: venta2.idVenta,
        idUsuario: creatorUserId,
        papel: PapelEnVenta.CREADOR,
      },
    })

    await prisma.ventaEvento.create({
      data: {
        idVenta: venta2.idVenta,
        idUsuario: creatorUserId,
        estadoDesde: null,
        estadoHasta: pendiente.idEstadoVenta,
        motivo: 'Creación de preventa',
      },
    })

    await prisma.ventaComentario.create({
      data: {
        idVenta: venta2.idVenta,
        idUsuario: creatorUserId,
        comentario: 'Cliente pidió reservar hasta mañana',
      },
    })
  }

  console.log('Seed completado')
}

seed()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })