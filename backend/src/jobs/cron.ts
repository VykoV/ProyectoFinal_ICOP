import cron from "node-cron";
import { PrismaClient, Prisma, PapelEnVenta, TipoNotificacion, NivelNotificacion, DestinatarioNotificacion } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Obtiene o crea un usuario "Sistema" para auditoría
async function getSystemUserId(): Promise<number | null> {
  try {
    const email = process.env.SYSTEM_USER_EMAIL || "system@local";
    const nombre = process.env.SYSTEM_USER_NAME || "Sistema";
    const u = await prisma.usuario.upsert({
      where: { emailUsuario: email },
      update: {},
      create: {
        nombreUsuario: nombre,
        emailUsuario: email,
        // contraseña no utilizada para login
        contrasenaUsuario: "!",
      },
      select: { idUsuario: true },
    });
    return u.idUsuario;
  } catch (err) {
    console.error("cron:getSystemUserId error", err);
    return null;
  }
}

async function getEstadoPendienteId(): Promise<number | null> {
  try {
    const e = await prisma.estadoVenta.findFirst({
      where: { nombreEstadoVenta: { equals: "Pendiente", mode: "insensitive" } },
      select: { idEstadoVenta: true },
    });
    return e?.idEstadoVenta ?? null;
  } catch (err) {
    console.error("cron:getEstadoPendienteId error", err);
    return null;
  }
}

async function getEstadoIds(): Promise<Record<string, number | null>> {
  try {
    const estados = await prisma.estadoVenta.findMany({
      where: { nombreEstadoVenta: { in: ["Pendiente", "Reservado", "ListoCaja", "Vencido"] } },
      select: { idEstadoVenta: true, nombreEstadoVenta: true },
    });
    const map: Record<string, number | null> = {
      Pendiente: null,
      Reservado: null,
      ListoCaja: null,
      Vencido: null,
    };
    for (const e of estados) map[e.nombreEstadoVenta] = e.idEstadoVenta;
    return map;
  } catch (err) {
    console.error("cron:getEstadoIds error", err);
    return { Pendiente: null, Reservado: null, ListoCaja: null, Vencido: null };
  }
}

async function liberarComprometidoVenta(idVenta: number): Promise<void> {
  const detalles = await prisma.detalleVenta.findMany({
    where: { idVenta },
    select: { idProducto: true, cantidad: true },
  });
  for (const d of detalles) {
    const stock = await prisma.stock.findUnique({
      where: { idProducto: d.idProducto },
      select: { stockComprometido: true },
    });
    const actual = Number(stock?.stockComprometido ?? 0);
    const cant = Number(d.cantidad ?? 0);
    const nuevo = Math.max(0, actual - cant);
    await prisma.stock.update({
      where: { idProducto: d.idProducto },
      data: { stockComprometido: nuevo },
    });
  }
}

async function calcularTotalBasico(idVenta: number): Promise<number> {
  const detalles = await prisma.detalleVenta.findMany({
    where: { idVenta },
    select: { cantidad: true, precioUnit: true, descuentoItem: true, recargoItem: true },
  });
  let total = 0;
  for (const d of detalles) {
    const cant = Number(d.cantidad ?? 0);
    const pu = Number(d.precioUnit ?? 0);
    const base = cant * pu;
    const descPct = Number(d.descuentoItem ?? 0) / 100;
    const recPct = Number(d.recargoItem ?? 0) / 100;
    const conDesc = base * (1 - descPct);
    const conRec = conDesc * (1 + recPct);
    total += conRec;
  }
  return total;
}

// Aviso diario “revisar cotización” (11:00)
cron.schedule("0 11 * * *", async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const desactualizadas = await prisma.moneda.findMany({
      where: { updatedAt: { lt: cutoff } },
      select: { moneda: true },
    });
    if (desactualizadas.length > 0) {
      const msg = `Monedas para revisar: ${desactualizadas.map(m => m.moneda).join(", ")}`;
      console.log(`[INFO] ${msg}`);
      // Si luego agregas una tabla de logs, registra aquí
      // await prisma.log.create({ data: { nivel: 'INFO', mensaje: msg } });
    }
  } catch (err) {
    console.error("cron 11:00 revisar cotización error", err);
  }
});

