import { api } from "../api";

export type MonedaRow = {
  id: number;
  nombre: string;
  precio: number;
  updatedAt?: string | null;
};

export async function listMonedas(): Promise<MonedaRow[]> {
  const { data } = await api.get("/monedas");
  return (data ?? []).map((m: any) => ({
    id: m.idMoneda ?? m.id ?? 0,
    nombre: m.moneda ?? m.nombre ?? "",
    precio: Number(m.precio ?? 0),
    updatedAt: m.updatedAt ?? null,
  }));
}

export async function updatePrecioMoneda(id: number, precio: number) {
  const { data } = await api.put(`/monedas/${id}`, { precio });
  return data;
}

export async function updateMoneda(
  id: number,
  payload: { nombre?: string; precio?: number }
): Promise<MonedaRow> {
  const body: Record<string, unknown> = {};
  if (payload.nombre !== undefined) body.moneda = payload.nombre;
  if (payload.precio !== undefined) body.precio = payload.precio;
  const { data } = await api.put(`/monedas/${id}`, body);
  return {
    id: data.idMoneda ?? data.id ?? id,
    nombre: data.moneda ?? payload.nombre ?? "",
    precio: Number(data.precio ?? payload.precio ?? 0),
    updatedAt: data.updatedAt ?? null,
  };
}

export async function createMoneda(moneda: string, precio: number) {
  const { data } = await api.post(`/monedas`, { moneda, precio });
  return data as MonedaRow;
}

export async function deleteMoneda(id: number) {
  await api.delete(`/monedas/${id}`);
}