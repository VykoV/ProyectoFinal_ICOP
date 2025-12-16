import 'dotenv/config'
import express, { Request, Response, NextFunction } from "express";
import "./jobs/cron";
import cors from "cors";
import session from "express-session";
import pgSession from "connect-pg-simple";
import bcrypt from "bcrypt";
import { PrismaClient, Prisma, PapelEnVenta, TipoNotificacion, NivelNotificacion, DestinatarioNotificacion, EstadoCompra } from "@prisma/client";
import { authorize } from "./middleware/authorize";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import authRoutes from "./auth";
import proveedores from "./routes/proveedores";
import compras from "./routes/compras";
import statsRoutes from "./routes/stats";
import { requireAuth } from "./middleware/requireAuth";

const DEV = process.env.NODE_ENV !== "production";
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || typeof DATABASE_URL !== 'string' || !DATABASE_URL.trim()) {
  console.error("DATABASE_URL no está definido. Configure su conexión en backend/.env");
  process.exit(1);
}
const app = express();
// Prisma con logging para pruebas en desarrollo
const prismaLogs: any = DEV
  ? [{ level: "query", emit: "event" }, { level: "error", emit: "event" }]
  : [];
const pool = new Pool({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({
  log: prismaLogs,
  adapter: new PrismaPg(pool),
} as any);
if (DEV) {
  (prisma as any).$on("query", (e: any) => {
    try {
      console.log("[SQL]", e.query, e.params);
    } catch { }
  });
  (prisma as any).$on("error", (e: any) => {
    try {
      console.error("[SQL ERROR]", e);
    } catch { }
  });
}
const PgSession = pgSession(session);

// ==========================
// 1) CONFIGURACIÓN DE CORS
// ==========================
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "X-User-Id", "x-skip-alert"],
  })
);
app.options(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "X-User-Id", "x-skip-alert"],
  })
);

// ==========================
// 2) PARSER JSON
// ==========================
app.use(express.json());

app.set(
  "json replacer",
  (key: string, value: unknown): unknown =>
    typeof value === "bigint" ? value.toString() : value
);

// Desactivar ETag para evitar respuestas 304 en endpoints críticos
app.set("etag", false);

// Forzar no-cache en preventas y ventas para evitar datos desactualizados
app.use((req, res, next) => {
  if (req.path.startsWith("/api/preventas") || req.path.startsWith("/api/ventas")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// ==========================
// 3) SESIONES
// ==========================
app.use(
  session({
    store: new PgSession({
      conString: DATABASE_URL,
      schemaName: "auth",
      tableName: "session",
      createTableIfMissing: false,
    }),
    name: "sid",
    secret: process.env.SESSION_SECRET ?? "dev_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

// ==========================
// 4) RUTA DE AUTENTICACIÓN
// ==========================
app.use("/api/auth", authRoutes);

// ==========================
// 4b) RUTAS DE PROVEEDORES (CRUD + productos por proveedor)
// ==========================
app.use("/api/proveedores", proveedores);
app.use("/api/compras", compras);
app.use("/api/stats", statsRoutes);

// ==========================
// 5) LOG SIMPLE
// ==========================
app.use((req, _res, next) => {
  console.log(req.method, req.url);
  next();
});

// ==========================
// 6) ENDPOINT HEALTH
// ==========================
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ==========================
// HELPERS
// ==========================
const sumStock = (stocks: { cantidadRealStock: Prisma.Decimal; stockComprometido: Prisma.Decimal }[]) =>
  stocks.reduce(
    (acc, s) =>
      acc +
      (Number(s.cantidadRealStock) - Number(s.stockComprometido || 0)),
    0
  );

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


// ====== CRUD PRODUCTOS ======

// LISTAR
app.get(
  "/api/products",
  requireAuth,
  authorize(["Administrador", "Vendedor", "Cajero"]),
  async (_req, res) => {
    const rows = await prisma.producto.findMany({
      select: {
        idProducto: true,
        nombreProducto: true,
        codigoProducto: true,
        precioVentaPublicoProducto: true,
        ofertaProducto: true,
        porcentajeOfertaProducto: true,
        fechaInicioOferta: true,
        fechaFinOferta: true,
        descripcionProducto: true,
        idSubFamilia: true,
        SubFamilia: {
          select: {
            idSubFamilia: true,
            tipoSubFamilia: true,
            Familia: { select: { idFamilia: true, tipoFamilia: true } },
          },
        },
        stocks: {
          select: {
            cantidadRealStock: true,
            stockComprometido: true,
          },
        },
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
        porcentajeOferta: r.porcentajeOfertaProducto ?? null,
        fechaInicioOferta: r.fechaInicioOferta ?? null,
        fechaFinOferta: r.fechaFinOferta ?? null,
        descripcion: r.descripcionProducto ?? null,
        subFamiliaId: r.SubFamilia?.idSubFamilia ?? r.idSubFamilia ?? null,
        nombreSubfamilia: r.SubFamilia?.tipoSubFamilia ?? null,
        familiaId: r.SubFamilia?.Familia?.idFamilia ?? null,
        nombreFamilia: r.SubFamilia?.Familia?.tipoFamilia ?? null,
      }))
    );
  });

// OBTENER UNO (sólo IDs numéricos para evitar colisiones con rutas específicas)
app.get("/api/products/:id(\\d+)", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "BAD_PRODUCT_ID" });
  }

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
      porcentajeOfertaProducto: true,
      fechaInicioOferta: true,
      fechaFinOferta: true,
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
          cantidadRealStock: true,
          stockComprometido: true,
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
          Proveedor: {
            select: { idProveedor: true, nombreProveedor: true },
          },
        },
        orderBy: { fechaIngreso: "desc" },
        take: 1,
      },
    },
  });

  if (!r) return res.status(404).json({ error: "NOT_FOUND" });

  const s = r.stocks[0];
  const pp = r.proveedorProductos[0];

  const stockDisponible = s
    ? Number(s.cantidadRealStock) - Number(s.stockComprometido || 0)
    : 0;

  res.json({
    id: r.idProducto,
    sku: r.codigoProducto,
    nombre: r.nombreProducto,
    precio: Number(r.precioVentaPublicoProducto),
    descripcion: r.descripcionProducto ?? null,
    codigoBarras: r.codigoBarrasProducto
      ? String(r.codigoBarrasProducto)
      : null,
    oferta: r.ofertaProducto,
    porcentajeOferta: r.porcentajeOfertaProducto ?? null,
    fechaInicioOferta: r.fechaInicioOferta ?? null,
    fechaFinOferta: r.fechaFinOferta ?? null,
    precioCosto: Number(r.precioProducto),
    utilidad: Number(r.utilidadProducto),
    subFamiliaId: r.SubFamilia?.idSubFamilia ?? r.idSubFamilia,
    nombreSubfamilia: r.SubFamilia?.tipoSubFamilia ?? null,
    familiaId: r.SubFamilia?.Familia?.idFamilia ?? null,
    nombreFamilia: r.SubFamilia?.Familia?.tipoFamilia ?? null,

    stock: stockDisponible,
    bajoMinimoStock: s ? Number(s.bajoMinimoStock) : 0,
    ultimaModificacionStock: s ? s.ultimaModificacionStock : null,

    proveedorId: pp?.idProveedor ?? pp?.Proveedor?.idProveedor ?? null,
    nombreProveedor: pp?.Proveedor?.nombreProveedor ?? null,
  });
});

// STOCK DETALLADO DE UN PRODUCTO
app.get("/api/products/:id/stock", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const s = await prisma.stock.findFirst({ where: { idProducto: id } });
    // Si no hay fila de stock, devolver valores por defecto en vez de 404
    if (!s) {
      return res.json({
        real: 0,
        comprometido: 0,
        minimo: 0,
        actualizadoEn: null,
      });
    }
    res.json({
      real: Number(s.cantidadRealStock || 0),
      comprometido: Number(s.stockComprometido || 0),
      minimo: Number(s.bajoMinimoStock || 0),
      actualizadoEn: s.ultimaModificacionStock ?? null,
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "STOCK_READ_FAILED" });
  }
});

