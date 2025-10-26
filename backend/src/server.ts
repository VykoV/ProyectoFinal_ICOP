import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import pgSession from "connect-pg-simple";
import bcrypt from "bcrypt";
import { PrismaClient, Prisma } from "@prisma/client";
import authRoutes from "./auth";

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
    allowedHeaders: ["Content-Type", "Accept"],
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

app.get("/api/proveedores", async (_req, res) => {
  const rows = await prisma.proveedor.findMany({
    select: { idProveedor: true, nombreProveedor: true },
    orderBy: { idProveedor: "asc" },
  });
  res.json(rows.map(r => ({ id: r.idProveedor, nombre: r.nombreProveedor })));
});


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

  // stockDisponible = real - comprometido
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
    cantidadRealStock: new Prisma.Decimal(stock ?? 0),
    stockComprometido: new Prisma.Decimal(0),
    bajoMinimoStock: new Prisma.Decimal(bajoMinimoStock ?? 0),
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
app.get("/api/usuarios", async (_req, res) => {
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
app.post("/api/usuarios", async (req, res) => {
  try {
    const { nombreUsuario, emailUsuario, contrasenaUsuario, idRol } = req.body;

    if (!nombreUsuario || !emailUsuario || !contrasenaUsuario)
      return res.status(400).json({ error: "FALTAN_DATOS" });

    const exists = await prisma.usuario.findUnique({
      where: { emailUsuario },
    });
    if (exists) return res.status(409).json({ error: "EMAIL_TAKEN" });

    const hash = await bcrypt.hash(contrasenaUsuario, 12);

    // crear usuario
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
app.put("/api/usuarios/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { nombreUsuario, emailUsuario, contrasenaUsuario, idRol } = req.body;

  // preparar data básica
  const data: any = {};
  if (nombreUsuario !== undefined) data.nombreUsuario = nombreUsuario;
  if (emailUsuario !== undefined) data.emailUsuario = emailUsuario;
  if (contrasenaUsuario) data.contrasenaUsuario = await bcrypt.hash(contrasenaUsuario, 12);

  try {
    // update básico
    await prisma.usuario.update({ where: { idUsuario: id }, data });

    // rol: reemplazar asignación
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
app.delete("/api/usuarios/:id", async (req, res) => {
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

  // armar filtro
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
    if (e.code === "P2003") return res.status(409).json({ error: "FK_CONSTRAINT_IN_USE" }); // tiene ventas
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

app.post("/api/preventas", async (req, res) => {
  try {
    const { idCliente, idTipoPago, observacion, detalles = [] } = req.body;

    if (!idCliente || !idTipoPago || !Array.isArray(detalles) || detalles.length === 0)
      return res.status(400).json({ error: "FALTAN_DATOS" });

    // estado = Pendiente
    const estado = await prisma.estadoVenta.findFirst({
      where: { nombreEstadoVenta: { equals: "Pendiente", mode: "insensitive" } },
      select: { idEstadoVenta: true },
    });
    const idEstadoVenta = estado?.idEstadoVenta ?? 1;

    // moneda por defecto
    const moneda = await prisma.moneda.findFirst({ select: { idMoneda: true } });
    const idMoneda = moneda?.idMoneda ?? 1;

    const ahora = new Date();

    const v = await prisma.venta.create({
      data: {
        fechaVenta: ahora,
        fechaCobroVenta: ahora, 
        observacion: observacion ?? null,
        idCliente: Number(idCliente),
        idEstadoVenta,
        idTipoPago: Number(idTipoPago),
        idMoneda,
        detalles: {
          create: detalles.map((d: any) => ({
            idProducto: Number(d.idProducto),
            cantidad: Number(d.cantidad),
          })),
        },
      },
      select: { idVenta: true },
    });

    res.status(201).json({ id: v.idVenta });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "CREATE_FAILED" });
  }
});

app.get("/api/preventas", async (req, res) => {
  const q = String(req.query.q ?? "").trim();

  // id del estado "Pendiente"
  const estado = await prisma.estadoVenta.findFirst({
    where: { nombreEstadoVenta: { equals: "Pendiente", mode: "insensitive" } },
    select: { idEstadoVenta: true },
  });
  const pendienteId = estado?.idEstadoVenta ?? 0;

  const rows = await prisma.venta.findMany({
    where: {
      idEstadoVenta: pendienteId,
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
    include: { Cliente: true, TipoPago: true },
    orderBy: { idVenta: "desc" },
    take: 100,
  });

  const out = await Promise.all(
    rows.map(async v => ({
      id: v.idVenta,
      cliente: `${v.Cliente.apellidoCliente}, ${v.Cliente.nombreCliente}`,
      fecha: v.fechaVenta,
      metodoPago: v.TipoPago?.tipoPago ?? null,
      total: await calcularTotal(v.idVenta),
    }))
  );

  res.json(out);
});

app.get("/api/preventas/:id", async (req, res) => {
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

app.put("/api/preventas/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { idCliente, idTipoPago, observacion, detalles = [] } = req.body;

  const v = await prisma.venta.update({
    where: { idVenta: id },
    data: {
      ...(idCliente && { idCliente: Number(idCliente) }),
      ...(idTipoPago && { idTipoPago: Number(idTipoPago) }),
      observacion: observacion ?? null,
    },
    select: { idVenta: true },
  });

  // remplazar detalles
  await prisma.detalleVenta.deleteMany({ where: { idVenta: id } });
  if (detalles.length) {
    await prisma.detalleVenta.createMany({
      data: detalles.map((d: any) => ({
        idVenta: id,
        idProducto: Number(d.idProducto),
        cantidad: Number(d.cantidad),
      })),
    });
  }

  res.json({ id: v.idVenta });
});

app.delete("/api/preventas/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.$transaction([
    prisma.detalleVenta.deleteMany({ where: { idVenta: id } }),
    prisma.venta.delete({ where: { idVenta: id } }),
  ]);
  res.status(204).end();
});


// Tipos de pago (para el select)
app.get("/api/tipos-pago", async (_req, res) => {
  const rows = await prisma.tipoPago.findMany({ orderBy: { idTipoPago: "asc" } });
  res.json(rows.map(r => ({ id: r.idTipoPago, nombre: r.tipoPago })));
});

// Búsqueda de productos (por nombre/código/barras)
app.get("/api/products/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const where = q
    ? {
        OR: [
          {
            nombreProducto: {
              contains: q,
              mode: "insensitive" as const,
            },
          },
          {
            codigoProducto: {
              contains: q,
              mode: "insensitive" as const,
            },
          },
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


/* ==== PREVENTAS (Venta con estado 'Pendiente') ==== */

async function getDefaultMonedaId() {
  const m = await prisma.moneda.findFirst({
    select: { idMoneda: true },
    orderBy: { idMoneda: "asc" },
  });
  return m?.idMoneda ?? 1;
}

// resolver id del estado 'Pendiente' una sola vez
async function getPendienteId() {
  const e = await prisma.estadoVenta.findFirst({
    where: { nombreEstadoVenta: { equals: "Pendiente", mode: "insensitive" } },
    select: { idEstadoVenta: true },
  });
  return e?.idEstadoVenta ?? 1; // fallback si ya sabés que 1 = Pendiente
}

// helper: total = Σ(detalle.cantidad * producto.precioVentaPublicoProducto)
async function calcularTotal(idVenta: number) {
  const dets = await prisma.detalleVenta.findMany({
    where: { idVenta },
    select: {
      cantidad: true,
      Producto: { select: { precioVentaPublicoProducto: true } },
    },
  });
  return dets.reduce(
    (a, d) => a + Number(d.cantidad) * Number(d.Producto.precioVentaPublicoProducto ?? 0),
    0
  );
}

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
