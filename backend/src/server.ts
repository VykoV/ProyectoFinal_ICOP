import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import pgSession from "connect-pg-simple";
import bcrypt from "bcrypt";
import { PrismaClient, Prisma, PapelEnVenta } from "@prisma/client";
import authRoutes from "./auth";
import proveedores from "./routes/proveedores";
import { requireAuth } from "./middleware/requireAuth";
import { authorize } from "./middleware/authorize";

const DEV = process.env.NODE_ENV !== "production";
const app = express();
const prisma = new PrismaClient();
const PgSession = pgSession(session);

// ==========================
// 1) CONFIGURACIÓN DE CORS
// ==========================
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "X-User-Id"],
  })
);
app.options("*", cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"], credentials: true }));

// ==========================
// 2) PARSER JSON
// ==========================
app.use(express.json());

app.set(
  "json replacer",
  (key: string, value: unknown): unknown =>
    typeof value === "bigint" ? value.toString() : value
);

// ==========================
// 3) SESIONES
// ==========================
app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL!,
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
      subFamiliaId,
      stock = 0,
      bajoMinimoStock = 0,
      ultimaModificacionStock,
      proveedorId,
      codigoArticuloProveedor,
      fechaIngreso,
      precioHistorico,
    } = req.body;

    const sf = await prisma.subFamilia.findUnique({
      where: { idSubFamilia: Number(subFamiliaId) },
      include: { Familia: true },
    });
    if (!sf) return res.status(400).json({ error: "SUBFAMILIA_NOT_FOUND" });

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
      }
    }

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
  await prisma.usuarioRol.deleteMany({ where: { idUsuario: id } });
  await prisma.usuario.delete({ where: { idUsuario: id } });
  res.status(204).end();
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
    await prisma.cliente.delete({ where: { idCliente: id } });
    res.status(204).end();
  } catch (e: any) {
    if (e.code === "P2003") return res.status(409).json({ error: "FK_CONSTRAINT_IN_USE" });
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
  LISTO_CAJA: "ListoCaja",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
} as const;

