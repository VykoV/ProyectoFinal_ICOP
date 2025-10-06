// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // ---------- Usuario base para asignar roles obligatorios ----------
  const admin = await prisma.usuario.upsert({
    where: { idUsuario: 1 },
    update: {},
    create: {
      nombreUsuario: 'admin',
      emailUsuario: 'admin@example.com',
      contrasenaUsuario: 'dummy-hash'
    }
  })

  // ---------- Provincias y Localidades ----------
  const provincias: Array<{
    nombreProvincia: string
    localidades: string[]
  }> = [
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
    const provincia = await prisma.provincia.upsert({
      where: { idProvincia: 0 }, // fuerza create; no hay unique por nombre
      update: {},
      create: { nombreProvincia: p.nombreProvincia }
    })
    // Localidades
    await prisma.localidad.createMany({
      data: p.localidades.map(nombre => ({
        nombreLocalidad: nombre,
        idProvincia: provincia.idProvincia
      })),
      skipDuplicates: true
    })
  }

  // ---------- Moneda ----------
  await prisma.moneda.createMany({
    data: [
      { moneda: 'ARS', precio: 1 },
      { moneda: 'USD', precio: 1460 } // ajusta
    ],
    skipDuplicates: true
  })

  // ---------- Tipo de Cliente ----------
  await prisma.tipoCliente.createMany({
    data: [
      { tipoCliente: 'Consumidor Final' }
    ],
    skipDuplicates: true
  })

  // ---------- Nivel de Cliente ----------
  await prisma.nivelCliente.createMany({
    data: [
      { indiceBeneficio: 0 }, 
      { indiceBeneficio: 5 }, 
      { indiceBeneficio: 10 } 
    ],
    skipDuplicates: true
  })

  // ---------- Tipo de Pago ----------
  await prisma.tipoPago.createMany({
    data: [
      { tipoPago: 'Efectivo',      recargo: 0 },
      { tipoPago: 'Transferencia', recargo: 0 },
      { tipoPago: 'Débito',        recargo: 0 },
      { tipoPago: 'Crédito 5%',    recargo: 5 },
      { tipoPago: 'Crédito 7%',    recargo: 7 },
      { tipoPago: 'QR 5%',         recargo: 5 },
      { tipoPago: 'QR 7%',         recargo: 7 }
    ],
    skipDuplicates: true
  })

  // ---------- Estado de Venta ----------
  await prisma.estadoVenta.createMany({
    data: [
      { nombreEstadoVenta: 'Pendiente' },
      { nombreEstadoVenta: 'Finalizada' }
    ],
    skipDuplicates: true
  })

  // ---------- Roles asignados al usuario admin ----------
  await prisma.rol.createMany({
    data: [
      { nombreRol: 'Administrador'},
      { nombreRol: 'Vendedor' },
      { nombreRol: 'Cajero'}
    ],
    skipDuplicates: true
  })

  // ---------- Método de Pago ----------
  await prisma.metodoPago.createMany({
    data: [
      { metodoPago: 'Efectivo' },
      { metodoPago: 'Transferencia' }
    ],
    skipDuplicates: true
  })

  console.log('Seed completado')
}
