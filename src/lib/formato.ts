export const fecha = (value: string) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
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
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + texto], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
