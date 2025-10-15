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

// ====== SELECTS ======
app.get("/api/familias", async (_req, res) => {
  const rows = await prisma.familia.findMany({
    select: { idFamilia: true, tipoFamilia: true },
    orderBy: { idFamilia: "asc" },
  });
  res.json(rows.map(r => ({ id: r.idFamilia, nombre: r.tipoFamilia })));
});

app.get("/api/subfamilias", async (_req, res) => {
  const rows = await prisma.subFamilia.findMany({
    select: { idSubFamilia: true, tipoSubFamilia: true, idFamilia: true },
    orderBy: [{ idFamilia: "asc" }, { idSubFamilia: "asc" }],
  });
  res.json(rows.map(r => ({
    id: r.idSubFamilia,
    nombre: r.tipoSubFamilia,
    familiaId: r.idFamilia,
  })));
});

app.get("/api/proveedores", async (_req, res) => {
  const rows = await prisma.proveedor.findMany({
    select: { idProveedor: true, nombreProveedor: true },
    orderBy: { idProveedor: "asc" },
  });
  res.json(rows.map(r => ({ id: r.idProveedor, nombre: r.nombreProveedor })));
});

// ====== HELPERS ======
const sumStock = (stocks: { cantidadStock: Prisma.Decimal }[]) =>
  stocks.reduce((acc, s) => acc + Number(s.cantidadStock), 0);

// ====== CRUD PRODUCTOS ======

// LISTAR
app.get("/api/products", async (_req, res) => {
  const rows = await prisma.producto.findMany({
    select: {
      idProducto: true,
      nombreProducto: true,
      codigoProducto: true,
      precioVentaPublicoProducto: true,
      ofertaProducto: true,
      stocks: { select: { cantidadStock: true } },
    },
    orderBy: { idProducto: "desc" },
  });

  res.json(
    rows.map(r => ({
      id: r.idProducto,
      nombre: r.nombreProducto,
      sku: r.codigoProducto,
      precio: Number(r.precioVentaPublicoProducto),
      stock: sumStock(r.stocks),
      oferta: r.ofertaProducto,
    }))
  );
});

// OBTENER UNO
// OBTENER UNO (incluye proveedor y nombres de familia/subfamilia)
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
      SubFamilia: {
        select: {
          idSubFamilia: true,
          tipoSubFamilia: true,
          Familia: { select: { idFamilia: true, tipoFamilia: true } },
        },
      },
      stocks: {
        select: {
          idStock: true,
          cantidadStock: true,
          bajoMinimoStock: true,
          ultimaModificacionStock: true,
        },
        orderBy: { ultimaModificacionStock: "desc" },
        take: 1,
      },
      proveedorProductos: {
        select: {
          idProveedor: true,
          fechaIngreso: true,
          Proveedor: { select: { idProveedor: true, nombreProveedor: true } },
        },
        orderBy: { fechaIngreso: "desc" },
        take: 1,
      },
    },
  });

  if (!r) return res.status(404).json({ error: "NOT_FOUND" });

  const s = r.stocks[0];
  const pp = r.proveedorProductos[0];
  res.json({
    // básicos
    id: r.idProducto,
    sku: r.codigoProducto,
    nombre: r.nombreProducto,
    precio: Number(r.precioVentaPublicoProducto),
    descripcion: r.descripcionProducto ?? null,
    codigoBarras: r.codigoBarrasProducto ? String(r.codigoBarrasProducto) : null,
    oferta: r.ofertaProducto,
    // precios
    precioCosto: Number(r.precioProducto),
    utilidad: Number(r.utilidadProducto),
    // taxonomías
    subFamiliaId: r.SubFamilia?.idSubFamilia ?? r.idSubFamilia,
    nombreSubfamilia: r.SubFamilia?.tipoSubFamilia ?? null,
    familiaId: r.SubFamilia?.Familia?.idFamilia ?? null,
    nombreFamilia: r.SubFamilia?.Familia?.tipoFamilia ?? null,
    // stock último snapshot
    stock: s ? Number(s.cantidadStock) : 0,
    bajoMinimoStock: s ? Number(s.bajoMinimoStock) : 0,
    ultimaModificacionStock: s ? s.ultimaModificacionStock : null,
    // proveedor último asignado
    proveedorId: pp?.idProveedor ?? pp?.Proveedor?.idProveedor ?? null,
    nombreProveedor: pp?.Proveedor?.nombreProveedor ?? null,
  });
});