// Reservas vencidas (Cajero) — 08:30
cron.schedule("30 8 * * *", async () => {
  try {
    const { Reservado } = await getEstadoIds();
    if (Reservado == null) return;
    const rows = await prisma.venta.findMany({
      where: {
        idEstadoVenta: Reservado,
        fechaReservaLimite: { not: null, lt: new Date() },
      },
      select: { idVenta: true },
    });
    if (rows.length > 0) {
      await prisma.notificacion.create({
        data: {
          tipo: TipoNotificacion.RESERVA_VENCIDA,
          mensaje: `Reservas vencidas: ${rows.length}`,
          nivel: NivelNotificacion.WARN,
          destinatario: DestinatarioNotificacion.CAJERO,
        },
      });
    }
  } catch (err) {
    console.error("cron 08:30 reservas vencidas error", err);
  }
});

// Reservas retiro hoy (Cajero) — 09:00
cron.schedule("0 9 * * *", async () => {
  try {
    const { Reservado } = await getEstadoIds();
    if (Reservado == null) return;
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    const rows = await prisma.venta.findMany({
      where: {
        idEstadoVenta: Reservado,
        fechaReservaLimite: { not: null, gte: start, lte: end },
      },
      select: { idVenta: true },
    });
    if (rows.length > 0) {
      await prisma.notificacion.create({
        data: {
          tipo: TipoNotificacion.OTRO,
          mensaje: `Reservas para retiro hoy: ${rows.length}`,
          nivel: NivelNotificacion.INFO,
          destinatario: DestinatarioNotificacion.CAJERO,
          data: { code: "RESERVA_RETIRO_HOY" },
        },
      });
    }
  } catch (err) {
    console.error("cron 09:00 reservas retiro hoy error", err);
  }
});

// Cierre automático de ofertas vencidas (00:05)
cron.schedule("5 0 * * *", async () => {
  try {
    const ahora = new Date();
    const vencidos = await prisma.producto.findMany({
      where: {
        ofertaProducto: true,
        fechaFinOferta: { not: null, lt: ahora },
      },
      select: {
        idProducto: true,
        porcentajeOfertaProducto: true,
        fechaInicioOferta: true,
        fechaFinOferta: true,
      },
    });

    if (vencidos.length === 0) return;
    const ids = vencidos.map((p) => p.idProducto);

    await prisma.producto.updateMany({
      where: { idProducto: { in: ids } },
      data: { ofertaProducto: false },
    });

  for (const p of vencidos) {
      // Evitar duplicados: si el último registro coincide exactamente, no crear otro
      const last = await prisma.ofertaProductoHistorial.findFirst({
        where: { idProducto: p.idProducto },
        orderBy: { idOfertaProductoHistorial: "desc" },
        select: {
          ofertaProducto: true,
          porcentajeOfertaProducto: true,
          fechaInicio: true,
          fechaFin: true,
        },
      });
      const lastFi = last?.fechaInicio ? new Date(last.fechaInicio).getTime() : null;
      const lastFf = last?.fechaFin ? new Date(last.fechaFin).getTime() : null;
      const nextFi = p.fechaInicioOferta ? new Date(p.fechaInicioOferta).getTime() : null;
      const nextFf = p.fechaFinOferta ? new Date(p.fechaFinOferta).getTime() : null;
      const isSame = !!last &&
        last.ofertaProducto === false &&
        Number(last.porcentajeOfertaProducto ?? 0) === Number(p.porcentajeOfertaProducto ?? 0) &&
        lastFi === nextFi &&
        lastFf === nextFf;
      if (!isSame) {
        const systemUserId = await getSystemUserId();
        await prisma.ofertaProductoHistorial.create({
          data: {
            idProducto: p.idProducto,
            ofertaProducto: false,
            porcentajeOfertaProducto: Number(p.porcentajeOfertaProducto ?? 0),
            ...(p.fechaInicioOferta ? { fechaInicio: p.fechaInicioOferta } : {}),
            ...(p.fechaFinOferta ? { fechaFin: p.fechaFinOferta } : {}),
            creadoPor: systemUserId ?? null,
          },
        });
      }
    }

    console.log(`[INFO] Ofertas vencidas desactivadas: ${ids.join(", ")}`);
  } catch (err) {
    console.error("cron 00:05 cierre ofertas vencidas error", err);
  }
});