app.get(
  "/api/products/stock-minimo",
  requireAuth,
  authorize(["Administrador"]),
  async (_req, res) => {
    try {
      const stocks = await prisma.stock.findMany({
        select: {
          idProducto: true,
          cantidadRealStock: true,
          stockComprometido: true,
          bajoMinimoStock: true,
          ultimaModificacionStock: true,
        },
      });
      const ids = Array.from(new Set(stocks.map((s: any) => Number(s.idProducto)).filter((x) => Number(x))));
      const prods = await prisma.producto.findMany({
        where: { idProducto: { in: ids } },
        select: { idProducto: true, nombreProducto: true },
      });
      const mapNombre = new Map<number, string>(prods.map((p) => [p.idProducto, p.nombreProducto]));
      const list = stocks
        .map((s: any) => {
          const real = Number(s.cantidadRealStock || 0);
          const comp = Number(s.stockComprometido || 0);
          const minimo = Number(s.bajoMinimoStock || 0);
          const disp = real - comp;
          return {
            idProducto: Number(s.idProducto),
            nombreProducto: mapNombre.get(Number(s.idProducto)) || "",
            disponible: disp,
            minimo,
            actualizadoEn: s.ultimaModificacionStock ?? null,
          };
        })
        .filter((x) => x.minimo > 0 && x.disponible < x.minimo)
        .sort((a, b) => a.disponible - b.disponible);
      res.json(list);
    } catch (err) {
      console.error("GET /api/products/stock-minimo error", err);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
);

// HISTÓRICO DE PRECIO POR PRODUCTO (opcional filtro de proveedor y rango de fechas)
app.get("/api/products/:id/historico-precio", async (req, res) => {
  const id = Number(req.params.id);
  const { proveedorId, desde, hasta, page = "1", limit = "20" } = req.query as any;
  const skip = Math.max(0, (Number(page) - 1) * Number(limit));
  const take = Math.max(1, Number(limit));

  const where: Prisma.ProveedorProductoWhereInput = { idProducto: id };
  if (proveedorId) where.idProveedor = Number(proveedorId);
  if (desde || hasta) {
    where.fechaIngreso = {
      ...(desde && { gte: new Date(String(desde)) }),
      ...(hasta && { lte: new Date(String(hasta)) }),
    } as any;
  }

  try {
    const rows = await prisma.proveedorProducto.findMany({
      where,
      include: { Proveedor: { select: { idProveedor: true, nombreProveedor: true } } },
      orderBy: { fechaIngreso: "desc" },
      skip,
      take,
    });

    res.json(
      rows.map(r => ({
        proveedorId: r.idProveedor,
        nombreProveedor: r.Proveedor?.nombreProveedor ?? null,
        precio: Number(r.precioHistorico),
        fechaIngreso: r.fechaIngreso,
        codigoArticuloProveedor: r.codigoArticuloProveedor ?? null,
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "HISTORICO_READ_FAILED" });
  }
});

// HISTÓRICO DE OFERTA POR PRODUCTO
app.get("/api/products/:id/historico-oferta", async (req, res) => {
  const id = Number(req.params.id);
  const { page = "1", limit = "20" } = req.query as any;
  const skip = Math.max(0, (Number(page) - 1) * Number(limit));
  const take = Math.max(1, Number(limit));

  try {
    const rows = await prisma.ofertaProductoHistorial.findMany({
      where: { idProducto: id },
      orderBy: { fechaInicio: "desc" },
      skip,
      take,
      select: {
        idOfertaProductoHistorial: true,
        ofertaProducto: true,
        porcentajeOfertaProducto: true,
        fechaInicio: true,
        fechaFin: true,
        creadoPor: true,
      },
    });

    res.json(
      rows.map(r => ({
        id: r.idOfertaProductoHistorial,
        oferta: r.ofertaProducto,
        porcentaje: Number(r.porcentajeOfertaProducto),
        inicio: r.fechaInicio,
        fin: r.fechaFin ?? null,
        creadoPor: r.creadoPor ?? null,
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "HISTORICO_OFERTA_FAILED" });
  }
});

// Ofertas por vencer en próximos N días
app.get(
  "/api/products/ofertas-por-vencer",
  requireAuth,
  authorize(["Administrador", "Vendedor", "Cajero"]),
  async (req, res) => {
    try {
      const days = Math.max(1, Math.min(30, Number(req.query.days ?? 2)));
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
      end.setHours(23, 59, 59, 999);

      const rows = await prisma.producto.findMany({
        where: {
          ofertaProducto: true,
          // Filtrar por fecha de fin dentro del rango. Los valores null no coinciden con gte/lte.
          fechaFinOferta: { gte: start, lte: end },
        },
        select: {
          idProducto: true,
          nombreProducto: true,
          porcentajeOfertaProducto: true,
          fechaFinOferta: true,
        },
        orderBy: { fechaFinOferta: "asc" },
      });

      res.json(
        rows.map(r => ({
          id: r.idProducto,
          nombre: r.nombreProducto,
          porcentajeOferta: Number(r.porcentajeOfertaProducto ?? 0),
          fechaFinOferta: r.fechaFinOferta,
        }))
      );
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: "OFERTAS_POR_VENCER_FAILED" });
    }
  }
);

app.get(
  "/api/products/ofertas",
  requireAuth,
  authorize(["Administrador", "Vendedor", "Cajero"]),
  async (_req, res) => {
    try {
      const rows = await prisma.producto.findMany({
        where: { ofertaProducto: true },
        select: {
          idProducto: true,
          nombreProducto: true,
          precioVentaPublicoProducto: true,
          codigoProducto: true,
        },
        orderBy: { nombreProducto: "asc" },
        take: 8,
      });
      res.json(
        rows.map((r) => ({
          idProducto: r.idProducto,
          nombreProducto: r.nombreProducto,
          precioVentaPublicoProducto: Number(r.precioVentaPublicoProducto ?? 0),
          codigoProducto: r.codigoProducto ?? null,
        }))
      );
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: "OFERTAS_READ_FAILED" });
    }
  }
);

app.get(
  "/api/products/stock-bajo-real",
  requireAuth,
  authorize(["Administrador", "Vendedor", "Cajero"]),
  async (_req, res) => {
    try {
      const stocks = await prisma.stock.findMany({
        select: {
          idProducto: true,
          cantidadRealStock: true,
          bajoMinimoStock: true,
          ultimaModificacionStock: true,
        },
      });
      const ids = Array.from(
        new Set(stocks.map((s: any) => Number(s.idProducto)).filter((x) => Number(x)))
      );
      const prods = await prisma.producto.findMany({
        where: { idProducto: { in: ids } },
        select: { idProducto: true, nombreProducto: true },
      });
      const mapNombre = new Map<number, string>(
        prods.map((p) => [p.idProducto, p.nombreProducto])
      );
      const list = stocks
        .map((s: any) => ({
          idProducto: Number(s.idProducto),
          nombreProducto: mapNombre.get(Number(s.idProducto)) || "",
          stockActual: Number(s.cantidadRealStock || 0),
          minimo: Number(s.bajoMinimoStock || 0),
          actualizadoEn: s.ultimaModificacionStock ?? null,
        }))
        .filter((x) => x.minimo > 0 && x.stockActual < x.minimo)
        .sort((a, b) => a.stockActual - b.stockActual)
        .slice(0, 10);
      res.json(list);
    } catch (err) {
      console.error("GET /api/products/stock-bajo-real error", err);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
);

// CREAR con código FF-SS-000X
app.post(
  "/api/products",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    try {
      const {
        nombre,
        precio,
        precioCosto,
        utilidad,
        descripcion,
        codigoBarras,
        oferta,
        porcentajeOferta,
        fechaInicioOferta,
        fechaFinOferta,
        subFamiliaId,
        stock = 0,
        bajoMinimoStock = 0,
        ultimaModificacionStock,
        proveedorId,
        codigoArticuloProveedor,
        fechaIngreso,
        precioHistorico,
      } = req.body;

      // Validaciones de fechas de oferta
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = parseLocalDate(fechaInicioOferta, false);
        const end = parseLocalDate(fechaFinOferta, true);
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(0, 0, 0, 0);
        if (start && start < today) {
          return res.status(422).json({ error: "OFERTA_INICIO_PASADO", message: "La fecha de inicio de oferta no puede ser anterior a hoy." });
        }
        if (start && end && end < start) {
          return res.status(422).json({ error: "OFERTA_FIN_ANTES_INICIO", message: "La fecha de fin de oferta no puede ser anterior a la fecha de inicio." });
        }
      } catch { }

      const sf = await prisma.subFamilia.findUnique({
        where: { idSubFamilia: Number(subFamiliaId) },
        include: { Familia: true },
      });
      if (!sf) return res.status(400).json({ error: "SUBFAMILIA_NOT_FOUND" });
      const nombreTrim = String(nombre ?? "").trim();
      if (!nombreTrim) return res.status(400).json({ error: "NOMBRE_REQUIRED" });
      const existsNombre = await prisma.producto.findFirst({
        where: { nombreProducto: { equals: nombreTrim, mode: Prisma.QueryMode.insensitive } },
        select: { idProducto: true },
      });
      if (existsNombre) {
        return res.status(409).json({ error: "PRODUCT_NAME_TAKEN", message: "Ya existe un producto con ese nombre." });
      }

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
          ...(porcentajeOferta !== undefined && {
            porcentajeOfertaProducto: Number(porcentajeOferta ?? 0),
          }),
          fechaInicioOferta: fechaInicioOferta !== undefined ? (fechaInicioOferta ? parseLocalDate(fechaInicioOferta, false) : null) : undefined,
          fechaFinOferta: fechaFinOferta !== undefined ? (fechaFinOferta ? parseLocalDate(fechaFinOferta, true) : null) : undefined,
          idSubFamilia: Number(subFamiliaId),
        },
        select: { idProducto: true },
      });

      const codigoGenerado =
        `${String(sf.Familia.idFamilia).padStart(2, "0")}-` +
        `${String(sf.idSubFamilia).padStart(2, "0")}-` +
        `${String(created.idProducto).padStart(4, "0")}`;

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

      await prisma.stock.create({
        data: {
          idProducto: row.idProducto,
          cantidadRealStock: new Prisma.Decimal(stock ?? 0),
          stockComprometido: new Prisma.Decimal(0),
          bajoMinimoStock: new Prisma.Decimal(bajoMinimoStock ?? 0),
          ultimaModificacionStock: ultimaModificacionStock
            ? new Date(ultimaModificacionStock)
            : new Date(),
        },
      });
      await ensureLowStockNotification(prisma as any, row.idProducto);

      // Registrar historial de oferta al crear (fechas con semántica local por día)
      const fi = fechaInicioOferta ? parseLocalDate(fechaInicioOferta, false) : null;
      const ff = fechaFinOferta ? parseLocalDate(fechaFinOferta, true) : null;
      // Evitar duplicados: no crear si el último registro es idéntico
      const lastCreate = await prisma.ofertaProductoHistorial.findFirst({
        where: { idProducto: row.idProducto },
        orderBy: { idOfertaProductoHistorial: "desc" },
        select: {
          ofertaProducto: true,
          porcentajeOfertaProducto: true,
          fechaInicio: true,
          fechaFin: true,
        },
      });
      const lastFi = lastCreate?.fechaInicio ? new Date(lastCreate.fechaInicio).getTime() : null;
      const lastFf = lastCreate?.fechaFin ? new Date(lastCreate.fechaFin).getTime() : null;
      const nextFi = fi ? new Date(fi).getTime() : null;
      const nextFf = ff ? new Date(ff).getTime() : null;
      const isSameAsLast = !!lastCreate &&
        lastCreate.ofertaProducto === !!oferta &&
        Number(lastCreate.porcentajeOfertaProducto ?? 0) === Number(porcentajeOferta ?? 0) &&
        lastFi === nextFi &&
        lastFf === nextFf;
      if (!isSameAsLast) {
        await prisma.ofertaProductoHistorial.create({
          data: {
            idProducto: row.idProducto,
            ofertaProducto: !!oferta,
            porcentajeOfertaProducto: Number(porcentajeOferta ?? 0),
            ...(fi ? { fechaInicio: fi } : {}),
            ...(ff ? { fechaFin: ff } : {}),
            creadoPor: getUserId(req),
          },
        });
      }

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
        porcentajeOferta: porcentajeOferta ?? null,
        fechaInicioOferta: fechaInicioOferta ?? null,
        fechaFinOferta: fechaFinOferta ?? null,
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
    precio,
    precioCosto,
    utilidad,
    descripcion,
    codigoBarras,
    oferta,
    porcentajeOferta,
    fechaInicioOferta,
    fechaFinOferta,
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
    // Validaciones de fechas de oferta
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = parseLocalDate(fechaInicioOferta, false);
      const end = parseLocalDate(fechaFinOferta, true);
      if (start) start.setHours(0, 0, 0, 0);
      if (end) end.setHours(0, 0, 0, 0);
      if (start && start < today) {
        return res.status(422).json({ error: "OFERTA_INICIO_PASADO", message: "La fecha de inicio de oferta no puede ser anterior a hoy." });
      }
      if (start && end && end < start) {
        return res.status(422).json({ error: "OFERTA_FIN_ANTES_INICIO", message: "La fecha de fin de oferta no puede ser anterior a la fecha de inicio." });
      }
    } catch { }
    // Leer actual para comparar precio
    const actual = await prisma.producto.findUnique({
      where: { idProducto: id },
      select: {
        idProducto: true,
        nombreProducto: true,
        codigoProducto: true,
        precioVentaPublicoProducto: true,
        ofertaProducto: true,
        porcentajeOfertaProducto: true,
        fechaInicioOferta: true,
        fechaFinOferta: true,
      },
    });
    if (!actual) return res.status(404).json({ error: "NOT_FOUND" });
    if (nombre !== undefined) {
      const nombreTrim = String(nombre ?? "").trim();
      if (!nombreTrim) return res.status(400).json({ error: "NOMBRE_INVALIDO" });
      const existsNombre = await prisma.producto.findFirst({
        where: {
          nombreProducto: { equals: nombreTrim, mode: Prisma.QueryMode.insensitive },
          NOT: { idProducto: id },
        } as any,
        select: { idProducto: true },
      });
      if (existsNombre) {
        return res.status(409).json({ error: "PRODUCT_NAME_TAKEN", message: "Ya existe un producto con ese nombre." });
      }
    }

    const precioCambio =
      precio !== undefined &&
      !new Prisma.Decimal(precio).equals(actual.precioVentaPublicoProducto);

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
        ...(porcentajeOferta !== undefined && {
          porcentajeOfertaProducto: Number(porcentajeOferta ?? 0),
        }),
        ...(fechaInicioOferta !== undefined && {
          fechaInicioOferta: fechaInicioOferta ? parseLocalDate(fechaInicioOferta, false) : null,
        }),
        ...(fechaFinOferta !== undefined && {
          fechaFinOferta: fechaFinOferta ? parseLocalDate(fechaFinOferta, true) : null,
        }),
        ...(subFamiliaId !== undefined && { idSubFamilia: Number(subFamiliaId) }),
      },
      select: {
        idProducto: true,
        nombreProducto: true,
        codigoProducto: true,
        precioVentaPublicoProducto: true,
        ofertaProducto: true,
        porcentajeOfertaProducto: true,
        fechaInicioOferta: true,
        fechaFinOferta: true,
      },
    });

    if (
      stock !== undefined ||
      bajoMinimoStock !== undefined ||
      ultimaModificacionStock !== undefined
    ) {
      const s = await prisma.stock.findFirst({ where: { idProducto: id } });
      if (s) {
        await prisma.stock.update({
          where: { idStock: s.idStock },
          data: {
            ...(stock !== undefined && {
              cantidadRealStock: new Prisma.Decimal(stock),
            }),
            ...(bajoMinimoStock !== undefined && {
              bajoMinimoStock: new Prisma.Decimal(bajoMinimoStock),
            }),
            ...(ultimaModificacionStock !== undefined && {
              ultimaModificacionStock: new Date(ultimaModificacionStock),
            }),
          },
        });
        await ensureLowStockNotification(prisma as any, id);
      } else {
        await prisma.stock.create({
          data: {
            idProducto: id,
            cantidadRealStock: new Prisma.Decimal(stock ?? 0),
            stockComprometido: new Prisma.Decimal(0),
            bajoMinimoStock: new Prisma.Decimal(bajoMinimoStock ?? 0),
            ultimaModificacionStock: ultimaModificacionStock
              ? new Date(ultimaModificacionStock)
              : new Date(),
          },
        });
        await ensureLowStockNotification(prisma as any, id);
      }
    }

    // Registrar histórico de precio si hubo cambio de precio
    if (precioCambio) {
      let provId: number | undefined = proveedorId ? Number(proveedorId) : undefined;
      if (!provId) {
        const last = await prisma.detalleCompra.findFirst({
          where: { idProducto: id },
          include: { Compra: { select: { idProveedor: true, fechaComprobanteCompra: true } } },
          orderBy: { Compra: { fechaComprobanteCompra: "desc" } },
        });
        provId = last?.Compra?.idProveedor;
      }

      if (!provId) {
        return res
          .status(422)
          .json({ error: "PROVEEDOR_REQUIRED", message: "Se requiere proveedorId o inferencia fallida" });
      }

      await prisma.proveedorProducto.create({
        data: {
          idProducto: id,
          idProveedor: provId,
          codigoArticuloProveedor: codigoArticuloProveedor ?? "",
          fechaIngreso: fechaIngreso ? new Date(fechaIngreso) : new Date(),
          precioHistorico: new Prisma.Decimal(precio ?? actual.precioVentaPublicoProducto),
        },
      });
    }

    // Registrar historial de oferta si hubo cambios en oferta/porcentaje/fechas
    const oldPct = actual.porcentajeOfertaProducto != null
      ? Number(actual.porcentajeOfertaProducto)
      : null;
    const newPct = porcentajeOferta != null
      ? Number(porcentajeOferta)
      : null;
    const porcentajeCambios = porcentajeOferta !== undefined && oldPct !== newPct;
    const fechaInicioCambios = fechaInicioOferta !== undefined &&
      ((actual.fechaInicioOferta ? new Date(actual.fechaInicioOferta).getTime() : null) !== (fechaInicioOferta ? new Date(fechaInicioOferta).getTime() : null));
    const fechaFinCambios = fechaFinOferta !== undefined &&
      ((actual.fechaFinOferta ? new Date(actual.fechaFinOferta).getTime() : null) !== (fechaFinOferta ? new Date(fechaFinOferta).getTime() : null));
    const ofertaCambios = oferta !== undefined && (!!oferta !== actual.ofertaProducto);

    if (porcentajeCambios || fechaInicioCambios || fechaFinCambios || ofertaCambios) {
      // Evitar duplicados por cambios redundantes o doble envío
      const last = await prisma.ofertaProductoHistorial.findFirst({
        where: { idProducto: row.idProducto },
        orderBy: { idOfertaProductoHistorial: "desc" },
        select: {
          ofertaProducto: true,
          porcentajeOfertaProducto: true,
          fechaInicio: true,
          fechaFin: true,
        },
      });
      const lastFi = last?.fechaInicio ? new Date(last.fechaInicio).getTime() : null;
      const lastFf = last?.fechaFin ? new Date(last.fechaFin).getTime() : null;
      const nextFi = row.fechaInicioOferta ? new Date(row.fechaInicioOferta).getTime() : null;
      const nextFf = row.fechaFinOferta ? new Date(row.fechaFinOferta).getTime() : null;
      const isSame = !!last &&
        last.ofertaProducto === row.ofertaProducto &&
        Number(last.porcentajeOfertaProducto ?? 0) === Number(row.porcentajeOfertaProducto ?? 0) &&
        lastFi === nextFi &&
        lastFf === nextFf;
      if (!isSame) {
        await prisma.ofertaProductoHistorial.create({
          data: {
            idProducto: row.idProducto,
            ofertaProducto: row.ofertaProducto,
            porcentajeOfertaProducto: Number(row.porcentajeOfertaProducto ?? 0),
            ...(row.fechaInicioOferta ? { fechaInicio: row.fechaInicioOferta } : {}),
            ...(row.fechaFinOferta ? { fechaFin: row.fechaFinOferta } : {}),
            creadoPor: getUserId(req),
          },
        });
      }
    }

    res.json({
      id: row.idProducto,
      nombre: row.nombreProducto,
      sku: row.codigoProducto,
      precio: Number(row.precioVentaPublicoProducto),
      oferta: row.ofertaProducto,
      porcentajeOferta: row.porcentajeOfertaProducto ?? null,
      fechaInicioOferta: row.fechaInicioOferta ?? null,
      fechaFinOferta: row.fechaFinOferta ?? null,
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
    const [compCount, ventaCount, histCount, stockRow] = await prisma.$transaction([
      prisma.detalleCompra.count({ where: { idProducto: id } }),
      prisma.detalleVenta.count({ where: { idProducto: id } }),
      prisma.proveedorProducto.count({ where: { idProducto: id } }),
      prisma.stock.findFirst({ where: { idProducto: id } }),
    ] as any);

    if (compCount > 0 || ventaCount > 0 || histCount > 0 || !!stockRow) {
      return res
        .status(409)
        .json({ error: "PRODUCT_IN_USE", message: "Producto con movimientos, histórico o stock. No se puede borrar." });
    }

    await prisma.producto.delete({ where: { idProducto: id } });
    res.status(204).end();
  } catch (e: any) {
    if (e.code === "P2003") {
      return res.status(409).json({ error: "FK_CONSTRAINT_IN_USE" });
    }
    console.error(e);
    res.status(400).json({ error: "DELETE_FAILED" });
  }
});

// ====== ROLES ======
app.get("/api/roles", async (_req, res) => {
  const rows = await prisma.rol.findMany({
    select: { idRol: true, nombreRol: true, comentario: true },
    orderBy: { idRol: "asc" },
  });
  res.json(rows.map(r => ({
    id: r.idRol,
    nombre: r.nombreRol,
    comentario: r.comentario ?? null,
  })));
});

// ====== USUARIOS (listado) ======
app.get(
  "/api/usuarios",
  requireAuth,
  authorize(["Administrador"]),
  async (_req, res) => {
    const rows = await prisma.usuario.findMany({
      select: {
        idUsuario: true,
        nombreUsuario: true,
        emailUsuario: true,
        roles: {
          select: { Rol: { select: { idRol: true, nombreRol: true, comentario: true } } },
        },
      },
      orderBy: { idUsuario: "asc" },
    });

    res.json(rows.map(u => ({
      id: u.idUsuario,
      nombre: u.nombreUsuario,
      email: u.emailUsuario,
      roles: u.roles.map(x => ({
        id: x.Rol.idRol,
        nombre: x.Rol.nombreRol,
        comentario: x.Rol.comentario ?? null,
      })),
    })));
  });

// ====== CREAR USUARIO ======
app.post(
  "/api/usuarios",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    try {
      const { nombreUsuario, emailUsuario, contrasenaUsuario, idRol } = req.body;

      if (!nombreUsuario || !emailUsuario || !contrasenaUsuario)
        return res.status(400).json({ error: "FALTAN_DATOS" });

      const exists = await prisma.usuario.findUnique({
        where: { emailUsuario },
      });
      if (exists) return res.status(409).json({ error: "EMAIL_TAKEN" });

      const hash = await bcrypt.hash(contrasenaUsuario, 12);

      const user = await prisma.usuario.create({
        data: {
          nombreUsuario,
          emailUsuario,
          contrasenaUsuario: hash,
          roles: idRol
            ? {
              create: [{ Rol: { connect: { idRol: Number(idRol) } } }],
            }
            : undefined,
        },
        include: { roles: { include: { Rol: true } } },
      });

      res.status(201).json(user);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "CREATE_FAILED" });
    }
  });

// ACTUALIZAR USUARIO
app.put(
  "/api/usuarios/:id",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "ID_INVALIDO" });
    const { nombreUsuario, emailUsuario, contrasenaUsuario, idRol } = req.body;

    const data: any = {};
    if (nombreUsuario !== undefined) data.nombreUsuario = nombreUsuario;
    if (emailUsuario !== undefined) data.emailUsuario = emailUsuario;
    if (contrasenaUsuario) data.contrasenaUsuario = await bcrypt.hash(contrasenaUsuario, 12);

    try {
      await prisma.usuario.update({ where: { idUsuario: id }, data });

      if (idRol !== undefined) {
        await prisma.usuarioRol.deleteMany({ where: { idUsuario: id } });
        if (idRol) {
          await prisma.usuarioRol.create({
            data: { idUsuario: id, idRol: Number(idRol) },
          });
        }
      }

      res.status(200).json({ ok: true });
    } catch (e: any) {
      if (e.code === "P2002") return res.status(409).json({ error: "EMAIL_TAKEN" });
      res.status(400).json({ error: "UPDATE_FAILED" });
    }
  });

// ELIMINAR USUARIO
app.delete(
  "/api/usuarios/:id",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "ID_INVALIDO" });
    try {
      const [ventaActor, ventaEvento, ventaComentario, cierreCaja, egresoCaja, notificacion] = await Promise.all([
        prisma.ventaActor.count({ where: { idUsuario: id } }),
        prisma.ventaEvento.count({ where: { idUsuario: id } }),
        prisma.ventaComentario.count({ where: { idUsuario: id } }),
        prisma.cierreCaja.count({ where: { idUsuario: id } }),
        prisma.egresoCaja.count({ where: { idUsuario: id } }),
        prisma.notificacion.count({ where: { idUsuario: id } }),
      ]);
      const totalRefs = ventaActor + ventaEvento + ventaComentario + cierreCaja + egresoCaja + notificacion;
      if (totalRefs > 0) {
        return res.status(409).json({
          error: "USER_IN_USE",
          details: { ventaActor, ventaEvento, ventaComentario, cierreCaja, egresoCaja, notificacion },
        });
      }

      await prisma.usuarioRol.deleteMany({ where: { idUsuario: id } });
      await prisma.usuario.delete({ where: { idUsuario: id } });
      res.status(204).end();
    } catch (e: any) {
      if (e?.code === "P2003") {
        return res.status(409).json({ error: "USER_IN_USE" });
      }
      res.status(400).json({ error: "DELETE_FAILED" });
    }
  });

/* === API === */
const api = express.Router();

/* ---- CLIENTES ---- */
api.get("/clientes", async (req, res) => {
  const q = String(req.query.q ?? "").trim();

  let where: any = undefined;
  if (q) {
    const qNum = q.replace(/\D/g, "");
    where = {
      OR: [
        { nombreCliente: { contains: q, mode: "insensitive" } },
        { apellidoCliente: { contains: q, mode: "insensitive" } },
        { emailCliente: { contains: q, mode: "insensitive" } },
        ...(qNum
          ? [
            { cuil: BigInt(qNum) },
            { telefonoCliente: BigInt(qNum) },
          ]
          : []),
      ],
    };
  }

  const rows = await prisma.cliente.findMany({
    where,
    select: {
      idCliente: true,
      nombreCliente: true,
      apellidoCliente: true,
      cuil: true,
      emailCliente: true,
      telefonoCliente: true,
      NivelCliente: {
        select: {
          indiceBeneficio: true,
        },
      },
    },
    orderBy: { idCliente: "asc" },
  });

  res.json(rows);
});

