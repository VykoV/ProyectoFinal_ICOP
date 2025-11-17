"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