// Expira preventas y libera stock comprometido (cada 15 minutos)
cron.schedule("*/15 * * * *", async () => {
  try {
    const { Pendiente, Reservado, ListoCaja, Vencido } = await getEstadoIds();
    if (Pendiente == null || Reservado == null || ListoCaja == null || Vencido == null) return;

    const now = new Date();
    const vencidas = await prisma.venta.findMany({
      where: {
        fechaVencimiento: { not: null, lt: now },
        idEstadoVenta: { in: [Pendiente, Reservado, ListoCaja] },
      },
      select: { idVenta: true, idEstadoVenta: true },
    });

    if (vencidas.length === 0) return;

    const systemUserId = await getSystemUserId();
    for (const v of vencidas) {
      await liberarComprometidoVenta(v.idVenta);
      await prisma.venta.update({
        where: { idVenta: v.idVenta },
        data: { idEstadoVenta: Vencido, estadoPago: 'PENDIENTE' },
      });
      if (systemUserId) {
        await prisma.ventaEvento.create({
          data: {
            idVenta: v.idVenta,
            idUsuario: systemUserId,
            estadoDesde: v.idEstadoVenta,
            estadoHasta: Vencido,
            motivo: 'vencida automáticamente',
          },
        });
        await prisma.ventaActor.create({
          data: { idVenta: v.idVenta, idUsuario: systemUserId, papel: PapelEnVenta.ANULADOR },
        });
      }
    }

    console.log(`[INFO] Preventas vencidas marcadas y stock liberado: ${vencidas.map(x => x.idVenta).join(', ')}`);
  } catch (err) {
    console.error("cron expirar preventas error", err);
  }
});

