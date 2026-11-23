import type { z } from "zod";
import * as S from "../../api/schemas";
import type { EstadoEditor, Secuencia } from "../../types";

export type Contenido = z.infer<typeof S.contenidoSecuenciaSchema>;
export type PasoBorrador = Contenido["pasos"][number];
/** Correo en el editor: siempre con id (solo para ordenar y como clave). */
export type CorreoEditor = PasoBorrador & { id: string };
export type Borrador = Omit<Contenido, "pasos"> & { pasos: CorreoEditor[] };

export const ESTADO_EDITOR: Record<
  EstadoEditor,
  [string, "success" | "warning" | "error" | "info"]
> = {
  borrador: ["Borrador", "warning"],
  cambios_sin_aprobar: ["Cambios sin aprobar", "warning"],
  aprobada: ["Aprobada", "success"],
  activa: ["Activa", "success"],
  pausada: ["Pausada", "info"],
  finalizada: ["Finalizada", "info"],
  archivada: ["Archivada", "info"],
};

export const AUTOR: Record<string, string> = { agente: "IA", admin: "Tú" };
export const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const VARIABLES = [
  "nombre",
  "empresa",
  "cargo",
  "municipio",
  "senal",
  "enlace",
  "firma",
  "baja",
];
/** Variables de datos (tienen respaldo); las demás las pone el sistema. */
export const VARIABLES_DATOS = [
  "nombre",
  "empresa",
  "cargo",
  "municipio",
  "senal",
];
export const CAMPO_FUENTE: Record<string, string> = {
  nombre: "nombre",
  empresa: "razonSocial",
  cargo: "cargo",
  municipio: "municipio",
  senal: "senal",
};
export const RESPALDO_POR_DEFECTO: Record<string, string> = {
  nombre: "equipo",
  empresa: "su empresa",
  senal: "trabaja con empresas grandes de la región",
  cargo: "su equipo",
  municipio: "su región",
};

/** Contenido de un borrador con ids únicos en cada correo (los de la IA pueden faltar). */
export function paraEditor(c: Contenido): Borrador {
  const vistos = new Set<string>();
  return {
    ...c,
    pasos: c.pasos.map((p, i) => {
      let id = p.id && p.id !== "nuevo" ? p.id : `correo-${i + 1}`;
      if (vistos.has(id)) id = `correo-${i + 1}-${crypto.randomUUID()}`;
      vistos.add(id);
      return { ...p, id, formato: p.formato ?? "texto" };
    }),
  };
}

/** Lo que se guarda: orden consecutivo, asunto solo en el primero (o fuera del hilo). */
export function normalizarOrden(b: Borrador): Borrador {
  return {
    ...b,
    pasos: b.pasos.map((p, i) => ({
      ...p,
      orden: i + 1,
      mismoHilo: i === 0 ? false : p.mismoHilo,
    })),
  };
}

/** Palabras del cuerpo sin contar {{firma}} ni {{baja}} (igual que el backend). */
export const palabras = (cuerpo: string) =>
  cuerpo
    .replace(/\{\{(firma|baja)\}\}/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

/** Día hábil en que sale cada correo (cada espera cuenta desde el anterior). */
export function diasDeEnvio(pasos: { esperaDiasHabiles: number }[]) {
  let total = 0;
  return pasos.map((p) => (total += p.esperaDiasHabiles));
}
export const duracion = (pasos: { esperaDiasHabiles: number }[]) =>
  pasos.reduce((n, p) => n + p.esperaDiasHabiles, 0);

/** «Correo 1 · día 0», «Correo 2 · +4 días hábiles · mismo hilo». */
export function tituloCorreo(i: number, espera: number, mismoHilo: boolean) {
  return [
    `Correo ${i + 1}`,
    i === 0
      ? `día ${espera}`
      : `+${espera} ${espera === 1 ? "día hábil" : "días hábiles"}`,
    ...(i > 0 && mismoHilo ? ["mismo hilo"] : []),
  ].join(" · ");
}

export const ventanaTexto = (v: Secuencia["ventanaEnvio"]) =>
  `${[...v.dias]
    .sort((a, b) => a - b)
    .map((d) => DIAS[d])
    .join(", ")} · ${v.desde}–${v.hasta} (hora de Bogotá)`;

/** Avisos de la revisión que corresponden a un correo («Correo 2: …»). */
export const avisosDeCorreo = (lista: string[], i: number) =>
  lista
    .filter((a) => a.startsWith(`Correo ${i + 1}:`))
    .map((a) => a.slice(`Correo ${i + 1}:`.length).trim());

/** Partes de un texto: literal o variable ({{nombre}}), para resaltarlas. */
export function partesConVariables(texto: string) {
  return texto
    .split(/(\{\{\w+\}\})/g)
    .filter(Boolean)
    .map((t) => ({ texto: t, variable: /^\{\{\w+\}\}$/.test(t) }));
}

/** Variables de datos usadas en un correo (para la tabla de respaldos). */
export function variablesUsadas(
  p: Pick<PasoBorrador, "asunto" | "cuerpo" | "cuerpoHtml">,
) {
  const texto = (p.asunto ?? "") + p.cuerpo + (p.cuerpoHtml ?? "");
  return [
    ...new Set([...texto.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])),
  ].filter((v) => VARIABLES_DATOS.includes(v));
}

/** Fecha estimada de cada correo a partir de hoy, contando solo días de la ventana. */
export function fechasEstimadas(
  pasos: { esperaDiasHabiles: number }[],
  dias: number[],
  desde = new Date(),
) {
  const permitidos = dias.length ? dias : [1, 2, 3, 4, 5];
  const siguienteHabil = (d: Date) => {
    const x = new Date(d);
    while (!permitidos.includes(x.getDay())) x.setDate(x.getDate() + 1);
    return x;
  };
  let fecha = siguienteHabil(desde);
  return pasos.map((p, i) => {
    if (i > 0)
      for (let n = 0; n < p.esperaDiasHabiles; n++) {
        fecha = new Date(fecha);
        fecha.setDate(fecha.getDate() + 1);
        fecha = siguienteHabil(fecha);
      }
    return new Date(fecha);
  });
}

export type Trozo = { tipo: "igual" | "agregado" | "quitado"; texto: string };

/** Diferencia palabra por palabra (LCS sobre palabras y espacios). */
export function diferencia(antes: string, despues: string): Trozo[] {
  const a = antes.split(/(\s+)/).filter(Boolean);
  const b = despues.split(/(\s+)/).filter(Boolean);
  const n = a.length;
  const m = b.length;
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

export const leerContenido = (x: unknown): Contenido | null => {
  const r = S.contenidoSecuenciaSchema.safeParse(x);
  return r.success ? r.data : null;
};
