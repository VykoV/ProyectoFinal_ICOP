export function fmtPrice(n: any, opts?: { minFraction?: number; maxFraction?: number }) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "-";
  const minimumFractionDigits = opts?.minFraction ?? 0; // mostrar decimales solo si existen
  const maximumFractionDigits = opts?.maxFraction ?? 2; // hasta 2 decimales
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}