api.get("/clientes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const row = await prisma.cliente.findUnique({
    where: { idCliente: id },
    include: {
      TipoCliente: true,
      NivelCliente: true,
      Localidad: { include: { Provincia: true } },
    },
  });
  if (!row) return res.status(404).json({ error: "NOT_FOUND" });
  res.json(row);
});

// crear
api.post("/clientes", async (req, res) => {
  try {
    const {
      cuil, nombreCliente, apellidoCliente, emailCliente, telefonoCliente,
      observacion, idTipoCliente, idNivelCliente, idLocalidad, fechaRegistro,
    } = req.body;

    const created = await prisma.cliente.create({
      data: {
        cuil: cuil ? BigInt(cuil) : null,
        nombreCliente, apellidoCliente,
        emailCliente: emailCliente ?? null,
        telefonoCliente: telefonoCliente ? BigInt(telefonoCliente) : null,
        observacion: observacion ?? null,
        idTipoCliente: idTipoCliente ? Number(idTipoCliente) : null,
        idNivelCliente: idNivelCliente ? Number(idNivelCliente) : null,
        idLocalidad: idLocalidad ? Number(idLocalidad) : null,
        fechaRegistro: fechaRegistro ? new Date(fechaRegistro) : undefined,
      },
    });

    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: "CREATE_FAILED" });
  }
});

// actualizar
api.put("/clientes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const {
    cuil, nombreCliente, apellidoCliente, emailCliente, telefonoCliente,
    observacion, idTipoCliente, idNivelCliente, idLocalidad, fechaRegistro,
  } = req.body;

  try {
    const updated = await prisma.cliente.update({
      where: { idCliente: id },
      data: {
        ...(cuil !== undefined && { cuil: cuil ? BigInt(cuil) : null }),
        ...(nombreCliente !== undefined && { nombreCliente }),
        ...(apellidoCliente !== undefined && { apellidoCliente }),
        ...(emailCliente !== undefined && { emailCliente }),
        ...(telefonoCliente !== undefined && { telefonoCliente: telefonoCliente ? BigInt(telefonoCliente) : null }),
        ...(observacion !== undefined && { observacion }),
        ...(idTipoCliente !== undefined && { idTipoCliente: idTipoCliente ? Number(idTipoCliente) : null }),
        ...(idNivelCliente !== undefined && { idNivelCliente: idNivelCliente ? Number(idNivelCliente) : null }),
        ...(idLocalidad !== undefined && { idLocalidad: idLocalidad ? Number(idLocalidad) : null }),
        ...(fechaRegistro !== undefined && { fechaRegistro: new Date(fechaRegistro) }),
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: "UPDATE_FAILED" });
  }
});

// eliminar
api.delete("/clientes/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const ventas = await prisma.venta.count({ where: { idCliente: id } });
    if (ventas > 0) {
      return res.status(409).json({ error: "CLIENTE_EN_USO", details: { ventas } });
    }
    await prisma.cliente.delete({ where: { idCliente: id } });
    res.status(204).end();
  } catch (e: any) {
    if (e.code === "P2003") return res.status(409).json({ error: "CLIENTE_EN_USO" });
    res.status(400).json({ error: "DELETE_FAILED" });
  }
});

// Catálogos
app.get("/api/tipos-cliente", async (_req, res) => {
  const rows = await prisma.tipoCliente.findMany({ orderBy: { idTipoCliente: "asc" } });
  res.json(rows);
});

app.get("/api/niveles-cliente", async (_req, res) => {
  const rows = await prisma.nivelCliente.findMany({ orderBy: { idNivelCliente: "asc" } });
  res.json(rows);
});

app.get("/api/provincias", async (_req, res) => {
  const rows = await prisma.provincia.findMany({ orderBy: { idProvincia: "asc" } });
  res.json(rows);
});

app.get("/api/localidades", async (req, res) => {
  const provinciaId = req.query.provinciaId ? Number(req.query.provinciaId) : undefined;
  const where = provinciaId ? { idProvincia: provinciaId } : {};
  const rows = await prisma.localidad.findMany({ where, orderBy: { idLocalidad: "asc" } });
  res.json(rows);
});

/* ========================
   PREVENTAS + VENTAS (NUEVO)
   ======================== */

// — Estados de negocio:
const ESTADOS = {
  PENDIENTE: "Pendiente",
  RESERVADO: "Reservado",
  LISTO_CAJA: "ListoCaja",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
  VENCIDA: "Vencido",
} as const;

// Estados requeridos al arrancar 
const REQUIRED_ESTADOS = [
  "Pendiente",
  "Reservado",
  "ListoCaja",
  "Finalizada",
  "Cancelada",
  "Vencido",
];

// Normaliza nombres: sin espacios/guiones_bajos y lower 
const norm = (s: string) => s.toLowerCase().replace(/[\s_]/g, "");

// helper numérico robusto
const toNum = (v: any) => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
};

// Normaliza cantidades a 3 decimales (Decimal con 3dp exactos)
const toDec3 = (n: number | string) =>
  new Prisma.Decimal(Number(n ?? 0)).toDecimalPlaces(3);
// helper para valores con 2 decimales (precios, porcentajes)
const toDec2 = (n: number | string) =>
  new Prisma.Decimal(Number(n ?? 0)).toDecimalPlaces(2);

// Asegura que existan los estados base 
async function ensureEstadosBase() {
  await prisma.$transaction(async (tx: any) => {
    const existentes = await tx.estadoVenta.findMany({
      select: { idEstadoVenta: true, nombreEstadoVenta: true },
    });
    const have = new Set(existentes.map(e => norm(e.nombreEstadoVenta)));
    for (const n of REQUIRED_ESTADOS) {
      if (!have.has(norm(n))) {
        await tx.estadoVenta.create({ data: { nombreEstadoVenta: n } });
      }
    }
  });
}

// Llamar una vez al inicio 
ensureEstadosBase().catch(err =>
  console.error("ensureEstadosBase error", err)
);

// — Usuario de la sesión o header para auditoría:
function getUserId(req: any): number {
  // La sesión escribe en req.session.userId desde /api/auth/login
  const sid = req?.session?.userId ?? req?.session?.user?.idUsuario ?? req?.session?.idUsuario;
  if (sid) return Number(sid);
  const hdr = req.headers["x-user-id"];
  if (hdr) return Number(hdr);
  return 1; // fallback dev
}

// — EstadoVenta helpers:
async function getEstadoId(tx: PrismaClient, nombre: string) {
  // variantes aceptadas: "ListoCaja", "Listo Caja", "listocaja" 
  const candidates = Array.from(new Set([
    nombre,
    nombre.replace(/([a-z])([A-Z])/g, "$1 $2"),  // "ListoCaja" -> "Listo Caja" 
    nombre.replace(/[\s_]/g, ""),               // "Listo Caja" -> "ListoCaja" 
  ]));

  // 1) intento por igualdad insensible con variantes 
  for (const cand of candidates) {
    const row = await tx.estadoVenta.findFirst({
      where: { nombreEstadoVenta: { equals: cand, mode: "insensitive" } },
      select: { idEstadoVenta: true },
    });
    if (row) return row.idEstadoVenta;
  }

  // 2) intento por normalización 
  const all = await tx.estadoVenta.findMany({
    select: { idEstadoVenta: true, nombreEstadoVenta: true },
  });
  const hit = all.find(e => norm(e.nombreEstadoVenta) === norm(nombre));
  if (hit) return hit.idEstadoVenta;

  // 3) en dev, créalo con el nombre solicitado 
  if (DEV) {
    const created = await tx.estadoVenta.create({
      data: { nombreEstadoVenta: nombre },
      select: { idEstadoVenta: true },
    });
    return created.idEstadoVenta;
  }

  throw new Error(`ESTADO_NO_DEFINIDO:${nombre}`);
}

// — Stock helpers:
async function getStockFila(tx: PrismaClient, idProducto: number) {
  const s = await tx.stock.findFirst({ where: { idProducto } });
  if (!s) return null;
  return {
    idStock: s.idStock,
    real: Number(s.cantidadRealStock || 0),
    comp: Number(s.stockComprometido || 0),
  };
}

async function ensureLowStockNotification(tx: PrismaClient, idProducto: number) {
  const s = await tx.stock.findFirst({ where: { idProducto } });
  if (!s) return;
  const real = Number(s.cantidadRealStock || 0);
  const comp = Number(s.stockComprometido || 0);
  const min = Number(s.bajoMinimoStock || 0);
  const disp = real - comp;
  if (min <= 0) return;
  const prod = await tx.producto.findUnique({ where: { idProducto }, select: { nombreProducto: true } });
  const nombre = prod?.nombreProducto ?? `#${idProducto}`;
  const msg = `Stock bajo: ${nombre} (#${idProducto})`;
  if (disp < min) {
    const exists = await tx.notificacion.findFirst({
      where: {
        tipo: TipoNotificacion.STOCK_BAJO,
        mensaje: { contains: `#${idProducto}` },
        leido: false,
      },
    });
    if (!exists) {
      await tx.notificacion.create({
        data: {
          tipo: TipoNotificacion.STOCK_BAJO,
          mensaje: msg,
          nivel: NivelNotificacion.WARN,
          destinatario: DestinatarioNotificacion.ADMIN,
          data: { code: 'STOCK_BAJO', idProducto },
        },
      });
    }
  } else {
    await tx.notificacion.updateMany({
      where: {
        tipo: TipoNotificacion.STOCK_BAJO,
        mensaje: { contains: `#${idProducto}` },
        leido: false,
      },
      data: { leido: true },
    });
  }
}

async function validarDisponible(tx: PrismaClient, items: { idProducto: number; cantidad: number }[]) {
  for (const it of items) {
    const s = await getStockFila(tx, it.idProducto);
    if (!s) throw new Error("STOCK_INEXISTENTE");
    const disponible = s.real - s.comp;
    if (disponible < Number(it.cantidad || 0)) throw new Error("STOCK_INSUFICIENTE");
  }
}

async function validarReal(tx: PrismaClient, items: { idProducto: number; cantidad: number }[]) {
  for (const it of items) {
    const s = await getStockFila(tx, it.idProducto);
    if (!s) throw new Error("STOCK_INEXISTENTE");
    if (s.real < Number(it.cantidad || 0)) throw new Error("STOCK_INSUFICIENTE");
  }
}

async function reservarComprometido(tx: PrismaClient, items: { idProducto: number; cantidad: number }[]) {
  const orden = [...items].sort((a, b) => a.idProducto - b.idProducto);
  for (const it of orden) {
    const s = await getStockFila(tx, it.idProducto);
    if (!s) throw new Error("STOCK_INEXISTENTE");
    await tx.stock.update({
      where: { idStock: s.idStock },
      data: {
        stockComprometido: new Prisma.Decimal(s.comp + Number(it.cantidad || 0)),
        ultimaModificacionStock: new Date(),
      },
    });
    await ensureLowStockNotification(tx, it.idProducto);
  }
}

async function liberarComprometido(tx: PrismaClient, items: { idProducto: number; cantidad: number }[]) {
  const orden = [...items].sort((a, b) => a.idProducto - b.idProducto);
  for (const it of orden) {
    const s = await getStockFila(tx, it.idProducto);
    if (!s) continue;
    const nuevo = Math.max(0, s.comp - Number(it.cantidad || 0));
    await tx.stock.update({
      where: { idStock: s.idStock },
      data: {
        stockComprometido: new Prisma.Decimal(nuevo),
        ultimaModificacionStock: new Date(),
      },
    });
    await ensureLowStockNotification(tx, it.idProducto);
  }
}

async function descontarRealYComprometido(tx: PrismaClient, items: { idProducto: number; cantidad: number }[]) {
  const orden = [...items].sort((a, b) => a.idProducto - b.idProducto);
  for (const it of orden) {
    const s = await getStockFila(tx, it.idProducto);
    if (!s) throw new Error("STOCK_INEXISTENTE");
    const real = Math.max(0, s.real - Number(it.cantidad || 0));
    const comp = Math.max(0, s.comp - Number(it.cantidad || 0));
    await tx.stock.update({
      where: { idStock: s.idStock },
      data: {
        cantidadRealStock: new Prisma.Decimal(real),
        stockComprometido: new Prisma.Decimal(comp),
        ultimaModificacionStock: new Date(),
      },
    });
    await ensureLowStockNotification(tx, it.idProducto);
  }
}

// — Auditoría helpers:
// — Auditoría helpers (flex: intenta con IDs y si falla, usa nombres)
async function registrarEventoIds(
  tx: PrismaClient,
  args: { idVenta: number; idUsuario: number; desdeId: number | null; hastaId: number; motivo?: string | null }
) {
  try {
    // Caso 1: el modelo tiene columnas numéricas estadoDesde/estadoHasta
    return await tx.ventaEvento.create({
      data: {
        idVenta: args.idVenta,
        idUsuario: args.idUsuario,
        estadoDesde: args.desdeId,
        estadoHasta: args.hastaId,
        motivo: args.motivo ?? null,
      } as any,
    });
  } catch (e: any) {
    // Caso 2: fallback a columnas por nombre (ajusta nombres si tu schema usa otros)
    return await tx.ventaEvento.create({
      data: {
        idVenta: args.idVenta,
        idUsuario: args.idUsuario,
        estadoDesdeNombre: args.desdeId == null ? null : String(args.desdeId),
        estadoHastaNombre: String(args.hastaId),
        motivo: args.motivo ?? null,
      } as any,
    });
  }
}

async function registrarActor(
  tx: PrismaClient,
  args: { idVenta: number; idUsuario: number; papel: PapelEnVenta }
) {
  // Evita duplicados y posibles errores por clave compuesta existente
  await tx.ventaActor.upsert({
    where: {
      idVenta_idUsuario_papel: {
        idVenta: args.idVenta,
        idUsuario: args.idUsuario,
        papel: args.papel,
      },
    },
    update: {},
    create: {
      idVenta: args.idVenta,
      idUsuario: args.idUsuario,
      papel: args.papel,
    } as any,
  });
}

async function agregarComentario(
  tx: PrismaClient,
  args: { idVenta: number; idUsuario: number; comentario: string }
) {
  await tx.ventaComentario.create({
    data: {
      idVenta: args.idVenta,
      idUsuario: args.idUsuario,
      comentario: args.comentario,
    } as any,
  });
}

// — Util detalle:
async function leerItemsVenta(tx: PrismaClient, idVenta: number) {
  const items = await tx.detalleVenta.findMany({
    where: { idVenta },
    select: { idProducto: true, cantidad: true },
  });
  return items.map((r) => ({ idProducto: Number(r.idProducto), cantidad: Number(r.cantidad) }));
}

// Marca preventa como vencida y libera stock comprometido, registrando auditoría
async function marcarPreventaComoVencida(
  tx: PrismaClient,
  args: { idVenta: number; idUsuario?: number; estadoDesdeId?: number | null; motivo?: string }
) {
  const { idVenta, idUsuario, estadoDesdeId, motivo } = args;
  const idVenc = await getEstadoId(tx, ESTADOS.VENCIDA);
  const items = await leerItemsVenta(tx, idVenta);
  if (items.length) {
    await liberarComprometido(tx, items);
  }
  await tx.venta.update({ where: { idVenta }, data: { idEstadoVenta: idVenc, estadoPago: 'PENDIENTE' } });
  if (idUsuario) {
    await registrarEventoIds(tx, {
      idVenta,
      idUsuario,
      desdeId: estadoDesdeId ?? null,
      hastaId: idVenc,
      motivo: motivo ?? 'vencida por validación',
    });
    await registrarActor(tx, { idVenta, idUsuario, papel: PapelEnVenta.ANULADOR });
  }
}

// — totales avanzados:
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
  if (!venta) return { importeArticulos: 0, importeNeto: 0, impuesto: 0, totalFinal: 0 };

  const IVA_RATE = Number(process.env.IVA_RATE ?? 0.21);

  // 1) Precios de productos ya incluyen IVA: trabajamos siempre con montos IVA-incluido
  //    Aplicamos descuentos/recargos por línea sobre el precio final (incluido IVA)
  const importeArticulos = venta.detalles.reduce((acc, d) => {
    const cantidad = Number(d.cantidad ?? 0);
    const pu = Number(d.precioUnit ?? 0); // IVA incluido
    const base = cantidad * pu;
    const descPct = Number(d.descuentoItem ?? 0) / 100;
    const recPct = Number(d.recargoItem ?? 0) / 100;
    const conDesc = base * (1 - descPct);
    const conRecargo = conDesc * (1 + recPct);
    return acc + conRecargo;
  }, 0);

  // 2) Aplicamos descuento general y recargo por método de pago sobre el total IVA-incluido
  const descGeneralPct = Number(venta.descuentoGeneralVenta ?? 0) / 100;
  const recargoPagoPct = Number(venta.recargoPagoVenta ?? 0) / 100;
  const totalConDescuento = importeArticulos * (1 - descGeneralPct);
  const totalFinal = totalConDescuento * (1 + recargoPagoPct);

  // 3) Derivamos neto e IVA a partir de un total IVA-incluido, sin sumar IVA extra
  const importeNeto = totalFinal / (1 + IVA_RATE);
  const impuesto = totalFinal - importeNeto;

  return { importeArticulos, importeNeto, impuesto, totalFinal };
}

