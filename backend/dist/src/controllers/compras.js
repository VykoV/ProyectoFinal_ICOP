"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.getById = getById;
exports.create = create;
exports.update = update;
exports.remove = remove;
exports.confirmar = confirmar;
exports.aplicarStock = aplicarStock;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const compras_1 = require("../validators/compras");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter: new adapter_pg_1.PrismaPg(pool) });
const calcTotal = (items) => items.reduce((acc, i) => acc + i.cantidad * i.precioUnit, 0);
async function list(req, res) {
    const q = compras_1.comprasQuery.parse(req.query);
    const where = {};
    if (q.proveedor)
        where.idProveedor = q.proveedor;
    if (q.desde || q.hasta) {
        where.fechaComprobanteCompra = {};
        if (q.desde)
            where.fechaComprobanteCompra.gte = q.desde;
        if (q.hasta)
            where.fechaComprobanteCompra.lte = q.hasta;
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
async function getById(req, res) {
    const id = Number(req.params.id);
    const row = await prisma.compra.findUnique({
        where: { id },
        include: { Proveedor: true, MetodoPago: true, Moneda: true, detalles: { include: { Producto: true } } },
    });
    if (!row)
        return res.sendStatus(404);
    res.json(row);
}
async function create(req, res) {
    const body = compras_1.compraCreate.parse(req.body);
    const dup = await prisma.compra.findFirst({
        where: { idProveedor: body.idProveedor, nroFactura: body.nroFactura },
    });
    if (dup)
        return res.status(409).json({ error: "nroFactura ya existe para este proveedor" });
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
            estado: client_1.EstadoCompra.PendientePago,
            detalles: { create: body.items },
        },
    });
    res.status(201).json(created);
}
async function update(req, res) {
    const id = Number(req.params.id);
    const c = await prisma.compra.findUnique({ where: { id }, include: { detalles: true } });
    if (!c)
        return res.sendStatus(404);
    if (c.estado !== client_1.EstadoCompra.PendientePago)
        return res.status(409).json({ error: "Solo se edita en Pendiente de pago" });
    // si está bloqueada la edición, no permitir cambios
    if (c.edicionBloqueada)
        return res.status(409).json({ error: "Edición bloqueada" });
    const body = compras_1.compraUpdate.parse(req.body);
    // acción administrativa: lock/unlock sin modificar estado
    if (body.accion === "lock" || body.accion === "unlock") {
        const updated = await prisma.compra.update({
            where: { id },
            data: { edicionBloqueada: body.accion === "lock" },
        });
        return res.json(updated);
    }
    const items = body.items ?? c.detalles.map((d) => ({ idProducto: d.idProducto, cantidad: Number(d.cantidad), precioUnit: Number(d.precioUnit) }));
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
async function remove(req, res) {
    const id = Number(req.params.id);
    const c = await prisma.compra.findUnique({ where: { id } });
    if (!c)
        return res.sendStatus(404);
    if (c.estado !== client_1.EstadoCompra.PendientePago)
        return res.status(409).json({ error: "Solo se elimina en Pendiente de pago" });
    if (c.edicionBloqueada)
        return res.status(409).json({ error: "Edición bloqueada" });
    await prisma.compra.delete({ where: { id } });
    res.sendStatus(204);
}
// aplica stock en base a los detalles, sin cambiar el estado
//
async function confirmar(req, res) {
    const id = Number(req.params.id);
    const c = await prisma.compra.findUnique({ where: { id } });
    if (!c)
        return res.sendStatus(404);
    if (c.estado !== client_1.EstadoCompra.PendientePago)
        return res.status(409).json({ error: "Ya confirmada" });
    await prisma.compra.update({ where: { id }, data: { estado: client_1.EstadoCompra.Finalizado } });
    res.sendStatus(204);
}
// aplicar stock y bloquear edición, sin cambiar estado
async function aplicarStock(req, res) {
    const id = Number(req.params.id);
    const c = await prisma.compra.findUnique({ where: { id }, include: { detalles: true } });
    if (!c)
        return res.sendStatus(404);
    if (c.estado !== client_1.EstadoCompra.PendientePago)
        return res.status(409).json({ error: "Solo se aplica stock en Pendiente de pago" });
    await prisma.$transaction(async (tx) => {
        // 1) Actualizar stock
        for (const d of c.detalles) {
            await tx.stock.upsert({
                where: { idProducto: d.idProducto },
                create: {
                    idProducto: d.idProducto,
                    bajoMinimoStock: new client_1.Prisma.Decimal(0),
                    cantidadRealStock: new client_1.Prisma.Decimal(Number(d.cantidad)),
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
                    precioHistorico: new client_1.Prisma.Decimal(Number(d.precioUnit)),
                },
            });
        }
        // 3) Bloquear edición
        await tx.compra.update({ where: { id }, data: { edicionBloqueada: true } });
    });
    res.sendStatus(204);
}
