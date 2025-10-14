import express, { Request, Response } from "express";
import cors from "cors";
import { PrismaClient, Prisma } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);

// logger simple
app.use((req, _res, next) => {
  console.log(req.method, req.url);
  next();
});

// health
app.get("/api/health", (_req: Request, res: Response) => res.json({ ok: true }));

// ====== SELECTS: familias / subfamilias ======
app.get("/api/familias", async (_req, res) => {
  const rows = await prisma.familia.findMany({
    select: { idFamilia: true, tipoFamilia: true },
  });
  res.json(rows.map(r => ({ id: r.idFamilia, nombre: r.tipoFamilia })));
});

app.get("/api/subfamilias", async (_req, res) => {
  const rows = await prisma.subFamilia.findMany({
    select: { idSubFamilia: true, tipoSubFamilia: true, idFamilia: true },
  });
  res.json(
    rows.map(r => ({
      id: r.idSubFamilia,
      nombre: r.tipoSubFamilia,
      familiaId: r.idFamilia,
    }))
  );
});

// ====== CRUD PRODUCTOS ======
// LISTAR (normalizo a la forma del front)
app.get("/api/products", async (_req, res) => {
  const rows = await prisma.producto.findMany({
    select: {
      idProducto: true,
      nombreProducto: true,
      codigoProducto: true,
      precioVentaPublicoProducto: true,
    },
    orderBy: { idProducto: "desc" },
  });
  res.json(
    rows.map(r => ({
      id: r.idProducto,
      nombre: r.nombreProducto,
      sku: r.codigoProducto,
      precio: Number(r.precioVentaPublicoProducto),
      stock: 0, // TODO: calcular desde Stock[]
    }))
  );
});

// OBTENER UNO
app.get("/api/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const r = await prisma.producto.findUnique({
    where: { idProducto: id },
    select: {
      idProducto: true,
      nombreProducto: true,
      codigoProducto: true,
      precioVentaPublicoProducto: true,
      descripcionProducto: true,
      codigoBarrasProducto: true,
      ofertaProducto: true,
      idSubFamilia: true,
      precioProducto: true,
      utilidadProducto: true,
    },
  });
  if (!r) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({
    id: r.idProducto,
    nombre: r.nombreProducto,
    sku: r.codigoProducto,
    precio: Number(r.precioVentaPublicoProducto),
    descripcion: r.descripcionProducto,
    codigoBarras: r.codigoBarrasProducto ? String(r.codigoBarrasProducto) : null,
    oferta: r.ofertaProducto,
    subFamiliaId: r.idSubFamilia,
    precioCosto: Number(r.precioProducto),
    utilidad: Number(r.utilidadProducto),
    stock: 0,
  });
});

// CREAR
app.post("/api/products", async (req, res) => {
  try {
    const {
      nombre,
      sku,
      precio,
      precioCosto,
      utilidad,
      descripcion,
      codigoBarras,
      oferta,
      subFamiliaId,
    } = req.body;

    const row = await prisma.producto.create({
      data: {
        nombreProducto: nombre,
        codigoProducto: sku, // UNIQUE
        precioVentaPublicoProducto: precio,
        precioProducto: precioCosto ?? 0,
        utilidadProducto: utilidad ?? 0,
        descripcionProducto: descripcion ?? null,
        codigoBarrasProducto: codigoBarras ? BigInt(codigoBarras) : null, // UNIQUE (nullable)
        ofertaProducto: !!oferta,
        idSubFamilia: Number(subFamiliaId),
      },
      select: {
        idProducto: true,
        nombreProducto: true,
        codigoProducto: true,
        precioVentaPublicoProducto: true,
      },
    });

    res.status(201).json({
      id: row.idProducto,
      nombre: row.nombreProducto,
      sku: row.codigoProducto,
      precio: Number(row.precioVentaPublicoProducto),
      stock: 0,
    });
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        return res
          .status(409)
          .json({ error: "UNIQUE_CONSTRAINT", fields: e.meta?.target ?? [] });
      }
      if (e.code === "P2003") {
        return res.status(400).json({ error: "FK_CONSTRAINT" });
      }
    }
    console.error(e);
    res.status(400).json({ error: "CREATE_FAILED" });
  }
});

// ACTUALIZAR
app.put("/api/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const {
    nombre,
    sku,
    precio,
    precioCosto,
    utilidad,
    descripcion,
    codigoBarras,
    oferta,
    subFamiliaId,
  } = req.body;

  try {
    const row = await prisma.producto.update({
      where: { idProducto: id },
      data: {
        ...(nombre !== undefined && { nombreProducto: nombre }),
        ...(sku !== undefined && { codigoProducto: sku }),
        ...(precio !== undefined && { precioVentaPublicoProducto: precio }),
        ...(precioCosto !== undefined && { precioProducto: precioCosto }),
        ...(utilidad !== undefined && { utilidadProducto: utilidad }),
        ...(descripcion !== undefined && { descripcionProducto: descripcion }),
        ...(codigoBarras !== undefined && {
          codigoBarrasProducto: codigoBarras ? BigInt(codigoBarras) : null,
        }),
        ...(oferta !== undefined && { ofertaProducto: !!oferta }),
        ...(subFamiliaId !== undefined && {
          idSubFamilia: Number(subFamiliaId),
        }),
      },
      select: {
        idProducto: true,
        nombreProducto: true,
        codigoProducto: true,
        precioVentaPublicoProducto: true,
      },
    });

    res.json({
      id: row.idProducto,
      nombre: row.nombreProducto,
      sku: row.codigoProducto,
      precio: Number(row.precioVentaPublicoProducto),
      stock: 0,
    });
  } catch (e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res
        .status(409)
        .json({ error: "UNIQUE_CONSTRAINT", fields: e.meta?.target ?? [] });
    }
    console.error(e);
    res.status(400).json({ error: "UPDATE_FAILED" });
  }
});

// ELIMINAR
app.delete("/api/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.producto.delete({ where: { idProducto: id } });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "DELETE_FAILED" });
  }
});

// ====== META ======
app.get("/api/_meta/product-columns", async (_req, res) => {
  const cols: Array<{ column_name: string }> = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema='public' AND lower(table_name)='producto'
    ORDER BY ordinal_position
  `);
  res.json(cols.map(c => c.column_name));
});

app.listen(4000, () =>
  console.log("API corriendo en http://127.0.0.1:4000")
);
