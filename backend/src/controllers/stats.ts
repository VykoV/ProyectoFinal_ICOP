import { Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const parseDate = (d: any) => (d ? new Date(String(d)) : undefined);

// 1. Rotación de Stock
export async function getStockRotation(req: Request, res: Response) {
  try {
    const { from, to } = req.query;
    const startDate = parseDate(from);
    const endDate = parseDate(to);

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Fechas requeridas (from, to)" });
    }
    // Ajustar fin del día
    endDate.setHours(23, 59, 59, 999);

    // Ventas en el periodo
    const ventas = await prisma.detalleVenta.groupBy({
      by: ["idProducto"],
      _sum: { cantidad: true },
      where: {
        Venta: {
          fechaVenta: { gte: startDate, lte: endDate },
        },
      },
    });

    if (ventas.length === 0) {
      return res.json([]);
    }

    const productIds = ventas.map((v) => v.idProducto);
    const productos = await prisma.producto.findMany({
      where: { idProducto: { in: productIds } },
      include: { stocks: true },
    });

    const report = productos.map((p) => {
      const sold = Number(ventas.find((v) => v.idProducto === p.idProducto)?._sum.cantidad || 0);
      const stock = Number(p.stocks[0]?.cantidadRealStock || 0);
      // Rotación = Vendido / (Stock + Vendido). Si se vendió todo, rotación 1 (100%).
      const totalDisp = stock + sold;
      const rotacion = totalDisp > 0 ? sold / totalDisp : 0;

      return {
        id: p.idProducto,
        producto: p.nombreProducto,
        codigo: p.codigoProducto,
        unidadesVendidas: sold,
        stockActual: stock,
        rotacionEstimada: rotacion, // decimal 0-1
      };
    });

    // Ordenar: mayor rotación primero
    report.sort((a, b) => b.rotacionEstimada - a.rotacionEstimada);

    res.json(report);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al generar informe de rotación" });
  }
}

// 2. Productos Inmovilizados
export async function getStagnantProducts(req: Request, res: Response) {
  try {
    const months = Number(req.query.months || 3);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    cutoff.setHours(0, 0, 0, 0);

    // Productos SIN ventas desde cutoff y con stock positivo
    const products = await prisma.producto.findMany({
      where: {
        detalleVentas: {
          none: {
            Venta: {
              fechaVenta: { gte: cutoff },
            },
          },
        },
        stocks: {
          some: {
            cantidadRealStock: { gt: 0 },
          },
        },
      },
      include: {
        stocks: true,
        detalleVentas: {
          orderBy: { Venta: { fechaVenta: 'desc' } },
          take: 1,
          include: { Venta: { select: { fechaVenta: true } } }
        }
      },
    });

    const report = products.map(p => ({
      id: p.idProducto,
      producto: p.nombreProducto,
      codigo: p.codigoProducto,
      stockActual: Number(p.stocks[0]?.cantidadRealStock || 0),
      ultimoMovimiento: p.detalleVentas[0]?.Venta?.fechaVenta || null,
      precioCosto: Number(p.precioProducto),
      valorInmovilizado: Number(p.precioProducto) * Number(p.stocks[0]?.cantidadRealStock || 0)
    }));

    // Ordenar por valor inmovilizado descendente
    report.sort((a, b) => b.valorInmovilizado - a.valorInmovilizado);

    res.json(report);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al generar informe de inmovilizados" });
  }
}

// 3. Margen Estimado
export async function getEstimatedMargin(req: Request, res: Response) {
  try {
    const products = await prisma.producto.findMany({
      select: {
        idProducto: true,
        nombreProducto: true,
        codigoProducto: true,
        precioProducto: true, // Costo
        precioVentaPublicoProducto: true, // PVP
      }
    });

    const report = products.map(p => {
      const costo = Number(p.precioProducto);
      const pvp = Number(p.precioVentaPublicoProducto);
      const margen = pvp - costo;
      const margenPct = pvp > 0 ? (margen / pvp) * 100 : 0;

      return {
        id: p.idProducto,
        producto: p.nombreProducto,
        codigo: p.codigoProducto,
        costo,
        pvp,
        margen,
        margenPorcentaje: margenPct
      };
    });

    // Ordenar por margen % descendente (o ascendente para ver los peores?)
    // Generalmente interesa ver los de mayor margen o menor. Pondremos mayor primero.
    report.sort((a, b) => b.margenPorcentaje - a.margenPorcentaje);

    res.json(report);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al generar informe de margen" });
  }
}

