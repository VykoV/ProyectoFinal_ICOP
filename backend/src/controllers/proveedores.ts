import { Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { proveedorIn, paginadoQuery } from "../validators/proveedores";

const prisma = new PrismaClient();

export async function list(req: Request, res: Response) {
  const q = paginadoQuery.parse(req.query);
  const where = q.search
    ? {
        OR: [
          { nombreProveedor: { contains: q.search, mode: Prisma.QueryMode.insensitive } },
          { mailProveedor: { contains: q.search, mode: Prisma.QueryMode.insensitive } },
          { observacionProveedor: { contains: q.search, mode: Prisma.QueryMode.insensitive } },
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
export async function selectList(_req: Request, res: Response) {
  const rows = await prisma.proveedor.findMany({
    select: { idProveedor: true, nombreProveedor: true },
    orderBy: { idProveedor: "asc" },
  });
  res.json(rows.map(r => ({ id: r.idProveedor, nombre: r.nombreProveedor })));
}

export async function getById(req: Request, res: Response) {
  const id = Number(req.params.id);
  const row = await prisma.proveedor.findUnique({
    where: { idProveedor: id },
    include: { Localidad: true },
  });
  if (!row) return res.sendStatus(404);
  res.json(row);
}

export async function create(req: Request, res: Response) {
  const data = proveedorIn.parse(req.body);

  // unicidad por CIF/NIF si viene informado
  if (data.CIF_NIFProveedor) {
    const exists = await prisma.proveedor.findFirst({
      where: { CIF_NIFProveedor: data.CIF_NIFProveedor },
    });
    if (exists) return res.status(409).json({ error: "CIF_NIF ya registrado" });
  }

  const row = await prisma.proveedor.create({ data });
  res.status(201).json(row);
}

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  const data = proveedorIn.parse(req.body);

  if (data.CIF_NIFProveedor) {
    const exists = await prisma.proveedor.findFirst({
      where: {
        CIF_NIFProveedor: data.CIF_NIFProveedor,
        NOT: { idProveedor: id },
      },
    });
    if (exists) return res.status(409).json({ error: "CIF_NIF ya registrado" });
  }

  const row = await prisma.proveedor.update({
    where: { idProveedor: id },
    data,
  });
  res.json(row);
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);

  const inUse =
    (await prisma.proveedorProducto.count({ where: { idProveedor: id } })) +
    (await prisma.compra.count({ where: { idProveedor: id } }));

  if (inUse > 0) {
    return res
      .status(409)
      .json({ error: "No se puede eliminar. Tiene productos o compras asociadas." });
  }
  await prisma.proveedor.delete({ where: { idProveedor: id } });
  res.sendStatus(204);
}

// productos por proveedor, con paginado y búsqueda por nombre/código
export async function listProductosByProveedor(req: Request, res: Response) {
  const id = Number(req.params.id);
  const q = paginadoQuery.parse(req.query);

  const wherePP = {
    idProveedor: id,
    Producto: q.search
      ? {
          OR: [
            { nombreProducto: { contains: q.search, mode: Prisma.QueryMode.insensitive } },
            { codigoProducto: { contains: q.search, mode: Prisma.QueryMode.insensitive } },
            { codigoBarrasProducto: { contains: q.search, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : undefined,
  };

  const [total, rows] = await Promise.all([
    prisma.proveedorProducto.count({ where: wherePP as any }),
    prisma.proveedorProducto.findMany({
      where: wherePP as any,
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