// compatibilidad: función anterior devuelve solo el total final
async function calcularTotal(idVenta: number) {
  const t = await calcularTotales(idVenta);
  return t.totalFinal;
}

// Crear PREVENTA = estado Pendiente + reservar comprometido
app.post(
  "/api/preventas",
  requireAuth,
  authorize(["Administrador", "Vendedor"]),
  async (req, res) => {
    try {
      const {
        idCliente,
        idTipoPago,
        observacion,
        detalles = [],
        items = [],
        descuentoGeneral,
        recargoPago,
        fechaFacturacion,
        fechaCobro,
      } = req.body;

      const detallesIn: any[] = Array.isArray(items) && items.length > 0 ? items : detalles;

      if (!idCliente || !idTipoPago || !Array.isArray(detallesIn) || detallesIn.length === 0)
        return res.status(400).json({ error: "FALTAN_DATOS" });

      // Validar ítems antes de crear
      if (
        !Array.isArray(detallesIn) ||
        detallesIn.length === 0 ||
        detallesIn.some((d: any) => !Number(d.idProducto) || !(toNum(d.cantidad) > 0))
      ) {
        return res.status(400).json({ error: "SIN_ITEMS" });
      }

      const idUsuario = getUserId(req);
      // Precalcular precios y detectar ofertas fuera de la transacción
      const ids = detallesIn.map((d: any) => Number(d.idProducto)).filter((x: any) => Number(x));
      const productosPre = await prisma.producto.findMany({
        where: { idProducto: { in: ids } },
        select: {
          idProducto: true,
          precioVentaPublicoProducto: true,
          ofertaProducto: true,
          porcentajeOfertaProducto: true,
          fechaInicioOferta: true,
          fechaFinOferta: true,
        },
      });
      const priceMap = new Map<number, number>(
        productosPre.map((p) => [Number(p.idProducto), Number(p.precioVentaPublicoProducto ?? 0)])
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTs = today.getTime();
      const offerPctMap = new Map<number, number>();
      for (const p of productosPre) {
        const pct = Number(p.porcentajeOfertaProducto ?? 0);
        const flag = p.ofertaProducto;
        const ini = parseLocalDate(p.fechaInicioOferta, false);
        const fin = parseLocalDate(p.fechaFinOferta, true);
        const iniTs = ini ? ini.getTime() : null;
        const finTs = fin ? fin.getTime() : null;
        const dentro = (iniTs == null || todayTs >= iniTs) && (finTs == null || todayTs <= finTs);
        const activo = (flag === undefined ? pct > 0 : Boolean(flag)) && pct > 0 && dentro;
        offerPctMap.set(Number(p.idProducto), activo ? pct : 0);
      }

      // Permitir incluir productos en oferta en presupuestos pendientes.

      const result = await prisma.$transaction(async (tx: any) => {
        const idPend = await getEstadoId(tx, ESTADOS.PENDIENTE);
        const mARS = await tx.moneda.findFirst({ where: { moneda: { equals: "ARS" } }, select: { idMoneda: true } });
        const idMoneda = mARS?.idMoneda ?? (await tx.moneda.findFirst({ select: { idMoneda: true } }))?.idMoneda ?? 1;

        // normalización de fechas si vienen en el payload
        const fFactIn = (() => {
          if (!fechaFacturacion) return undefined;
          const d = new Date(fechaFacturacion);
          return isNaN(d.getTime()) ? undefined : d;
        })();
        const fCobroIn = (() => {
          if (!fechaCobro) return undefined;
          const d = new Date(fechaCobro);
          return isNaN(d.getTime()) ? undefined : d;
        })();

        const v = await tx.venta.create({
          data: {
            fechaVenta: fFactIn ?? new Date(),
            fechaCobroVenta: fCobroIn ?? new Date(),
            // Vigencia: hasta las 09:00 (BA) del día siguiente
            fechaVencimiento: nextBuenosAiresNineAM(),
            observacion: observacion ?? null,
            idCliente: Number(idCliente),
            idEstadoVenta: idPend,
            idTipoPago: Number(idTipoPago),
            idMoneda,
            estadoPago: 'RESERVA',
            ...(descuentoGeneral !== undefined && { descuentoGeneralVenta: new Prisma.Decimal(descuentoGeneral) }),
            ...(recargoPago !== undefined && { recargoPagoVenta: new Prisma.Decimal(recargoPago) }),
            detalles: {
              create: detallesIn.map((d: any) => {
                const idP = Number(d.idProducto);
                const cant = toDec3(d.cantidad);
                const pu = toDec2(d.precioUnit ?? priceMap.get(idP) ?? 0);
                // Aplicar como valor por defecto el porcentaje de oferta vigente
                const descItem = toDec2(
                  d.descuentoItem ?? (offerPctMap.get(idP) ?? 0)
                );
                const recItem = toDec2(d.recargoItem ?? 0);
                return {
                  idProducto: idP,
                  cantidad: cant,
                  precioUnit: pu,
                  descuentoItem: descItem,
                  recargoItem: recItem,
                };
              }),
            },
          },
          select: { idVenta: true },
        });

        const items = detallesIn.map((d: any) => ({
          idProducto: Number(d.idProducto),
          cantidad: toNum(d.cantidad),
        }));

        await validarDisponible(tx, items);
        await reservarComprometido(tx, items);

        await registrarEventoIds(tx, {
          idVenta: v.idVenta,
          idUsuario,
          desdeId: null,
          hastaId: idPend,
          motivo: "creación",
        });

        await registrarActor(tx, { idVenta: v.idVenta, idUsuario, papel: PapelEnVenta.CREADOR });

        return v;
      });

      res.status(201).json({ id: result.idVenta });
    } catch (e: any) {
      console.error("POST /api/preventas error", e);
      res.status(400).json({
        error: e.message || "CREATE_FAILED",
        ...(DEV ? { code: e.code, meta: e.meta, stack: e.stack } : {})
      });
    }
  });

// Listar PREVENTAS por estado (default: no cerradas)
app.get(
  "/api/preventas",
  requireAuth,
  authorize(["Administrador", "Vendedor", "Cajero"]),
  async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    const estadoQ = (req.query.estado as string | undefined)?.toLowerCase();

    const estados = await prisma.estadoVenta.findMany({
      select: { idEstadoVenta: true, nombreEstadoVenta: true },
    });

    let ids: number[] = [];
    if (estadoQ) {
      const e = estados.find(x => x.nombreEstadoVenta.toLowerCase() === estadoQ);
      ids = e ? [e.idEstadoVenta] : [-1];
    } else {
      ids = estados
        .filter(x => !["finalizada", "cancelada"].includes(x.nombreEstadoVenta.toLowerCase()))
        .map(x => x.idEstadoVenta);
    }

    const rows = await prisma.venta.findMany({
      where: {
        idEstadoVenta: { in: ids },
        ...(q
          ? {
            Cliente: {
              OR: [
                { nombreCliente: { contains: q, mode: "insensitive" } },
                { apellidoCliente: { contains: q, mode: "insensitive" } },
                { emailCliente: { contains: q, mode: "insensitive" } },
              ],
            },
          }
          : {}),
      },
      include: { Cliente: true, TipoPago: true, EstadoVenta: true },
      orderBy: { idVenta: "desc" },
      take: 100,
    });

    const out = await Promise.all(
      rows.map(async v => ({
        id: v.idVenta,
        cliente: v.Cliente ? `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}` : "",
        fecha: v.fechaVenta,
        // Exponer fechas de vencimiento y de límite de reserva para el frontend
        fechaVencimiento: v.fechaVencimiento ?? null,
        fechaReservaLimite: v.fechaReservaLimite ?? null,
        metodoPago: v.TipoPago?.tipoPago ?? null,
        estado: v.EstadoVenta?.nombreEstadoVenta ?? "",
        descuentoGeneral: Number(v.descuentoGeneralVenta ?? 0),
        recargoPago: Number(v.recargoPagoVenta ?? 0),
        total: await calcularTotal(v.idVenta),
      }))
    );

    res.json(out);
  });

// Detalle PREVENTA
app.get(
  "/api/preventas/:id(\\d+)",
  requireAuth,
  authorize(["Administrador", "Vendedor", "Cajero"]),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "ID_INVALIDO" });
    const idUsuario = getUserId(req);

    // Expiración perezosa: si la preventa venció, marcarla como Vencida y liberar stock
    await prisma.$transaction(async (tx: any) => {
      const ventaMini = await tx.venta.findUnique({
        where: { idVenta: id },
        select: { idEstadoVenta: true, fechaVencimiento: true },
      });
      if (!ventaMini) return; // será manejado abajo con 404
      const now = new Date();
      const idVenc = await getEstadoId(tx, ESTADOS.VENCIDA);
      const idFin = await getEstadoId(tx, ESTADOS.FINALIZADA);
      const idCanc = await getEstadoId(tx, ESTADOS.CANCELADA);
      const idLC = await getEstadoId(tx, ESTADOS.LISTO_CAJA);
      const vencida = ventaMini.fechaVencimiento && ventaMini.fechaVencimiento < now;
      const esTerminal = [idVenc, idFin, idCanc, idLC].includes(ventaMini.idEstadoVenta);
      if (vencida && !esTerminal) {
        await marcarPreventaComoVencida(tx, {
          idVenta: id,
          idUsuario,
          estadoDesdeId: ventaMini.idEstadoVenta,
          motivo: "expiración automática por consulta",
        });
      }
    });
    const v = await prisma.venta.findUnique({
      where: { idVenta: id },
      include: {
        Cliente: true,
        TipoPago: true,
        EstadoVenta: true,
        detalles: { include: { Producto: true } },
      },
    });
    if (!v) return res.status(404).json({ error: "NOT_FOUND" });
    // Adjuntamos totales calculados para facilitar la visualización de descuentos/recargos
    const totals = await calcularTotales(id);
    res.json({ ...v, totales: totals });
  });

// Historial PREVENTA
app.get("/api/preventas/:id/historial", async (req, res) => {
  const id = Number(req.params.id);

  const eventos = await prisma.ventaEvento.findMany({
    where: { idVenta: id },
    orderBy: { createdAt: "desc" },
    select: {
      idVentaEvento: true,
      estadoDesde: true,
      estadoHasta: true,
      motivo: true,
      createdAt: true,
      Usuario: {
        select: {
          idUsuario: true,
          nombreUsuario: true,
          emailUsuario: true,
        },
      },
    },
  });

  const estados = await prisma.estadoVenta.findMany({
    select: { idEstadoVenta: true, nombreEstadoVenta: true },
  });
  const lookup = new Map(estados.map(e => [e.idEstadoVenta, e.nombreEstadoVenta]));

  const eventosDecorados = eventos.map(ev => ({
    id: ev.idVentaEvento,
    desde: ev.estadoDesde ? lookup.get(ev.estadoDesde) ?? ev.estadoDesde : null,
    hasta: lookup.get(ev.estadoHasta) ?? ev.estadoHasta,
    motivo: ev.motivo ?? null,
    fecha: ev.createdAt,
    usuario: ev.Usuario
      ? {
        idUsuario: ev.Usuario.idUsuario,
        nombreUsuario: ev.Usuario.nombreUsuario,
        emailUsuario: ev.Usuario.emailUsuario,
      }
      : null,
  }));

  res.json(eventosDecorados);
});

// Desglose de totales para una preventa (montos IVA-incluido y separación neto/IVA)
app.get(
  "/api/preventas/:id/totales",
  requireAuth,
  authorize(["Administrador", "Vendedor", "Cajero"]),
  async (req, res) => {
    const id = Number(req.params.id);
    const v = await prisma.venta.findUnique({
      where: { idVenta: id },
      select: {
        idVenta: true,
        descuentoGeneralVenta: true,
        recargoPagoVenta: true,
        detalles: {
          select: {
            idProducto: true,
            cantidad: true,
            precioUnit: true,
            descuentoItem: true,
            recargoItem: true,
          },
        },
      },
    });
    if (!v) return res.status(404).json({ error: "NOT_FOUND" });

    const totals = await calcularTotales(id);
    res.json({
      id: v.idVenta,
      descuentoGeneral: Number(v.descuentoGeneralVenta ?? 0),
      recargoPago: Number(v.recargoPagoVenta ?? 0),
      detalles: v.detalles,
      totales: totals,
    });
  }
);

