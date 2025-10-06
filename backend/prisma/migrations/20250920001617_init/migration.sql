-- CreateTable
CREATE TABLE "public"."Usuario" (
    "idUsuario" SERIAL NOT NULL,
    "nombreUsuario" VARCHAR(100),
    "emailUsuario" VARCHAR(100),
    "contraseñaUsuario" VARCHAR(100),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("idUsuario")
);

-- CreateTable
CREATE TABLE "public"."Rol" (
    "idRol" SERIAL NOT NULL,
    "idUsuario" INTEGER NOT NULL,
    "nombreRol" VARCHAR(100) NOT NULL,
    "comentario" TEXT,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("idRol")
);

-- CreateTable
CREATE TABLE "public"."TipoCliente" (
    "idTipoCliente" SERIAL NOT NULL,
    "tipoCliente" VARCHAR(100) NOT NULL,

    CONSTRAINT "TipoCliente_pkey" PRIMARY KEY ("idTipoCliente")
);

-- CreateTable
CREATE TABLE "public"."NivelCliente" (
    "idNivelCliente" SERIAL NOT NULL,
    "indiceBeneficio" INTEGER NOT NULL,

    CONSTRAINT "NivelCliente_pkey" PRIMARY KEY ("idNivelCliente")
);

-- CreateTable
CREATE TABLE "public"."Provincia" (
    "idProvincia" SERIAL NOT NULL,
    "nombreProvincia" CHAR(100) NOT NULL,

    CONSTRAINT "Provincia_pkey" PRIMARY KEY ("idProvincia")
);

-- CreateTable
CREATE TABLE "public"."Localidad" (
    "idLocalidad" SERIAL NOT NULL,
    "nombreLocalidad" CHAR(100) NOT NULL,
    "idProvincia" INTEGER NOT NULL,

    CONSTRAINT "Localidad_pkey" PRIMARY KEY ("idLocalidad")
);

-- CreateTable
CREATE TABLE "public"."Cliente" (
    "idCliente" SERIAL NOT NULL,
    "nombreCliente" VARCHAR(100) NOT NULL,
    "apellidoCliente" VARCHAR(100) NOT NULL,
    "cuil" BIGINT,
    "emailCliente" VARCHAR(100) NOT NULL,
    "telefonoCliente" BIGINT,
    "observacion" TEXT,
    "idTipoCliente" INTEGER,
    "idNivelCliente" INTEGER,
    "idProvincia" INTEGER,
    "idLocalidad" INTEGER,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("idCliente")
);

-- CreateTable
CREATE TABLE "public"."Familia" (
    "idFamilia" SERIAL NOT NULL,
    "tipoFamilia" CHAR(100) NOT NULL,

    CONSTRAINT "Familia_pkey" PRIMARY KEY ("idFamilia")
);

-- CreateTable
CREATE TABLE "public"."SubFamilia" (
    "idSubFamilia" SERIAL NOT NULL,
    "tipoSubFamilia" CHAR(100) NOT NULL,
    "idFamilia" INTEGER NOT NULL,

    CONSTRAINT "SubFamilia_pkey" PRIMARY KEY ("idSubFamilia")
);

-- CreateTable
CREATE TABLE "public"."Producto" (
    "idProducto" SERIAL NOT NULL,
    "codigoBarrasProducto" BIGINT,
    "codigoProducto" VARCHAR(50) NOT NULL,
    "nombreProducto" VARCHAR(100) NOT NULL,
    "descripcionProducto" TEXT NOT NULL,
    "ofertaProducto" INTEGER,
    "precioProducto" INTEGER NOT NULL,
    "precioVentaPublicoProducto" INTEGER NOT NULL,
    "utilidadProducto" INTEGER NOT NULL,
    "idUsuario" INTEGER,
    "idFamilia" INTEGER NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("idProducto")
);

-- CreateTable
CREATE TABLE "public"."Stock" (
    "idStock" SERIAL NOT NULL,
    "idProducto" INTEGER NOT NULL,
    "bajoMinimoStock" INTEGER NOT NULL,
    "cantidadStock" INTEGER NOT NULL,
    "ultimaModificacionStock" INTEGER NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("idStock")
);