// Estados requeridos al arrancar 
const REQUIRED_ESTADOS = [
  "Pendiente",
  "ListoCaja",
  "Finalizada",
  "Cancelada",
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

// Asegura que existan los estados base 
async function ensureEstadosBase() {
  await prisma.$transaction(async (tx) => {
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
  const sid = req?.session?.user?.idUsuario ?? req?.session?.idUsuario;
  if (sid) return Number(sid);
  const hdr = req.headers["x-user-id"];
  if (hdr) return Number(hdr);
  return 1; // fallback dev
}

// — EstadoVenta helpers:
async function getEstadoId(tx: Prisma.TransactionClient, nombre: string) {
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
async function getStockFila(tx: Prisma.TransactionClient, idProducto: number) {
  const s = await tx.stock.findFirst({ where: { idProducto } });
  if (!s) return null;
  return {
    idStock: s.idStock,
    real: Number(s.cantidadRealStock || 0),
    comp: Number(s.stockComprometido || 0),
  };
}

async function validarDisponible(tx: Prisma.TransactionClient, items: { idProducto: number; cantidad: number }[]) {
  for (const it of items) {
    const s = await getStockFila(tx, it.idProducto);
    if (!s) throw new Error("STOCK_INEXISTENTE");
    const disponible = s.real - s.comp;
    if (disponible < Number(it.cantidad || 0)) throw new Error("STOCK_INSUFICIENTE");
  }
}

async function validarReal(tx: Prisma.TransactionClient, items: { idProducto: number; cantidad: number }[]) {
  for (const it of items) {
    const s = await getStockFila(tx, it.idProducto);
    if (!s) throw new Error("STOCK_INEXISTENTE");
    if (s.real < Number(it.cantidad || 0)) throw new Error("STOCK_INSUFICIENTE");
  }
}

async function reservarComprometido(tx: Prisma.TransactionClient, items: { idProducto: number; cantidad: number }[]) {
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
  }
}

async function liberarComprometido(tx: Prisma.TransactionClient, items: { idProducto: number; cantidad: number }[]) {
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
  }
}

async function descontarRealYComprometido(tx: Prisma.TransactionClient, items: { idProducto: number; cantidad: number }[]) {
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
  }
}

// — Auditoría helpers:
// — Auditoría helpers (flex: intenta con IDs y si falla, usa nombres)
async function registrarEventoIds(
  tx: Prisma.TransactionClient,
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
  tx: Prisma.TransactionClient,
  args: { idVenta: number; idUsuario: number; papel: PapelEnVenta }
) {
  try {
    await tx.ventaActor.create({
      data: { idVenta: args.idVenta, idUsuario: args.idUsuario, papel: args.papel } as any,
    });
  } catch {
    /* sin unique compuesto puede duplicar; aceptable */
  }
}

async function agregarComentario(
  tx: Prisma.TransactionClient,
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
async function leerItemsVenta(tx: Prisma.TransactionClient, idVenta: number) {
  const items = await tx.detalleVenta.findMany({
    where: { idVenta },
    select: { idProducto: true, cantidad: true },
  });
  return items.map((r) => ({ idProducto: Number(r.idProducto), cantidad: Number(r.cantidad) }));
}

// — totales:
async function calcularTotal(idVenta: number) {
  const dets = await prisma.detalleVenta.findMany({
    where: { idVenta },
    select: {
      cantidad: true,
      Producto: { select: { precioVentaPublicoProducto: true } },
    },
  });
  return dets.reduce(
    (a, d) => a + Number(d.cantidad) * Number(d.Producto?.precioVentaPublicoProducto ?? 0),
    0
  );
}

// Crear PREVENTA = estado Pendiente + reservar comprometido
app.post(
  "/api/preventas",
  requireAuth,
  authorize(["Administrador", "Vendedor"]),
  async (req, res) => {
  try {
    const { idCliente, idTipoPago, observacion, detalles = [] } = req.body;

    if (!idCliente || !idTipoPago || !Array.isArray(detalles) || detalles.length === 0)
      return res.status(400).json({ error: "FALTAN_DATOS" });

    // Validar ítems antes de crear
    if (
      !Array.isArray(detalles) ||
      detalles.length === 0 ||
      detalles.some((d: any) => !Number(d.idProducto) || !(toNum(d.cantidad) > 0))
    ) {
      return res.status(400).json({ error: "SIN_ITEMS" });
    }

    const idUsuario = getUserId(req);

    const result = await prisma.$transaction(async (tx) => {
      const idPend = await getEstadoId(tx, ESTADOS.PENDIENTE);
      const m = await tx.moneda.findFirst({ select: { idMoneda: true } });
      const idMoneda = m?.idMoneda ?? 1;

      const v = await tx.venta.create({
        data: {
          fechaVenta: new Date(),
          fechaCobroVenta: new Date(),
          observacion: observacion ?? null,
          idCliente: Number(idCliente),
          idEstadoVenta: idPend,
          idTipoPago: Number(idTipoPago),
          idMoneda,
          detalles: {
            create: detalles.map((d: any) => ({
              idProducto: Number(d.idProducto),
              cantidad: toDec3(d.cantidad),
            })),
          },
        },
        select: { idVenta: true },
      });

      const items = detalles.map((d: any) => ({
        idProducto: Number(d.idProducto),
        cantidad: toNum(d.cantidad),
      }));

      await validarDisponible(tx, items);
      await reservarComprometido(tx, items);

      const nomPend = ESTADOS.PENDIENTE;
      await registrarEventoIds(tx, {
        idVenta: v.idVenta, idUsuario,
        desdeId: idPend, hastaId: idPend,
        motivo: "creación"
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
      metodoPago: v.TipoPago?.tipoPago ?? null,
      estado: v.EstadoVenta?.nombreEstadoVenta ?? "",
      total: await calcularTotal(v.idVenta),
    }))
  );

  res.json(out);
});

// Detalle PREVENTA
app.get(
  "/api/preventas/:id",
  requireAuth,
  authorize(["Administrador", "Vendedor", "Cajero"]),
  async (req, res) => {
  const id = Number(req.params.id);
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
  res.json(v);
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

// Editar / Lock / Finalizar / Cancelar PREVENTA
app.put(
  "/api/preventas/:id",
  requireAuth,
  async (req, res, next) => {
    const accion = String(req.body?.accion || "guardar").toLowerCase();
    const allow: Record<string, string[]> = {
      guardar: ["Administrador", "Vendedor", "Cajero"],
      lock: ["Administrador", "Vendedor"],
      finalizar: ["Administrador", "Cajero"],
      cancelar: ["Administrador", "Cajero"],
    };
    return authorize(allow[accion] || ["Administrador"])(req, res, next);
  },
  async (req, res) => {
  const id = Number(req.params.id);
  const idUsuario = getUserId(req);

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

  // normalizar ítems a {idProducto:number,cantidad:number}
  // acepta alias: cant, qty, peso, gramos
  if (Array.isArray(items)) {
    items = items
      .map((i: any) => ({
        idProducto: Number(i.idProducto ?? i.productoId ?? i.id),
        cantidad: toNum(i.cantidad ?? i.cant ?? i.qty ?? i.peso ?? i.gramos),
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
      include: { EstadoVenta: true },
    });
    if (!ventaAntes) throw new Error("NOT_FOUND");
    const estadoActualNombre = ventaAntes.EstadoVenta.nombreEstadoVenta;

    // --- SOLO escrituras dentro de la transacción. Sin lecturas finales aquí.
    await prisma.$transaction(async (tx) => {
      
      const idPend = await getEstadoId(tx, ESTADOS.PENDIENTE);
      const idLC = await getEstadoId(tx, ESTADOS.LISTO_CAJA);
      const idFin = await getEstadoId(tx, ESTADOS.FINALIZADA);
      const idCan = await getEstadoId(tx, ESTADOS.CANCELADA);

      if (accion === "guardar") {
        const editable = [ESTADOS.PENDIENTE, ESTADOS.LISTO_CAJA].map(norm);
        if (!editable.includes(norm(estadoActualNombre)))
          throw new Error("ESTADO_INVALIDO");

        const antes = await tx.detalleVenta.findMany({
          where: { idVenta: id },
          select: { idProducto: true, cantidad: true },
        });

        const dataToUpdate: any = {
          ...(idCliente !== undefined && idCliente !== null && idCliente !== "" && { idCliente: Number(idCliente) }),
          ...(idTipoPago !== undefined && idTipoPago !== null && idTipoPago !== "" && { idTipoPago: Number(idTipoPago) }),
          ...(observacion !== undefined && { observacion: observacion ?? null }),
          ...(fechaFacturacion && { fechaVenta: new Date(fechaFacturacion) }),
          ...(fechaCobro && { fechaCobroVenta: new Date(fechaCobro) }),
          ...(idMoneda !== undefined && idMoneda !== null && idMoneda !== "" && { idMoneda: Number(idMoneda) }),
          ...(descuentoGeneral !== undefined && { descuentoGeneralVenta: new Prisma.Decimal(descuentoGeneral) }),
          ...(ajuste !== undefined && { ajusteVenta: new Prisma.Decimal(ajuste) }),
          ...(recargoPago !== undefined && { recargoPagoVenta: new Prisma.Decimal(recargoPago) }),
        };
        if (Object.keys(dataToUpdate).length) {
          await tx.venta.update({ where: { idVenta: id }, data: dataToUpdate });
        }

        // normalizar payload → lista compactada por producto
        const comp = new Map<number, number>();
        for (const raw of items as any[]) {
          const pid = Number(raw.idProducto);
          const cant = toNum(raw.cantidad ?? raw.cant ?? raw.qty ?? raw.peso ?? raw.gramos);
          if (!pid || cant <= 0) continue;
          comp.set(pid, (comp.get(pid) ?? 0) + cant);
        }
        const itemsOk = [...comp.entries()].map(([idProducto, cantidad]) => ({ idProducto, cantidad }));

        if (itemsOk.length === 0) throw new Error("SIN_ITEMS");

        // reemplazar detalles
        try {
          await tx.detalleVenta.deleteMany({ where: { idVenta: id } });
          await tx.detalleVenta.createMany({
            data: itemsOk.map(i => ({
              idVenta: id,
              idProducto: Number(i.idProducto),
              cantidad: toDec3(i.cantidad),
            })),
          });
          // fuerza error inmediato si la transacción quedó abortada
          await tx.$executeRaw`SELECT 1`;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError) throw err;
          throw new Error("DETALLES_CREATE_FAILED");
        }

        // recomputar después
        const despues = await tx.detalleVenta.findMany({
          where: { idVenta: id },
          select: { idProducto: true, cantidad: true },
        });

        // delta de comprometido = después - antes
        const delta = new Map<number, number>();
        for (const r of antes)   delta.set(r.idProducto, (delta.get(r.idProducto) ?? 0) - Number(r.cantidad));
        for (const r of despues) delta.set(r.idProducto, (delta.get(r.idProducto) ?? 0) + Number(r.cantidad));

        const incs: { idProducto:number; cantidad:number }[] = [];
        const decs: { idProducto:number; cantidad:number }[] = [];
        for (const [idProducto, d] of delta) {
          if (d > 0) incs.push({ idProducto, cantidad: d });
          if (d < 0) decs.push({ idProducto, cantidad: Math.abs(d) });
        }

        // aplicar stock comprometido
        if (incs.length) { await validarDisponible(tx, incs); await reservarComprometido(tx, incs); }
        if (decs.length) { await liberarComprometido(tx, decs); }

        const desdeId = norm(estadoActualNombre) === norm(ESTADOS.PENDIENTE) ? idPend : idLC;
        await registrarEventoIds(tx, { idVenta: id, idUsuario, desdeId, hastaId: desdeId, motivo: "edición" });
        await registrarActor(tx, { idVenta: id, idUsuario, papel: PapelEnVenta.EDITOR });
      }
      // --- LOCK ---
      else if (accion === "lock") {
        if (norm(estadoActualNombre) !== norm(ESTADOS.PENDIENTE))
          throw new Error("ESTADO_INVALIDO");

        await tx.venta.update({
          where: { idVenta: id },
          data: { idEstadoVenta: idLC },
        });

        await registrarEventoIds(tx, {
          idVenta: id, idUsuario,
          desdeId: idPend, hastaId: idLC,
          motivo: "cerrada por vendedor"
        });
        await registrarActor(tx, { idVenta: id, idUsuario, papel: PapelEnVenta.EDITOR });
      }

      else if (accion === "cancelar") {
        if (![norm(ESTADOS.PENDIENTE), norm(ESTADOS.LISTO_CAJA)].includes(norm(estadoActualNombre)))
          throw new Error("ESTADO_INVALIDO");
        if (!motivoCancelacion || String(motivoCancelacion).trim().length === 0)
          throw new Error("MOTIVO_REQUERIDO");

        const itemsAct = await leerItemsVenta(tx, id);
        await liberarComprometido(tx, itemsAct);

        const desde = norm(estadoActualNombre) === norm(ESTADOS.PENDIENTE) ? idPend : idLC;
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
        await validarReal(tx, itemsAct);
        await descontarRealYComprometido(tx, itemsAct);
        await tx.venta.update({
          where: { idVenta: id },
          data: { idEstadoVenta: idFin },
        });
        await registrarEventoIds(tx, { idVenta: id, idUsuario, desdeId: idLC, hastaId: idFin, motivo: "cobrada" });
        await registrarActor(tx, { idVenta: id, idUsuario, papel: PapelEnVenta.CAJERO });
      }
      else {
        throw new Error("ACCION_DESCONOCIDA");
      }
    });
    // Lectura final FUERA de la transacción
  const out = await prisma.venta.findUnique({
    where: { idVenta: id },
    include: { EstadoVenta: true, detalles: { include: { Producto: true } } },
  });
    return res.json(out);
  } catch (err: any) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ error: "NOT_FOUND" });
    if (["STOCK_INEXISTENTE", "STOCK_INSUFICIENTE", "SIN_ITEMS", "ESTADO_INVALIDO", "ACCION_DESCONOCIDA", "MOTIVO_REQUERIDO"].includes(err.message))
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
    await prisma.$transaction(async (tx) => {
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

  const out = rows.map((v) => {
    const total = v.detalles.reduce((acc, d) => {
      const cant = Number(d.cantidad ?? 0);
      const pu = Number(d.Producto?.precioVentaPublicoProducto ?? 0);
      return acc + cant * pu;
    }, 0);

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
  });

  res.json(out);
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
// lista monedas
app.get("/api/monedas", async (_req, res) => {
  const rows = await prisma.moneda.findMany({
    select: { idMoneda: true, moneda: true, precio: true },
    orderBy: { moneda: "asc" },
  });
  res.json(rows.map(r => ({ idMoneda: r.idMoneda, moneda: r.moneda, precio: Number(r.precio) })));
});

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

app.listen(4000, () =>
  console.log("✅ API corriendo en http://localhost:4000")
);
