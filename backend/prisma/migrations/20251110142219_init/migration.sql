-- CreateEnum
CREATE TYPE "PapelEnVenta" AS ENUM ('CREADOR', 'CAJERO', 'ANULADOR', 'EDITOR');

-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('PendientePago', 'Finalizado');

-- CreateTable
CREATE TABLE "Usuario" (
    "idUsuario" SERIAL NOT NULL,
    "nombreUsuario" VARCHAR(100) NOT NULL,
    "emailUsuario" VARCHAR(320) NOT NULL,
    "contraseñaUsuario" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("idUsuario")
);

-- CreateTable
CREATE TABLE "Rol" (
    "idRol" SERIAL NOT NULL,
    "nombreRol" TEXT NOT NULL,
    "comentario" TEXT,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("idRol")
);

-- CreateTable
CREATE TABLE "UsuarioRol" (
    "idUsuario" INTEGER NOT NULL,
    "idRol" INTEGER NOT NULL,

    CONSTRAINT "UsuarioRol_pkey" PRIMARY KEY ("idUsuario","idRol")
);

-- CreateTable
CREATE TABLE "TipoCliente" (
    "idTipoCliente" SERIAL NOT NULL,
    "tipoCliente" VARCHAR(100) NOT NULL,

    CONSTRAINT "TipoCliente_pkey" PRIMARY KEY ("idTipoCliente")
);

-- CreateTable
CREATE TABLE "NivelCliente" (
    "idNivelCliente" SERIAL NOT NULL,
    "indiceBeneficio" INTEGER NOT NULL,

    CONSTRAINT "NivelCliente_pkey" PRIMARY KEY ("idNivelCliente")
);

-- CreateTable
CREATE TABLE "Provincia" (
    "idProvincia" SERIAL NOT NULL,
    "nombreProvincia" CHAR(100) NOT NULL,

    CONSTRAINT "Provincia_pkey" PRIMARY KEY ("idProvincia")
);

-- CreateTable
CREATE TABLE "Localidad" (
    "idLocalidad" SERIAL NOT NULL,
    "nombreLocalidad" CHAR(100) NOT NULL,
    "idProvincia" INTEGER NOT NULL,

    CONSTRAINT "Localidad_pkey" PRIMARY KEY ("idLocalidad")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "idCliente" SERIAL NOT NULL,
    "nombreCliente" VARCHAR(100) NOT NULL,
    "apellidoCliente" VARCHAR(100) NOT NULL,
    "cuil" BIGINT,
    "emailCliente" VARCHAR(100) NOT NULL,
    "telefonoCliente" BIGINT,
    "observacion" TEXT,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idTipoCliente" INTEGER,
    "idNivelCliente" INTEGER,
    "idLocalidad" INTEGER,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("idCliente")
);

-- CreateTable
CREATE TABLE "Familia" (
    "idFamilia" SERIAL NOT NULL,
    "tipoFamilia" CHAR(100) NOT NULL,

    CONSTRAINT "Familia_pkey" PRIMARY KEY ("idFamilia")
);

-- CreateTable
CREATE TABLE "SubFamilia" (
    "idSubFamilia" SERIAL NOT NULL,
    "tipoSubFamilia" CHAR(100) NOT NULL,
    "idFamilia" INTEGER NOT NULL,

    CONSTRAINT "SubFamilia_pkey" PRIMARY KEY ("idSubFamilia")
);

-- CreateTable
CREATE TABLE "Producto" (
    "idProducto" SERIAL NOT NULL,
    "codigoBarrasProducto" BIGINT,
    "codigoProducto" VARCHAR(50) NOT NULL,
    "nombreProducto" VARCHAR(100) NOT NULL,
    "descripcionProducto" TEXT,
    "ofertaProducto" BOOLEAN NOT NULL DEFAULT false,
    "precioProducto" DECIMAL(12,2) NOT NULL,
    "precioVentaPublicoProducto" DECIMAL(12,2) NOT NULL,
    "utilidadProducto" DECIMAL(7,2) NOT NULL,
    "idUsuario" INTEGER,
    "idSubFamilia" INTEGER NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("idProducto")
);

-- CreateTable
CREATE TABLE "Stock" (
    "idStock" SERIAL NOT NULL,
    "idProducto" INTEGER NOT NULL,
    "bajoMinimoStock" DECIMAL(12,2) NOT NULL,
    "cantidadRealStock" DECIMAL(12,2) NOT NULL,
    "stockComprometido" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ultimaModificacionStock" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("idStock")
);

