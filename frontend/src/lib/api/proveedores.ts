import { api } from "../api";

export type Proveedor = {
  idProveedor: number;
  CIF_NIFProveedor: string | null;
  nombreProveedor: string;
  mailProveedor?: string | null;
  telefonoProveedor?: string | null;
  observacionProveedor?: string | null;
  idLocalidad?: number | null;
};

export type Page<T> = { total: number; page: number; pageSize: number; rows: T[] };

export async function getPage(params: { search?: string; page?: number; pageSize?: number }) {
  const { data } = await api.get<Page<Proveedor>>("/proveedores", { params });
  return data;
}

export async function getOne(id: number) {
  const { data } = await api.get<Proveedor>("/proveedores/" + id);
  return data;
}

export async function create(payload: Partial<Proveedor>) {
  const { data } = await api.post<Proveedor>("/proveedores", payload);
  return data;
}

export async function update(id: number, payload: Partial<Proveedor>) {
  const { data } = await api.put<Proveedor>("/proveedores/" + id, payload);
  return data;
}

export async function remove(id: number) {
  await api.delete("/proveedores/" + id);
}

export type ProveedorProductoRow = {
  idProveedorProducto: number;
  idProveedor: number;
  idProducto: number;
  codigoArticuloProveedor: string;
  fechaIngreso: string;
  precioHistorico: string; // Decimal
  Producto: {
    idProducto: number;
    codigoProducto: string | null;
    codigoBarrasProducto: string | null;
    nombreProducto: string;
    precioProducto: string | null;
  };
  Proveedor: { idProveedor: number; nombreProveedor: string };
};

export async function getProductosByProveedor(
  idProveedor: number,
  params: { search?: string; page?: number; pageSize?: number }
) {
  const { data } = await api.get<Page<ProveedorProductoRow>>(`/proveedores/${idProveedor}/productos`, { params });
  return data;
}