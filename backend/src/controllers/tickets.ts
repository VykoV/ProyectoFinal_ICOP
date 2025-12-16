import { Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import PDFDocument from "pdfkit";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Configuración de negocio
const COMERCIO_NOMBRE = process.env.COMERCIO_NOMBRE || "Lanería Q'Le";
const COMERCIO_DIRECCION = process.env.COMERCIO_DIRECCION || "";
const COMERCIO_TELEFONO = process.env.COMERCIO_TELEFONO || "";

const IVA_RATE = Number(process.env.IVA_RATE ?? 0.21);

// Helper para totales (reutilizado de server.ts logic)
async function calcularTotales(idVenta: number) {
  const venta = await prisma.venta.findUnique({
    where: { idVenta },
    select: {
      descuentoGeneralVenta: true,
      recargoPagoVenta: true,
      detalles: {
        select: {
          cantidad: true,
          precioUnit: true,
          descuentoItem: true,
          recargoItem: true,
        },
      },
    },
  });
  if (!venta) return { importeArticulos: 0, totalFinal: 0, subtotal: 0, descuentoGeneralMonto: 0, recargoPagoMonto: 0 };

  const importeArticulos = venta.detalles.reduce((acc, d) => {
    const cantidad = Number(d.cantidad ?? 0);
    const pu = Number(d.precioUnit ?? 0);
    const base = cantidad * pu;
    const descPct = Number(d.descuentoItem ?? 0) / 100;
    const recPct = Number(d.recargoItem ?? 0) / 100;
    const conDesc = base * (1 - descPct);
    const conRecargo = conDesc * (1 + recPct);
    return acc + conRecargo;
  }, 0);

  const descGeneralPct = Number(venta.descuentoGeneralVenta ?? 0) / 100;
  const recargoPagoPct = Number(venta.recargoPagoVenta ?? 0) / 100;
  const totalConDescuento = importeArticulos * (1 - descGeneralPct);
  const totalFinal = totalConDescuento * (1 + recargoPagoPct);

  return {
    importeArticulos, // Suma de líneas (ya con desc/rec de línea)
    totalFinal,
    descuentoGeneralMonto: importeArticulos * descGeneralPct,
    recargoPagoMonto: totalConDescuento * recargoPagoPct
  };
}

// Generador genérico de Ticket
async function generateTicketPDF(res: Response, type: 'presupuesto' | 'venta', id: number) {
  try {
    const venta = await prisma.venta.findUnique({
      where: { idVenta: id },
      include: {
        Cliente: true,
        Usuario: true, // Vendedor o Cajero
        TipoPago: true,
        detalles: {
          include: { Producto: true }
        },
        actores: {
          where: { papel: 'CREADOR' },
          take: 1
        }
      }
    });

    if (!venta) return res.status(404).json({ error: "NOT_FOUND" });

    // Intentar obtener fecha/hora real de creación
    const fechaHora = venta.actores?.[0]?.createdAt ?? venta.fechaVenta ?? new Date();

    const totales = await calcularTotales(id);

    // Configurar PDF
    // 80mm ancho ~ 226pt. Alto dinámico (auto). Margen pequeño.
    const doc = new PDFDocument({
      size: [226, 800], // Altura inicial arbitraria, pdfkit paginará si es necesario, pero para tickets térmicos idealmente es una página larga. 
      // Nota: PDFKit no soporta altura "infinita" nativamente fácil, pero para descargar un archivo está bien.
      // Ajustamos margins
      margins: { top: 10, bottom: 10, left: 10, right: 10 },
      autoFirstPage: false
    });

    // Buffer de salida
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      const filenameType = type === 'venta' ? 'factura' : type;
      res.setHeader('Content-Disposition', `attachment; filename=ticket-${filenameType}-${id}.pdf`);
      res.send(pdfData);
    });

    // Iniciar página con altura suficiente (calculada o fija larga)
    // Para tickets, a veces se usa una altura muy grande para evitar saltos de página
    doc.addPage({ size: [226, 1000], margins: { top: 10, bottom: 10, left: 10, right: 10 } });

    // Estilos base
    doc.font('Helvetica').fontSize(9);

    // --- ENCABEZADO ---
    doc.fontSize(10).font('Helvetica-Bold').text(COMERCIO_NOMBRE, { align: 'center' });
    if (COMERCIO_DIRECCION) doc.fontSize(8).font('Helvetica').text(COMERCIO_DIRECCION, { align: 'center' });
    if (COMERCIO_TELEFONO) doc.text(`Tel: ${COMERCIO_TELEFONO}`, { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica');
    const title = type === 'presupuesto' ? 'PRESUPUESTO' : 'TICKET DE VENTA';
    doc.font('Helvetica-Bold').text(`${title} N° ${id}`, { align: 'center' });

    doc.moveDown(0.5);
    doc.font('Helvetica').text(`Fecha: ${fechaHora.toLocaleString()}`);

    if (type === 'presupuesto') {
      // Vendedor? El usuario de la venta se asume vendedor en preventa
      if (venta.Usuario) doc.text(`Vendedor: ${venta.Usuario.nombreUsuario}`);
    } else {
      if (venta.Usuario) doc.text(`Cajero: ${venta.Usuario.nombreUsuario}`);
    }

    if (venta.Cliente) {
      doc.text(`Cliente: ${venta.Cliente.nombreCliente} ${venta.Cliente.apellidoCliente}`);
      if (venta.Cliente.cuil) doc.text(`CUIT/DNI: ${venta.Cliente.cuil}`);
      if (venta.Cliente.telefonoCliente) doc.text(`Tel: ${venta.Cliente.telefonoCliente}`);
    } else {
      doc.text(`Cliente: Consumidor Final`);
    }

    doc.moveDown(0.5);
    doc.text('------------------------------------------', { align: 'center' });
    doc.moveDown(0.5);

    // --- DETALLE ---
    // Col headers: Cant | Desc | Total
    // Layout simplificado:
    // Producto
    // Cant x PrecioU = Subtotal

    venta.detalles.forEach(d => {
      const nombre = d.Producto?.nombreProducto || `Item #${d.idProducto}`;
      const cant = Number(d.cantidad);
      const precio = Number(d.precioUnit);
      // Calcular subtotal línea con desc/recargo
      const base = cant * precio;
      const descPct = Number(d.descuentoItem ?? 0) / 100;
      const recPct = Number(d.recargoItem ?? 0) / 100;
      const totalLinea = base * (1 - descPct) * (1 + recPct);

      doc.font('Helvetica').text(nombre);

      let detalleStr = `${cant} x $${precio.toFixed(2)}`;
      if (descPct > 0) detalleStr += ` (Desc ${Number(d.descuentoItem)}%)`;
      if (recPct > 0) detalleStr += ` (Rec ${Number(d.recargoItem)}%)`;

      // Alinear montos a la derecha es difícil sin tablas, usamos x position manual
      const y = doc.y;
      doc.text(detalleStr, { width: 140 }); // Dejar espacio para el total
      doc.text(`$${totalLinea.toFixed(2)}`, 150, y, { align: 'right', width: 60 });
      doc.moveDown(0.2);
    });

    doc.moveDown(0.5);
    doc.text('------------------------------------------', 10, doc.y, { align: 'center' });
    doc.moveDown(0.5);

    // --- TOTALES ---
    const startXLabel = 60;
    const startXValue = 150;
    const widthValue = 60;

    // Subtotal (suma de líneas)
    doc.text('Subtotal:', startXLabel, doc.y, { align: 'right', width: 80 });
    doc.text(`$${totales.importeArticulos.toFixed(2)}`, startXValue, doc.y - doc.currentLineHeight(), { align: 'right', width: widthValue });

    if (totales.descuentoGeneralMonto > 0) {
      doc.text(`Desc. Gral (${Number(venta.descuentoGeneralVenta)}%):`, 10, doc.y, { align: 'right', width: 130 });
      doc.text(`-$${totales.descuentoGeneralMonto.toFixed(2)}`, startXValue, doc.y - doc.currentLineHeight(), { align: 'right', width: widthValue });
    }

    if (totales.recargoPagoMonto > 0) {
      doc.text(`Recargo (${Number(venta.recargoPagoVenta)}%):`, 10, doc.y, { align: 'right', width: 130 });
      doc.text(`+$${totales.recargoPagoMonto.toFixed(2)}`, startXValue, doc.y - doc.currentLineHeight(), { align: 'right', width: widthValue });
    }

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('TOTAL:', startXLabel, doc.y, { align: 'right', width: 80 });
    doc.text(`$${totales.totalFinal.toFixed(2)}`, startXValue, doc.y - doc.currentLineHeight(), { align: 'right', width: widthValue });

    // --- PIE ---
    doc.font('Helvetica').fontSize(8);
    doc.moveDown(1);

    if (type === 'presupuesto' && venta.fechaVencimiento) {
      doc.text(`Válido hasta: ${new Date(venta.fechaVencimiento).toLocaleDateString()}`, { align: 'center' });
    }

    if (type === 'venta') {
      if (venta.TipoPago) {
        doc.text(`Forma de Pago: ${venta.TipoPago.tipoPago}`, { align: 'center' });
        doc.text(`Monto: $${totales.totalFinal.toFixed(2)}`, { align: 'center' });
      }
      doc.moveDown(0.5);
      // Mensaje fiscal o cierre
      doc.text('Comprobante no válido como factura fiscal', { align: 'center', oblique: true });
    }

    doc.moveDown(1);
    doc.text('¡Gracias por su visita!', { align: 'center' });

    doc.end();

  } catch (error) {
    console.error("Error generando ticket PDF:", error);
    res.status(500).json({ error: "PDF_GENERATION_FAILED" });
  }
}

export async function getPresupuestoTicket(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID_INVALIDO" });
  return generateTicketPDF(res, 'presupuesto', id);
}

export async function getVentaTicket(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID_INVALIDO" });
  return generateTicketPDF(res, 'venta', id);
}
