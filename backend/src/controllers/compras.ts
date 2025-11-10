import { Request, Response } from "express";
import { PrismaClient, EstadoCompra, Prisma } from "@prisma/client";
import { compraCreate, compraUpdate, comprasQuery } from "../validators/compras";

const prisma = new PrismaClient();

const calcTotal = (items: { cantidad: number; precioUnit: number }[]) =>
  items.reduce((acc, i) => acc + i.cantidad * i.precioUnit, 0);

export async function list(req: Request, res: Response) {
  const q = comprasQuery.parse(req.query);
  const where: any = {};
  if (q.proveedor) where.idProveedor = q.proveedor;
  if (q.desde || q.hasta) {
    where.fechaComprobanteCompra = {};
    if (q.desde) where.fechaComprobanteCompra.gte = q.desde;
    if (q.hasta) where.fechaComprobanteCompra.lte = q.hasta;
  }
  const [total, rows] = await Promise.all([
    prisma.compra.count({ where }),
    prisma.compra.findMany({
      where,
      orderBy: { fechaComprobanteCompra: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: { Proveedor: true, MetodoPago: true, Moneda: true, detalles: true },
    }),
  ]);
  res.json({ total, page: q.page, limit: q.limit, rows });
}

export async function getById(req: Request, res: Response) {
  const id = Number(req.params.id);
  const row = await prisma.compra.findUnique({
    where: { id },
    include: { Proveedor: true, MetodoPago: true, Moneda: true, detalles: { include: { Producto: true } } },
  });
  if (!row) return res.sendStatus(404);
  res.json(row);
}

export async function create(req: Request, res: Response) {
  const body = compraCreate.parse(req.body);
  const dup = await prisma.compra.findFirst({
    where: { idProveedor: body.idProveedor, nroFactura: body.nroFactura },
  });
  if (dup) return res.status(409).json({ error: "nroFactura ya existe para este proveedor" });

  const total = calcTotal(body.items);

  const created = await prisma.compra.create({
    data: {
      idProveedor: body.idProveedor,
      idMetodoPago: body.idMetodoPago,
      idMoneda: body.idMoneda,
      fechaComprobanteCompra: body.fechaComprobanteCompra,
      nroFactura: body.nroFactura,
      observacion: body.observacion ?? null,
      total,
      estado: EstadoCompra.PendientePago,
      detalles: { create: body.items },
    },
  });
  res.status(201).json(created);
}

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c = await prisma.compra.findUnique({ where: { id }, include: { detalles: true } });
  if (!c) return res.sendStatus(404);
  if (c.estado !== EstadoCompra.PendientePago)
    return res.status(409).json({ error: "Solo se edita en Pendiente de pago" });

  // si está bloqueada la edición, no permitir cambios
  if ((c as any).edicionBloqueada)
    return res.status(409).json({ error: "Edición bloqueada" });

  const body = compraUpdate.parse(req.body);

  // acción administrativa: lock/unlock sin modificar estado
  if ((body as any).accion === "lock" || (body as any).accion === "unlock") {
    const updated = await prisma.compra.update({
      where: { id },
      data: { edicionBloqueada: (body as any).accion === "lock" },
    });
    return res.json(updated);
  }
  const items =
    body.items ?? c.detalles.map((d) => ({ idProducto: d.idProducto, cantidad: Number(d.cantidad), precioUnit: Number(d.precioUnit) }));
  const total = calcTotal(items);

  const updated = await prisma.$transaction(async (tx) => {
    if (body.items) {
      await tx.detalleCompra.deleteMany({ where: { idCompra: id } });
      await tx.detalleCompra.createMany({ data: items.map((i) => ({ ...i, idCompra: id })) });
    }
    return tx.compra.update({
      where: { id },
      data: {
        idMetodoPago: body.idMetodoPago ?? c.idMetodoPago,
        idMoneda: body.idMoneda ?? c.idMoneda,
        fechaComprobanteCompra: body.fechaComprobanteCompra ?? c.fechaComprobanteCompra,
        observacion: body.observacion ?? c.observacion,
        total,
      },
    });
  });

  res.json(updated);
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c = await prisma.compra.findUnique({ where: { id } });
  if (!c) return res.sendStatus(404);
  if (c.estado !== EstadoCompra.PendientePago)
    return res.status(409).json({ error: "Solo se elimina en Pendiente de pago" });

  if ((c as any).edicionBloqueada)
    return res.status(409).json({ error: "Edición bloqueada" });

  await prisma.compra.delete({ where: { id } });
  res.sendStatus(204);
}

// aplica stock en base a los detalles, sin cambiar el estado
//

export async function confirmar(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c = await prisma.compra.findUnique({ where: { id } });
  if (!c) return res.sendStatus(404);
  if (c.estado !== EstadoCompra.PendientePago)
    return res.status(409).json({ error: "Ya confirmada" });
  await prisma.compra.update({ where: { id }, data: { estado: EstadoCompra.Finalizado } });
  res.sendStatus(204);
}

// aplicar stock y bloquear edición, sin cambiar estado
export async function aplicarStock(req: Request, res: Response) {
  const id = Number(req.params.id);
  const c = await prisma.compra.findUnique({ where: { id }, include: { detalles: true } });
  if (!c) return res.sendStatus(404);
  if (c.estado !== EstadoCompra.PendientePago)
    return res.status(409).json({ error: "Solo se aplica stock en Pendiente de pago" });
  await prisma.$transaction(async (tx) => {
    // 1) Actualizar stock
    for (const d of c.detalles) {
      await tx.stock.upsert({
        where: { idProducto: d.idProducto },
        create: {
          idProducto: d.idProducto,
          bajoMinimoStock: new Prisma.Decimal(0),
          cantidadRealStock: new Prisma.Decimal(Number(d.cantidad)),
          ultimaModificacionStock: new Date(),
        },
        update: {
          cantidadRealStock: { increment: Number(d.cantidad) },
          ultimaModificacionStock: new Date(),
        },
      });
    }

    // 2) Registrar precio histórico proveedor-producto
    for (const d of c.detalles) {
      await tx.proveedorProducto.create({
        data: {
          idProveedor: c.idProveedor,
          idProducto: d.idProducto,
          codigoArticuloProveedor: "",
          fechaIngreso: c.fechaComprobanteCompra,
          precioHistorico: new Prisma.Decimal(Number(d.precioUnit)),
        },
      });
    }

    // 3) Bloquear edición
    await tx.compra.update({ where: { id }, data: { edicionBloqueada: true } });
  });

  res.sendStatus(204);
}