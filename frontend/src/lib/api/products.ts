import { api } from "../api";

export type ProductStock = {
  real: number;
  comprometido: number;
  minimo: number;
  actualizadoEn: string | null;
};

export async function getProductStock(idProducto: number): Promise<ProductStock> {
  const { data } = await api.get(`/products/${idProducto}/stock`);
  return {
    real: Number(data?.real ?? 0),
    comprometido: Number(data?.comprometido ?? 0),
    minimo: Number(data?.minimo ?? 0),
    actualizadoEn: data?.actualizadoEn ?? null,
  };
}