-- CreateTable
CREATE TABLE "VwStock" (
    "idProducto" INTEGER NOT NULL,
    "cantidadRealStock" DECIMAL(12,2) NOT NULL,
    "stockComprometido" DECIMAL(12,2) NOT NULL,
    "stockDisponible" DECIMAL(12,2) NOT NULL
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "idProveedor" SERIAL NOT NULL,
    "CIF_NIFProveedor" BIGINT,
    "nombreProveedor" VARCHAR(100) NOT NULL,
    "mailProveedor" VARCHAR(100),
    "telefonoProveedor" BIGINT,
    "observacionProveedor" TEXT,
    "idLocalidad" INTEGER,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("idProveedor")
);

-- CreateTable
CREATE TABLE "ProveedorProducto" (
    "idProveedorProducto" SERIAL NOT NULL,
    "idProveedor" INTEGER NOT NULL,
    "idProducto" INTEGER NOT NULL,
    "codigoArticuloProveedor" VARCHAR(50) NOT NULL,
    "fechaIngreso" DATE NOT NULL,
    "precioHistorico" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ProveedorProducto_pkey" PRIMARY KEY ("idProveedorProducto")
);

-- CreateTable
CREATE TABLE "MetodoPago" (
    "idMetodoPago" SERIAL NOT NULL,
    "metodoPago" CHAR(100),

    CONSTRAINT "MetodoPago_pkey" PRIMARY KEY ("idMetodoPago")
);

-- CreateTable
CREATE TABLE "Moneda" (
    "idMoneda" SERIAL NOT NULL,
    "moneda" VARCHAR(50) NOT NULL,
    "precio" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "Moneda_pkey" PRIMARY KEY ("idMoneda")
);

-- CreateTable
CREATE TABLE "Compra" (
    "idCompra" SERIAL NOT NULL,
    "fechaComprobanteCompra" DATE NOT NULL,
    "nroFactura" VARCHAR(50) NOT NULL,
    "observacion" TEXT,
    "idProveedor" INTEGER NOT NULL,
    "idMetodoPago" INTEGER NOT NULL,
    "idMoneda" INTEGER NOT NULL,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "EstadoCompra" NOT NULL DEFAULT 'PendientePago',

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("idCompra")
);

-- CreateTable
CREATE TABLE "DetalleCompra" (
    "idDetalleCompra" SERIAL NOT NULL,
    "idCompra" INTEGER NOT NULL,
    "idProducto" INTEGER NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL,
    "precioUnit" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "DetalleCompra_pkey" PRIMARY KEY ("idDetalleCompra")
);

-- CreateTable
CREATE TABLE "TipoPago" (
    "idTipoPago" SERIAL NOT NULL,
    "tipoPago" CHAR(100) NOT NULL,

    CONSTRAINT "TipoPago_pkey" PRIMARY KEY ("idTipoPago")
);

-- CreateTable
CREATE TABLE "EstadoVenta" (
    "idEstadoVenta" SERIAL NOT NULL,
    "nombreEstadoVenta" VARCHAR(100) NOT NULL,

    CONSTRAINT "EstadoVenta_pkey" PRIMARY KEY ("idEstadoVenta")
);

-- CreateTable
CREATE TABLE "Venta" (
    "idVenta" SERIAL NOT NULL,
    "fechaVenta" DATE NOT NULL,
    "fechaCobroVenta" DATE NOT NULL,
    "observacion" TEXT,
    "idCliente" INTEGER NOT NULL,
    "idEstadoVenta" INTEGER NOT NULL,
    "idTipoPago" INTEGER NOT NULL,
    "idMoneda" INTEGER NOT NULL,
    "idUsuario" INTEGER,
    "descuentoGeneralVenta" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "ajusteVenta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "recargoPagoVenta" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("idVenta")
);

-- CreateTable
CREATE TABLE "DetalleVenta" (
    "idDetalleVenta" SERIAL NOT NULL,
    "idVenta" INTEGER NOT NULL,
    "idProducto" INTEGER NOT NULL,
    "cantidad" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "DetalleVenta_pkey" PRIMARY KEY ("idDetalleVenta")
);

-- CreateTable
CREATE TABLE "VentaActor" (
    "idVenta" INTEGER NOT NULL,
    "idUsuario" INTEGER NOT NULL,
    "papel" "PapelEnVenta" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaActor_pkey" PRIMARY KEY ("idVenta","idUsuario","papel")
);

-- CreateTable
CREATE TABLE "VentaEvento" (
    "idVentaEvento" SERIAL NOT NULL,
    "idVenta" INTEGER NOT NULL,
    "idUsuario" INTEGER NOT NULL,
    "estadoDesde" INTEGER,
    "estadoHasta" INTEGER NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaEvento_pkey" PRIMARY KEY ("idVentaEvento")
);

