-- staging para el CSV
DROP TABLE IF EXISTS staging_articulos;
CREATE TABLE staging_articulos (
  id             integer,
  desc_articulo  text,
  familia        text,
  subfamilia     text,
  proveedor      text,
  precio_costo   numeric,
  precio_venta   numeric,
  stock          numeric
);

-- importa el CSV que copiaremos a /data/articulo1.csv
COPY staging_articulos
FROM '/data/articulo1.csv'
WITH (FORMAT csv, HEADER true);

-- verificación rápida
SELECT count(*) AS filas, min(id) AS min_id, max(id) AS max_id FROM staging_articulos;
