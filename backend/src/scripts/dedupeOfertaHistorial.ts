import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Deduplica registros consecutivos idénticos en OfertaProductoHistorial
 * Conserva el último registro de cada bloque de cambios idénticos
 * (misma combinación de: ofertaProducto, porcentaje, fechaInicio, fechaFin).
 */
async function main() {
  const prisma = new PrismaClient();
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

    let deletedIds: number[] = [];
    let currentGroupKey: string | null = null;
    let currentGroup: { id: number; key: string }[] = [];
    let lastProducto: number | null = null;

    const makeKey = (r: any) => {
      const fi = r.fechaInicio ? new Date(r.fechaInicio).getTime() : null;
      const ff = r.fechaFin ? new Date(r.fechaFin).getTime() : null;
      return `${r.idProducto}|${r.ofertaProducto ? 1 : 0}|${Number(r.porcentajeOfertaProducto ?? 0)}|${fi}|${ff}`;
    };

    const flushGroup = () => {
      if (currentGroup.length <= 1) return;
      // conservar el último, borrar los anteriores
      const keepLast = currentGroup[currentGroup.length - 1].id;
      for (const g of currentGroup) {
        if (g.id !== keepLast) deletedIds.push(g.id);
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
      } else {
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

    const chunk = (arr: number[], size: number) => {
      const out: number[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    const chunks = chunk(deletedIds, 500);
    for (const ids of chunks) {
      await prisma.ofertaProductoHistorial.deleteMany({
        where: { idOfertaProductoHistorial: { in: ids } },
      });
    }
    console.log(`Eliminados ${deletedIds.length} registros duplicados de oferta.`);
  } catch (err) {
    console.error("Error en dedupe de historial de ofertas:", err);
  }
}

main();