"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
/**
 * Deduplica registros consecutivos idénticos en OfertaProductoHistorial
 * Conserva el último registro de cada bloque de cambios idénticos
 * (misma combinación de: ofertaProducto, porcentaje, fechaInicio, fechaFin).
 */
async function main() {
    const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
    const prisma = new client_1.PrismaClient({ adapter: new adapter_pg_1.PrismaPg(pool) });
    try {
        const rows = await prisma.ofertaProductoHistorial.findMany({
            orderBy: [{ idProducto: "asc" }, { idOfertaProductoHistorial: "asc" }],
            select: {
                idOfertaProductoHistorial: true,
                idProducto: true,
                ofertaProducto: true,
                porcentajeOfertaProducto: true,
                fechaInicio: true,
                fechaFin: true,
            },
        });
        let deletedIds = [];
        let currentGroupKey = null;
        let currentGroup = [];
        let lastProducto = null;
        const makeKey = (r) => {
            const fi = r.fechaInicio ? new Date(r.fechaInicio).getTime() : null;
            const ff = r.fechaFin ? new Date(r.fechaFin).getTime() : null;
            return `${r.idProducto}|${r.ofertaProducto ? 1 : 0}|${Number(r.porcentajeOfertaProducto ?? 0)}|${fi}|${ff}`;
        };
        const flushGroup = () => {
            if (currentGroup.length <= 1)
                return;
            // conservar el último, borrar los anteriores
            const keepLast = currentGroup[currentGroup.length - 1].id;
            for (const g of currentGroup) {
                if (g.id !== keepLast)
                    deletedIds.push(g.id);
            }
            currentGroup = [];
            currentGroupKey = null;
        };
        for (const r of rows) {
            const key = makeKey(r);
            if (lastProducto !== r.idProducto) {
                // nuevo producto: flush del grupo anterior
                flushGroup();
                lastProducto = r.idProducto;
                currentGroupKey = null;
                currentGroup = [];
            }
            if (currentGroupKey == null || currentGroupKey !== key) {
                // cerramos el grupo anterior y comenzamos uno nuevo
                flushGroup();
                currentGroupKey = key;
                currentGroup = [{ id: r.idOfertaProductoHistorial, key }];
            }
            else {
                // mismo key (idéntico a registro anterior): acumular para dedupe
                currentGroup.push({ id: r.idOfertaProductoHistorial, key });
            }
        }
        // flush final
        flushGroup();
        if (deletedIds.length === 0) {
            console.log("No se encontraron duplicados consecutivos para eliminar.");
            await prisma.$disconnect();
            return;
        }
        const chunk = (arr, size) => {
            const out = [];
            for (let i = 0; i < arr.length; i += size)
                out.push(arr.slice(i, i + size));
            return out;
        };
        const chunks = chunk(deletedIds, 500);
        for (const ids of chunks) {
            await prisma.ofertaProductoHistorial.deleteMany({
                where: { idOfertaProductoHistorial: { in: ids } },
            });
        }
        console.log(`Eliminados ${deletedIds.length} registros duplicados de oferta.`);
    }
    catch (err) {
        console.error("Error en dedupe de historial de ofertas:", err);
    }
}
main();