-- CreateTable
CREATE TABLE "public"."Proveedor" (
    "idProveedor" SERIAL NOT NULL,
    "CIF_NIFProveedor" BIGINT NOT NULL,
    "nombreProveedor" VARCHAR(100) NOT NULL,
    "mailProveedor" VARCHAR(100) NOT NULL,
    "telefonoProveedor" BIGINT NOT NULL,
    "observacionProveedor" TEXT,
    "idProvincia" INTEGER NOT NULL,
    "idLocalidad" INTEGER NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("idProveedor")
);

-- CreateTable
CREATE TABLE "public"."ProveedorProducto" (
    "idProveedorProducto" SERIAL NOT NULL,
    "idProveedor" INTEGER NOT NULL,
    "idProducto" INTEGER NOT NULL,
    "codigoArticuloProveedor" VARCHAR(50) NOT NULL,
    "fechaIngreso" DATE NOT NULL,
    "precioHistorico" INTEGER NOT NULL,

    CONSTRAINT "ProveedorProducto_pkey" PRIMARY KEY ("idProveedorProducto")
);

-- CreateTable
CREATE TABLE "public"."MetodoPago" (
    "idMetodoPago" SERIAL NOT NULL,
    "metodoPago" CHAR(100),

    CONSTRAINT "MetodoPago_pkey" PRIMARY KEY ("idMetodoPago")
);

-- CreateTable
CREATE TABLE "public"."Moneda" (
    "idMoneda" SERIAL NOT NULL,
    "moneda" VARCHAR(50) NOT NULL,
    "precio" INTEGER NOT NULL,

    CONSTRAINT "Moneda_pkey" PRIMARY KEY ("idMoneda")
);

-- CreateTable
CREATE TABLE "public"."Compra" (
    "idCompra" SERIAL NOT NULL,
    "fechaComprobanteCompra" DATE NOT NULL,
    "nroFactura" INTEGER NOT NULL,
    "observacion" CHAR(255) NOT NULL,
    "idProveedor" INTEGER NOT NULL,
    "idMetodoPago" INTEGER NOT NULL,
    "idMoneda" INTEGER NOT NULL,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("idCompra")
);

-- CreateTable
CREATE TABLE "public"."DetalleCompra" (
    "idDetalleCompra" SERIAL NOT NULL,
    "idCompra" INTEGER NOT NULL,
    "idProducto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "DetalleCompra_pkey" PRIMARY KEY ("idDetalleCompra")
);

-- CreateTable
CREATE TABLE "public"."TipoPago" (
    "idTipoPago" SERIAL NOT NULL,
    "tipoPago" CHAR(100) NOT NULL,
    "recargo" INTEGER,

    CONSTRAINT "TipoPago_pkey" PRIMARY KEY ("idTipoPago")
);

-- CreateTable
CREATE TABLE "public"."EstadoVenta" (
    "idEstadoVenta" SERIAL NOT NULL,
    "estadoPago" CHAR(100),

    CONSTRAINT "EstadoVenta_pkey" PRIMARY KEY ("idEstadoVenta")
);

-- CreateTable
CREATE TABLE "public"."Venta" (
    "idVenta" SERIAL NOT NULL,
    "fechaVenta" DATE NOT NULL,
    "fechaCobroVenta" DATE NOT NULL,
    "observacion" TEXT,
    "idCliente" INTEGER NOT NULL,
    "idEstadoVenta" INTEGER NOT NULL,
    "idTipoPago" INTEGER NOT NULL,
    "idMoneda" INTEGER NOT NULL,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("idVenta")
);

-- CreateTable
CREATE TABLE "public"."DetalleVenta" (
    "idDetalleVenta" SERIAL NOT NULL,
    "idVenta" INTEGER NOT NULL,
    "idProducto" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "DetalleVenta_pkey" PRIMARY KEY ("idDetalleVenta")
);

