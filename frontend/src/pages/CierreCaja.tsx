import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { askConfirm } from "../lib/alerts";

const numberFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});
function fmt(n: number | string) {
  const num = Number(n);
  if (!isFinite(num)) return String(n);
  return numberFormatter.format(num);
}

type CierrePreview = {
  fecha: string;
  totalVentas: number;
  totalCobros: number;
  totalCompras: number;
  totalEgresos: number;
  saldoInicial: number;
  saldoFinal: number;
  ventasPorMetodo?: Array<{ metodo: string; total: number }>;
  egresos?: Array<{ monto: string | number; comentario?: string | null }>;
  ventasDelDia?: Array<{
    idVenta: number;
    cliente: string;
    metodoPago: string;
    total: number;
  }>;
  comprasDelDia?: Array<{ idCompra: number; proveedor: string; total: number }>;
};

type CierreCaja = {
  idCierre: number;
  fecha: string;
  totalVentas: string;
  totalCobros: string;
  totalCompras: string;
  totalEgresos: string;
  saldoInicial: string;
  saldoFinal: string;
  Usuario?: { nombreUsuario?: string; emailUsuario?: string } | null;
};

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Formatea fechas preservando el día original (evita desfase por zona horaria)
function toYmd(dateInput: string | Date) {
  if (typeof dateInput === "string") {
    const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CierreCajaPage() {
  const [tab, setTab] = useState<"generar" | "listado">("generar");
  const { user } = useAuth();

  // Generar / Preview
  const [fecha, setFecha] = useState<string>(todayStr());
  // Saldo inicial se obtiene del día anterior (sin input manual)
  const [preview, setPreview] = useState<CierrePreview | null>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movimientosBloqueados, setMovimientosBloqueados] = useState(false);
  const [ventasDetalleOpen, setVentasDetalleOpen] = useState(false);
  const [ventasDiaExpanded, setVentasDiaExpanded] = useState<boolean>(true);
  // Formularios de Ingreso/Egreso
  const [ingresoOpen, setIngresoOpen] = useState<boolean>(false);
  const [ingresoMonto, setIngresoMonto] = useState<string>("");
  const [ingresoMotivo, setIngresoMotivo] = useState<string>("");
  const [egresoOpen, setEgresoOpen] = useState<boolean>(false);
  const [egresoMonto, setEgresoMonto] = useState<string>("");
  const [egresoMotivo, setEgresoMotivo] = useState<string>("");

  async function calcular() {
    // Al recalcular, desbloquear acciones de movimientos
    setMovimientosBloqueados(false);
    setLoadingPrev(true);
    try {
      const params = new URLSearchParams();
      params.set("fecha", fecha);
      const res = await api.get(`/cierres-caja/preview?${params.toString()}`, {
        withCredentials: true,
      });
      setPreview(res.data);
    } catch (err) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Error al calcular";
      toast.error(msg);
    } finally {
      setLoadingPrev(false);
    }
  }

  async function confirmar() {
    if (!fecha) return;
    const ok = await askConfirm({
      title: "Confirmar cierre de caja",
      message: "¿Seguro que quiere cerrar la caja del día?",
      confirmText: "Aceptar",
      cancelText: "Cancelar",
      type: "warning",
    });
    if (!ok) return;
    // Bloquear ingresos/egresos tras aceptar
    setMovimientosBloqueados(true);
    setSaving(true);
    try {
      await api.post(`/cierres-caja`, { fecha }, { withCredentials: true });
      toast.success("Cierre generado");
      setPreview(null);
      // refrescar listado
      await cargarListado();
      setTab("listado");
    } catch (err) {
      console.error(err);
      const status = (err as any)?.response?.status;
      const serverMsg = (err as any)?.response?.data?.error;
      if (status === 409) {
        // Caso específico: el cierre ya existe para esa fecha
        toast.success("Ya se hizo el cierre de caja del día");
      } else {
        const msg =
          serverMsg || (err as any)?.message || "Error al confirmar el cierre";
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  // Listado
  const [cierres, setCierres] = useState<CierreCaja[]>([]);
  const [egresosDia, setEgresosDia] = useState<
    Array<{
      idEgreso: number;
      fecha: string;
      monto: string | number;
      comentario?: string;
      Usuario?: { nombre?: string };
    }>
  >([]);
  const [loadingList, setLoadingList] = useState(false);
  // Exportación por período (Listado)
  function firstDayOfMonthStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  const [periodDesde, setPeriodDesde] = useState<string>(firstDayOfMonthStr());
  const [periodHasta, setPeriodHasta] = useState<string>(todayStr());
  const [exportOpen, setExportOpen] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  // Bloqueo automático si ya existe un cierre para la fecha seleccionada
  const yaCerrada = useMemo(() => {
    try {
      return cierres.some((c) => toYmd((c as any).fecha) === fecha);
    } catch {
      return false;
    }
  }, [cierres, fecha]);
  const bloqueado = movimientosBloqueados || yaCerrada;
  // Totales locales de ingresos/egresos del día (efectivo)
  const totalIngresosEfectivo = useMemo(() => {
    return egresosDia.reduce((acc, e) => {
      const n = Number(e.monto);
      const isIngreso =
        n > 0 ||
        String(e.comentario || "")
          .toLowerCase()
          .includes("ajuste saldo inicial");
      return acc + (isIngreso ? n : 0);
    }, 0);
  }, [egresosDia]);
  // paginación locales
  const pageSize = 5;
  const [ventasPage, setVentasPage] = useState<number>(1);
  const [cierresPage, setCierresPage] = useState<number>(1);
  async function cargarListado() {
    setLoadingList(true);
    try {
      const res = await api.get(`/cierres-caja`, { withCredentials: true });
      setCierres(res.data);
    } catch (err) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Error al listar cierres";
      toast.error(msg);
    } finally {
      setLoadingList(false);
    }
  }

  async function cargarEgresosDelDia() {
    try {
      const params = new URLSearchParams();
      params.set("fecha", fecha);
      const res = await api.get(`/egresos-caja?${params.toString()}`, {
        withCredentials: true,
      });
      setEgresosDia(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  // Formularios: Ingreso
  function agregarIngreso() {
    if (bloqueado || saving) {
      return toast.error("Caja bloqueada: ya existe cierre o en confirmación");
    }
    setIngresoMonto("");
    setIngresoMotivo("");
    setIngresoOpen(true);
  }

  async function submitIngreso() {
    if (bloqueado || saving) {
      return toast.error("Caja bloqueada: ya existe cierre o en confirmación");
    }
    const montoNum = Number(ingresoMonto);
    if (Number.isNaN(montoNum)) {
      return toast.error("Ingresa un monto válido; si es cero, escribe 0");
    }
    if (montoNum < 0) {
      return toast.error("El ingreso debe ser positivo o cero");
    }
    if (!ingresoMotivo || ingresoMotivo.trim().length === 0) {
      return toast.error("Ingresa un motivo");
    }
    try {
      await api.post(
        `/egresos-caja`,
        {
          fecha,
          monto: montoNum,
          comentario: `ajuste saldo inicial: ${ingresoMotivo}`,
        },
        { withCredentials: true }
      );
      toast.success("Ingreso registrado");
      setIngresoOpen(false);
      await cargarEgresosDelDia();
      await calcular();
    } catch (err) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Error al registrar ingreso";
      toast.error(msg);
    }
  }

  // Formularios: Egreso
  function agregarEgreso() {
    if (bloqueado || saving) {
      return toast.error("Caja bloqueada: ya existe cierre o en confirmación");
    }
    setEgresoMonto("");
    setEgresoMotivo("");
    setEgresoOpen(true);
  }

  async function submitEgreso() {
    if (bloqueado || saving) {
      return toast.error("Caja bloqueada: ya existe cierre o en confirmación");
    }
    let montoNum = Number(egresoMonto);
    if (Number.isNaN(montoNum)) {
      return toast.error("Ingresa un monto válido");
    }
    if (!egresoMotivo || egresoMotivo.trim().length === 0) {
      return toast.error("Ingresa un motivo");
    }
    // Asegurar que sea negativo
    if (montoNum > 0) montoNum = -montoNum;
    try {
      await api.post(
        `/egresos-caja`,
        { fecha, monto: montoNum, comentario: egresoMotivo },
        { withCredentials: true }
      );
      toast.success("Egreso registrado");
      setEgresoOpen(false);
      await cargarEgresosDelDia();
      await calcular();
    } catch (err) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Error al registrar egreso";
      toast.error(msg);
    }
  }

  useEffect(() => {
    cargarListado();
  }, []);
  useEffect(() => {
    cargarEgresosDelDia();
  }, [fecha]);
  // resetear páginas cuando cambia la fecha o se recalcula preview
  useEffect(() => {
    setVentasPage(1);
  }, [fecha, preview]);

  // ===== Export helpers =====
  function downloadFile(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  function toCsvLine(cols: Array<string | number>) {
    return cols
      .map((c) => {
        const s = String(c ?? "");
        const needsQuote = /[,"]/.test(s);
        return needsQuote ? `"${s.replace(/"/g, '""')}` + `"` : s;
      })
      .join(",");
  }

  // Normalización y suma por método de pago para reportes
  function normalizeMetodo(nombre: string) {
    const t = String(nombre || "").toLowerCase();
    // Remover acentos para coincidencias robustas (crédito -> credito, débito -> debito)
    const s = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (s.includes("efect")) return "Efectivo";
    if (s.includes("trans")) return "Transferencia";
    if (s.includes("qr")) return "QR";
    if (
      s.includes("cred") ||
      s.includes("credit") ||
      s.includes("tarjeta credito")
    )
      return "Crédito";
    if (
      s.includes("deb") ||
      s.includes("debit") ||
      s.includes("tarjeta debito")
    )
      return "Débito";
    return "Otros";
  }
  function sumPorMetodo(rows: Array<{ metodo: string; total: number }>) {
    const acc = {
      Efectivo: 0,
      Transferencia: 0,
      QR: 0,
      Crédito: 0,
      Débito: 0,
    } as Record<string, number>;
    for (const r of rows || []) {
      const key = normalizeMetodo(r.metodo);
      if (acc[key] != null) acc[key] += Number(r.total || 0);
    }
    return acc as {
      Efectivo: number;
      Transferencia: number;
      QR: number;
      Crédito: number;
      Débito: number;
    };
  }
  async function obtenerVentasPorMetodo(fechaYmd: string) {
    try {
      const params = new URLSearchParams();
      params.set("fecha", fechaYmd);
      const res = await api.get(`/cierres-caja/preview?${params.toString()}`, {
        withCredentials: true,
      });
      return (res.data?.ventasPorMetodo ?? []) as Array<{
        metodo: string;
        total: number;
      }>;
    } catch {
      return [] as Array<{ metodo: string; total: number }>;
    }
  }

  async function obtenerIngresosCaja(fechaYmd: string) {
    try {
      const params = new URLSearchParams();
      params.set("fecha", fechaYmd);
      const res = await api.get(`/cierres-caja/preview?${params.toString()}`, {
        withCredentials: true,
      });
      return Number(res.data?.ingresosCaja ?? 0);
    } catch {
      return 0;
    }
  }

  function printHtml(title: string, html: string) {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document
      .write(`<!doctype html><html><head><meta charset=\"utf-8\"/><title>${title}</title>
      <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; padding: 24px; }
        h1 { font-size: 18px; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f3f4f6; }
      </style>
    </head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 200);
  }

  async function exportCierreCSV(c: CierreCaja) {
    const ventasMet = await obtenerVentasPorMetodo(toYmd((c as any).fecha));
    const byMet = sumPorMetodo(ventasMet);
    const ingresosCaja = await obtenerIngresosCaja(toYmd((c as any).fecha));
    const header = toCsvLine(["Campo", "Valor"]);
    const lines: string[] = [];
    lines.push(toCsvLine(["Fecha", toYmd((c as any).fecha)]));
    lines.push(toCsvLine(["Saldo inicial", Number(c.saldoInicial)]));
    lines.push(toCsvLine(["Total ventas del día", Number(c.totalVentas)]));
    lines.push(toCsvLine(["Ventas por método - Efectivo", byMet.Efectivo]));
    lines.push(
      toCsvLine(["Ventas por método - Transferencia", byMet.Transferencia])
    );
    lines.push(toCsvLine(["Ventas por método - QR", byMet.QR]));
    lines.push(toCsvLine(["Ventas por método - Crédito", byMet.Crédito]));
    lines.push(toCsvLine(["Ventas por método - Débito", byMet.Débito]));
    lines.push(toCsvLine(["Total ingresos efectivo", ingresosCaja]));
    lines.push(toCsvLine(["Total egresos", Number(c.totalEgresos)]));
    lines.push(toCsvLine(["Saldo final teórico", Number(c.saldoFinal)]));
    lines.push(
      toCsvLine([
        "Usuario",
        String(c.Usuario?.nombreUsuario || c.Usuario?.emailUsuario || "-"),
      ])
    );
    const csv = header + "\n" + lines.join("\n") + "\n";
    downloadFile(
      `cierre_${toYmd((c as any).fecha)}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
  }

  async function exportCierrePDF(c: CierreCaja) {
    const ventasMet = await obtenerVentasPorMetodo(toYmd((c as any).fecha));
    const byMet = sumPorMetodo(ventasMet);
    const ingresosCaja = await obtenerIngresosCaja(toYmd((c as any).fecha));
    const html = `
      <h1>Informe diario de cierre de caja</h1>
      <table>
        <tbody>
          <tr><th>Fecha</th><td>${toYmd((c as any).fecha)}</td></tr>
          <tr><th>Saldo inicial</th><td>${fmt(Number(c.saldoInicial))}</td></tr>
          <tr><th>Total ventas del día</th><td>${fmt(
            Number(c.totalVentas)
          )}</td></tr>
        </tbody>
      </table>
      <h1 style="margin-top:16px">Ventas por método</h1>
      <table>
        <tbody>
          <tr><th>Efectivo</th><td>${fmt(byMet.Efectivo)}</td></tr>
          <tr><th>Transferencia</th><td>${fmt(byMet.Transferencia)}</td></tr>
          <tr><th>QR</th><td>${fmt(byMet.QR)}</td></tr>
          <tr><th>Crédito</th><td>${fmt(byMet.Crédito)}</td></tr>
          <tr><th>Débito</th><td>${fmt(byMet.Débito)}</td></tr>
        </tbody>
      </table>
      <table>
        <tbody>
          <tr><th>Total ingresos efectivo</th><td>${fmt(
            Number(ingresosCaja)
          )}</td></tr>
          <tr><th>Total egresos</th><td>${fmt(Number(c.totalEgresos))}</td></tr>
          <tr><th>Saldo final teórico</th><td>${fmt(
            Number(c.saldoFinal)
          )}</td></tr>
          <tr><th>Usuario</th><td>${
            c.Usuario?.nombreUsuario || c.Usuario?.emailUsuario || "-"
          }</td></tr>
        </tbody>
      </table>
    `;
    printHtml(`Cierre_${toYmd((c as any).fecha)}`, html);
  }

  // Exportación por período: CSV/PDF de múltiples cierres
  function exportPeriodoRows() {
    const d0 = periodDesde?.trim();
    const d1 = periodHasta?.trim();
    if (!d0 || !d1) {
      toast.error("Selecciona fecha desde y hasta");
      return null;
    }
    if (d0 > d1) {
      toast.error("El período es inválido: 'Desde' es mayor que 'Hasta'");
      return null;
    }
    const rows = cierres.filter((c) => {
      const f = toYmd((c as any).fecha);
      return f >= d0 && f <= d1;
    });
    if (rows.length === 0) {
      toast("Sin cierres en el período seleccionado", { icon: "ℹ️" });
    }
    return rows;
  }

  async function exportPeriodoCSV() {
    const rows = exportPeriodoRows();
    if (!rows) return;
    const header = toCsvLine([
      "Fecha",
      "Saldo inicial",
      "Total ventas",
      "Efectivo",
      "Transferencia",
      "QR",
      "Crédito",
      "Débito",
      "Ingresos efectivo",
      "Total egresos",
      "Saldo final",
      "Usuario",
    ]);
    let totIni = 0,
      totVentas = 0,
      totEgresos = 0,
      totFinal = 0,
      totIng = 0,
      totEf = 0,
      totTr = 0,
      totQr = 0,
      totCr = 0,
      totDb = 0;
    const body = (
      await Promise.all(
        rows.map(async (c) => {
          const f = toYmd((c as any).fecha);
          const ini = Number(c.saldoInicial) || 0;
          const vta = Number(c.totalVentas) || 0;
          const egr = Number(c.totalEgresos) || 0;
          const fin = Number(c.saldoFinal) || 0;
          totIni += ini;
          totVentas += vta;
          totEgresos += egr;
          totFinal += fin;
          const ventasMet = await obtenerVentasPorMetodo(f);
          const byMet = sumPorMetodo(ventasMet);
          const ingresosCaja = await obtenerIngresosCaja(f);
          totIng += ingresosCaja;
          totEf += byMet.Efectivo;
          totTr += byMet.Transferencia;
          totQr += byMet.QR;
          totCr += byMet.Crédito;
          totDb += byMet.Débito;
          return toCsvLine([
            f,
            ini,
            vta,
            byMet.Efectivo,
            byMet.Transferencia,
            byMet.QR,
            byMet.Crédito,
            byMet.Débito,
            ingresosCaja,
            egr,
            fin,
            c.Usuario?.nombreUsuario || c.Usuario?.emailUsuario || "-",
          ]);
        })
      )
    ).join("\n");
    const footer =
      "\n" +
      toCsvLine([
        "Totales",
        totIni,
        totVentas,
        totEf,
        totTr,
        totQr,
        totCr,
        totDb,
        totIng,
        totEgresos,
        totFinal,
        "-",
      ]);
    const csv = header + "\n" + body + footer + "\n";
    downloadFile(
      `cierres_${periodDesde}_a_${periodHasta}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
  }

  async function exportPeriodoPDF() {
    const rows = exportPeriodoRows();
    if (!rows) return;
    let totIni = 0,
      totVentas = 0,
      totEgresos = 0,
      totFinal = 0,
      totIng = 0,
      totEf = 0,
      totTr = 0,
      totQr = 0,
      totCr = 0,
      totDb = 0;
    const trs = (
      await Promise.all(
        rows.map(async (c) => {
          const f = toYmd((c as any).fecha);
          const ini = Number(c.saldoInicial) || 0;
          const vta = Number(c.totalVentas) || 0;
          const egr = Number(c.totalEgresos) || 0;
          const fin = Number(c.saldoFinal) || 0;
          totIni += ini;
          totVentas += vta;
          totEgresos += egr;
          totFinal += fin;
          const ventasMet = await obtenerVentasPorMetodo(f);
          const byMet = sumPorMetodo(ventasMet);
          const ingresosCaja = await obtenerIngresosCaja(f);
          totIng += ingresosCaja;
          totEf += byMet.Efectivo;
          totTr += byMet.Transferencia;
          totQr += byMet.QR;
          totCr += byMet.Crédito;
          totDb += byMet.Débito;
          return `
        <tr>
          <td>${f}</td>
          <td>${fmt(ini)}</td>
          <td>${fmt(vta)}</td>
          <td>${fmt(byMet.Efectivo)}</td>
          <td>${fmt(byMet.Transferencia)}</td>
          <td>${fmt(byMet.QR)}</td>
          <td>${fmt(byMet.Crédito)}</td>
          <td>${fmt(byMet.Débito)}</td>
          <td>${fmt(ingresosCaja)}</td>
          <td>${fmt(egr)}</td>
          <td>${fmt(fin)}</td>
          <td>${c.Usuario?.nombreUsuario || c.Usuario?.emailUsuario || "-"}</td>
        </tr>`;
        })
      )
    ).join("");
    const html = `
      <h1>Informe de cierres de caja (${periodDesde} a ${periodHasta})</h1>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Saldo inicial</th>
            <th>Total ventas</th>
            <th>Efectivo</th>
            <th>Transferencia</th>
            <th>QR</th>
            <th>Crédito</th>
            <th>Débito</th>
            <th>Ingresos efectivo</th>
            <th>Total egresos</th>
            <th>Saldo final</th>
            <th>Usuario</th>
          </tr>
        </thead>
        <tbody>
          ${trs}
          <tr>
            <th>Totales</th>
            <th>${fmt(totIni)}</th>
            <th>${fmt(totVentas)}</th>
            <th>${fmt(totEf)}</th>
            <th>${fmt(totTr)}</th>
            <th>${fmt(totQr)}</th>
            <th>${fmt(totCr)}</th>
            <th>${fmt(totDb)}</th>
            <th>${fmt(totIng)}</th>
            <th>${fmt(totEgresos)}</th>
            <th>${fmt(totFinal)}</th>
            <th>-</th>
          </tr>
        </tbody>
      </table>`;
    printHtml(`Cierres_${periodDesde}_a_${periodHasta}`, html);
  }

  async function generarExportPeriodo() {
    if (exportFormat === "csv") await exportPeriodoCSV();
    else await exportPeriodoPDF();
    setExportOpen(false);
  }

  const previewRows = useMemo(() => {
    if (!preview) return [] as Array<[string, string]>;
    const rows: Array<[string, string]> = [
      ["Saldo Inicial", fmt(preview.saldoInicial)],
      ["Total Ventas", fmt(preview.totalVentas)],
      ["Total Egresos Efectivo", fmt(preview.totalEgresos)],
      ["Total Ingresos Efectivo", fmt(totalIngresosEfectivo)],
      ["Saldo Final Efectivo", fmt(preview.saldoFinal)],
    ];
    return rows;
  }, [preview, totalIngresosEfectivo]);

  // Valores crudos numéricos por clave para determinar signos en la UI
  const rawByKey = useMemo(() => {
    if (!preview) return null as null | Record<string, number>;
    return {
      "Saldo Inicial": preview.saldoInicial,
      "Total Ventas": preview.totalVentas,
      "Total Egresos Efectivo": preview.totalEgresos,
      "Total Ingresos Efectivo": totalIngresosEfectivo,
      "Saldo Final Efectivo": preview.saldoFinal,
    } as Record<string, number>;
  }, [preview, totalIngresosEfectivo]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Cierre de caja</h1>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            className={`rounded border px-3 py-1 ${
              tab === "generar" ? "bg-gray-100" : ""
            }`}
            onClick={() => setTab("generar")}
          >
            Generar cierre
          </button>
          <button
            className={`rounded border px-3 py-1 ${
              tab === "listado" ? "bg-gray-100" : ""
            }`}
            onClick={() => setTab("listado")}
          >
            Listado
          </button>
        </div>
      </div>

      {tab === "generar" ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-end gap-3 mb-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-600 block">Fecha</label>
                    <input
                      type="date"
                      className="rounded border px-2 py-1 w-40"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={calcular}
                    className="rounded border px-3 py-2 text-sm"
                    disabled={loadingPrev}
                  >
                    {loadingPrev ? "Calculando…" : "Calcular"}
                  </button>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Resultado</h3>
                </div>
                {preview ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Usuario</span>
                      <span className="font-medium">
                        {user?.nombre || user?.email || "-"}
                      </span>
                    </div>
                    {previewRows.map(([k, v]) => {
                      const numeric = rawByKey?.[k] ?? 0;
                      const conceptNegative = k === "Total Egresos Efectivo";
                      const isNegative = conceptNegative || numeric < 0;
                      const hasVentasMetodo =
                        k === "Total Ventas" &&
                        !!preview?.ventasPorMetodo?.length;
                      return (
                        <div key={k} className="space-y-1">
                          <div className={`flex items-center justify-between`}>
                            <span className="text-gray-600 flex items-center gap-1">
                              {k}
                              {hasVentasMetodo && (
                                <button
                                  type="button"
                                  className="text-xs leading-none cursor-pointer select-none"
                                  aria-label="Mostrar detalle por método"
                                  onClick={() =>
                                    setVentasDetalleOpen((b) => !b)
                                  }
                                >
                                  {ventasDetalleOpen ? "▾" : "▸"}
                                </button>
                              )}
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-medium text-right ${
                                  k === "Total Ingresos Efectivo"
                                    ? "text-green-600"
                                    : isNegative
                                    ? "text-red-600"
                                    : ""
                                }`}
                              >
                                {v}
                              </span>
                            </div>
                          </div>
                          {hasVentasMetodo && ventasDetalleOpen && (
                            <div className="pl-6 text-xs">
                              {(() => {
                                // Construir resumen de totales por método
                                const base = (
                                  preview?.ventasPorMetodo || []
                                ).map((r) => ({
                                  metodo: normalizeMetodo(r.metodo),
                                  total: Number(r.total || 0),
                                }));
                                // Fallback si no hay ventasPorMetodo
                                const fallback = (
                                  preview?.ventasDelDia || []
                                ).map((v) => ({
                                  metodo: normalizeMetodo(v.metodoPago),
                                  total: Number(v.total || 0),
                                }));
                                const resumen = sumPorMetodo(
                                  base.length ? base : fallback
                                );
                                const items: Array<{
                                  label: string;
                                  value: number;
                                }> = [
                                  {
                                    label: "Efectivo",
                                    value: resumen.Efectivo,
                                  },
                                  { label: "Crédito", value: resumen.Crédito },
                                  { label: "Débito", value: resumen.Débito },
                                  { label: "QR", value: resumen.QR },
                                  {
                                    label: "Transferencia",
                                    value: resumen.Transferencia,
                                  },
                                ];
                                return (
                                  <ul className="space-y-1">
                                    {items.map((it) => (
                                      <li
                                        key={it.label}
                                        className="flex items-center justify-between"
                                      >
                                        <span className="text-gray-600">
                                          {it.label}
                                        </span>
                                        <span className="font-medium text-right">
                                          {fmt(it.value)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    Sin cálculo. Seleccione fecha y presione Calcular.
                  </p>
                )}
              </div>

              {/* Ventas del día */}
              <div className="rounded-xl border bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Ventas del día</h3>
                  <button
                    type="button"
                    className="text-xs border px-2 py-1 rounded"
                    onClick={() => setVentasDiaExpanded((b) => !b)}
                    aria-label="Mostrar/Ocultar ventas del día"
                  >
                    {ventasDiaExpanded ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                {preview ? (
                  ventasDiaExpanded ? (
                    (() => {
                      const total = preview.ventasDelDia?.length ?? 0;
                      if (total === 0) {
                        return (
                          <p className="text-sm text-gray-600">Sin ventas.</p>
                        );
                      }
                      const totalPages = Math.max(
                        1,
                        Math.ceil(total / pageSize)
                      );
                      const safePage = Math.min(
                        Math.max(1, ventasPage),
                        totalPages
                      );
                      const start = (safePage - 1) * pageSize;
                      const end = Math.min(start + pageSize, total);
                      const pageRows = preview.ventasDelDia!.slice(start, end);
                      return (
                        <div className="overflow-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left">
                                <th className="py-2 border-b">#</th>
                                <th className="py-2 border-b">Cliente</th>
                                <th className="py-2 border-b">Método</th>
                                <th className="py-2 border-b text-center">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {pageRows.map((v) => (
                                <tr key={v.idVenta}>
                                  <td className="py-2 border-b">{v.idVenta}</td>
                                  <td className="py-2 border-b">{v.cliente}</td>
                                  <td className="py-2 border-b">
                                    {v.metodoPago}
                                  </td>
                                  <td className="py-2 border-b text-right">
                                    {fmt(v.total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {/* Controles de paginación */}
                          {total > pageSize && (
                            <div className="flex items-center justify-between mt-2 text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  className="border px-2 py-1 rounded disabled:opacity-50"
                                  onClick={() =>
                                    setVentasPage((p) => Math.max(1, p - 1))
                                  }
                                  disabled={safePage <= 1}
                                >
                                  Anterior
                                </button>
                                <button
                                  className="border px-2 py-1 rounded disabled:opacity-50"
                                  onClick={() =>
                                    setVentasPage((p) =>
                                      Math.min(totalPages, p + 1)
                                    )
                                  }
                                  disabled={safePage >= totalPages}
                                >
                                  Siguiente
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span>Página</span>
                                <input
                                  className="w-14 rounded border px-2 py-1"
                                  type="number"
                                  min={1}
                                  max={totalPages}
                                  value={safePage}
                                  onChange={(e) => {
                                    const v = Math.max(
                                      1,
                                      Math.min(
                                        totalPages,
                                        Number(e.target.value) || 1
                                      )
                                    );
                                    setVentasPage(v);
                                  }}
                                />
                                <span>de {totalPages}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : null
                ) : (
                  <p className="text-sm text-gray-600">
                    Sin cálculo. Seleccione fecha y presione Calcular.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={confirmar}
                  disabled={saving || !preview || bloqueado}
                  className="rounded-lg bg-black text-white px-3 py-2 text-sm"
                >
                  {saving ? "Confirmando…" : "Confirmar cierre"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {/* Ingreso/Egresos */}
              <div className="rounded-xl border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Ingreso/Egresos</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="border px-2 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={bloqueado || saving}
                      onClick={agregarIngreso}
                    >
                      Ingresos
                    </button>
                    <button
                      className="border px-2 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={bloqueado || saving}
                      onClick={agregarEgreso}
                    >
                      Egresos
                    </button>
                  </div>
                </div>
                {ingresoOpen && (
                  <div className="fixed inset-0 z-50">
                    <div
                      className="absolute inset-0 bg-black/20"
                      onClick={() => setIngresoOpen(false)}
                    />
                    <div className="absolute inset-0 p-4 flex items-center justify-center">
                      <div className="w-full max-w-md rounded-xl border bg-white shadow-lg">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                          <h3 className="text-sm font-semibold">
                            Registrar ingreso
                          </h3>
                          <button
                            className="p-2 rounded hover:bg-gray-100"
                            onClick={() => setIngresoOpen(false)}
                            aria-label="Cerrar"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="p-4 space-y-3 text-sm">
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600 block">
                              Monto
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              className="rounded border px-2 py-1 w-full"
                              value={ingresoMonto}
                              onChange={(e) => setIngresoMonto(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600 block">
                              Motivo
                            </label>
                            <input
                              type="text"
                              className="rounded border px-2 py-1 w-full"
                              value={ingresoMotivo}
                              onChange={(e) => setIngresoMotivo(e.target.value)}
                              placeholder="Ej: ajuste por conteo"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                              className="text-xs border px-3 py-1 rounded"
                              onClick={() => setIngresoOpen(false)}
                            >
                              Cancelar
                            </button>
                            <button
                              className="text-xs border px-3 py-1 rounded bg-black text-white"
                              onClick={submitIngreso}
                            >
                              Registrar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {egresoOpen && (
                  <div className="fixed inset-0 z-50">
                    <div
                      className="absolute inset-0 bg-black/20"
                      onClick={() => setEgresoOpen(false)}
                    />
                    <div className="absolute inset-0 p-4 flex items-center justify-center">
                      <div className="w-full max-w-md rounded-xl border bg-white shadow-lg">
                        <div className="flex items-center justify-between px-4 py-3 border-b">
                          <h3 className="text-sm font-semibold">
                            Registrar egreso
                          </h3>
                          <button
                            className="p-2 rounded hover:bg-gray-100"
                            onClick={() => setEgresoOpen(false)}
                            aria-label="Cerrar"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="p-4 space-y-3 text-sm">
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600 block">
                              Monto
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              className="rounded border px-2 py-1 w-full"
                              value={egresoMonto}
                              onChange={(e) => setEgresoMonto(e.target.value)}
                              placeholder="0.00 (se convertirá a negativo)"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600 block">
                              Motivo
                            </label>
                            <input
                              type="text"
                              className="rounded border px-2 py-1 w-full"
                              value={egresoMotivo}
                              onChange={(e) => setEgresoMotivo(e.target.value)}
                              placeholder="Ej: compra de insumos"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                              className="text-xs border px-3 py-1 rounded"
                              onClick={() => setEgresoOpen(false)}
                            >
                              Cancelar
                            </button>
                            <button
                              className="text-xs border px-3 py-1 rounded bg-black text-white"
                              onClick={submitEgreso}
                            >
                              Registrar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="py-2 border-b">Monto</th>
                        <th className="py-2 border-b">Comentario</th>
                        <th className="py-2 border-b">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {egresosDia.map((e) => (
                        <EgresoRow
                          key={e.idEgreso}
                          egreso={e}
                          movimientosBloqueados={bloqueado}
                          onChanged={async () => {
                            await cargarEgresosDelDia();
                            await calcular();
                          }}
                        />
                      ))}
                      {egresosDia.length === 0 && (
                        <tr>
                          <td
                            className="py-2 border-b text-gray-600"
                            colSpan={3}
                          >
                            Sin movimientos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border bg-white p-4 overflow-auto">
          {loadingList ? (
            <div className="text-sm">Cargando…</div>
          ) : (
            (() => {
              const total = cierres.length;
              const totalPages = Math.max(1, Math.ceil(total / pageSize));
              const safePage = Math.min(Math.max(1, cierresPage), totalPages);
              const start = (safePage - 1) * pageSize;
              const end = Math.min(start + pageSize, total);
              const pageRows = cierres.slice(start, end);
              return (
                <>
                  {/* Encabezado y botón Exportar en una misma fila */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold">
                      Historial de cierres
                    </h3>
                    <div>
                      <button
                        className="text-xs border px-3 py-1 rounded"
                        onClick={() => setExportOpen(true)}
                      >
                        Exportar
                      </button>
                    </div>
                  </div>
                  {exportOpen && (
                    <div className="fixed inset-0 z-50">
                      <div
                        className="absolute inset-0 bg-black/20"
                        onClick={() => setExportOpen(false)}
                      />
                      <div className="absolute inset-0 p-4 flex items-center justify-center">
                        <div className="w-full max-w-md rounded-xl border bg-white shadow-lg">
                          <div className="flex items-center justify-between px-4 py-3 border-b">
                            <h3 className="text-sm font-semibold">
                              Exportar cierres
                            </h3>
                            <button
                              className="p-2 rounded hover:bg-gray-100"
                              onClick={() => setExportOpen(false)}
                              aria-label="Cerrar"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="p-4 space-y-3 text-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-xs text-gray-600 block">
                                  Desde
                                </label>
                                <input
                                  type="date"
                                  className="rounded border px-2 py-1 w-full"
                                  value={periodDesde}
                                  onChange={(e) =>
                                    setPeriodDesde(e.target.value)
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-gray-600 block">
                                  Hasta
                                </label>
                                <input
                                  type="date"
                                  className="rounded border px-2 py-1 w-full"
                                  value={periodHasta}
                                  onChange={(e) =>
                                    setPeriodHasta(e.target.value)
                                  }
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-gray-600 block">
                                Formato
                              </label>
                              <select
                                className="rounded border px-2 py-1 w-full"
                                value={exportFormat}
                                onChange={(e) =>
                                  setExportFormat(
                                    e.target.value as "csv" | "pdf"
                                  )
                                }
                              >
                                <option value="csv">CSV</option>
                                <option value="pdf">PDF</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-2">
                              <button
                                className="text-xs border px-3 py-1 rounded"
                                onClick={() => setExportOpen(false)}
                              >
                                Cancelar
                              </button>
                              <button
                                className="text-xs border px-3 py-1 rounded bg-black text-white"
                                onClick={generarExportPeriodo}
                              >
                                Generar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="py-2 border-b">Fecha</th>
                        <th className="py-2 border-b">Total Ventas</th>
                        <th className="py-2 border-b">Saldo final efectivo</th>
                        <th className="py-2 border-b">Usuario</th>
                        <th className="py-2 border-b">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((c) => (
                        <tr key={c.idCierre}>
                          <td className="py-2 border-b">
                            {toYmd((c as any).fecha)}
                          </td>
                          <td className="py-2 border-b">
                            {fmt(c.totalVentas)}
                          </td>
                          <td
                            className={`py-2 border-b ${
                              Number(c.saldoFinal) < 0 ? "text-red-600" : ""
                            }`}
                          >
                            {fmt(c.saldoFinal)}
                          </td>
                          <td className="py-2 border-b">
                            {c.Usuario?.nombreUsuario ||
                              c.Usuario?.emailUsuario ||
                              "-"}
                          </td>
                          <td className="py-2 border-b">
                            <div className="flex items-center gap-2">
                              <button
                                className="text-xs border px-2 py-1 rounded"
                                onClick={() => exportCierreCSV(c)}
                              >
                                CSV
                              </button>
                              <button
                                className="text-xs border px-2 py-1 rounded"
                                onClick={() => exportCierrePDF(c)}
                              >
                                PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {total === 0 && (
                        <tr>
                          <td
                            className="py-2 border-b text-gray-600"
                            colSpan={4}
                          >
                            No hay cierres.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {/* Controles de paginación */}
                  {total > pageSize && (
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          className="border px-2 py-1 rounded disabled:opacity-50"
                          onClick={() =>
                            setCierresPage((p) => Math.max(1, p - 1))
                          }
                          disabled={safePage <= 1}
                        >
                          Anterior
                        </button>
                        <button
                          className="border px-2 py-1 rounded disabled:opacity-50"
                          onClick={() =>
                            setCierresPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={safePage >= totalPages}
                        >
                          Siguiente
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Página</span>
                        <input
                          className="w-16 rounded border px-2 py-1"
                          type="number"
                          min={1}
                          max={totalPages}
                          value={safePage}
                          onChange={(e) => {
                            const v = Math.max(
                              1,
                              Math.min(totalPages, Number(e.target.value) || 1)
                            );
                            setCierresPage(v);
                          }}
                        />
                        <span>de {totalPages}</span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>
      )}
    </section>
  );
}

function EgresoRow({
  egreso,
  onChanged,
  movimientosBloqueados,
}: {
  egreso: {
    idEgreso: number;
    monto: number | string;
    comentario?: string | null;
  };
  onChanged: () => void;
  movimientosBloqueados: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const comentarioLc = (egreso.comentario ?? "").toLowerCase();
  const esRetiro = comentarioLc.includes("retiro en efectivo caja");
  const esAjusteSaldoInicial = comentarioLc.includes("ajuste saldo inicial");

  // Modal de edición
  const [editOpen, setEditOpen] = useState(false);
  const [editMonto, setEditMonto] = useState<string>(
    String(egreso.monto ?? "")
  );
  const [editMotivo, setEditMotivo] = useState<string>(egreso.comentario ?? "");

  function abrirEditar() {
    setEditMonto(String(egreso.monto ?? ""));
    setEditMotivo(egreso.comentario ?? "");
    setEditOpen(true);
  }

  async function submitEditar() {
    const montoNum = Number(editMonto);
    if (Number.isNaN(montoNum)) {
      return toast.error("Ingresa un monto válido; si es cero, escribe 0");
    }
    if (!editMotivo || editMotivo.trim().length === 0) {
      return toast.error("Ingresa un motivo");
    }
    setSaving(true);
    try {
      await api.put(
        `/egresos-caja/${egreso.idEgreso}`,
        { monto: montoNum, comentario: editMotivo },
        { withCredentials: true }
      );
      toast.success("Movimiento actualizado");
      setEditOpen(false);
      onChanged();
    } catch (err) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Error al actualizar movimiento";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function eliminar() {
    const ok = await askConfirm({
      title: "Eliminar egreso",
      message: "¿Confirmas eliminar este egreso?",
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      type: "warning",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete(`/egresos-caja/${egreso.idEgreso}`, {
        withCredentials: true,
      });
      toast.success("Egreso eliminado");
      onChanged();
    } catch (err) {
      console.error(err);
      const msg =
        (err as any)?.response?.data?.error ||
        (err as any)?.message ||
        "Error al eliminar egreso";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <tr>
        <td
          className={`py-2 border-b ${
            Number(egreso.monto) < 0 ? "text-red-600" : "text-green-600"
          }`}
        >
          {fmt(egreso.monto)}
        </td>
        <td className="py-2 border-b">
          <span className="flex items-center gap-1 text-gray-700">
            {esRetiro && <span title="Retiro en efectivo caja">★</span>}
            {esAjusteSaldoInicial && (
              <span title="Ajuste saldo inicial">★</span>
            )}
            {egreso.comentario ?? "-"}
          </span>
        </td>
        <td className="py-2 border-b">
          <div className="flex items-center gap-2">
            <button
              className="border px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={abrirEditar}
              disabled={saving || movimientosBloqueados}
            >
              {saving ? "Guardando…" : "Editar"}
            </button>
            <button
              className="border px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={eliminar}
              disabled={deleting || movimientosBloqueados}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </td>
      </tr>
      {editOpen && (
        <tr>
          <td colSpan={3}>
            <div className="fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-black/20"
                onClick={() => setEditOpen(false)}
              />
              <div className="absolute inset-0 p-4 flex items-center justify-center">
                <div className="w-full max-w-md rounded-xl border bg-white shadow-lg">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="text-sm font-semibold">Editar movimiento</h3>
                    <button
                      className="p-2 rounded hover:bg-gray-100"
                      onClick={() => setEditOpen(false)}
                      aria-label="Cerrar"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-4 space-y-3 text-sm">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600 block">
                        Monto
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="rounded border px-2 py-1 w-full"
                        value={editMonto}
                        onChange={(e) => setEditMonto(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-600 block">
                        Motivo
                      </label>
                      <input
                        type="text"
                        className="rounded border px-2 py-1 w-full"
                        value={editMotivo}
                        onChange={(e) => setEditMotivo(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        className="text-xs border px-3 py-1 rounded"
                        onClick={() => setEditOpen(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        className="text-xs border px-3 py-1 rounded bg-black text-white"
                        onClick={submitEditar}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
