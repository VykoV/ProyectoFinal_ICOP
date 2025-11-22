"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter: new adapter_pg_1.PrismaPg(pool) });
// Obtiene o crea un usuario "Sistema" para auditoría
async function getSystemUserId() {
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
    }
    catch (err) {
        console.error("cron:getSystemUserId error", err);
        return null;
    }
}
async function getEstadoPendienteId() {
    try {
        const e = await prisma.estadoVenta.findFirst({
            where: { nombreEstadoVenta: { equals: "Pendiente", mode: "insensitive" } },
            select: { idEstadoVenta: true },
        });
        return e?.idEstadoVenta ?? null;
    }
    catch (err) {
        console.error("cron:getEstadoPendienteId error", err);
        return null;
    }
}
async function getEstadoIds() {
    try {
        const estados = await prisma.estadoVenta.findMany({
            where: { nombreEstadoVenta: { in: ["Pendiente", "Reservado", "ListoCaja", "Vencido"] } },
            select: { idEstadoVenta: true, nombreEstadoVenta: true },
        });
        const map = {
            Pendiente: null,
            Reservado: null,
            ListoCaja: null,
            Vencido: null,
        };
        for (const e of estados)
            map[e.nombreEstadoVenta] = e.idEstadoVenta;
        return map;
    }
    catch (err) {
        console.error("cron:getEstadoIds error", err);
        return { Pendiente: null, Reservado: null, ListoCaja: null, Vencido: null };
    }
}
async function liberarComprometidoVenta(idVenta) {
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
// Aviso diario “revisar cotización” (11:00)
node_cron_1.default.schedule("0 11 * * *", async () => {
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
    }
    catch (err) {
        console.error("cron 11:00 revisar cotización error", err);
    }
});
// Recordatorio de reservas vencidas (08:30)
node_cron_1.default.schedule("30 8 * * *", async () => {
    try {
        const pendienteId = await getEstadoPendienteId();
        if (!pendienteId)
            return;
        const vencidas = await prisma.venta.findMany({
            where: {
                idEstadoVenta: pendienteId,
                fechaReservaLimite: { not: null, lt: new Date() },
            },
            select: { idVenta: true },
        });
        if (vencidas.length > 0) {
            const msg = `Reservas vencidas: ${vencidas.map(v => v.idVenta).join(", ")}`;
            console.warn(`[WARN] ${msg}`);
            // Opcional: automatizar liberación llamando al servicio correspondiente
            // for (const v of vencidas) await liberarReserva(v.idVenta)
            // Si luego agregas una tabla de logs, registra aquí
            // await prisma.log.create({ data: { nivel: 'WARN', mensaje: msg } });
        }
    }
    catch (err) {
        console.error("cron 08:30 reservas vencidas error", err);
    }
});
// Cierre automático de ofertas vencidas (00:05)
node_cron_1.default.schedule("5 0 * * *", async () => {
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
        if (vencidos.length === 0)
            return;
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
    }
    catch (err) {
        console.error("cron 00:05 cierre ofertas vencidas error", err);
    }
});
// Expira preventas y libera stock comprometido (cada 15 minutos)
node_cron_1.default.schedule("*/15 * * * *", async () => {
    try {
        const { Pendiente, Reservado, ListoCaja, Vencido } = await getEstadoIds();
        if (Pendiente == null || Reservado == null || ListoCaja == null || Vencido == null)
            return;
        const now = new Date();
        const vencidas = await prisma.venta.findMany({
            where: {
                fechaVencimiento: { not: null, lt: now },
                idEstadoVenta: { in: [Pendiente, Reservado, ListoCaja] },
            },
            select: { idVenta: true, idEstadoVenta: true },
        });
        if (vencidas.length === 0)
            return;
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
                    data: { idVenta: v.idVenta, idUsuario: systemUserId, papel: client_1.PapelEnVenta.ANULADOR },
                });
            }
        }
        console.log(`[INFO] Preventas vencidas marcadas y stock liberado: ${vencidas.map(x => x.idVenta).join(', ')}`);
    }
    catch (err) {
        console.error("cron expirar preventas error", err);
    }
});