// Listado de VENCIDOS (todas las preventas/reservas marcadas como Vencido) — solo Administrador
app.get(
  "/api/preventas/vencidos",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    try {
      const idVenc = await getEstadoId(prisma, ESTADOS.VENCIDA);
      if (!idVenc) return res.json([]);
      const rawPage = Number(req.query.page ?? 1);
      const rawPageSize = Number(req.query.pageSize ?? 5);
      const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
      const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? rawPageSize : 5;

      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const y = prev.getFullYear();
      const m = String(prev.getMonth() + 1).padStart(2, "0");
      const day = String(prev.getDate()).padStart(2, "0");
      const { desde, hasta } = rangoDia(`${y}-${m}-${day}`);

      const rows = await prisma.venta.findMany({
        where: {
          idEstadoVenta: idVenc,
          OR: [
            { fechaVencimiento: { gte: desde, lt: hasta } },
            { fechaReservaLimite: { gte: desde, lt: hasta } },
          ],
        },
        orderBy: { idVenta: "desc" },
        include: { Cliente: true, TipoPago: true, EstadoVenta: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      const out = await Promise.all(
        rows.map(async (v) => ({
          id: v.idVenta,
          cliente: v.Cliente ? `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}` : "",
          fecha: v.fechaVenta,
          fechaVencimiento: v.fechaVencimiento ?? null,
          fechaReservaLimite: v.fechaReservaLimite ?? null,
          metodoPago: v.TipoPago?.tipoPago ?? null,
          estado: v.EstadoVenta?.nombreEstadoVenta ?? "",
          total: Number(await calcularTotal(v.idVenta)),
        }))
      );
      res.json(out);
    } catch (err) {
      console.error("GET /api/preventas/vencidos error", err);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
);

// Editar / Lock / Finalizar / Cancelar PREVENTA
app.put(
  "/api/preventas/:id",
  requireAuth,
  async (req, res, next) => {
    const accion = String(req.body?.accion || "guardar").toLowerCase();
    const allow: Record<string, string[]> = {
      guardar: ["Administrador", "Vendedor", "Cajero"],
      editar: ["Administrador", "Vendedor", "Cajero"],
      reservar: ["Administrador", "Vendedor", "Cajero"],
      lock: ["Administrador", "Vendedor", "Cajero"],
      finalizar: ["Administrador", "Cajero"],
      cancelar: ["Administrador", "Cajero", "Vendedor"],
    };
    return authorize(allow[accion] || ["Administrador"])(req, res, next);
  },
  async (req, res) => {
    const id = Number(req.params.id);
    const idUsuario = getUserId(req);
    if (DEV) {
      try {
        const accionIn = String(req.body?.accion || "guardar").toLowerCase();
        console.log("PUT /api/preventas/:id start", { id, accion: accionIn, userId: idUsuario });
      } catch { }
    }

    // Expiración perezosa y bloqueo si ya está vencida
    try {
      await prisma.$transaction(async (tx: any) => {
        const ventaMini = await tx.venta.findUnique({
          where: { idVenta: id },
          select: { idEstadoVenta: true, fechaVencimiento: true },
        });
        if (!ventaMini) return; // se devolverá 404 más abajo si aplica
        const now = new Date();
        const idVenc = await getEstadoId(tx, ESTADOS.VENCIDA);
        const idFin = await getEstadoId(tx, ESTADOS.FINALIZADA);
        const idCanc = await getEstadoId(tx, ESTADOS.CANCELADA);
        const idLC = await getEstadoId(tx, ESTADOS.LISTO_CAJA);
        const vencida = ventaMini.fechaVencimiento && ventaMini.fechaVencimiento < now;
        const noExpira = [idVenc, idFin, idCanc, idLC].includes(ventaMini.idEstadoVenta);
        if (vencida && !noExpira) {
          await marcarPreventaComoVencida(tx, {
            idVenta: id,
            idUsuario,
            estadoDesdeId: ventaMini.idEstadoVenta,
            motivo: "expiración automática por modificación",
          });
        }
      });
      const idVencCheck = await getEstadoId(prisma, ESTADOS.VENCIDA);
      const ventaEstado = await prisma.venta.findUnique({
        where: { idVenta: id },
        select: { idEstadoVenta: true },
      });
      if (!ventaEstado) return res.status(404).json({ error: "NOT_FOUND" });
      if (ventaEstado.idEstadoVenta === idVencCheck) {
        return res.status(400).json({ error: "PREVENTA_VENCIDA" });
      }
    } catch (err) {
      // Si algo falla en expiración, continuar con manejo estándar para no bloquear casos no relacionados
      if (DEV) console.warn("lazy expire in PUT falló", err);
    }

    // normalización de payload
    const raw = req.body ?? {};
    let {
      idCliente,
      idTipoPago,
      observacion,
      fechaFacturacion,
      fechaCobro,
      idMoneda,
      accion,
      motivoCancelacion,
      motivoLock,
      comentarioCajero,
      descuentoGeneral,
      ajuste,
      recargoPago,
    } = raw;

    let items = Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.detalles)
        ? raw.detalles
        : undefined;

    if (accion === "editar") accion = "guardar";
    if (!accion) {
      if (Array.isArray(items) && items.length > 0) accion = "guardar";
      else if (raw.lock === true) accion = "lock";
    }

    // normalizar ítems a {idProducto:number,cantidad:number,precioUnit?:number,descuentoItem?:number,recargoItem?:number}
    // acepta alias: cant, qty, peso, gramos
    if (Array.isArray(items)) {
      items = items
        .map((i: any) => ({
          idProducto: Number(i.idProducto ?? i.productoId ?? i.id),
          cantidad: toNum(i.cantidad ?? i.cant ?? i.qty ?? i.peso ?? i.gramos),
          precioUnit: toNum(i.precioUnit),
          descuentoItem: toNum(i.descuentoItem),
          recargoItem: toNum(i.recargoItem),
        }));
    }

    if (!accion) return res.status(400).json({ error: "ACCION_REQUERIDA" });

    try {
      // Validación temprana SIN_ITEMS antes de tocar DB (solo para guardar)
      if (accion === "guardar") {
        if (
          !Array.isArray(items) ||
          items.length === 0 ||
          items.some((i: any) => Number(i.cantidad) <= 0)
        ) {
          throw new Error("SIN_ITEMS");
        }
      }

      // Lectura inicial fuera de la transacción (estado actual)
      const ventaAntes = await prisma.venta.findUnique({
        where: { idVenta: id },
        include: { EstadoVenta: true, detalles: true },
      });
      if (!ventaAntes) throw new Error("NOT_FOUND");
      const estadoActualNombre = ventaAntes.EstadoVenta.nombreEstadoVenta;

      // Normalizar campos de entrada no estructurados
      const normalizeObs = (v: any): string | undefined => {
        const s = String(v ?? "").trim();
        // tratar placeholders comunes como vacío
        if (!s || s === "-" || s === "—" || s.toLowerCase() === "n/a") return undefined;
        return s;
      };
      observacion = normalizeObs(observacion);
      const normalizeDateIn = (v: any): Date | undefined => {
        if (v === undefined || v === null || String(v).trim() === "") return undefined;
        const d = new Date(v);
        return isNaN(d.getTime()) ? undefined : d;
      };
      const fFactIn = normalizeDateIn(fechaFacturacion);
      const fCobroIn = normalizeDateIn(fechaCobro);

      // Determinar si hay cambios reales de encabezado respecto a valores actuales
      const numEq = (a: any, b: any) => Number(a ?? 0) === Number(b ?? 0);
      const dateEq = (a: any, b: any) => {
        if (!a && !b) return true;
        if (!a || !b) return false;
        const da = new Date(a).getTime();
        const db = new Date(b).getTime();
        // tolerar pequeñas diferencias de milisegundos
        return Math.abs(da - db) < 1000;
      };
      const headerChanged = (
        (idCliente !== undefined && !numEq(idCliente, ventaAntes.idCliente)) ||
        (idTipoPago !== undefined && !numEq(idTipoPago, ventaAntes.idTipoPago)) ||
        (observacion !== undefined && String(observacion).trim() !== String(ventaAntes.observacion ?? "").trim()) ||
        (fFactIn !== undefined && !dateEq(fFactIn, ventaAntes.fechaVenta)) ||
        (fCobroIn !== undefined && !dateEq(fCobroIn, ventaAntes.fechaCobroVenta)) ||
        (idMoneda !== undefined && !numEq(idMoneda, ventaAntes.idMoneda)) ||
        (descuentoGeneral !== undefined && !numEq(descuentoGeneral, ventaAntes.descuentoGeneralVenta)) ||
        (ajuste !== undefined && !numEq(ajuste, ventaAntes.ajusteVenta)) ||
        (recargoPago !== undefined && !numEq(recargoPago, ventaAntes.recargoPagoVenta))
      );

      // --- SOLO escrituras dentro de la transacción. Sin lecturas finales aquí.
      await prisma.$transaction(async (tx: any) => {

        const idPend = await getEstadoId(tx, ESTADOS.PENDIENTE);
        const idRes = await getEstadoId(tx, ESTADOS.RESERVADO);
        const idLC = await getEstadoId(tx, ESTADOS.LISTO_CAJA);
        const idFin = await getEstadoId(tx, ESTADOS.FINALIZADA);
        const idCan = await getEstadoId(tx, ESTADOS.CANCELADA);

        if (accion === "guardar") {
          const editable = [ESTADOS.PENDIENTE, ESTADOS.RESERVADO, ESTADOS.LISTO_CAJA].map(norm);
          if (!editable.includes(norm(estadoActualNombre)))
            throw new Error("ESTADO_INVALIDO");

          const antes = await tx.detalleVenta.findMany({
            where: { idVenta: id },
            select: { idProducto: true, cantidad: true, precioUnit: true, descuentoItem: true, recargoItem: true },
          });

          const esListoCaja = norm(estadoActualNombre) === norm(ESTADOS.LISTO_CAJA);
          const dataToUpdate: any = headerChanged
            ? {
              ...(idCliente !== undefined && idCliente !== null && idCliente !== "" && { idCliente: Number(idCliente) }),
              ...(esListoCaja && idTipoPago !== undefined && idTipoPago !== null && idTipoPago !== "" && { idTipoPago: Number(idTipoPago) }),
              ...(observacion !== undefined && { observacion }),
              ...(fFactIn !== undefined && !dateEq(fFactIn, ventaAntes.fechaVenta) && { fechaVenta: fFactIn }),
              ...(fCobroIn !== undefined && !dateEq(fCobroIn, ventaAntes.fechaCobroVenta) && { fechaCobroVenta: fCobroIn }),
              ...(esListoCaja && idMoneda !== undefined && idMoneda !== null && idMoneda !== "" && { idMoneda: Number(idMoneda) }),
              ...(esListoCaja && descuentoGeneral !== undefined && { descuentoGeneralVenta: new Prisma.Decimal(descuentoGeneral) }),
              ...(esListoCaja && ajuste !== undefined && { ajusteVenta: new Prisma.Decimal(ajuste) }),
              ...(esListoCaja && recargoPago !== undefined && { recargoPagoVenta: new Prisma.Decimal(recargoPago) }),
            }
            : undefined;
          if (dataToUpdate && Object.keys(dataToUpdate).length) {
            await tx.venta.update({ where: { idVenta: id }, data: dataToUpdate });
          }

          // normalizar payload → lista compactada por producto
          // compactar por producto, conservando últimos precio/porcentajes enviados
          const comp = new Map<number, { cantidad: number; precioUnit?: number; descuentoItem?: number; recargoItem?: number }>();
          for (const raw of items as any[]) {
            const pid = Number(raw.idProducto);
            const cant = toNum(raw.cantidad ?? raw.cant ?? raw.qty ?? raw.peso ?? raw.gramos);
            if (!pid || cant <= 0) continue;
            const prev = comp.get(pid) ?? { cantidad: 0 };
            comp.set(pid, {
              cantidad: (prev.cantidad ?? 0) + cant,
              precioUnit: raw.precioUnit ?? prev.precioUnit,
              descuentoItem: raw.descuentoItem ?? prev.descuentoItem,
              recargoItem: raw.recargoItem ?? prev.recargoItem,
            });
          }
          const itemsOk = [...comp.entries()].map(([idProducto, v]) => ({ idProducto, ...v }));

          if (itemsOk.length === 0) throw new Error("SIN_ITEMS");

          // Resolver precios por defecto y evaluar si los detalles cambian
          const ids = itemsOk.map(i => Number(i.idProducto)).filter((x: any) => Number(x));
          const productos = await tx.producto.findMany({
            where: { idProducto: { in: ids } },
            select: {
              idProducto: true,
              precioVentaPublicoProducto: true,
              ofertaProducto: true,
              porcentajeOfertaProducto: true,
              fechaInicioOferta: true,
              fechaFinOferta: true,
            },
          });
          const priceMap = new Map<number, number>(
            productos.map((p) => [Number(p.idProducto), Number(p.precioVentaPublicoProducto ?? 0)])
          );
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayTs = today.getTime();
          const offerPctMap = new Map<number, number>();
          for (const p of productos) {
            const pct = Number(p.porcentajeOfertaProducto ?? 0);
            const flag = p.ofertaProducto;
            const ini = parseLocalDate(p.fechaInicioOferta, false);
            const fin = parseLocalDate(p.fechaFinOferta, true);
            const iniTs = ini ? ini.getTime() : null;
            const finTs = fin ? fin.getTime() : null;
            const dentro = (iniTs == null || todayTs >= iniTs) && (finTs == null || todayTs <= finTs);
            const activo = (flag === undefined ? pct > 0 : Boolean(flag)) && pct > 0 && dentro;
            offerPctMap.set(Number(p.idProducto), activo ? pct : 0);
          }
          const reqMap = new Map<number, { c: number; pu: number; d: number; r: number }>();
          for (const i of itemsOk) {
            reqMap.set(Number(i.idProducto), {
              c: Number(i.cantidad),
              pu: Number(i.precioUnit ?? priceMap.get(Number(i.idProducto)) ?? 0),
              d: Number(i.descuentoItem ?? 0),
              r: Number(i.recargoItem ?? 0),
            });
          }
          const beforeMap = new Map<number, { c: number; pu: number; d: number; r: number }>();
          for (const a of antes) {
            beforeMap.set(a.idProducto, {
              c: Number(a.cantidad), pu: Number(a.precioUnit), d: Number(a.descuentoItem ?? 0), r: Number(a.recargoItem ?? 0)
            });
          }
          const detailsChanged = (
            beforeMap.size !== reqMap.size ||
            [...reqMap.entries()].some(([idP, v]) => {
              const b = beforeMap.get(idP);
              return !b || b.c !== v.c || b.pu !== v.pu || b.d !== v.d || b.r !== v.r;
            })
          );

          if (detailsChanged) {
            // reemplazar detalles
            try {
              await tx.detalleVenta.deleteMany({ where: { idVenta: id } });
              const dataDetalles = itemsOk.map(i => {
                const idProd = Number(i.idProducto);
                const prev = beforeMap.get(idProd);
                const precio = toDec2(i.precioUnit ?? priceMap.get(idProd) ?? 0);
                const desc = toDec2(
                  i.descuentoItem ?? (prev ? prev.d : (offerPctMap.get(idProd) ?? 0))
                );
                const rec = toDec2(i.recargoItem ?? 0);
                return {
                  idVenta: id,
                  idProducto: idProd,
                  cantidad: toDec3(i.cantidad),
                  precioUnit: precio,
                  descuentoItem: desc,
                  recargoItem: rec,
                };
              });
              await tx.detalleVenta.createMany({ data: dataDetalles });
              // fuerza error inmediato si la transacción quedó abortada
              await tx.$executeRaw`SELECT 1`;
            } catch (err) {
              if (err instanceof Prisma.PrismaClientKnownRequestError) throw err;
              throw new Error("DETALLES_CREATE_FAILED");
            }
          }

          // recomputar después
          const despues = await tx.detalleVenta.findMany({
            where: { idVenta: id },
            select: { idProducto: true, cantidad: true, precioUnit: true, descuentoItem: true, recargoItem: true },
          });

          // delta de comprometido = después - antes
          const delta = new Map<number, number>();
          for (const r of antes) delta.set(r.idProducto, (delta.get(r.idProducto) ?? 0) - Number(r.cantidad));
          for (const r of despues) delta.set(r.idProducto, (delta.get(r.idProducto) ?? 0) + Number(r.cantidad));

          const incs: { idProducto: number; cantidad: number }[] = [];
          const decs: { idProducto: number; cantidad: number }[] = [];
          for (const [idProducto, d] of delta) {
            if (d > 0) incs.push({ idProducto, cantidad: d });
            if (d < 0) decs.push({ idProducto, cantidad: Math.abs(d) });
          }

          // aplicar stock comprometido
          if (incs.length) { await validarDisponible(tx, incs); await reservarComprometido(tx, incs); }
          if (decs.length) { await liberarComprometido(tx, decs); }

          // Detectar cambios reales en detalles (cantidad/precio/descuento/recargo)
          const mapA = new Map<number, { c: number; pu: number; d: number; r: number }>();
          for (const a of antes) mapA.set(a.idProducto, {
            c: Number(a.cantidad), pu: Number(a.precioUnit), d: Number(a.descuentoItem ?? 0), r: Number(a.recargoItem ?? 0)
          });
          const mapB = new Map<number, { c: number; pu: number; d: number; r: number }>();
          for (const b of despues) mapB.set(b.idProducto, {
            c: Number(b.cantidad), pu: Number(b.precioUnit), d: Number(b.descuentoItem ?? 0), r: Number(b.recargoItem ?? 0)
          });
          const itemsChanged = (
            mapA.size !== mapB.size ||
            [...mapA.entries()].some(([idP, va]) => {
              const vb = mapB.get(idP);
              return !vb || va.c !== vb.c || va.pu !== vb.pu || va.d !== vb.d || va.r !== vb.r;
            })
          );

          // Registrar evento de edición SOLO si hubo cambios reales
          if (headerChanged || itemsChanged || incs.length || decs.length) {
            const estadoNorm = norm(estadoActualNombre);
            const desdeId = estadoNorm === norm(ESTADOS.PENDIENTE)
              ? idPend
              : (estadoNorm === norm(ESTADOS.RESERVADO) ? idRes : idLC);
            await registrarEventoIds(tx, { idVenta: id, idUsuario, desdeId, hastaId: desdeId, motivo: "edición" });
            await registrarActor(tx, { idVenta: id, idUsuario, papel: PapelEnVenta.EDITOR });
            if (comentarioCajero && String(comentarioCajero).trim().length > 0) {
              await agregarComentario(tx, { idVenta: id, idUsuario, comentario: String(comentarioCajero) });
            }
          }
        }
        // --- RESERVAR ---
        else if (accion === "reservar") {
          if (norm(estadoActualNombre) !== norm(ESTADOS.PENDIENTE))
            throw new Error("ESTADO_INVALIDO");

          const itemsAct = await leerItemsVenta(tx, id);
          if (itemsAct.length === 0) throw new Error("SIN_ITEMS");
          const idsProd = itemsAct.map((i) => Number(i.idProducto)).filter((x) => Number(x));
          if (idsProd.length > 0) {
            const prods = await tx.producto.findMany({
              where: { idProducto: { in: idsProd } },
              select: {
                idProducto: true,
                ofertaProducto: true,
                porcentajeOfertaProducto: true,
                fechaInicioOferta: true,
                fechaFinOferta: true,
              },
            });
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const nowTs = now.getTime();
            const hayOfertaActiva = prods.some((p) => {
              const pct = Number(p.porcentajeOfertaProducto ?? 0);
              const flag = p.ofertaProducto;
              const ini = parseLocalDate(p.fechaInicioOferta, false);
              const fin = parseLocalDate(p.fechaFinOferta, true);
              const iniTs = ini ? ini.getTime() : null;
              const finTs = fin ? fin.getTime() : null;
              const dentro = (iniTs == null || nowTs >= iniTs) && (finTs == null || nowTs <= finTs);
              return (flag === undefined ? pct > 0 : Boolean(flag)) && pct > 0 && dentro;
            });
            if (hayOfertaActiva) throw new Error("RESERVA_PRODUCTO_EN_OFERTA");
          }

          await tx.venta.update({
            where: { idVenta: id },
            data: { idEstadoVenta: idRes, estadoPago: 'PENDIENTE' },
          });

          await registrarEventoIds(tx, {
            idVenta: id, idUsuario,
            desdeId: idPend, hastaId: idRes,
            motivo: "reservada",
          });
          await registrarActor(tx, { idVenta: id, idUsuario, papel: PapelEnVenta.EDITOR });
        }
        // --- LOCK ---
        else if (accion === "lock") {
          const estadoNorm = norm(estadoActualNombre);
          if (![norm(ESTADOS.PENDIENTE), norm(ESTADOS.RESERVADO)].includes(estadoNorm))
            throw new Error("ESTADO_INVALIDO");
          if (!motivoLock || String(motivoLock).trim().length === 0)
            throw new Error("MOTIVO_REQUERIDO");

          console.log("LOCK preventa", { id, estadoAntes: estadoActualNombre });

          await tx.venta.update({
            where: { idVenta: id },
            data: {
              idEstadoVenta: idLC,
              estadoPago: 'PENDIENTE',
            },
          });

          const desdeId = estadoNorm === norm(ESTADOS.RESERVADO) ? idRes : idPend;
          await registrarEventoIds(tx, {
            idVenta: id, idUsuario,
            desdeId, hastaId: idLC,
            motivo: String(motivoLock)
          });
          await registrarActor(tx, { idVenta: id, idUsuario, papel: PapelEnVenta.EDITOR });
          await agregarComentario(tx, { idVenta: id, idUsuario, comentario: String(motivoLock) });

          console.log("LOCK preventa DONE", { id, estadoDespues: ESTADOS.LISTO_CAJA });
        }

        else if (accion === "cancelar") {
          if (![norm(ESTADOS.PENDIENTE), norm(ESTADOS.RESERVADO), norm(ESTADOS.LISTO_CAJA)].includes(norm(estadoActualNombre)))
            throw new Error("ESTADO_INVALIDO");
          if (!motivoCancelacion || String(motivoCancelacion).trim().length === 0)
            throw new Error("MOTIVO_REQUERIDO");

          const itemsAct = await leerItemsVenta(tx, id);
          await liberarComprometido(tx, itemsAct);

          const desde = norm(estadoActualNombre) === norm(ESTADOS.PENDIENTE)
            ? idPend
            : (norm(estadoActualNombre) === norm(ESTADOS.RESERVADO) ? idRes : idLC);
          await tx.venta.update({
            where: { idVenta: id },
            data: { idEstadoVenta: idCan },
          });
          await registrarEventoIds(tx, { idVenta: id, idUsuario, desdeId: desde, hastaId: idCan, motivo: String(motivoCancelacion) });
          await registrarActor(tx, { idVenta: id, idUsuario, papel: PapelEnVenta.ANULADOR });
          await agregarComentario(tx, { idVenta: id, idUsuario, comentario: String(motivoCancelacion) });
        }
        else if (accion === "finalizar") {
          if (norm(estadoActualNombre) !== norm(ESTADOS.LISTO_CAJA))
            throw new Error("ESTADO_INVALIDO");
          const itemsAct = await leerItemsVenta(tx, id);
          if (itemsAct.length === 0) throw new Error("SIN_ITEMS");
          if (itemsAct.some((i) => !(Number(i.cantidad) > 0))) {
            throw new Error("SIN_ITEMS");
          }

          // Antes de descontar stock, aplicar descuentos por oferta vigentes al momento del cobro
          {
            const idsProd = itemsAct.map((i) => Number(i.idProducto)).filter((x) => Number(x));
            if (idsProd.length > 0) {
              const prods = await tx.producto.findMany({
                where: { idProducto: { in: idsProd } },
                select: {
                  idProducto: true,
                  ofertaProducto: true,
                  porcentajeOfertaProducto: true,
                  fechaInicioOferta: true,
                  fechaFinOferta: true,
                },
              });
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              const nowTs = now.getTime();
              for (const p of prods) {
                const pct = Number(p.porcentajeOfertaProducto ?? 0);
                const flag = p.ofertaProducto;
                const ini = parseLocalDate(p.fechaInicioOferta, false);
                const fin = parseLocalDate(p.fechaFinOferta, true);
                const iniTs = ini ? ini.getTime() : null;
                const finTs = fin ? fin.getTime() : null;
                const dentro = (iniTs == null || nowTs >= iniTs) && (finTs == null || nowTs <= finTs);
                const activo = (flag === undefined ? pct > 0 : Boolean(flag)) && pct > 0 && dentro;
                const descuento = activo ? pct : 0;
                // Guardar el descuento por oferta directamente en el detalle
                await tx.detalleVenta.updateMany({
                  where: { idVenta: id, idProducto: Number(p.idProducto) },
                  data: { descuentoItem: toDec2(descuento) },
                });
              }
            }
          }

          await validarReal(tx, itemsAct);
          await descontarRealYComprometido(tx, itemsAct);
          await tx.venta.update({
            where: { idVenta: id },
            data: { idEstadoVenta: idFin, estadoPago: 'PAGADO', fechaCobroVenta: new Date() },
          });
          await registrarEventoIds(tx, { idVenta: id, idUsuario, desdeId: idLC, hastaId: idFin, motivo: "cobrada" });
          await registrarActor(tx, { idVenta: id, idUsuario, papel: PapelEnVenta.CAJERO });
          if (comentarioCajero && String(comentarioCajero).trim().length > 0) {
            await agregarComentario(tx, { idVenta: id, idUsuario, comentario: String(comentarioCajero) });
          }
        }
        else {
          throw new Error("ACCION_DESCONOCIDA");
        }
      });
      // Lectura final FUERA de la transacción
      const out = await prisma.venta.findUnique({
        where: { idVenta: id },
        include: {
          EstadoVenta: true,
          Cliente: { select: { nombreCliente: true, apellidoCliente: true } },
          detalles: { include: { Producto: true } },
        },
      });
      try {
        const estadoResp = out?.EstadoVenta?.nombreEstadoVenta ?? null;
        const accionResp = String(accion || "").toLowerCase();
        if (estadoResp && DEV) {
          console.log("PUT /api/preventas/:id done", { id, accion: accionResp, estado: estadoResp });
        }
        // Superficie un aviso en el frontend si se cerró o cambió de estado
        if (estadoResp && accionResp === "lock") {
          res.set("x-notification", `Estado actualizado: ${estadoResp}`);
          res.set("x-notification-type", "success");
          try {
            const total = Number(await calcularTotal(id));
            const cliente = out?.Cliente ? `${out.Cliente.apellidoCliente}, ${out.Cliente.nombreCliente}` : String(out?.idCliente ?? "");
            await prisma.notificacion.create({
              data: {
                tipo: TipoNotificacion.OTRO,
                mensaje: `Lista para caja #${id} — ${cliente} — $${total.toFixed(2)} — ${new Date().toLocaleTimeString()}`,
                nivel: NivelNotificacion.INFO,
                destinatario: DestinatarioNotificacion.CAJERO,
                data: { code: "NUEVA_LISTA_CAJA", ventaId: id },
                idUsuario,
              },
            });
          } catch (e) {
            console.error("notificacion NUEVA_LISTA_CAJA error", e);
          }
        }
      } catch { }
      return res.json(out);
    } catch (err: any) {
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "NOT_FOUND" });
      if (["STOCK_INEXISTENTE", "STOCK_INSUFICIENTE", "SIN_ITEMS", "ESTADO_INVALIDO", "ACCION_DESCONOCIDA", "MOTIVO_REQUERIDO", "RESERVA_PRODUCTO_EN_OFERTA"].includes(err.message))
        return res.status(400).json({ error: err.message });

      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") return res.status(409).json({ error: "UNIQUE_CONSTRAINT", target: err.meta?.target });
        if (err.code === "P2003") return res.status(400).json({ error: "FK_CONSTRAINT" });
      }

      console.error("PUT /api/preventas/:id error", err);
      return res.status(500).json({
        error: "UPDATE_FAILED",
        ...(DEV ? { message: err.message, code: err.code, meta: err.meta, stack: err.stack } : {})
      });
    }
  });

