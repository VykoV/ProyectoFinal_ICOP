"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = list;
exports.selectList = selectList;
exports.getById = getById;
exports.create = create;
exports.update = update;
exports.remove = remove;
exports.listProductosByProveedor = listProductosByProveedor;
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const proveedores_1 = require("../validators/proveedores");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter: new adapter_pg_1.PrismaPg(pool) });
async function list(req, res) {
    const q = proveedores_1.paginadoQuery.parse(req.query);
    const where = q.search
        ? {
            OR: [
                { nombreProveedor: { contains: q.search, mode: client_1.Prisma.QueryMode.insensitive } },
                { mailProveedor: { contains: q.search, mode: client_1.Prisma.QueryMode.insensitive } },
                { observacionProveedor: { contains: q.search, mode: client_1.Prisma.QueryMode.insensitive } },
            ],
        }
        : {};
    const [total, rows] = await Promise.all([
        prisma.proveedor.count({ where }),
        prisma.proveedor.findMany({
            where,
            orderBy: { nombreProveedor: "asc" },
            skip: (q.page - 1) * q.pageSize,
            take: q.pageSize,
            include: { Localidad: true },
        }),
    ]);
    res.json({ total, page: q.page, pageSize: q.pageSize, rows });
}
// lista simple para selects (id/nombre)
async function selectList(_req, res) {
    const rows = await prisma.proveedor.findMany({
        select: { idProveedor: true, nombreProveedor: true },
        orderBy: { idProveedor: "asc" },
    });
    res.json(rows.map(r => ({ id: r.idProveedor, nombre: r.nombreProveedor })));
}
async function getById(req, res) {
    const id = Number(req.params.id);
    const row = await prisma.proveedor.findUnique({
        where: { idProveedor: id },
        include: { Localidad: true },
    });
    if (!row)
        return res.sendStatus(404);
    res.json(row);
}
async function create(req, res) {
    const parsed = proveedores_1.proveedorIn.safeParse(req.body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return res.status(422).json({
            error: issue?.message || "Datos inválidos",
            field: issue?.path?.[0] ?? undefined,
        });
    }
    const data = parsed.data;
    // unicidad por CIF/NIF si viene informado
    if (data.CIF_NIFProveedor) {
        const exists = await prisma.proveedor.findFirst({
            where: { CIF_NIFProveedor: data.CIF_NIFProveedor },
        });
        if (exists)
            return res.status(409).json({ error: "CIF_NIF ya registrado" });
    }
    try {
        const row = await prisma.proveedor.create({ data });
        res.status(201).json(row);
    }
    catch (e) {
        if (e?.code === "P2002") {
            const target = e?.meta?.target?.[0];
            return res.status(409).json({
                error: "UNIQUE_CONSTRAINT",
                field: target || undefined,
            });
        }
        console.error(e);
        res.status(400).json({ error: "CREATE_FAILED" });
    }
}
async function update(req, res) {
    const id = Number(req.params.id);
    const parsed = proveedores_1.proveedorIn.safeParse(req.body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return res.status(422).json({
            error: issue?.message || "Datos inválidos",
            field: issue?.path?.[0] ?? undefined,
        });
    }
    const data = parsed.data;
    if (data.CIF_NIFProveedor) {
        const exists = await prisma.proveedor.findFirst({
            where: {
                CIF_NIFProveedor: data.CIF_NIFProveedor,
                NOT: { idProveedor: id },
            },
        });
        if (exists)
            return res.status(409).json({ error: "CIF_NIF ya registrado" });
    }
    try {
        const row = await prisma.proveedor.update({
            where: { idProveedor: id },
            data,
        });
        res.json(row);
    }
    catch (e) {
        if (e?.code === "P2002") {
            const target = e?.meta?.target?.[0];
            return res.status(409).json({
                error: "UNIQUE_CONSTRAINT",
                field: target || undefined,
            });
        }
        console.error(e);
        res.status(400).json({ error: "UPDATE_FAILED" });
    }
}
async function remove(req, res) {
    const id = Number(req.params.id);
    const productos = await prisma.proveedorProducto.count({ where: { idProveedor: id } });
    const compras = await prisma.compra.count({ where: { idProveedor: id } });
    const inUse = productos + compras;
    if (inUse > 0) {
        return res.status(409).json({ error: "PROVEEDOR_EN_USO", details: { productos, compras } });
    }
    await prisma.proveedor.delete({ where: { idProveedor: id } });
    res.sendStatus(204);
}
// productos por proveedor, con paginado y búsqueda por nombre/código
async function listProductosByProveedor(req, res) {
    const id = Number(req.params.id);
    const q = proveedores_1.paginadoQuery.parse(req.query);
    const wherePP = {
        idProveedor: id,
    };
    if (q.search) {
        const or = [
            { nombreProducto: { contains: q.search, mode: client_1.Prisma.QueryMode.insensitive } },
            { codigoProducto: { contains: q.search, mode: client_1.Prisma.QueryMode.insensitive } },
        ];
        if (/^\d+$/.test(q.search)) {
            try {
                const num = BigInt(q.search);
                or.push({ codigoBarrasProducto: { equals: num } });
            }
            catch { }
        }
        wherePP.Producto = { is: { OR: or } };
    }
    const [total, rows] = await Promise.all([
        prisma.proveedorProducto.count({ where: wherePP }),
        prisma.proveedorProducto.findMany({
            where: wherePP,
            orderBy: { fechaIngreso: "desc" },
            skip: (q.page - 1) * q.pageSize,
            take: q.pageSize,
            include: {
                Producto: true,
                Proveedor: { select: { idProveedor: true, nombreProveedor: true } },
            },
        }),
    ]);
    res.json({ total, page: q.page, pageSize: q.pageSize, rows });
}