cron.schedule("30 19 * * *", async () => {
  try {
    const systemUserId = await getSystemUserId();
    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0,0,0,0);
    const endToday = new Date(now); endToday.setHours(23,59,59,999);
    const y = new Date(now); y.setDate(y.getDate() - 1); y.setHours(0,0,0,0);
    const yEnd = new Date(now); yEnd.setDate(yEnd.getDate() - 1); yEnd.setHours(23,59,59,999);

    const cierreHoy = await prisma.cierreCaja.findFirst({ where: { fecha: { gte: startToday, lte: endToday } } });
    if (!cierreHoy) {
      const exists = await prisma.notificacion.findFirst({
        where: {
          tipo: TipoNotificacion.CIERRE_CAJA_PENDIENTE,
          createdAt: { gte: startToday },
          mensaje: { equals: `Fecha sin cierre: ${startToday.toISOString().slice(0,10)}` },
        },
      });
      if (!exists) {
        for (const dest of [DestinatarioNotificacion.ADMIN, DestinatarioNotificacion.CAJERO]) {
          await prisma.notificacion.create({
            data: {
              tipo: TipoNotificacion.CIERRE_CAJA_PENDIENTE,
              mensaje: `Fecha sin cierre: ${startToday.toISOString().slice(0,10)}`,
              nivel: NivelNotificacion.WARN,
              idUsuario: systemUserId ?? null,
              destinatario: dest,
            },
          });
        }
      }
    }

    const cierreAyer = await prisma.cierreCaja.findFirst({ where: { fecha: { gte: y, lte: yEnd } } });
    if (!cierreAyer) {
      const existsPrev = await prisma.notificacion.findFirst({
        where: {
          tipo: TipoNotificacion.CIERRE_CAJA_PENDIENTE,
          createdAt: { gte: startToday },
          mensaje: { equals: `Cierre pendiente día anterior: ${y.toISOString().slice(0,10)}` },
        },
      });
      if (!existsPrev) {
        for (const dest of [DestinatarioNotificacion.ADMIN, DestinatarioNotificacion.CAJERO]) {
          await prisma.notificacion.create({
            data: {
              tipo: TipoNotificacion.CIERRE_CAJA_PENDIENTE,
              mensaje: `Cierre pendiente día anterior: ${y.toISOString().slice(0,10)}`,
              nivel: NivelNotificacion.WARN,
              idUsuario: systemUserId ?? null,
              destinatario: dest,
            },
          });
        }
      }
    }

    // Ventas en ListoCaja pendientes de cobro (Cajero) — 19:30
    try {
      const estados = await getEstadoIds();
      const idLC = estados.ListoCaja;
      if (idLC != null) {
        const ventasLC = await prisma.venta.findMany({
          where: { idEstadoVenta: idLC, fechaVenta: { gte: startToday, lte: endToday } },
          select: { idVenta: true, idCliente: true, Cliente: { select: { nombreCliente: true, apellidoCliente: true } }, fechaVenta: true },
        });
        if (ventasLC.length > 0) {
          const top5 = ventasLC.slice(0, 5);
          const resumenParts: string[] = [];
          for (const v of top5) {
            const cliente = v.Cliente ? (v.Cliente.apellidoCliente + ", " + v.Cliente.nombreCliente) : String(v.idCliente);
            const hora = v.fechaVenta ? new Date(v.fechaVenta).toTimeString().slice(0,5) : "";
            const total = await calcularTotalBasico(v.idVenta);
            resumenParts.push(`#${v.idVenta} ${cliente} $${total.toFixed(2)} ${hora}`);
          }
          const resumen = resumenParts.join("; ");
          await prisma.notificacion.create({
            data: {
              tipo: TipoNotificacion.OTRO,
              mensaje: `Ventas pendientes de cobro: ${ventasLC.length}. ${resumen}`,
              nivel: NivelNotificacion.WARN,
              destinatario: DestinatarioNotificacion.CAJERO,
              data: { code: "VENTA_PENDIENTE_COBRO_CAJERO" },
            },
          });
        }
      }
    } catch (err) {
      console.error("cron 19:30 ventas pendientes cobro cajero error", err);
    }

    // Presupuestos por vencer (Vendedor) — 19:30
    try {
      const estados = await getEstadoIds();
      const idPend = estados.Pendiente;
      if (idPend != null) {
        const presupuestos = await prisma.venta.findMany({
          where: { idEstadoVenta: idPend, fechaVenta: { gte: startToday, lte: endToday } },
          select: { idVenta: true, idCliente: true, Cliente: { select: { nombreCliente: true, apellidoCliente: true } } },
        });
        if (presupuestos.length > 0) {
          const resumen = presupuestos.slice(0, 5).map((v) => `#${v.idVenta} ${(v.Cliente ? (v.Cliente.apellidoCliente + ", " + v.Cliente.nombreCliente) : String(v.idCliente))}`).join("; ");
          await prisma.notificacion.create({
            data: {
              tipo: TipoNotificacion.PRESUPUESTOS_PENDIENTES,
              mensaje: `Presupuestos por vencer hoy: ${presupuestos.length}. ${resumen}`,
              nivel: NivelNotificacion.WARN,
              destinatario: DestinatarioNotificacion.VENDEDOR,
            },
          });
        }
      }
    } catch (err) {
      console.error("cron 19:30 presupuestos por vencer vendedor error", err);
    }
  } catch (err) {
    console.error("cron 19:30 cierre caja pendiente error", err);
  }
});