-- CreateTable
CREATE TABLE "VentaComentario" (
    "idVentaComentario" SERIAL NOT NULL,
    "idVenta" INTEGER NOT NULL,
    "idUsuario" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaComentario_pkey" PRIMARY KEY ("idVentaComentario")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_emailUsuario_key" ON "Usuario"("emailUsuario");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombreRol_key" ON "Rol"("nombreRol");

-- CreateIndex
CREATE UNIQUE INDEX "Localidad_idProvincia_nombreLocalidad_key" ON "Localidad"("idProvincia", "nombreLocalidad");

-- CreateIndex
CREATE UNIQUE INDEX "Familia_tipoFamilia_key" ON "Familia"("tipoFamilia");

-- CreateIndex
CREATE UNIQUE INDEX "SubFamilia_idFamilia_tipoSubFamilia_key" ON "SubFamilia"("idFamilia", "tipoSubFamilia");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarrasProducto_key" ON "Producto"("codigoBarrasProducto");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoProducto_key" ON "Producto"("codigoProducto");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_idProducto_key" ON "Stock"("idProducto");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_CIF_NIFProveedor_key" ON "Proveedor"("CIF_NIFProveedor");

-- CreateIndex
CREATE INDEX "ProveedorProducto_idProducto_idx" ON "ProveedorProducto"("idProducto");

-- CreateIndex
CREATE INDEX "Compra_fechaComprobanteCompra_idx" ON "Compra"("fechaComprobanteCompra");

-- CreateIndex
CREATE UNIQUE INDEX "Compra_idProveedor_nroFactura_key" ON "Compra"("idProveedor", "nroFactura");

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_idRol_fkey" FOREIGN KEY ("idRol") REFERENCES "Rol"("idRol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Localidad" ADD CONSTRAINT "Localidad_idProvincia_fkey" FOREIGN KEY ("idProvincia") REFERENCES "Provincia"("idProvincia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_idTipoCliente_fkey" FOREIGN KEY ("idTipoCliente") REFERENCES "TipoCliente"("idTipoCliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_idNivelCliente_fkey" FOREIGN KEY ("idNivelCliente") REFERENCES "NivelCliente"("idNivelCliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_idLocalidad_fkey" FOREIGN KEY ("idLocalidad") REFERENCES "Localidad"("idLocalidad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubFamilia" ADD CONSTRAINT "SubFamilia_idFamilia_fkey" FOREIGN KEY ("idFamilia") REFERENCES "Familia"("idFamilia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_idSubFamilia_fkey" FOREIGN KEY ("idSubFamilia") REFERENCES "SubFamilia"("idSubFamilia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proveedor" ADD CONSTRAINT "Proveedor_idLocalidad_fkey" FOREIGN KEY ("idLocalidad") REFERENCES "Localidad"("idLocalidad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorProducto" ADD CONSTRAINT "ProveedorProducto_idProveedor_fkey" FOREIGN KEY ("idProveedor") REFERENCES "Proveedor"("idProveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProveedorProducto" ADD CONSTRAINT "ProveedorProducto_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_idProveedor_fkey" FOREIGN KEY ("idProveedor") REFERENCES "Proveedor"("idProveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_idMetodoPago_fkey" FOREIGN KEY ("idMetodoPago") REFERENCES "MetodoPago"("idMetodoPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_idMoneda_fkey" FOREIGN KEY ("idMoneda") REFERENCES "Moneda"("idMoneda") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_idCompra_fkey" FOREIGN KEY ("idCompra") REFERENCES "Compra"("idCompra") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_idCliente_fkey" FOREIGN KEY ("idCliente") REFERENCES "Cliente"("idCliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_idEstadoVenta_fkey" FOREIGN KEY ("idEstadoVenta") REFERENCES "EstadoVenta"("idEstadoVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_idTipoPago_fkey" FOREIGN KEY ("idTipoPago") REFERENCES "TipoPago"("idTipoPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_idMoneda_fkey" FOREIGN KEY ("idMoneda") REFERENCES "Moneda"("idMoneda") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_idVenta_fkey" FOREIGN KEY ("idVenta") REFERENCES "Venta"("idVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaActor" ADD CONSTRAINT "VentaActor_idVenta_fkey" FOREIGN KEY ("idVenta") REFERENCES "Venta"("idVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaActor" ADD CONSTRAINT "VentaActor_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaEvento" ADD CONSTRAINT "VentaEvento_idVenta_fkey" FOREIGN KEY ("idVenta") REFERENCES "Venta"("idVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaEvento" ADD CONSTRAINT "VentaEvento_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaEvento" ADD CONSTRAINT "VentaEvento_estadoDesde_fkey" FOREIGN KEY ("estadoDesde") REFERENCES "EstadoVenta"("idEstadoVenta") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaEvento" ADD CONSTRAINT "VentaEvento_estadoHasta_fkey" FOREIGN KEY ("estadoHasta") REFERENCES "EstadoVenta"("idEstadoVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaComentario" ADD CONSTRAINT "VentaComentario_idVenta_fkey" FOREIGN KEY ("idVenta") REFERENCES "Venta"("idVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VentaComentario" ADD CONSTRAINT "VentaComentario_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;