// CREAR con código FF-SS-000X
app.post("/api/products", async (req, res) => {
  try {
    const {
      nombre,
      // sku ignorado
      precio,
      precioCosto,
      utilidad,
      descripcion,
      codigoBarras,
      oferta,
      subFamiliaId,
      // stock y proveedor opcionales
      stock = 0,
      bajoMinimoStock = 0,
      ultimaModificacionStock,
      proveedorId,
      codigoArticuloProveedor,
      fechaIngreso,
      precioHistorico,
    } = req.body;

    // subfamilia y familia
    const sf = await prisma.subFamilia.findUnique({
      where: { idSubFamilia: Number(subFamiliaId) },
      include: { Familia: true },
    });
    if (!sf) return res.status(400).json({ error: "SUBFAMILIA_NOT_FOUND" });

    // crear placeholder
    const created = await prisma.producto.create({
      data: {
        nombreProducto: nombre,
        codigoProducto: "",
        precioVentaPublicoProducto: precio,
        precioProducto: precioCosto ?? 0,
        utilidadProducto: utilidad ?? 0,
        descripcionProducto: descripcion ?? null,
        codigoBarrasProducto: codigoBarras ? BigInt(codigoBarras) : null,
        ofertaProducto: !!oferta,
        idSubFamilia: Number(subFamiliaId),
      },
      select: { idProducto: true },
    });

    // generar código
    const codigoGenerado =
      `${String(sf.Familia.idFamilia).padStart(2, "0")}-` +
      `${String(sf.idSubFamilia).padStart(2, "0")}-` +
      `${String(created.idProducto).padStart(4, "0")}`;

    // guardar código
    const row = await prisma.producto.update({
      where: { idProducto: created.idProducto },
      data: { codigoProducto: codigoGenerado },
      select: {
        idProducto: true,
        nombreProducto: true,
        codigoProducto: true,
        precioVentaPublicoProducto: true,
        ofertaProducto: true,
      },
    });

    // stock inicial
    await prisma.stock.create({
      data: {
        idProducto: row.idProducto,
        cantidadStock: Number(stock ?? 0),
        bajoMinimoStock: Number(bajoMinimoStock ?? 0),
        ultimaModificacionStock: ultimaModificacionStock
          ? new Date(ultimaModificacionStock)
          : new Date(),
      },
    });

    // relación proveedor–producto histórica (opcional)
    if (proveedorId) {
      await prisma.proveedorProducto.create({
        data: {
          idProducto: row.idProducto,
          idProveedor: Number(proveedorId),
          codigoArticuloProveedor: codigoArticuloProveedor ?? "",
          fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : new Date(),
          precioHistorico: precioHistorico ?? 0,
        },
      });
    }

    res.status(201).json({
      id: row.idProducto,
      nombre: row.nombreProducto,
      sku: row.codigoProducto,
      precio: Number(row.precioVentaPublicoProducto),
      stock: Number(stock ?? 0),
      oferta: row.ofertaProducto,
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

// ACTUALIZAR (no cambia codigoProducto)
app.put("/api/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const {
    nombre,
    // sku ignorado
    precio,
    precioCosto,
    utilidad,
    descripcion,
    codigoBarras,
    oferta,
    subFamiliaId,
    stock,
    bajoMinimoStock,
    ultimaModificacionStock,
    proveedorId,
    codigoArticuloProveedor,
    fechaIngreso,
    precioHistorico,
  } = req.body;

  try {
    const row = await prisma.producto.update({
      where: { idProducto: id },
      data: {
        ...(nombre !== undefined && { nombreProducto: nombre }),
        ...(precio !== undefined && { precioVentaPublicoProducto: precio }),
        ...(precioCosto !== undefined && { precioProducto: precioCosto }),
        ...(utilidad !== undefined && { utilidadProducto: utilidad }),
        ...(descripcion !== undefined && { descripcionProducto: descripcion }),
        ...(codigoBarras !== undefined && {
          codigoBarrasProducto: codigoBarras ? BigInt(codigoBarras) : null,
        }),
        ...(oferta !== undefined && { ofertaProducto: !!oferta }),
        ...(subFamiliaId !== undefined && { idSubFamilia: Number(subFamiliaId) }),
      },
      select: {
        idProducto: true,
        nombreProducto: true,
        codigoProducto: true,
        precioVentaPublicoProducto: true,
        ofertaProducto: true,
      },
    });

    // stock: create/update simple
    if (stock !== undefined || bajoMinimoStock !== undefined || ultimaModificacionStock !== undefined) {
      const s = await prisma.stock.findFirst({ where: { idProducto: id } });
      if (s) {
        await prisma.stock.update({
          where: { idStock: s.idStock },
          data: {
            ...(stock !== undefined && { cantidadStock: Number(stock) }),
            ...(bajoMinimoStock !== undefined && { bajoMinimoStock: Number(bajoMinimoStock) }),
            ...(ultimaModificacionStock !== undefined && {
              ultimaModificacionStock: new Date(ultimaModificacionStock),
            }),
          },
        });
      } else {
        await prisma.stock.create({
          data: {
            idProducto: id,
            cantidadStock: Number(stock ?? 0),
            bajoMinimoStock: Number(bajoMinimoStock ?? 0),
            ultimaModificacionStock: ultimaModificacionStock
              ? new Date(ultimaModificacionStock)
              : new Date(),
          },
        });
      }
    }

    // proveedor histórico opcional
    if (proveedorId) {
      await prisma.proveedorProducto.create({
        data: {
          idProducto: id,
          idProveedor: Number(proveedorId),
          codigoArticuloProveedor: codigoArticuloProveedor ?? "",
          fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : new Date(),
          precioHistorico: precioHistorico ?? 0,
        },
      });
    }

    res.json({
      id: row.idProducto,
      nombre: row.nombreProducto,
      sku: row.codigoProducto,
      precio: Number(row.precioVentaPublicoProducto),
      oferta: row.ofertaProducto,
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
    await prisma.$transaction([
      prisma.stock.deleteMany({ where: { idProducto: id } }),
      prisma.proveedorProducto.deleteMany({ where: { idProducto: id } }),
      prisma.detalleCompra.deleteMany({ where: { idProducto: id } }),
      prisma.detalleVenta.deleteMany({ where: { idProducto: id } }),
      prisma.producto.delete({ where: { idProducto: id } }),
    ]);

    res.status(204).end();
  } catch (e: any) {
    // Si algún FK externo sigue bloqueando
    if (e.code === "P2003") {
      return res.status(409).json({ error: "FK_CONSTRAINT_IN_USE" });
    }
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