-- AddForeignKey
ALTER TABLE "public"."Rol" ADD CONSTRAINT "Rol_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "public"."Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Localidad" ADD CONSTRAINT "Localidad_idProvincia_fkey" FOREIGN KEY ("idProvincia") REFERENCES "public"."Provincia"("idProvincia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cliente" ADD CONSTRAINT "Cliente_idTipoCliente_fkey" FOREIGN KEY ("idTipoCliente") REFERENCES "public"."TipoCliente"("idTipoCliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cliente" ADD CONSTRAINT "Cliente_idNivelCliente_fkey" FOREIGN KEY ("idNivelCliente") REFERENCES "public"."NivelCliente"("idNivelCliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cliente" ADD CONSTRAINT "Cliente_idProvincia_fkey" FOREIGN KEY ("idProvincia") REFERENCES "public"."Provincia"("idProvincia") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cliente" ADD CONSTRAINT "Cliente_idLocalidad_fkey" FOREIGN KEY ("idLocalidad") REFERENCES "public"."Localidad"("idLocalidad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubFamilia" ADD CONSTRAINT "SubFamilia_idFamilia_fkey" FOREIGN KEY ("idFamilia") REFERENCES "public"."Familia"("idFamilia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Producto" ADD CONSTRAINT "Producto_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "public"."Usuario"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Producto" ADD CONSTRAINT "Producto_idFamilia_fkey" FOREIGN KEY ("idFamilia") REFERENCES "public"."Familia"("idFamilia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Stock" ADD CONSTRAINT "Stock_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "public"."Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proveedor" ADD CONSTRAINT "Proveedor_idProvincia_fkey" FOREIGN KEY ("idProvincia") REFERENCES "public"."Provincia"("idProvincia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Proveedor" ADD CONSTRAINT "Proveedor_idLocalidad_fkey" FOREIGN KEY ("idLocalidad") REFERENCES "public"."Localidad"("idLocalidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProveedorProducto" ADD CONSTRAINT "ProveedorProducto_idProveedor_fkey" FOREIGN KEY ("idProveedor") REFERENCES "public"."Proveedor"("idProveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProveedorProducto" ADD CONSTRAINT "ProveedorProducto_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "public"."Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Compra" ADD CONSTRAINT "Compra_idProveedor_fkey" FOREIGN KEY ("idProveedor") REFERENCES "public"."Proveedor"("idProveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Compra" ADD CONSTRAINT "Compra_idMetodoPago_fkey" FOREIGN KEY ("idMetodoPago") REFERENCES "public"."MetodoPago"("idMetodoPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Compra" ADD CONSTRAINT "Compra_idMoneda_fkey" FOREIGN KEY ("idMoneda") REFERENCES "public"."Moneda"("idMoneda") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DetalleCompra" ADD CONSTRAINT "DetalleCompra_idCompra_fkey" FOREIGN KEY ("idCompra") REFERENCES "public"."Compra"("idCompra") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DetalleCompra" ADD CONSTRAINT "DetalleCompra_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "public"."Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Venta" ADD CONSTRAINT "Venta_idCliente_fkey" FOREIGN KEY ("idCliente") REFERENCES "public"."Cliente"("idCliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Venta" ADD CONSTRAINT "Venta_idEstadoVenta_fkey" FOREIGN KEY ("idEstadoVenta") REFERENCES "public"."EstadoVenta"("idEstadoVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Venta" ADD CONSTRAINT "Venta_idTipoPago_fkey" FOREIGN KEY ("idTipoPago") REFERENCES "public"."TipoPago"("idTipoPago") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Venta" ADD CONSTRAINT "Venta_idMoneda_fkey" FOREIGN KEY ("idMoneda") REFERENCES "public"."Moneda"("idMoneda") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DetalleVenta" ADD CONSTRAINT "DetalleVenta_idVenta_fkey" FOREIGN KEY ("idVenta") REFERENCES "public"."Venta"("idVenta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DetalleVenta" ADD CONSTRAINT "DetalleVenta_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "public"."Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;