// Eliminar PREVENTA solo si Pendiente. Libera comprometido.
app.delete("/api/preventas/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.$transaction(async (tx: any) => {
      const v = await tx.venta.findUnique({
        where: { idVenta: id },
        include: { EstadoVenta: true },
      });
      if (!v) throw new Error("NOT_FOUND");
      if (v.EstadoVenta.nombreEstadoVenta.toLowerCase() !== ESTADOS.PENDIENTE.toLowerCase())
        throw new Error("ESTADO_INVALIDO");

      const items = await leerItemsVenta(tx, id);
      await liberarComprometido(tx, items);

      await tx.detalleVenta.deleteMany({ where: { idVenta: id } });
      await tx.venta.delete({ where: { idVenta: id } });
    });
    res.status(204).end();
  } catch (err: any) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ error: "NOT_FOUND" });
    if (err.message === "ESTADO_INVALIDO") return res.status(409).json({ error: "ESTADO_INVALIDO" });
    console.error(err);
    res.status(400).json({ error: "DELETE_FAILED" });
  }
});

// Reserva PREVENTA: actualizar fecha límite de reserva
app.put("/api/preventas/:id/reserva", requireAuth, authorize(["Administrador", "Cajero", "Vendedor"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const idUsuario = getUserId(req);
    const { fechaReservaLimite, motivo } = req.body ?? {};
    let fechaParsed: Date | null = null;
    if (fechaReservaLimite) {
      const s = String(fechaReservaLimite);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        // Interpretar día seleccionado como 09:00 Buenos Aires (UTC-3) para evitar desfasajes
        const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
        if (m) {
          const y = Number(m[1]);
          const mon = Number(m[2]) - 1;
          const day = Number(m[3]);
          // 09:00 BA = 12:00 UTC
          fechaParsed = new Date(Date.UTC(y, mon, day, 12, 0, 0, 0));
        } else {
          fechaParsed = new Date(`${s}T09:00:00-03:00`);
        }
      } else {
        fechaParsed = new Date(s);
      }
    }
    const data: any = { fechaReservaLimite: fechaParsed };
    const pv = await prisma.$transaction(async (tx: any) => {
      const vBefore = await tx.venta.findUnique({ where: { idVenta: id }, select: { idEstadoVenta: true } });
      let updated = await tx.venta.update({ where: { idVenta: id }, data });
      if (motivo && String(motivo).trim().length > 0) {
        await agregarComentario(tx, { idVenta: id, idUsuario, comentario: String(motivo) });
      }
      if (vBefore?.idEstadoVenta) {
        if (!fechaParsed) {
          const idRes = await getEstadoId(tx, ESTADOS.RESERVADO);
          const idCan = await getEstadoId(tx, ESTADOS.CANCELADA);
          if (vBefore.idEstadoVenta === idRes) {
            const itemsAct = await leerItemsVenta(tx, id);
            if (itemsAct.length) {
              await liberarComprometido(tx, itemsAct);
            }
            updated = await tx.venta.update({ where: { idVenta: id }, data: { idEstadoVenta: idCan } });
            await registrarEventoIds(tx, { idVenta: id, idUsuario, desdeId: idRes, hastaId: idCan, motivo: String(motivo || 'reserva quitada') });
            await registrarActor(tx, { idVenta: id, idUsuario, papel: PapelEnVenta.ANULADOR });
          } else {
            await registrarEventoIds(tx, { idVenta: id, idUsuario, desdeId: vBefore.idEstadoVenta, hastaId: vBefore.idEstadoVenta, motivo: 'reserva quitada' });
            await registrarActor(tx, { idVenta: id, idUsuario, papel: PapelEnVenta.EDITOR });
          }
        } else {
          await registrarEventoIds(tx, { idVenta: id, idUsuario, desdeId: vBefore.idEstadoVenta, hastaId: vBefore.idEstadoVenta, motivo: 'reserva postergada' });
          await registrarActor(tx, { idVenta: id, idUsuario, papel: PapelEnVenta.EDITOR });
        }
      }
      return updated;
    });
    res.json(pv);
  } catch (err) {
    console.error("PUT /api/preventas/:id/reserva error", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// Listado de PREVENTAS con reserva vencida
app.get("/api/preventas/reservas-vencidas", requireAuth, async (_req, res) => {
  try {
    // obtener id del estado 'Reservado'
    const estados = await prisma.estadoVenta.findMany({
      select: { idEstadoVenta: true, nombreEstadoVenta: true },
    });
    const reservado = estados.find(
      e => e.nombreEstadoVenta.toLowerCase() === "reservado"
    )?.idEstadoVenta;
    if (!reservado) return res.json([]);

    const rows = await prisma.venta.findMany({
      where: {
        idEstadoVenta: reservado,
        fechaReservaLimite: { not: null, lt: new Date() },
      },
      orderBy: { fechaVenta: "asc" },
      include: { Cliente: true, TipoPago: true, EstadoVenta: true },
    });
    res.json(rows);
  } catch (err) {
    console.error("GET /api/preventas/reservas-vencidas error", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

app.get(
  "/api/preventas/vencidas",
  requireAuth,
  authorize(["Administrador"]),
  async (_req, res) => {
    try {
      const idPend = await getEstadoId(prisma, ESTADOS.PENDIENTE);
      if (!idPend) return res.json([]);
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rows = await prisma.venta.findMany({
        where: {
          idEstadoVenta: idPend,
          OR: [
            { fechaVenta: { lt: cutoff } },
            { fechaReservaLimite: { not: null, lt: new Date() } },
          ],
        },
        orderBy: { fechaVenta: "asc" },
        include: { Cliente: true },
      });
      const out = await Promise.all(
        rows.map(async (v) => ({
          idVenta: v.idVenta,
          cliente: v.Cliente ? `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}` : "",
          fecha: v.fechaVenta,
          total: Number(await calcularTotal(v.idVenta)),
        }))
      );
      res.json(out);
    } catch (err) {
      console.error("GET /api/preventas/vencidas error", err);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
);

app.get(
  "/api/preventas/reservas-hoy",
  requireAuth,
  authorize(["Administrador", "Cajero"]),
  async (_req, res) => {
    try {
      const idRes = await getEstadoId(prisma, ESTADOS.RESERVADO);
      if (!idRes) return res.json([]);
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const { desde, hasta } = rangoDia(`${y}-${m}-${day}`);
      const rows = await prisma.venta.findMany({
        where: {
          idEstadoVenta: idRes,
          fechaReservaLimite: { gte: desde, lt: hasta },
        },
        orderBy: { fechaReservaLimite: "asc" },
        include: { Cliente: true },
      });
      res.json(rows.map((v) => ({
        idVenta: v.idVenta,
        cliente: v.Cliente ? `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}` : "",
        fechaReservaLimite: v.fechaReservaLimite,
      })));
    } catch (err) {
      console.error("GET /api/preventas/reservas-hoy error", err);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
);

app.get(
  "/api/ventas/pendientes-cobro",
  requireAuth,
  authorize(["Administrador", "Cajero"]),
  async (_req, res) => {
    try {
      const idLC = await getEstadoId(prisma, ESTADOS.LISTO_CAJA);
      if (!idLC) return res.json([]);
      const rows = await prisma.venta.findMany({
        where: {
          idEstadoVenta: idLC,
          estadoPago: { not: "PAGADO" },
        },
        include: { Cliente: true },
        orderBy: { idVenta: "desc" },
        take: 100,
      });
      const out = await Promise.all(
        rows.map(async (v) => ({
          idVenta: v.idVenta,
          cliente: v.Cliente ? `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}` : "",
          fecha: v.fechaVenta,
          total: Number(await calcularTotal(v.idVenta)),
        }))
      );
      res.json(out);
    } catch (err) {
      console.error("GET /api/ventas/pendientes-cobro error", err);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
);

app.get(
  "/api/cierres-caja/pending-today",
  requireAuth,
  authorize(["Administrador", "Cajero"]),
  async (_req, res) => {
    try {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const { desde, hasta } = rangoDia(`${y}-${m}-${day}`);
      const cierre = await prisma.cierreCaja.findFirst({ where: { fecha: { gte: desde, lt: hasta } } });
      res.json({ pending: !cierre, fecha: desde });
    } catch (err) {
      console.error("GET /api/cierres-caja/pending-today error", err);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
);

function nivelFromType(t: string): NivelNotificacion {
  const s = String(t || "").toLowerCase();
  if (s === "error") return NivelNotificacion.ERROR;
  if (s === "warning" || s === "warn") return NivelNotificacion.WARN;
  return NivelNotificacion.INFO;
}

function tipoFromCode(code?: string): TipoNotificacion {
  const c = String(code || "").toUpperCase();
  if (c.includes("STOCK")) return TipoNotificacion.STOCK_BAJO;
  if (c.includes("CIERRE_CAJA") && c.includes("PENDIENTE")) return TipoNotificacion.CIERRE_CAJA_PENDIENTE;
  if (c.includes("RESERVA") && c.includes("VENCIDA")) return TipoNotificacion.RESERVA_VENCIDA;
  if (c.includes("RESERVA")) return TipoNotificacion.RESERVA_POR_VENCER;
  if (c.includes("PRESUPUESTO")) return TipoNotificacion.PRESUPUESTOS_PENDIENTES;
  return TipoNotificacion.OTRO;
}

function destinatarioFromCode(code?: string): DestinatarioNotificacion {
  const c = String(code || "").toUpperCase();
  if (c.includes("RESERVA") || c.includes("VENTA_PENDIENTE_COBRO")) return DestinatarioNotificacion.CAJERO;
  if (c.includes("PRESUPUESTO")) return DestinatarioNotificacion.VENDEDOR;
  if (c.includes("CIERRE_CAJA") || c.includes("STOCK")) return DestinatarioNotificacion.ADMIN;
  return DestinatarioNotificacion.ADMIN;
}

async function getDestinatariosPermitidos(req: any): Promise<DestinatarioNotificacion[]> {
  const uid = getUserId(req);
  const roles = await prisma.usuarioRol.findMany({ where: { idUsuario: uid }, include: { Rol: true } });
  const set = new Set<DestinatarioNotificacion>([DestinatarioNotificacion.TODOS]);
  for (const r of roles) {
    const nombre = String(r.Rol?.nombreRol || "").toLowerCase();
    if (nombre.includes("administrador")) set.add(DestinatarioNotificacion.ADMIN);
    if (nombre.includes("cajero")) set.add(DestinatarioNotificacion.CAJERO);
    if (nombre.includes("vendedor")) set.add(DestinatarioNotificacion.VENDEDOR);
  }
  return Array.from(set);
}

app.get("/api/notificaciones", requireAuth, async (req, res) => {
  try {
    const permitidos = await getDestinatariosPermitidos(req);
    const leidoRaw = req.query.leido;
    const where: any = { destinatario: { in: permitidos } };
    if (leidoRaw !== undefined) {
      const v = String(leidoRaw).toLowerCase();
      where.leido = v === "true" ? true : v === "false" ? false : undefined;
    }
    const rows = await prisma.notificacion.findMany({
      where,
      orderBy: { idNotificacion: "desc" },
      take: 200,
    });
    res.json(rows);
  } catch (err) {
    console.error("GET /api/notificaciones error", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

app.post("/api/notificaciones", requireAuth, async (req, res) => {
  try {
    const { code, type, title, message, destinatario } = req.body ?? {};
    const uid = getUserId(req);
    const tipo = tipoFromCode(code);
    const nivel = nivelFromType(type);
    const dest = destinatario ? (destinatario as DestinatarioNotificacion) : destinatarioFromCode(code);
    const msg = String(message || "");
    const start = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const exists = await prisma.notificacion.findFirst({
      where: { tipo, nivel, destinatario: dest, mensaje: msg, createdAt: { gte: start } },
      orderBy: { idNotificacion: "desc" },
    });
    if (exists) {
      return res.status(200).json(exists);
    }
    const row = await prisma.notificacion.create({
      data: {
        tipo,
        mensaje: msg,
        nivel,
        data: { code: code ?? null, title: title ?? null },
        idUsuario: uid,
        destinatario: dest,
      },
    });
    res.status(201).json(row);
  } catch (err) {
    console.error("POST /api/notificaciones error", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

app.put("/api/notificaciones/mark-all-read", requireAuth, async (req, res) => {
  try {
    const permitidos = await getDestinatariosPermitidos(req);
    const out = await prisma.notificacion.updateMany({
      where: { destinatario: { in: permitidos }, leido: false },
      data: { leido: true },
    });
    res.json({ updated: out.count });
  } catch (err) {
    console.error("PUT /api/notificaciones/mark-all-read error", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

app.put("/api/notificaciones/:id/read", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "BAD_ID" });
    const row = await prisma.notificacion.update({ where: { idNotificacion: id }, data: { leido: true } });
    res.json(row);
  } catch (err) {
    console.error("PUT /api/notificaciones/:id/read error", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// Ventas: listar solo Finalizadas o Canceladas
app.get("/api/ventas", async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();

  const estados = await prisma.estadoVenta.findMany({
    where: {
      nombreEstadoVenta: {
        in: ["Finalizada", "Cancelada"],
        mode: "insensitive",
      } as any,
    },
    select: { idEstadoVenta: true, nombreEstadoVenta: true },
  });

  const estadoIds = estados.map((e) => e.idEstadoVenta);

  const rows = await prisma.venta.findMany({
    where: {
      idEstadoVenta: { in: estadoIds },
      ...(q
        ? {
          Cliente: {
            OR: [
              { nombreCliente: { contains: q, mode: "insensitive" } },
              { apellidoCliente: { contains: q, mode: "insensitive" } },
              { emailCliente: { contains: q, mode: "insensitive" } },
            ],
          },
        }
        : {}),
    },
    include: {
      Cliente: true,
      TipoPago: true,
      EstadoVenta: true,
      detalles: {
        include: { Producto: { select: { precioVentaPublicoProducto: true } } },
      },
    },
    orderBy: { idVenta: "desc" },
    take: 100,
  });

  const out = await Promise.all(rows.map(async (v) => {
    const total = await calcularTotal(v.idVenta);

    return {
      id: v.idVenta,
      cliente: v.Cliente
        ? `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}`
        : "",
      fecha: v.fechaVenta?.toISOString().slice(0, 10) ?? "",
      metodoPago: v.TipoPago?.tipoPago ?? null,
      estado: v.EstadoVenta?.nombreEstadoVenta ?? "",
      total,
    };
  }));

  res.json(out);
});

// Detalle de una venta por id (incluye items y totales)
app.get("/api/ventas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "INVALID_ID" });

    const v = await prisma.venta.findUnique({
      where: { idVenta: id },
      include: {
        Cliente: true,
        TipoPago: true,
        EstadoVenta: true,
        detalles: {
          include: { Producto: { select: { nombreProducto: true } } },
        },
      },
    });
    if (!v) return res.status(404).json({ error: "NOT_FOUND" });

    const totales = await calcularTotales(id);
    const detalles = v.detalles.map(d => ({
      producto: d.Producto?.nombreProducto ?? "",
      cantidad: Number(d.cantidad ?? 0),
      precioUnit: Number(d.precioUnit ?? 0),
      descuentoItem: Number(d.descuentoItem ?? 0),
      recargoItem: Number(d.recargoItem ?? 0),
    }));

    res.json({
      id: v.idVenta,
      cliente: v.Cliente ? `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}` : "",
      fecha: v.fechaVenta?.toISOString().slice(0, 10) ?? "",
      metodoPago: v.TipoPago?.tipoPago ?? null,
      estado: v.EstadoVenta?.nombreEstadoVenta ?? "",
      totales,
      detalles,
    });
  } catch (err) {
    console.error("GET /api/ventas/:id error", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// — buscador de productos simple
app.get("/api/products/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const where = q
    ? {
      OR: [
        { nombreProducto: { contains: q, mode: "insensitive" as const } },
        { codigoProducto: { contains: q, mode: "insensitive" as const } },
      ],
    }
    : undefined;

  const rows = await prisma.producto.findMany({
    where,
    select: {
      idProducto: true,
      nombreProducto: true,
      codigoProducto: true,
      precioVentaPublicoProducto: true,
    },
    orderBy: { idProducto: "desc" },
    take: q ? 20 : 100,
  });

  res.json(
    rows.map(r => ({
      id: r.idProducto,
      nombre: r.nombreProducto,
      sku: r.codigoProducto,
      precio: Number(r.precioVentaPublicoProducto),
    }))
  );
});

// lista tipos de pago
app.get("/api/tipos-pago", async (_req, res) => {
  const rows = await prisma.tipoPago.findMany({
    select: { idTipoPago: true, tipoPago: true },
    orderBy: { tipoPago: "asc" },
  });
  res.json(rows.map(r => ({ idTipoPago: r.idTipoPago, tipoPago: r.tipoPago })));
});
// lista métodos de pago (para Compras)
app.get("/api/metodos-pago", async (_req, res) => {
  const rows = await prisma.metodoPago.findMany({
    select: { idMetodoPago: true, metodoPago: true },
    orderBy: { metodoPago: "asc" },
  });
  res.json(rows.map(r => ({ idMetodoPago: r.idMetodoPago, metodoPago: r.metodoPago })));
});
// lista monedas
app.get("/api/monedas", async (_req, res) => {
  const rows = await prisma.moneda.findMany({
    select: { idMoneda: true, moneda: true, precio: true, updatedAt: true },
    orderBy: { moneda: "asc" },
  });
  res.json(
    rows.map(r => ({
      idMoneda: r.idMoneda,
      moneda: r.moneda,
      precio: Number(r.precio),
      updatedAt: r.updatedAt,
    }))
  );
});

// Crear moneda (Admin)
app.post(
  "/api/monedas",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    try {
      const { moneda, precio } = req.body ?? {};
      if (!moneda || precio === undefined || precio === null) {
        return res.status(400).json({ error: "FALTAN_DATOS" });
      }
      const row = await prisma.moneda.create({
        data: { moneda: String(moneda), precio: new Prisma.Decimal(Number(precio)) },
      });
      res.status(201).json({
        idMoneda: row.idMoneda,
        moneda: row.moneda,
        precio: Number(row.precio),
        updatedAt: row.updatedAt,
      });
    } catch (err) {
      console.error("POST /api/monedas error", err);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
);

// Actualizar precio moneda (Admin)
app.put(
  "/api/monedas/:id",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { precio, moneda } = req.body ?? {};
      if (!id) {
        return res.status(400).json({ error: "FALTAN_DATOS" });
      }
      const data: { precio?: Prisma.Decimal; moneda?: string } = {};
      if (precio !== undefined && precio !== null) {
        data.precio = new Prisma.Decimal(Number(precio));
      }
      if (typeof moneda === "string" && moneda.trim().length > 0) {
        data.moneda = String(moneda).trim();
      }
      if (!data.precio && !data.moneda) {
        return res.status(400).json({ error: "FALTAN_DATOS" });
      }
      const row = await prisma.moneda.update({ where: { idMoneda: id }, data });
      res.json({
        idMoneda: row.idMoneda,
        moneda: row.moneda,
        precio: Number(row.precio),
        updatedAt: row.updatedAt,
      });
    } catch (err) {
      console.error("PUT /api/monedas/:id error", err);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
);

// Eliminar moneda (Admin)
app.delete(
  "/api/monedas/:id",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!id) {
        return res.status(400).json({ error: "FALTAN_DATOS" });
      }
      const [compras, ventas] = await Promise.all([
        prisma.compra.count({ where: { idMoneda: id } }),
        prisma.venta.count({ where: { idMoneda: id } }),
      ]);
      if (compras + ventas > 0) {
        return res.status(409).json({ error: "MONEDA_EN_USO", details: { compras, ventas } });
      }
      await prisma.moneda.delete({ where: { idMoneda: id } });
      res.status(204).end();
    } catch (err: any) {
      if (err?.code === "P2025") {
        return res.status(404).json({ error: "NO_ENCONTRADO" });
      }
      if (err?.code === "P2003") {
        return res.status(409).json({ error: "MONEDA_EN_USO" });
      }
      console.error("DELETE /api/monedas/:id error", err);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  }
);

/* ---- montar router ---- */
app.use("/api", api);

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

// Endpoint de debug para pruebas: devuelve IDs de estados (solo en DEV)
if (DEV) {
  app.get("/api/_debug/estado-ids", async (_req, res) => {
    try {
      const estados = await prisma.estadoVenta.findMany({
        select: { idEstadoVenta: true, nombreEstadoVenta: true },
        orderBy: { idEstadoVenta: "asc" },
      });
      const map = Object.fromEntries(
        estados.map((e) => [e.nombreEstadoVenta, e.idEstadoVenta])
      );
      res.json({ estados: map });
    } catch (err) {
      console.error("_debug/estado-ids error", err);
      res.status(500).json({ error: "SERVER_ERROR" });
    }
  });
}

/* ========================
   STATS (Productos, Clientes, Meses)
   ======================== */

// Utilidad: normaliza rango fechas
function parseRange(q: any) {
  const desdeStr = q.desde ? String(q.desde) : undefined;
  const hastaStr = q.hasta ? String(q.hasta) : undefined;
  const desde = desdeStr ? new Date(desdeStr) : undefined;
  const hasta = hastaStr ? new Date(hastaStr) : undefined;
  return { desde, hasta };
}

// Productos vendidos en rango (orden asc/desc por cantidad)
app.get(
  "/api/stats/products",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    const { desde, hasta } = parseRange(req.query);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 10)));
    const order = String(req.query.order ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const familiaId = req.query.familiaId ? Number(req.query.familiaId) : undefined;

    // Leer ventas en rango con detalles y producto
    const whereVenta: any = {};
    if (desde || hasta) {
      whereVenta.fechaVenta = {
        ...(desde && { gte: desde }),
        ...(hasta && { lte: hasta }),
      };
    }

    const ventas = await prisma.venta.findMany({
      where: whereVenta,
      select: {
        idVenta: true,
        detalles: {
          select: {
            idProducto: true,
            cantidad: true,
            Producto: {
              select: {
                nombreProducto: true,
                SubFamilia: {
                  select: {
                    Familia: { select: { idFamilia: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const agg = new Map<number, { idProducto: number; nombre: string; cantidad: number }>();
    for (const v of ventas) {
      for (const d of v.detalles) {
        // filtrar por familia si se especifica
        if (familiaId) {
          const famId = d.Producto?.SubFamilia?.Familia?.idFamilia
            ? Number(d.Producto.SubFamilia.Familia.idFamilia)
            : undefined;
          if (!famId || famId !== familiaId) continue;
        }
        const idP = Number(d.idProducto);
        const nombre = d.Producto?.nombreProducto ?? String(d.idProducto);
        const cant = Number(d.cantidad ?? 0);
        const prev = agg.get(idP) ?? { idProducto: idP, nombre, cantidad: 0 };
        prev.cantidad += cant;
        agg.set(idP, prev);
      }
    }
    const rows = [...agg.values()]
      .sort((a, b) => (order === "asc" ? a.cantidad - b.cantidad : b.cantidad - a.cantidad))
      .slice(0, limit);

    res.json(rows);
  });

// Clientes con más ventas en rango
app.get(
  "/api/stats/customers",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    const { desde, hasta } = parseRange(req.query);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 10)));
    const metric = String(req.query.metric ?? "compras"); // compras | productos | monto
    const search = String(req.query.search ?? "").trim().toLowerCase();

    const whereVenta: any = {};
    if (desde || hasta) {
      whereVenta.fechaVenta = {
        ...(desde && { gte: desde }),
        ...(hasta && { lte: hasta }),
      };
    }

    const ventas = await prisma.venta.findMany({
      where: whereVenta,
      select: {
        idVenta: true,
        idCliente: true,
        Cliente: { select: { idCliente: true, nombreCliente: true, apellidoCliente: true } },
      },
    });

    const agg = new Map<
      number,
      { idCliente: number; nombre: string; compras: number; productos: number; monto: number }
    >();

    for (const v of ventas) {
      const idC = Number(v.idCliente ?? v.Cliente?.idCliente);
      if (!idC) continue;
      const nombre = v.Cliente
        ? `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}`
        : String(idC);

      // cantidad de productos en esta venta
      const dets = await prisma.detalleVenta.findMany({
        where: { idVenta: Number(v.idVenta) },
        select: { cantidad: true },
      });
      const cantProductos = dets.reduce((a, d) => a + Number(d.cantidad ?? 0), 0);

      // monto total de esta venta
      const total = await calcularTotal(Number(v.idVenta));

      const prev =
        agg.get(idC) ?? { idCliente: idC, nombre, compras: 0, productos: 0, monto: 0 };
      prev.compras += 1;
      prev.productos += cantProductos;
      prev.monto += Number(total);
      agg.set(idC, prev);
    }

    const rows = [...agg.values()].sort((a, b) => {
      if (metric === "monto") return b.monto - a.monto;
      if (metric === "productos") return b.productos - a.productos;
      return b.compras - a.compras;
    }).filter(r => !search || r.nombre.toLowerCase().includes(search)).slice(0, limit);

    res.json(rows);
  });

// Ventas vs Compras por mes (montos), con filtro de cantidad de meses
app.get(
  "/api/stats/sales-vs-purchases",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    const { desde, hasta } = parseRange(req.query);
    const monthsCount = Math.max(1, Math.min(24, Number(req.query.months ?? 12)));

    const whereVenta: any = {};
    if (desde || hasta) {
      whereVenta.fechaVenta = {
        ...(desde && { gte: desde }),
        ...(hasta && { lte: hasta }),
      };
    }
    const whereCompra: any = {};
    if (desde || hasta) {
      whereCompra.fechaComprobanteCompra = {
        ...(desde && { gte: desde }),
        ...(hasta && { lte: hasta }),
      };
    }

    const [ventas, compras] = await Promise.all([
      prisma.venta.findMany({
        where: whereVenta,
        select: { idVenta: true, fechaVenta: true },
        orderBy: { fechaVenta: "asc" },
      }),
      prisma.compra.findMany({
        where: whereCompra,
        select: { id: true, fechaComprobanteCompra: true, total: true },
        orderBy: { fechaComprobanteCompra: "asc" },
      }),
    ]);

    const bucketsV = new Map<string, number>();
    for (const v of ventas) {
      const f = v.fechaVenta ? new Date(v.fechaVenta) : null;
      if (!f) continue;
      const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`;
      const total = await calcularTotal(Number(v.idVenta));
      bucketsV.set(key, (bucketsV.get(key) ?? 0) + Number(total));
    }

    const bucketsC = new Map<string, number>();
    for (const c of compras) {
      const f = c.fechaComprobanteCompra ? new Date(c.fechaComprobanteCompra as any) : null;
      if (!f) continue;
      const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`;
      const total = Number(c.total ?? 0);
      bucketsC.set(key, (bucketsC.get(key) ?? 0) + total);
    }

    // union de meses
    const monthsSet = new Set<string>([...bucketsV.keys(), ...bucketsC.keys()]);
    const monthsSorted = [...monthsSet.values()].sort();
    const monthsLimited = monthsSorted.slice(Math.max(0, monthsSorted.length - monthsCount));

    const series = monthsLimited.map((m) => ({
      month: m,
      ventas: Number(bucketsV.get(m) ?? 0),
      compras: Number(bucketsC.get(m) ?? 0),
    }));

    res.json({ series });
  });

// Análisis de proveedores: total comprado por proveedor en el período
app.get(
  "/api/stats/proveedores",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    const { desde, hasta } = parseRange(req.query);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit ?? 10)));
    const where: any = {};
    if (desde || hasta) {
      where.fechaComprobanteCompra = {
        ...(desde && { gte: desde }),
        ...(hasta && { lte: hasta }),
      };
    }

    const compras = await prisma.compra.findMany({
      where,
      select: { idProveedor: true, total: true, Proveedor: { select: { idProveedor: true, nombreProveedor: true } } },
    });

    const agg = new Map<number, { idProveedor: number; nombre: string; total: number }>();
    for (const c of compras) {
      const idP = Number(c.idProveedor ?? c.Proveedor?.idProveedor);
      const nombre = c.Proveedor?.nombreProveedor ?? String(idP);
      const prev = agg.get(idP) ?? { idProveedor: idP, nombre, total: 0 };
      prev.total += Number(c.total ?? 0);
      agg.set(idP, prev);
    }
    const rows = [...agg.values()].sort((a, b) => b.total - a.total).slice(0, limit);
    res.json(rows);
  });

// Ventas por mes (monto total) y el mes con mayor monto
app.get(
  "/api/stats/months",
  requireAuth,
  authorize(["Administrador"]),
  async (req, res) => {
    const { desde, hasta } = parseRange(req.query);
    const whereVenta: any = {};
    if (desde || hasta) {
      whereVenta.fechaVenta = {
        ...(desde && { gte: desde }),
        ...(hasta && { lte: hasta }),
      };
    }

    const ventas = await prisma.venta.findMany({
      where: whereVenta,
      select: { idVenta: true, fechaVenta: true },
      orderBy: { fechaVenta: "asc" },
    });

    const buckets = new Map<string, number>();
    for (const v of ventas) {
      const f = v.fechaVenta ? new Date(v.fechaVenta) : null;
      if (!f) continue;
      const key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}`;
      const total = await calcularTotal(Number(v.idVenta));
      buckets.set(key, (buckets.get(key) ?? 0) + Number(total));
    }
    const series = [...buckets.entries()].map(([month, monto]) => ({ month, monto }));
    const best = series.reduce<{ month: string | null; monto: number }>(
      (acc, cur) => (cur.monto > (acc.monto ?? 0) ? cur : acc),
      { month: null, monto: 0 }
    );

    res.json({ series, bestMonth: best.month, bestAmount: best.monto });
  });

app.get(
  "/api/stats/dashboard-admin",
  requireAuth,
  authorize(["Administrador"]),
  async (_req, res) => {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth(); // 0-based
      const d = now.getDate();
      const inicioDiaBA = new Date(Date.UTC(y, m, d, 3, 0, 0, 0));
      const finDiaBA = new Date(Date.UTC(y, m, d + 1, 3, 0, 0, 0));

      const idFinal = await getEstadoId(prisma as any, ESTADOS.FINALIZADA);
      const ventasHoyRows = await prisma.venta.findMany({
        where: {
          idEstadoVenta: idFinal,
          fechaVenta: { gte: inicioDiaBA, lt: finDiaBA },
        },
        select: { idVenta: true },
      });
      const ventasHoyCount = ventasHoyRows.length;
      let ventasHoyTotal = 0;
      for (const v of ventasHoyRows) {
        const t = await calcularTotal(Number(v.idVenta));
        ventasHoyTotal += Number(t);
      }

      const inicioMesBA = new Date(Date.UTC(y, m, 1, 3, 0, 0, 0));
      const finMesBA = finDiaBA; // hasta fin del día actual
      const ventasMesRows = await prisma.venta.findMany({
        where: {
          idEstadoVenta: idFinal,
          fechaVenta: { gte: inicioMesBA, lt: finMesBA },
        },
        select: { idVenta: true },
      });
      const ventasMesCount = ventasMesRows.length;
      let ventasMesTotal = 0;
      for (const v of ventasMesRows) {
        const t = await calcularTotal(Number(v.idVenta));
        ventasMesTotal += Number(t);
      }

      const idPend = await getEstadoId(prisma as any, ESTADOS.PENDIENTE);
      const preventasPendientesCount = await prisma.venta.count({
        where: { idEstadoVenta: idPend },
      });

      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const productosAntiguos = await prisma.producto.findMany({
        where: { updatedAt: { lt: cutoff } },
        select: { idProducto: true },
      });
      const stocksAntiguos = await prisma.stock.findMany({
        where: { ultimaModificacionStock: { lt: cutoff } },
        select: { idProducto: true },
      });
      const setIds = new Set<number>();
      for (const p of productosAntiguos) setIds.add(Number(p.idProducto));
      for (const s of stocksAntiguos) setIds.add(Number(s.idProducto));
      const preciosDesactualizadosCount = setIds.size;

      res.json({
        ventasHoy: { cantidad: ventasHoyCount, total: ventasHoyTotal },
        ventasMes: { cantidad: ventasMesCount, total: ventasMesTotal },
        preventasPendientes: { cantidad: preventasPendientesCount },
        preciosDesactualizados: { cantidad: preciosDesactualizadosCount },
      });
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: "DASHBOARD_ADMIN_FAILED" });
    }
  }
);

/* ========================
   CIERRE DE CAJA (básico)
   ======================== */

// Rango de un día calendario en Buenos Aires (UTC-3) [00:00 BA, siguiente 00:00 BA)
function rangoDia(dateStr: string) {
  // Si viene en formato YYYY-MM-DD, usar esa fecha tal cual en zona BA
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(dateStr || ""));
  let y: number, mon: number, day: number;
  if (m) {
    y = Number(m[1]);
    mon = Number(m[2]) - 1;
    day = Number(m[3]);
  } else {
    // Fallback: tomar "hoy" en zona BA a partir de la hora actual
    const nowUtc = new Date();
    const ba = new Date(nowUtc.getTime() - 3 * 3600 * 1000);
    y = ba.getUTCFullYear();
    mon = ba.getUTCMonth();
    day = ba.getUTCDate();
  }
  // 00:00 BA ≡ 03:00 UTC
  const desde = new Date(Date.UTC(y, mon, day, 3, 0, 0, 0));
  const hasta = new Date(Date.UTC(y, mon, day + 1, 3, 0, 0, 0));
  return { desde, hasta };
}

// Calcula totales del día para cierre
async function calcularTotalesCierre(fechaStr: string) {
  const { desde, hasta } = rangoDia(fechaStr);

  // Tipo intermedio para evitar problemas de tipos en la unión
  type VentaParaCierre = {
    idVenta: number;
    idTipoPago: number | null;
    TipoPago?: { tipoPago: string } | null;
    Cliente?: { nombreCliente: string; apellidoCliente: string } | null;
  };

  // Ventas cobradas ese día por fechaCobroVenta
  const ventasPorCobro = (await prisma.venta.findMany({
    where: {
      fechaCobroVenta: { gte: desde, lt: hasta },
      estadoPago: "PAGADO",
    },
    select: {
      idVenta: true,
      idTipoPago: true,
      TipoPago: { select: { tipoPago: true } },
      Cliente: { select: { nombreCliente: true, apellidoCliente: true } },
    },
  })) as unknown as VentaParaCierre[];
  // Regla clara: el cierre usa exclusivamente fechaCobroVenta.
  // Evitamos confusión con eventos "cobrada" que podrían tener timestamps distintos.
  const ventas = ventasPorCobro;

  let totalVentas = 0;
  const porMetodo = new Map<string, number>();
  const ventasDelDia: Array<{ idVenta: number; cliente: string; metodoPago: string; total: number }> = [];
  for (const v of ventas) {
    const totalV = Number(await calcularTotal(Number(v.idVenta)));
    totalVentas += totalV;
    const metodo = v.TipoPago?.tipoPago ?? String(v.idTipoPago);
    const prev = porMetodo.get(metodo) ?? 0;
    porMetodo.set(metodo, prev + totalV);
    const cliente = [v.Cliente?.nombreCliente, v.Cliente?.apellidoCliente].filter(Boolean).join(" ") || "-";
    ventasDelDia.push({ idVenta: Number(v.idVenta), cliente, metodoPago: metodo, total: totalV });
  }

  const ventasPorMetodo = Array.from(porMetodo.entries()).map(([metodo, total]) => ({ metodo, total }));

  // Compras finalizadas ese día
  const compras = await prisma.compra.findMany({
    where: {
      fechaComprobanteCompra: { gte: desde, lt: hasta },
      estado: "Finalizado",
    },
    select: { id: true, total: true, Proveedor: { select: { nombreProveedor: true } } },
  });

  const totalCompras = compras.reduce((acc, c) => acc + Number(c.total ?? 0), 0);
  const comprasDelDia = compras.map((c) => ({ idCompra: Number(c.id), proveedor: c.Proveedor?.nombreProveedor ?? "-", total: Number(c.total ?? 0) }));
  // Ingresos efectivos del día: solo ventas cobradas con método "Efectivo"
  const ingresoEfectivo = Array.from(porMetodo.entries()).reduce((acc, [metodo, total]) => {
    const isCash = String(metodo).toLowerCase().startsWith("efectivo");
    return acc + (isCash ? Number(total) : 0);
  }, 0);
  const totalCobros = ingresoEfectivo; // solo efectivo impacta caja

  // Egresos del día
  const egresos = (await (prisma as any).egresoCaja.findMany({
    where: { fecha: { gte: desde, lt: hasta } },
    select: { monto: true, comentario: true },
    orderBy: { createdAt: "asc" },
  })) as Array<{ monto: number | string; comentario: string | null }>;
  // Los egresos deben considerar solo montos negativos (salidas de efectivo).
  // Si hay ajustes positivos, no deben descontar egresos.
  const totalEgresos = egresos.reduce((acc: number, e) => {
    const n = Number((e as any).monto ?? 0);
    return acc + (n < 0 ? Math.abs(n) : 0);
  }, 0);
  // Ingresos de caja (ajustes/entradas en efectivo fuera de ventas)
  const ingresosCaja = egresos.reduce((acc: number, e) => {
    const n = Number((e as any).monto ?? 0);
    return acc + (n > 0 ? n : 0);
  }, 0);

  return { totalVentas, totalCobros, totalCompras, totalEgresos, ingresosCaja, ventasPorMetodo, egresos, ventasDelDia, comprasDelDia };
}

// POST: generar cierre de caja
app.post(
  "/api/cierres-caja",
  requireAuth,
  authorize(["Administrador", "Cajero"]),
  async (req, res) => {
    try {
      const { fecha, saldoInicial, motivoSaldoInicial: rawMotivoSaldoInicial } = req.body ?? {};
      if (!fecha) {
        return res.status(400).json({ error: "Fecha requerida" });
      }

      const { desde, hasta } = rangoDia(String(fecha));

      // evitar duplicados del mismo día
      const cierreExistente = await prisma.cierreCaja.findFirst({
        where: { fecha: { gte: desde, lt: hasta } },
      });
      if (cierreExistente) {
        return res.status(409).json({ error: "Ya existe un cierre para ese día" });
      }

      // calcular totales del día
      const { totalVentas, totalCobros, totalCompras, totalEgresos, ingresosCaja } = await calcularTotalesCierre(String(fecha));

      // saldo inicial (si no viene, tomar último cierre anterior)
      let saldoIni = Number(saldoInicial ?? 0);
      const motivoSaldoInicial = rawMotivoSaldoInicial != null ? String(rawMotivoSaldoInicial).trim() : undefined;
      if (saldoInicial == null) {
        const ultimo = await prisma.cierreCaja.findFirst({
          where: { fecha: { lt: desde } },
          orderBy: { fecha: "desc" },
        });
        if (ultimo) {
          saldoIni = Number(ultimo.saldoFinal);
        }
      } else {
        const ultimo = await prisma.cierreCaja.findFirst({
          where: { fecha: { lt: desde } },
          orderBy: { fecha: "desc" },
        });
        if (ultimo && Number(ultimo.saldoFinal) !== saldoIni && !motivoSaldoInicial) {
          return res.status(400).json({ error: "Motivo requerido para modificar saldo inicial" });
        }
      }

      // Saldo teórico de caja (efectivo): saldoInicial + ingresosEfectivo - egresosEfectivo
      const saldoFinal = saldoIni + totalCobros + ingresosCaja - totalEgresos;

      const cierre = await (prisma as any).cierreCaja.create({
        data: {
          fecha: desde,
          totalVentas: toDec2(totalVentas),
          totalCobros: toDec2(totalCobros),
          totalCompras: toDec2(totalCompras),
          totalEgresos: toDec2(totalEgresos),
          saldoInicial: toDec2(saldoIni),
          saldoFinal: toDec2(saldoFinal),
          motivoSaldoInicial: motivoSaldoInicial ?? null,
          idUsuario: getUserId(req),
        },
      });

      res.json(cierre);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al generar el cierre de caja" });
    }
  }
);

// GET: listado de cierres (rango opcional)
app.get(
  "/api/cierres-caja",
  requireAuth,
  authorize(["Administrador", "Cajero"]),
  async (req, res) => {
    const { desde, hasta } = req.query as any;
    const where: any = {};
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = parseLocalDate(String(desde)) ?? undefined;
      if (hasta) where.fecha.lt = parseLocalDate(String(hasta), true) ?? undefined;
    }

    const cierres = await prisma.cierreCaja.findMany({
      where,
      orderBy: { fecha: "desc" },
      include: { Usuario: true },
    });
    res.json(cierres);
  }
);

// GET: preview de cierre (sin persistir)
app.get(
  "/api/cierres-caja/preview",
  requireAuth,
  authorize(["Administrador", "Cajero"]),
  async (req, res) => {
    try {
      const fecha = String((req.query as any)?.fecha ?? "");
      if (!fecha) return res.status(400).json({ error: "Fecha requerida" });

      const { desde } = rangoDia(fecha);
      const { totalVentas, totalCobros, totalCompras, totalEgresos, ingresosCaja, ventasPorMetodo, egresos, ventasDelDia, comprasDelDia } = await calcularTotalesCierre(fecha);

      let saldoInicial = Number((req.query as any)?.saldoInicial ?? 0);
      const saldoInicialProvided = (req.query as any)?.saldoInicial != null;
      let motivoSaldoInicial = String((req.query as any)?.motivoSaldoInicial ?? "").trim();
      if (!saldoInicialProvided) {
        const ultimo = await prisma.cierreCaja.findFirst({
          where: { fecha: { lt: desde } },
          orderBy: { fecha: "desc" },
        });
        if (ultimo) saldoInicial = Number(ultimo.saldoFinal);
      } else {
        const ultimo = await prisma.cierreCaja.findFirst({
          where: { fecha: { lt: desde } },
          orderBy: { fecha: "desc" },
        });
        if (ultimo && Number(ultimo.saldoFinal) !== saldoInicial && !motivoSaldoInicial) {
          return res.status(400).json({ error: "Motivo requerido para modificar saldo inicial" });
        }
      }

      // Saldo final teórico (efectivo): saldoInicial + ingresosEfectivo - egresosEfectivo
      const saldoFinal = saldoInicial + totalCobros + ingresosCaja - totalEgresos;
      // Saldo real contado y diferencia (opcional, informativo en preview)
      const saldoRealParam = (req.query as any)?.saldoReal;
      const saldoReal = saldoRealParam != null ? Number(saldoRealParam) : undefined;
      const diferencia = saldoReal != null && isFinite(saldoReal) ? saldoReal - saldoFinal : undefined;
      res.json({ fecha: desde, totalVentas, totalCobros, totalCompras, totalEgresos, ingresosCaja, saldoInicial, saldoFinal, motivoSaldoInicial, ventasPorMetodo, egresos, ventasDelDia, comprasDelDia, saldoReal, diferencia });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error en preview de cierre" });
    }
  }
);

// Egresos de caja
app.post(
  "/api/egresos-caja",
  requireAuth,
  authorize(["Administrador", "Cajero"]),
  async (req, res) => {
    try {
      const { fecha, monto, comentario } = req.body ?? {};
      if (!fecha || monto == null) return res.status(400).json({ error: "Fecha y monto requeridos" });
      const parsed = parseLocalDate(String(fecha));
      if (!parsed) return res.status(400).json({ error: "Fecha inválida" });
      const egreso = await (prisma as any).egresoCaja.create({
        data: {
          fecha: parsed,
          monto: toDec2(Number(monto)),
          comentario: comentario ?? null,
          idUsuario: getUserId(req),
        },
      });
      res.json(egreso);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al registrar egreso" });
    }
  }
);

app.get(
  "/api/egresos-caja",
  requireAuth,
  authorize(["Administrador", "Cajero"]),
  async (req, res) => {
    const fecha = String((req.query as any)?.fecha ?? "");
    const { desde, hasta } = fecha ? rangoDia(fecha) : { desde: undefined as any, hasta: undefined as any };
    const where: any = fecha ? { fecha: { gte: desde, lt: hasta } } : {};
    const rows = await (prisma as any).egresoCaja.findMany({
      where,
      orderBy: { fecha: "desc" },
      include: { Usuario: true },
    });
    res.json(rows);
  }
);

// Editar egreso de caja (monto/comentario)
app.put(
  "/api/egresos-caja/:id",
  requireAuth,
  authorize(["Administrador", "Cajero"]),
  async (req, res) => {
    try {
      const id = Number((req.params as any)?.id);
      if (!id) return res.status(400).json({ error: "ID inválido" });
      const { monto, comentario } = req.body ?? {};
      if (monto == null && comentario == null) return res.status(400).json({ error: "Nada para actualizar" });
      const data: any = {};
      if (monto != null) data.monto = toDec2(Number(monto));
      if (comentario !== undefined) data.comentario = comentario ?? null;
      const row = await (prisma as any).egresoCaja.update({ where: { idEgreso: id }, data });
      res.json(row);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al editar egreso" });
    }
  }
);

// Eliminar egreso de caja
app.delete(
  "/api/egresos-caja/:id",
  requireAuth,
  authorize(["Administrador", "Cajero"]),
  async (req, res) => {
    try {
      const id = Number((req.params as any)?.id);
      if (!id) return res.status(400).json({ error: "ID inválido" });
      await (prisma as any).egresoCaja.delete({ where: { idEgreso: id } });
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error al eliminar egreso" });
    }
  }
);

// GET: detalle de un cierre
app.get(
  "/api/cierres-caja/:id",
  requireAuth,
  authorize(["Administrador", "Cajero"]),
  async (req, res) => {
    const id = Number(req.params.id);
    const cierre = await prisma.cierreCaja.findUnique({
      where: { idCierre: id },
      include: { Usuario: true },
    });
    if (!cierre) return res.status(404).json({ error: "Cierre no encontrado" });
    res.json(cierre);
  }
);

app.listen(4000, () =>
  console.log("✅ API corriendo en http://localhost:4000")
);
// Utilidad: parsear fechas de oferta con semántica local por día
function parseLocalDate(raw: any, isEnd = false): Date | null {
  if (!raw) return null;
  if (typeof raw === "string" && raw.length === 10) {
    // Interpretar YYYY-MM-DD en zona Buenos Aires (UTC-3)
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(raw);
    if (!m) return null;
    const y = Number(m[1]);
    const mon = Number(m[2]) - 1;
    const day = Number(m[3]);
    // 00:00 BA ≡ 03:00 UTC. Para fin de día, usar inicio del día siguiente 00:00 BA.
    if (!isEnd) return new Date(Date.UTC(y, mon, day, 3, 0, 0, 0));
    return new Date(Date.UTC(y, mon, day + 1, 3, 0, 0, 0));
  }
  const d = new Date(raw);
  return Number.isNaN(d.valueOf()) ? null : d;
}

function nextBuenosAiresNineAM(): Date {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return new Date(Date.UTC(y, m, d + 1, 9, 0, 0, 0));
}
