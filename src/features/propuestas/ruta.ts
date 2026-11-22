import type { z } from "zod";
import * as S from "../../api/schemas";
import type { PropuestaAgente, Secuencia, VersionPropuesta } from "../../types";

export type RutaCorreo = z.infer<typeof S.rutaCorreoSchema>;
export type PasoRuta = RutaCorreo["pasos"][number];
export type NotaPaso = z.infer<typeof S.notaPasoSchema>;

/** Contenido de una versión como ruta; si no cumple el esquema, `null` (se muestra crudo). */
export function leerRuta(contenido: unknown): RutaCorreo | null {
  const r = S.rutaCorreoSchema.safeParse(contenido);
  return r.success ? r.data : null;
}

export const versionActual = (
  p: PropuestaAgente,
): VersionPropuesta | undefined =>
  p.versiones.find((v) => v.version === p.version) ?? p.versiones.at(-1);

/** Palabras del cuerpo sin contar {{firma}} ni {{baja}} (igual que el backend). */
export const palabras = (cuerpo: string) =>
  cuerpo
    .replace(/\{\{(firma|baja)\}\}/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

/** Día hábil en que sale cada correo (cada espera cuenta desde el correo anterior). */
export function diasDeEnvio(pasos: { esperaDiasHabiles: number }[]) {
  let total = 0;
  return pasos.map((p) => (total += p.esperaDiasHabiles));
}

export const duracion = (pasos: { esperaDiasHabiles: number }[]) =>
  diasDeEnvio(pasos).at(-1) ?? 0;

/** «Correo 1 · día 0», «Correo 2 · día 4 hábil · mismo hilo». */
export function tituloCorreo(i: number, dia: number, mismoHilo: boolean) {
  return [
    `Correo ${i + 1}`,
    i === 0 ? `día ${dia}` : `día ${dia} hábil`,
    ...(i > 0 && mismoHilo ? ["mismo hilo"] : []),
  ].join(" · ");
}

export const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const ventanaTexto = (v: Secuencia["ventanaEnvio"]) =>
  `${[...v.dias]
    .sort((a, b) => a - b)
    .map((d) => DIAS[d])
    .join(", ")} · ${v.desde}–${v.hasta} (hora de Bogotá)`;

/** Advertencias de la revisión que corresponden a un correo («Correo 2: …»). */
export const avisosDeCorreo = (advertencias: string[], i: number) =>
  advertencias
    .filter((a) => a.startsWith(`Correo ${i + 1}:`))
    .map((a) => a.slice(`Correo ${i + 1}:`.length).trim());

/** Partes de un texto: literal o variable ({{nombre}}), para resaltarlas. */
export function partesConVariables(texto: string) {
  return texto
    .split(/(\{\{\w+\}\})/g)
    .filter(Boolean)
    .map((t) => ({ texto: t, variable: /^\{\{\w+\}\}$/.test(t) }));
}

/** Pasos con id único para el editor (las versiones del agente pueden no traerlos). */
export function paraEditor(r: RutaCorreo, id: string): Secuencia {
  const vistos = new Set<string>();
  return {
    id,
    nombre: r.nombre,
    objetivo: r.objetivo,
    llamadaAccion: r.llamadaAccion,
    metricasExito: r.metricasExito,
    ventanaEnvio: r.ventanaEnvio,
    pasos: r.pasos.map((p, i) => {
      let pid = p.id && p.id !== "nuevo" ? p.id : `paso-${i + 1}`;
      if (vistos.has(pid)) pid = `paso-${i + 1}-${crypto.randomUUID()}`;
      vistos.add(pid);
      return { ...p, id: pid };
    }),
  };
}

export type Trozo = { tipo: "igual" | "agregado" | "quitado"; texto: string };

/** Diferencia palabra por palabra (LCS sobre palabras y espacios). */
export function diferencia(antes: string, despues: string): Trozo[] {
  const a = antes.split(/(\s+)/).filter(Boolean);
  const b = despues.split(/(\s+)/).filter(Boolean);
  const n = a.length;
  const m = b.length;
  // Tabla LCS (los correos tienen pocas centenas de palabras).
  const t = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      t[i][j] =
        a[i] === b[j]
          ? t[i + 1][j + 1] + 1
          : Math.max(t[i + 1][j], t[i][j + 1]);
  const out: Trozo[] = [];
  const push = (tipo: Trozo["tipo"], texto: string) => {
    const last = out.at(-1);
    if (last && last.tipo === tipo) last.texto += texto;
    else out.push({ tipo, texto });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("igual", a[i]);
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) push("quitado", a[i++]);
    else push("agregado", b[j++]);
  }
  while (i < n) push("quitado", a[i++]);
  while (j < m) push("agregado", b[j++]);
  return out;
}

export const AUTOR: Record<string, string> = {
  agente: "Agente",
  admin: "Administrador",
};
