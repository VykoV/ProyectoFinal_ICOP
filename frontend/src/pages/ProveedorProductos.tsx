import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "../components/DataTable";
import { Input, Label } from "../components/ui/Form";
import { Button } from "@/components/ui/button";
import * as svc from "../lib/api/proveedores";

export default function ProveedorProductos() {
  const { id } = useParams();
  const idProveedor = Number(id);
  const [rows, setRows] = useState<svc.ProveedorProductoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  async function load() {
    const res = await svc.getProductosByProveedor(idProveedor, { search, page, pageSize });
    setRows(res.rows);
    setTotal(res.total);
  }
  useEffect(() => {
    if (!Number.isFinite(idProveedor)) return;
    load();
  }, [idProveedor, search, page]);

  const cols: ColumnDef<svc.ProveedorProductoRow>[] = [
    { header: "Código", accessorFn: (r) => r.Producto.codigoProducto || r.Producto.codigoBarrasProducto || "-" },
    { header: "Producto", accessorFn: (r) => r.Producto.nombreProducto },
    { header: "Precio hist.", accessorKey: "precioHistorico" },
    { header: "Ingreso", accessorKey: "fechaIngreso" },
    { header: "Cod. prov.", accessorKey: "codigoArticuloProveedor" },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <Label>Buscar</Label>
          <Input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Código o nombre"
          />
        </div>
        <Button onClick={() => setSearch("")}>Limpiar</Button>
      </div>

      <DataTable
        columns={cols}
        data={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  );
}