// 4. Clientes Inactivos
export async function getInactiveClients(req: Request, res: Response) {
  try {
    const months = Number(req.query.months || 6);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    cutoff.setHours(0, 0, 0, 0);

    const clients = await prisma.cliente.findMany({
      where: {
        // Clientes que no tienen ventas en el periodo (o nunca tuvieron)
        ventas: {
          none: {
            fechaVenta: { gte: cutoff }
          }
        }
      },
      include: {
        ventas: {
          orderBy: { fechaVenta: 'desc' },
          take: 1,
          select: { fechaVenta: true }
        }
      }
    });

    const report = clients.map(c => ({
      id: c.idCliente,
      cliente: `${c.nombreCliente} ${c.apellidoCliente}`.trim(),
      email: c.emailCliente,
      telefono: c.telefonoCliente ? c.telefonoCliente.toString() : "",
      ultimaCompra: c.ventas[0]?.fechaVenta || null
    }));

    // Ordenar por fecha última compra (más antigua primero?) o nombre
    report.sort((a, b) => {
      if (!a.ultimaCompra) return 1;
      if (!b.ultimaCompra) return -1;
      return new Date(a.ultimaCompra).getTime() - new Date(b.ultimaCompra).getTime();
    });

    res.json(report);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al generar informe de clientes inactivos" });
  }
}

// 5. Dependencia Proveedor
export async function getProviderDependency(req: Request, res: Response) {
  try {
    const { from, to } = req.query;
    const startDate = parseDate(from);
    const endDate = parseDate(to);

    if (!startDate || !endDate) return res.status(400).json({ error: "Fechas requeridas" });
    endDate.setHours(23, 59, 59, 999);

    const compras = await prisma.compra.groupBy({
      by: ['idProveedor'],
      _sum: { total: true },
      where: {
        fechaComprobanteCompra: { gte: startDate, lte: endDate }
      }
    });

    const totalPeriodo = compras.reduce((acc, c) => acc + Number(c._sum.total || 0), 0);

    const providerIds = compras.map(c => c.idProveedor);
    const providers = await prisma.proveedor.findMany({
      where: { idProveedor: { in: providerIds } },
      select: { idProveedor: true, nombreProveedor: true }
    });

    const report = compras.map(c => {
      const prov = providers.find(p => p.idProveedor === c.idProveedor);
      const amount = Number(c._sum.total || 0);
      const share = totalPeriodo > 0 ? (amount / totalPeriodo) * 100 : 0;

      return {
        id: c.idProveedor,
        proveedor: prov?.nombreProveedor || `ID ${c.idProveedor}`,
        montoTotal: amount,
        porcentaje: share
      };
    });

    report.sort((a, b) => b.montoTotal - a.montoTotal);

    res.json(report);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al generar informe de proveedores" });
  }
}

// 6. Conversión Presupuestos
export async function getBudgetConversion(req: Request, res: Response) {
  try {
    const { from, to } = req.query;
    const startDate = parseDate(from);
    const endDate = parseDate(to);

    if (!startDate || !endDate) return res.status(400).json({ error: "Fechas requeridas" });
    endDate.setHours(23, 59, 59, 999);

    // Identificar estados
    const estados = await prisma.estadoVenta.findMany();
    // Pendiente suele ser "Presupuesto"
    const estPendiente = estados.find(e =>
      e.nombreEstadoVenta.toLowerCase().includes("pend") ||
      e.nombreEstadoVenta.toLowerCase().includes("presu")
    );
    // Finalizada
    const estFinal = estados.find(e =>
      e.nombreEstadoVenta.toLowerCase().includes("final") ||
      e.nombreEstadoVenta.toLowerCase().includes("cerrad")
    );

    if (!estPendiente || !estFinal) {
      return res.status(500).json({ error: "No se pudieron identificar estados de Venta (Pendiente/Finalizada)" });
    }

    // Presupuestos generados: Ventas creadas en rango con estado Pendiente
    // Asumiendo que fechaVenta es fecha creación.
    const generados = await prisma.venta.count({
      where: {
        fechaVenta: { gte: startDate, lte: endDate },
        idEstadoVenta: estPendiente.idEstadoVenta
      }
    });

    // Convertidos: Eventos de cambio de estado a Finalizada en el rango, desde Pendiente
    const convertidos = await prisma.ventaEvento.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        estadoHasta: estFinal.idEstadoVenta,
        estadoDesde: estPendiente.idEstadoVenta
      }
    });

    res.json({
      periodo: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      presupuestosGenerados: generados,
      ventasCerradasDesdePresupuesto: convertidos,
      tasaConversion: generados > 0 ? (convertidos / generados) * 100 : 0
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error al generar informe de conversión" });
  }
}
