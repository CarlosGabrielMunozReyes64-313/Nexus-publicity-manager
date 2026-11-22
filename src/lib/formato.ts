const ZONA = "America/Bogota";
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Las fechas de calendario («2026-11-21») no son instantes: si se convierten con
 * `new Date()` se interpretan como medianoche UTC y en Bogotá aparecen un día antes.
 * Solo los valores con hora (marcas de tiempo) se convierten a la zona de Bogotá.
 */
export const esFechaCalendario = (value: string) => SOLO_FECHA.test(value);

export const fecha = (value: string) => {
  const dia = SOLO_FECHA.exec(value);
  if (dia) return `${dia[3]}/${dia[2]}/${dia[1]}`;
  const instante = new Date(value);
  if (Number.isNaN(instante.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(instante);
};

/** Fecha y hora de Bogotá para instantes (envíos programados, auditoría). */
export const fechaHora = (value: string) => {
  if (esFechaCalendario(value)) return fecha(value);
  const instante = new Date(value);
  if (Number.isNaN(instante.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instante);
};

/** Día de calendario de Bogotá (AAAA-MM-DD) para un instante; por defecto, hoy. */
export const diaBogota = (instante: Date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);

/** Suma días a una fecha de calendario sin pasar por zonas horarias. */
export const sumarDias = (dia: string, dias: number) => {
  const [y, m, d] = dia.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d + dias));
  return base.toISOString().slice(0, 10);
};

/** Clave de día para agrupar: fechas de calendario tal cual; instantes, día de Bogotá. */
export const claveDia = (value: string) =>
  esFechaCalendario(value) ? value : diaBogota(new Date(value));

export const moneda = (value?: number | null) =>
  value == null
    ? "Sin datos"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(value);
export const etiqueta = (value: string) => value.replaceAll("_", " ");
export const porcentaje = (
  numerador?: number | null,
  denominador?: number | null,
) =>
  numerador == null || !denominador
    ? "Sin datos"
    : `${((numerador / denominador) * 100).toFixed(1)} %`;
export function descargarArchivo(nombre: string, contenido: Blob) {
  const url = URL.createObjectURL(contenido);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function descargarCSV(nombre: string, filas: Record<string, unknown>[]) {
  const keys = Object.keys(filas[0] ?? {});
  const cell = (v: unknown) =>
    '"' +
    String(typeof v === "object" ? JSON.stringify(v) : (v ?? ""))
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const texto = [keys, ...filas.map((f) => keys.map((k) => f[k]))]
    .map((r) => r.map(cell).join(","))
    .join("\r\n");
  descargarArchivo(
    nombre,
    new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" }),
  );
}
