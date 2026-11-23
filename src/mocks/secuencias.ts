/**
 * Secuencias de correo en el modo demostración: borrador, versiones, revisión,
 * aprobación, prueba y solicitudes a la IA, con las mismas reglas que el backend
 * (app/api/secuencias.py). El «agente» simulado responde en unos segundos.
 */
import { z } from "zod";
import * as S from "../api/schemas";
import type * as T from "../types";
import {
  coincide,
  erroresDeCorreos,
  huella as huellaAprobacion,
  puedeInscribir,
  ventanasCompatibles,
} from "../lib/reglas";
import { escaparHtml, htmlATexto, limpiarHtml } from "../lib/html";
import type { Datos } from "./data";

export type Contenido = z.infer<typeof S.contenidoSecuenciaSchema>;
type Paso = Contenido["pasos"][number];
type Solicitud = z.infer<typeof S.solicitudSecuenciaSchema>;
export type SolicitudMock = Solicitud & {
  trabajandoEn: number;
  listaEn: number;
  propuestaId?: string;
  notas?: string;
  comentario?: string;
  orden?: number;
  instruccion?: string;
  original?: { asunto?: string; cuerpo: string };
  resultado?: { asunto?: string; cuerpo: string; porQue: string };
  descartada?: boolean;
};

export class ErrorDemo extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Espera del agente simulado; las pruebas la ponen en 0. */
export const demoIA = { esperaMs: 6000 };
export const ADMIN_CORREO = "admin@nexus.example";
export const PRUEBAS_POR_DIA = 20;
export const OBJETIVO_POR_DEFECTO = "Que completen el diagnóstico RSE Express";
const ENLACE = "https://nexus.example/rse-express";
const VARIABLES_DATOS = ["nombre", "empresa", "senal", "cargo", "municipio"];
export const SIN_CAMBIOS =
  "No hay cambios para aprobar: la versión aprobada ya está vigente";
export const ARCHIVADA = "La secuencia está archivada";
export const VENTANA_GLOBAL =
  "La ventana de envío de la secuencia no coincide con el horario global (Configuración → Límites y horarios)";
const SIN_ELEGIBLES =
  "El segmento no tiene contactos elegibles: cada contacto necesita base legal aprobada y un correo verificado como válido";
const VIGENTE = ["aprobada", "activa", "pausada", "finalizada"];

const iso = (ms = 0) => new Date(Date.now() + ms).toISOString();
const uid = () => crypto.randomUUID();

// ------------------------------------------------------------ utilidades

export function elegiblesDe(db: Datos, segmentoId?: string): T.Contacto[] {
  const seg = db.segmentos.find((s) => s.id === segmentoId);
  if (!seg) return [];
  return db.contactos.filter(
    (c) =>
      puedeInscribir(c, db.supresiones) &&
      db.empresas.find((e) => e.id === c.empresaId)?.estadoCuenta !==
        "cliente" &&
      coincide(c, db.empresas, seg.reglas),
  );
}

export const leerContenido = (x: unknown): Contenido | null => {
  const r = S.contenidoSecuenciaSchema.safeParse(x);
  return r.success ? r.data : null;
};

/** Contenido comparable: sin ids ni notas (como la huella del backend). */
export const huella = (x: Contenido | T.Secuencia) =>
  JSON.stringify({
    nombre: x.nombre,
    objetivo: x.objetivo,
    llamadaAccion: x.llamadaAccion,
    metricasExito: x.metricasExito,
    ventanaEnvio: x.ventanaEnvio,
    pasos: x.pasos.map((p) => [
      p.asunto ?? "",
      p.cuerpo,
      p.esperaDiasHabiles,
      p.mismoHilo,
      p.variables,
      p.formato ?? "texto",
      p.formato === "html" ? (p.cuerpoHtml ?? "") : "",
    ]),
  });

const vivo = (s: T.Secuencia): Contenido => ({
  nombre: s.nombre,
  objetivo: s.objetivo,
  llamadaAccion: s.llamadaAccion,
  metricasExito: [...s.metricasExito],
  ventanaEnvio: structuredClone(s.ventanaEnvio),
  pasos: structuredClone(s.pasos),
});

/** HTML limpio y texto derivado en los correos con formato. */
export function preparar(c: Contenido): Contenido {
  return {
    ...c,
    pasos: c.pasos.map((p) => {
      if (p.formato !== "html") {
        const { cuerpoHtml, ...resto } = p;
        void cuerpoHtml;
        return { ...resto, formato: "texto" as const };
      }
      const html = limpiarHtml(p.cuerpoHtml ?? "");
      return { ...p, cuerpoHtml: html, cuerpo: htmlATexto(html) };
    }),
  };
}

/** Conserva las notas de la IA y marca los correos que cambió el administrador. */
export function notasEditadas(anterior: Contenido | null, nueva: Contenido) {
  if (!anterior?.notasAgente) return undefined;
  const claves = [
    "asunto",
    "cuerpo",
    "esperaDiasHabiles",
    "mismoHilo",
    "formato",
    "cuerpoHtml",
  ] as const;
  return {
    general: anterior.notasAgente.general,
    pasos: nueva.pasos.map((p, i) => {
      const antes = anterior.pasos[i];
      const nota = anterior.notasAgente!.pasos.find(
        (n) => n.orden === i + 1,
      ) ?? { orden: i + 1 };
      const cambio =
        !antes ||
        claves.some((k) => (p[k] ?? "") !== (antes[k] ?? "")) ||
        JSON.stringify(p.variables) !== JSON.stringify(antes.variables);
      return cambio
        ? { ...nota, orden: i + 1, editadoPorAdmin: true }
        : { ...nota, orden: i + 1 };
    }),
  };
}

export function campanaDe(db: Datos, seqId: string) {
  return db.campanas.find((c) => c.secuenciaId === seqId);
}

function propuestaDe(db: Datos, cam: T.Campana, seq: T.Secuencia) {
  let p = db.propuestas.find(
    (x) => x.tipo === "campana" && x.objetivoId === cam.id,
  );
  if (!p) {
    p = {
      id: uid(),
      objetivoId: cam.id,
      agente: "estratega_redactor",
      tipo: "campana",
      estado: "pendiente",
      resumen: `Secuencia de la campaña ${cam.nombre}`,
      version: 1,
      versiones: [
        { version: 1, contenido: vivo(seq), fecha: iso(), autor: "admin" },
      ],
      fuentes: [],
      creadaEn: iso(),
    };
    db.propuestas.unshift(p);
  }
  return p;
}

export function asegurar(db: Datos, seqId: string) {
  const seq = db.secuencias.find((s) => s.id === seqId);
  if (!seq) throw new ErrorDemo("Registro no encontrado", 404);
  const cam = campanaDe(db, seqId);
  if (!cam) throw new ErrorDemo("La secuencia no tiene campaña asociada", 409);
  return { seq, cam, p: propuestaDe(db, cam, seq) };
}

const ultima = (p: T.PropuestaAgente) =>
  p.versiones.find((v) => v.version === p.version) ?? p.versiones.at(-1)!;

export function borrador(db: Datos, seqId: string) {
  const { seq, p } = asegurar(db, seqId);
  const v = ultima(p);
  const c = leerContenido(v.contenido) ?? vivo(seq);
  return {
    version: v.version,
    autor: v.autor ?? "admin",
    fecha: v.fecha,
    contenido: { ...c, id: seqId },
  };
}

const aprobacionVigente = (cam: T.Campana) =>
  VIGENTE.includes(cam.estado) && cam.versionAprobada !== undefined;
const fueAprobada = (p: T.PropuestaAgente) =>
  p.versiones.some((v) => v.decision === "aprobada");

function hayCambios(
  db: Datos,
  seq: T.Secuencia,
  cam: T.Campana,
  p: T.PropuestaAgente,
) {
  if (!aprobacionVigente(cam)) return true;
  const b = leerContenido(ultima(p).contenido);
  return !b || huella(b) !== huella(seq);
}

export function estadoEditor(db: Datos, seq: T.Secuencia): T.EstadoEditor {
  if (db.archivadas[seq.id]) return "archivada";
  const cam = campanaDe(db, seq.id);
  if (!cam) return "borrador";
  const p = propuestaDe(db, cam, seq);
  if (!fueAprobada(p)) return "borrador";
  if (hayCambios(db, seq, cam, p)) return "cambios_sin_aprobar";
  return VIGENTE.includes(cam.estado)
    ? (cam.estado as T.EstadoEditor)
    : "cambios_sin_aprobar";
}

export function conExtras(db: Datos, seq: T.Secuencia): T.Secuencia {
  const cam = campanaDe(db, seq.id);
  const extra: Partial<T.Secuencia> = {
    archivada: Boolean(db.archivadas[seq.id]),
    estadoEditor: estadoEditor(db, seq),
  };
  let actualizada = db.actualizadas[seq.id] ?? iso(-86400000 * 3);
  if (cam) {
    const p = propuestaDe(db, cam, seq);
    const aprobada = [...p.versiones]
      .reverse()
      .find((v) => v.decision === "aprobada");
    Object.assign(extra, {
      campanaId: cam.id,
      campanaEstado: cam.estado,
      segmentoId: cam.segmentoId,
      versionBorrador: p.version,
      ...(aprobada ? { versionAprobada: aprobada.version } : {}),
    });
    const fecha = ultima(p).fecha;
    if (fecha > actualizada) actualizada = fecha;
  }
  return { ...structuredClone(seq), ...extra, actualizadaEn: actualizada };
}

export function lista(db: Datos, archivadas: boolean) {
  return db.secuencias
    .filter((s) => archivadas || !db.archivadas[s.id])
    .map((s) => conExtras(db, s))
    .sort((a, b) =>
      (b.actualizadaEn ?? "").localeCompare(a.actualizadaEn ?? ""),
    );
}

// ------------------------------------------------------------ borrador y versiones

export function leerForma(valor: unknown): Contenido {
  const r = S.contenidoSecuenciaSchema.safeParse(valor);
  if (!r.success) {
    const campo = r.error.issues[0]?.path.join(".") ?? "";
    throw new ErrorDemo(
      `La secuencia no tiene el formato esperado${campo ? ` (${campo})` : ""}`,
    );
  }
  const { notasAgente, id, ...resto } = r.data;
  void notasAgente;
  void id;
  return preparar(resto);
}

export function guardarBorrador(db: Datos, seqId: string, valor: unknown) {
  const { p } = asegurar(db, seqId);
  if (db.archivadas[seqId]) throw new ErrorDemo(ARCHIVADA, 409);
  const s = leerForma(valor);
  const actual = ultima(p);
  const anterior = leerContenido(actual.contenido);
  if (anterior && huella(anterior) === huella(s) && !actual.decision)
    return { ok: true as const, version: actual.version };
  const notas = notasEditadas(anterior, s);
  versionar(p, notas ? { ...s, notasAgente: notas } : s, "admin");
  db.actualizadas[seqId] = iso();
  return { ok: true as const, version: p.version };
}

function versionar(
  p: T.PropuestaAgente,
  contenido: unknown,
  autor: "agente" | "admin",
) {
  p.version++;
  p.estado = "pendiente";
  p.decision = undefined;
  p.versiones.push({
    version: p.version,
    contenido: structuredClone(contenido),
    fecha: iso(),
    autor,
  });
}

export function versiones(db: Datos, seqId: string) {
  const { p } = asegurar(db, seqId);
  return p.versiones.map((v) => ({
    version: v.version,
    autor: v.autor ?? "admin",
    fecha: v.fecha,
    ...(v.decision ? { decision: v.decision } : {}),
    ...(v.comentario ? { comentario: v.comentario } : {}),
    contenido: v.contenido,
  }));
}

export function restaurar(db: Datos, seqId: string, numero: number) {
  const { p } = asegurar(db, seqId);
  if (numero === p.version)
    throw new ErrorDemo("Esa ya es la versión del borrador");
  const v = p.versiones.find((x) => x.version === numero);
  if (!v) throw new ErrorDemo("Versión no encontrada", 404);
  versionar(p, v.contenido, "admin");
  db.actualizadas[seqId] = iso();
  return { ok: true as const, version: p.version };
}

// ------------------------------------------------------------ vista previa

/** Enlace visible; sin URL real (vista previa, prueba) solo el texto. Igual que el motor. */
const enlaceVisible = (url: string) => {
  const u = escaparHtml(url);
  return /^https?:\/\//.test(url) ? `<a href="${u}">${u}</a>` : u;
};

/** Variables dentro del HTML, como app/motor/plantillas.py: valores siempre escapados. */
function htmlConValores(
  html: string,
  valor: (k: string) => string,
  textoBaja: string,
  bajaUrl: string,
) {
  return html
    .replaceAll('href="{{enlace}}"', `href="${escaparHtml(ENLACE)}"`)
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
      if (k === "enlace") return enlaceVisible(ENLACE);
      if (k === "baja")
        return (
          escaparHtml(textoBaja).replace(/\n/g, "<br>") +
          "<br>" +
          enlaceVisible(bajaUrl)
        );
      return escaparHtml(valor(k)).replace(/\n/g, "<br>");
    });
}

export function renderMock(
  db: Datos,
  pasos: (Paso | T.Paso)[],
  c: T.Contacto,
  baja = "[Enlace de baja al enviar]",
) {
  const e = db.empresas.find((e) => e.id === c.empresaId);
  const valores: Record<string, string | undefined> = {
    nombre: c.nombre,
    empresa: e?.razonSocial,
    senal: e?.senales[0]?.descripcion,
    cargo: c.cargo,
    municipio: e?.municipio,
  };
  const sistema: Record<string, string> = {
    firma: db.marca.firma,
    baja: db.marca.baja + "\n" + baja,
    enlace: ENLACE,
  };
  const defectos: Record<string, string> = {
    nombre: "equipo",
    empresa: "su empresa",
    senal: "trabaja con empresas grandes de la región",
    cargo: "su equipo",
    municipio: "su región",
  };
  const respaldo: string[] = [];
  const evidencias = [...c.evidencias, ...(e?.evidencias ?? [])];
  const salida = pasos.map((p, i) => {
    const valor = (key: string) => {
      if (key in sistema) return sistema[key];
      const verificado = evidencias.some(
        (ev) =>
          (ev.campo === key ||
            (key === "empresa" && ev.campo === "razonSocial")) &&
          ev.estado === "verificado",
      );
      if (verificado && valores[key]) return valores[key]!;
      if (!respaldo.includes(key)) respaldo.push(key);
      return (
        p.variables.find((v) => v.nombre === key)?.respaldo ??
        defectos[key] ??
        ""
      );
    };
    const texto = (t: string) =>
      t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => valor(k));
    return {
      ...p,
      id: p.id ?? `paso-${i + 1}`,
      ...(p.asunto ? { asunto: texto(p.asunto) } : {}),
      cuerpo: texto(p.cuerpo),
      ...(p.formato === "html" && p.cuerpoHtml
        ? {
            cuerpoHtml: htmlConValores(
              p.cuerpoHtml,
              valor,
              db.marca.baja,
              baja,
            ),
          }
        : {}),
    };
  });
  return { pasos: salida, respaldo };
}

function contenidoPara(db: Datos, seqId: string, body: unknown) {
  const b = (body ?? {}) as { secuencia?: unknown };
  return b.secuencia != null
    ? leerForma(b.secuencia)
    : borrador(db, seqId).contenido;
}

export function previsualizar(db: Datos, seqId: string, body: unknown) {
  const b = (body ?? {}) as { contactoId?: string };
  const s = contenidoPara(db, seqId, body);
  const c = db.contactos.find((x) => x.id === b.contactoId);
  if (!c) throw new ErrorDemo("Elija un contacto");
  return renderMock(db, s.pasos, c);
}

// ------------------------------------------------------------ revisión

const palabras = (cuerpo: string) =>
  cuerpo
    .replace(/\{\{(firma|baja)\}\}/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

export function advertenciasDe(s: Contenido): string[] {
  const avisos: string[] = [];
  s.pasos.forEach((p, i) => {
    const n = palabras(p.cuerpo);
    if (n > 120)
      avisos.push(
        `Correo ${i + 1}: ${n} palabras; se recomienda no pasar de 120`,
      );
    const asunto = p.asunto ?? "";
    if (asunto.length > 60)
      avisos.push(
        `Correo ${i + 1}: asunto de ${asunto.length} caracteres; se recomienda menos de 60`,
      );
    if (
      /[A-ZÁÉÍÓÚÑ]{6,}/.test(asunto) ||
      /\b[A-ZÁÉÍÓÚÑ]{2,}\s+[A-ZÁÉÍÓÚÑ]{2,}\b/.test(asunto)
    )
      avisos.push(`Correo ${i + 1}: el asunto usa mayúsculas sostenidas`);
    if (/[!?¡¿]{2,}/.test(asunto))
      avisos.push(`Correo ${i + 1}: el asunto repite signos de puntuación`);
    const enlaces = (
      p.formato === "html" ? (p.cuerpoHtml ?? "") : p.cuerpo
    ).match(/\{\{enlace\}\}/g)?.length;
    if ((enlaces ?? 0) > 1)
      avisos.push(
        `Correo ${i + 1}: tiene más de un {{enlace}}; use una sola llamada a la acción`,
      );
  });
  const dias = s.pasos.reduce((n, p) => n + p.esperaDiasHabiles, 0);
  if (dias > 15)
    avisos.push(
      `La ruta dura ${dias} días hábiles; se recomienda no pasar de 15`,
    );
  return avisos;
}

export function revision(db: Datos, seqId: string) {
  const { seq, cam, p } = asegurar(db, seqId);
  const s = borrador(db, seqId).contenido;
  const seg = db.segmentos.find((x) => x.id === cam.segmentoId);
  const bloqueos: string[] = [];
  const errores = erroresDeCorreos(
    {
      ...s,
      id: seqId,
      pasos: s.pasos.map((x, i) => ({ ...x, id: x.id ?? `p${i}` })),
    },
    db.marca.prohibidas,
  );
  const advertencias = advertenciasDe(s);
  if (seg?.estado !== "aprobado")
    bloqueos.push("El segmento requiere aprobación");
  const ventanaValida =
    s.ventanaEnvio.dias.length > 0 &&
    s.ventanaEnvio.desde < s.ventanaEnvio.hasta &&
    ventanasCompatibles(s.ventanaEnvio, db.limites.ventana);
  if (
    s.ventanaEnvio.dias.length &&
    s.ventanaEnvio.desde < s.ventanaEnvio.hasta &&
    !ventanaValida
  )
    bloqueos.push(VENTANA_GLOBAL);
  if (db.archivadas[seqId]) bloqueos.push(ARCHIVADA);
  const cambios = hayCambios(db, seq, cam, p);
  if (!cambios) bloqueos.push(SIN_CAMBIOS);
  const elegibles = elegiblesDe(db, seg?.id);
  if (elegibles.length) {
    const usadas = new Set(
      s.pasos.flatMap((x) =>
        [
          ...(x.cuerpo + (x.asunto ?? "") + (x.cuerpoHtml ?? "")).matchAll(
            /\{\{(\w+)\}\}/g,
          ),
        ].map((m) => m[1]),
      ),
    );
    for (const variable of VARIABLES_DATOS) {
      if (!usadas.has(variable)) continue;
      const faltan = elegibles.filter(
        (c) =>
          renderMock(
            db,
            [
              {
                orden: 1,
                cuerpo: `{{${variable}}}`,
                variables: [],
                esperaDiasHabiles: 0,
                mismoHilo: false,
              },
            ],
            c,
          ).respaldo.length > 0,
      ).length;
      if (faltan)
        advertencias.push(
          `{{${variable}}}: ${faltan} de ${elegibles.length} contactos usarán el texto de respaldo`,
        );
    }
  }
  const gmail =
    db.integraciones.find((i) => i.id === "gmail")?.estado === "conectada";
  if (!gmail)
    advertencias.push(
      "Gmail no está conectado: podrá aprobar, pero no activar la campaña",
    );
  return {
    puedeAprobar: !bloqueos.length && !errores.length,
    bloqueos,
    errores,
    advertencias,
    elegibles: elegibles.length,
    gmailConectado: gmail,
    duracionDiasHabiles: s.pasos.reduce((n, x) => n + x.esperaDiasHabiles, 0),
    hayCambiosSinAprobar: cambios,
    ...(seg
      ? {
          segmento: {
            id: seg.id,
            nombre: seg.nombre,
            estado: seg.estado,
            version: seg.version,
          },
        }
      : {}),
    ventanaValida,
    topeDiario: cam.topeDiario,
    campanaEstado: cam.estado,
  };
}

// ------------------------------------------------------------ aprobación

export function aprobar(db: Datos, seqId: string) {
  const { seq, cam, p } = asegurar(db, seqId);
  const rev = revision(db, seqId);
  if (!rev.puedeAprobar)
    throw new ErrorDemo([...rev.bloqueos, ...rev.errores].join(". "));
  // Una versión ya decidida no se vuelve a decidir: se aprueba una copia.
  if (ultima(p).decision) versionar(p, ultima(p).contenido, "admin");
  const v = ultima(p);
  const contenido = leerContenido(v.contenido)!;
  Object.assign(seq, {
    nombre: contenido.nombre,
    objetivo: contenido.objetivo,
    llamadaAccion: contenido.llamadaAccion,
    metricasExito: contenido.metricasExito,
    ventanaEnvio: contenido.ventanaEnvio,
    pasos: contenido.pasos.map((x, i) => ({
      ...x,
      id: x.id && x.id !== "nuevo" ? x.id : `${seq.id}-p${i + 1}`,
    })),
  });
  Object.assign(v, { decision: "aprobada", decididaEn: iso() });
  p.estado = "aprobada";
  p.decision = { fecha: iso() };
  // Igual que los disparadores: lo programado se cancela y las inscripciones se pausan.
  db.inscripciones
    .filter((i) => i.campanaId === cam.id && i.estado === "activa")
    .forEach((i) => {
      i.estado = "pausada";
      i.proximoEnvio = undefined;
    });
  const seg = db.segmentos.find((x) => x.id === cam.segmentoId)!;
  cam.estado = "aprobada";
  cam.versionAprobada = v.version;
  cam.huellaAprobada = huellaAprobacion(seq, seg);
  db.actualizadas[seqId] = iso();
  return { ok: true as const, version: v.version };
}

// ------------------------------------------------------------ prueba

export function prueba(db: Datos, seqId: string, body: unknown) {
  const b = (body ?? {}) as {
    contactoId?: string;
    orden?: number;
    secuencia?: unknown;
  };
  if (db.integraciones.find((i) => i.id === "gmail")?.estado !== "conectada")
    throw new ErrorDemo("Conecte Gmail en Configuración para enviar pruebas");
  const s = contenidoPara(db, seqId, body);
  const c = db.contactos.find((x) => x.id === b.contactoId);
  if (!c) throw new ErrorDemo("Elija un contacto");
  let pasos = renderMock(db, s.pasos, c, "#").pasos;
  if (b.orden != null) {
    pasos = pasos.filter((x) => x.orden === b.orden);
    if (!pasos.length)
      throw new ErrorDemo("Correo no encontrado en la secuencia", 404);
  }
  const hoy = new Date().toISOString().slice(0, 10);
  const usadas = db.pruebas.filter((x) => x.fecha.slice(0, 10) === hoy).length;
  if (usadas + pasos.length > PRUEBAS_POR_DIA)
    throw new ErrorDemo(
      `Límite de ${PRUEBAS_POR_DIA} correos de prueba por día (quedan ${Math.max(0, PRUEBAS_POR_DIA - usadas)})`,
      429,
    );
  const primero = pasos.find((x) => x.asunto)?.asunto ?? "";
  for (const x of pasos)
    db.pruebas.push({
      fecha: iso(),
      destinatario: ADMIN_CORREO,
      asunto: "[Prueba] " + (x.asunto ?? "Re: " + primero),
    });
  return {
    ok: true as const,
    destinatario: ADMIN_CORREO,
    enviados: pasos.length,
  };
}

// ------------------------------------------------------------ crear, duplicar, archivar

function crear(
  db: Datos,
  s: Contenido,
  segmentoId: string,
  nombreCampana: string,
) {
  const seqId = uid();
  db.secuencias.push({
    id: seqId,
    nombre: s.nombre,
    objetivo: s.objetivo,
    llamadaAccion: s.llamadaAccion,
    metricasExito: [...s.metricasExito],
    ventanaEnvio: structuredClone(s.ventanaEnvio),
    pasos: s.pasos.map((p, i) => ({ ...p, id: `${seqId}-p${i + 1}` })),
  });
  const camId = uid();
  db.campanas.push({
    id: camId,
    nombre: nombreCampana,
    segmentoId,
    secuenciaId: seqId,
    estado: "borrador",
    topeDiario: 20,
    creadaEn: iso(),
    metricas: {
      inscritos: 0,
      enviados: 0,
      entregados: 0,
      rebotes: 0,
      bajas: 0,
      clics: 0,
      aperturas: 0,
      respuestas: 0,
      respuestasPositivas: 0,
      diagnosticos: 0,
      reuniones: 0,
    },
  });
  db.propuestas.unshift({
    id: uid(),
    objetivoId: camId,
    agente: "estratega_redactor",
    tipo: "campana",
    estado: "pendiente",
    resumen: "Secuencia creada por el administrador",
    version: 1,
    versiones: [
      {
        version: 1,
        contenido: { ...s, id: seqId },
        fecha: iso(),
        autor: "admin",
      },
    ],
    fuentes: [],
    creadaEn: iso(),
  });
  db.actualizadas[seqId] = iso();
  return seqId;
}

export function nueva(db: Datos, body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const limpio = (k: string) =>
    String(b[k] ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .join(" ");
  const nombre = limpio("nombre");
  const objetivo = limpio("objetivo");
  const llamada = limpio("llamadaAccion");
  if (nombre.length < 3 || nombre.length > 120)
    throw new ErrorDemo("El nombre requiere entre 3 y 120 caracteres");
  if (objetivo.length < 5 || objetivo.length > 200)
    throw new ErrorDemo("El objetivo requiere entre 5 y 200 caracteres");
  if (llamada.length < 3 || llamada.length > 200)
    throw new ErrorDemo(
      "La llamada a la acción requiere entre 3 y 200 caracteres",
    );
  const seg = db.segmentos.find((s) => s.id === b.segmentoId);
  if (!seg) throw new ErrorDemo("Elija un segmento");
  if (seg.estado !== "aprobado")
    throw new ErrorDemo("El segmento requiere aprobación", 409);
  const sugerida = { dias: [2, 3, 4], desde: "08:00", hasta: "10:30" };
  const ventana = ventanasCompatibles(sugerida, db.limites.ventana)
    ? sugerida
    : structuredClone(db.limites.ventana);
  const id = crear(
    db,
    {
      nombre,
      objetivo,
      llamadaAccion: llamada,
      metricasExito: ["Respuestas positivas", "Diagnósticos completados"],
      ventanaEnvio: ventana,
      pasos: [
        {
          orden: 1,
          asunto: "Una pregunta para {{empresa}}",
          cuerpo: `Buenos días, {{nombre}}:\n\nEscriba aquí su mensaje. ${llamada}: {{enlace}}\n\n{{firma}}\n{{baja}}`,
          esperaDiasHabiles: 0,
          mismoHilo: false,
          variables: [
            { nombre: "nombre", campoFuente: "nombre", respaldo: "equipo" },
            {
              nombre: "empresa",
              campoFuente: "razonSocial",
              respaldo: "su empresa",
            },
          ],
          formato: "texto",
        },
      ],
    },
    seg.id,
    nombre,
  );
  return { ok: true as const, id };
}

export function duplicar(db: Datos, seqId: string) {
  const { cam } = asegurar(db, seqId);
  const b = borrador(db, seqId).contenido;
  const { notasAgente, id, ...s } = b;
  void notasAgente;
  void id;
  const nuevoId = crear(
    db,
    {
      ...s,
      nombre: ("Copia de " + s.nombre).slice(0, 200),
      pasos: s.pasos.map(({ id: pid, ...p }) => {
        void pid;
        return p;
      }),
    },
    cam.segmentoId,
    ("Copia de " + cam.nombre).slice(0, 200),
  );
  return { ok: true as const, id: nuevoId };
}

export function archivar(db: Datos, seqId: string) {
  asegurar(db, seqId);
  const cam = campanaDe(db, seqId);
  if (cam?.estado === "activa")
    throw new ErrorDemo("Pause la campaña antes de archivar la secuencia", 409);
  db.archivadas[seqId] = iso();
  return { ok: true as const };
}

// ------------------------------------------------------------ IA (agente simulado)

const VARIABLES = [
  { nombre: "nombre", campoFuente: "nombre", respaldo: "equipo" },
  { nombre: "empresa", campoFuente: "razonSocial", respaldo: "su empresa" },
  {
    nombre: "senal",
    campoFuente: "senal",
    respaldo: "trabaja con empresas grandes de la región",
  },
];
const CORREOS = {
  contexto: (llamada: boolean) =>
    "Buenos días, {{nombre}}:\n\nCada vez más empresas grandes les piden a sus proveedores información de sostenibilidad, y muchas MiPymes no tienen cómo responder con evidencia. Vimos que {{empresa}} {{senal}}.\n\n" +
    (llamada
      ? "En NEXUS acompañamos a empresas como la suya a ordenar esa información. ¿Le sirve una llamada de 20 minutos esta semana? Responda este correo y la agendamos.\n\n"
      : "En NEXUS creamos el RSE Express, un diagnóstico gratuito que muestra el punto de partida de su empresa y por dónde empezar: {{enlace}}\n\n") +
    "{{firma}}\n{{baja}}",
  valor:
    "Hola, {{nombre}}:\n\nLe comparto algo útil aunque no haga el diagnóstico: los cuestionarios de proveedores suelen preguntar por manejo de residuos, condiciones laborales y de seguridad, y relación con la comunidad. Tener evidencia sencilla de cada tema ya es un avance.\n\nSi quiere ver cómo está {{empresa}} en esos temas, el RSE Express es gratuito: {{enlace}}\n\n{{firma}}\n{{baja}}",
  recordatorio:
    "Hola, {{nombre}}:\n\nUn recordatorio breve: el diagnóstico RSE Express sigue disponible y toma pocos minutos. Puede hacerlo cuando le quede bien: {{enlace}}\n\n{{firma}}\n{{baja}}",
  cierre:
    "Hola, {{nombre}}:\n\nEste es mi último mensaje sobre el tema. Si en algún momento le sirve, responda este correo y conversamos 20 minutos.\n\nGracias por su tiempo.\n\n{{firma}}\n{{baja}}",
};
const PLAN: Record<number, [keyof typeof CORREOS, number][]> = {
  2: [
    ["contexto", 0],
    ["cierre", 5],
  ],
  3: [
    ["contexto", 0],
    ["valor", 4],
    ["cierre", 5],
  ],
  4: [
    ["contexto", 0],
    ["valor", 3],
    ["recordatorio", 3],
    ["cierre", 4],
  ],
  5: [
    ["contexto", 0],
    ["valor", 3],
    ["recordatorio", 3],
    ["valor", 3],
    ["cierre", 4],
  ],
};
const PROPOSITO: Record<keyof typeof CORREOS, [string, string]> = {
  contexto: [
    "Presentar el problema y el diagnóstico gratuito",
    "Abre con la exigencia de las empresas grandes, que este segmento ya vive, y ofrece un paso concreto sin compromiso.",
  ],
  valor: [
    "Aportar valor aunque no hagan el diagnóstico",
    "Nombra los temas de los cuestionarios de proveedores para que el correo sea útil por sí mismo.",
  ],
  recordatorio: [
    "Recordar la invitación sin presión",
    "Un mensaje corto mantiene el hilo vivo sin repetir el argumento.",
  ],
  cierre: [
    "Cerrar con cortesía y dejar la puerta abierta",
    "Avisar que es el último mensaje respeta el tiempo del contacto y suele generar respuestas.",
  ],
};

export function secuenciaDeLaIA(o: {
  objetivo: string;
  numeroCorreos: number;
  segmento: string;
  elegibles: number;
}): Contenido {
  const llamada = /llamada/i.test(o.objetivo);
  const plan = PLAN[o.numeroCorreos] ?? PLAN[3];
  return {
    nombre: `RSE Express · ${o.segmento}`,
    objetivo: o.objetivo,
    llamadaAccion: llamada
      ? "Responder para agendar 20 minutos"
      : "Completar el diagnóstico RSE Express",
    metricasExito: ["Respuestas positivas", "Diagnósticos completados"],
    ventanaEnvio: { dias: [2, 3, 4], desde: "08:00", hasta: "10:30" },
    pasos: plan.map(([tipo, espera], i) => ({
      orden: i + 1,
      ...(i === 0
        ? {
            asunto: "Los cuestionarios de proveedores que llegan a {{empresa}}",
          }
        : {}),
      cuerpo: tipo === "contexto" ? CORREOS.contexto(llamada) : CORREOS[tipo],
      esperaDiasHabiles: espera,
      mismoHilo: i > 0,
      variables: VARIABLES,
      formato: "texto" as const,
    })),
    notasAgente: {
      general: `«${o.segmento}» reúne ${o.elegibles} contactos elegibles de empresas que venden a compañías grandes, que cada vez piden información de sostenibilidad a sus proveedores. Una secuencia corta en el mismo hilo, con una sola llamada a la acción por correo, respeta su tiempo.`,
      pasos: plan.map(([tipo], i) => ({
        orden: i + 1,
        proposito: PROPOSITO[tipo][0],
        porQue: PROPOSITO[tipo][1],
      })),
    },
  };
}

function versionDeLaIA(base: Contenido, comentario: string): Contenido {
  const pasos = base.pasos.map((p, i) =>
    i === 0
      ? {
          ...p,
          formato: "texto" as const,
          cuerpoHtml: undefined,
          cuerpo:
            "Buenos días, {{nombre}}:\n\nLas empresas grandes piden cada vez más información de sostenibilidad a sus proveedores. Vimos que {{empresa}} {{senal}}.\n\nEl RSE Express es un diagnóstico gratuito que le muestra por dónde empezar: {{enlace}}\n\n{{firma}}\n{{baja}}",
        }
      : p,
  );
  return {
    ...base,
    pasos,
    notasAgente: {
      general: `Versión ajustada según su comentario: «${comentario}». Acorté el primer correo y mantuve el resto.`,
      pasos: pasos.map((p, i) => ({
        orden: i + 1,
        proposito:
          base.notasAgente?.pasos.find((n) => n.orden === i + 1)?.proposito ??
          "Correo de la secuencia",
        porQue:
          i === 0
            ? "Más corto y directo, como pidió el comentario."
            : (base.notasAgente?.pasos.find((n) => n.orden === i + 1)?.porQue ??
              "Se mantiene de la versión anterior."),
      })),
    },
  };
}

function reescribir(
  original: { asunto?: string; cuerpo: string },
  instruccion: string,
) {
  const parrafos = original.cuerpo
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);
  const esPie = (x: string) =>
    x.includes("{{firma}}") || x.includes("{{baja}}");
  const pie = parrafos.filter(esPie).join("\n\n") || "{{firma}}\n{{baja}}";
  const [saludo = "Hola, {{nombre}}:", ...resto] = parrafos.filter(
    (x) => !esPie(x),
  );
  const conEnlace = resto.find((x) => x.includes("{{enlace}}"));
  const otros = resto.filter((x) => x !== conEnlace);
  const unir = (partes: (string | undefined)[]) =>
    partes.filter(Boolean).join("\n\n");
  let cuerpo: string;
  let porQue: string;
  if (/cort|breve|resum/i.test(instruccion)) {
    const frase = otros[0]?.split(/(?<=\.)\s+/)[0];
    cuerpo = unir([
      saludo,
      frase,
      conEnlace ? "Le comparto el diagnóstico gratuito: {{enlace}}" : undefined,
      pie,
    ]);
    porQue =
      "Dejé una sola frase de contexto y el enlace, para que se lea en pocos segundos.";
  } else if (/direct/i.test(instruccion)) {
    cuerpo = unir([saludo, conEnlace, ...otros, pie]);
    porQue =
      "Puse el enlace del diagnóstico al principio y el contexto después.";
  } else if (/formal/i.test(instruccion)) {
    cuerpo = unir([
      saludo.replace(/^Hola/, "Buenos días"),
      ...otros,
      conEnlace,
      "Quedo atento a sus comentarios.",
      pie,
    ]);
    porQue =
      "Usé un saludo y un cierre más formales, sin cambiar el contenido.";
  } else {
    cuerpo = unir([
      saludo.replace(/^Buenos días/, "Hola"),
      ...otros,
      conEnlace,
      "Si le sirve, con gusto le explico cómo funciona.",
      pie,
    ]);
    porQue = `Ajusté el tono según la instrucción: «${instruccion}».`;
  }
  return {
    ...(original.asunto ? { asunto: original.asunto } : {}),
    cuerpo,
    porQue,
  };
}

function nuevaSolicitud(
  datos: Omit<
    SolicitudMock,
    "id" | "estado" | "creadaEn" | "trabajandoEn" | "listaEn"
  >,
): SolicitudMock {
  const ahora = Date.now();
  return {
    ...datos,
    id: uid(),
    estado: "en_cola",
    creadaEn: iso(),
    trabajandoEn: ahora + demoIA.esperaMs / 3,
    listaEn: ahora + demoIA.esperaMs,
  };
}

export const publica = (s: SolicitudMock): Solicitud => ({
  id: s.id,
  tipo: s.tipo,
  estado: s.estado,
  ...(s.segmentoId ? { segmentoId: s.segmentoId } : {}),
  ...(s.segmento ? { segmento: s.segmento } : {}),
  ...(s.secuenciaId ? { secuenciaId: s.secuenciaId } : {}),
  ...(s.objetivo ? { objetivo: s.objetivo } : {}),
  ...(s.numeroCorreos ? { numeroCorreos: s.numeroCorreos } : {}),
  creadaEn: s.creadaEn,
  ...(s.terminadaEn ? { terminadaEn: s.terminadaEn } : {}),
  ...(s.error ? { error: s.error } : {}),
});

export function validarPedido(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const segmentoId = String(b.segmentoId ?? "").trim();
  if (!segmentoId) throw new ErrorDemo("Elija un segmento");
  const objetivo = String(b.objetivo ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
  if (objetivo.length < 5 || objetivo.length > 200)
    throw new ErrorDemo("El objetivo requiere entre 5 y 200 caracteres");
  const numero = b.numeroCorreos ?? 3;
  if (
    typeof numero !== "number" ||
    !Number.isInteger(numero) ||
    numero < 2 ||
    numero > 5
  )
    throw new ErrorDemo("El número de correos debe ser un entero entre 2 y 5");
  const notas = String(b.notas ?? "").trim();
  if (notas.length > 500)
    throw new ErrorDemo("Las notas admiten hasta 500 caracteres");
  return { segmentoId, objetivo, numeroCorreos: numero, notas };
}

const activa = (s: SolicitudMock) =>
  s.estado === "en_cola" || s.estado === "trabajando";

export function pedirIA(
  db: Datos,
  solicitudes: SolicitudMock[],
  body: unknown,
) {
  const d = validarPedido(body);
  const seg = db.segmentos.find((s) => s.id === d.segmentoId);
  if (!seg) throw new ErrorDemo("Registro no encontrado", 404);
  if (seg.estado !== "aprobado")
    throw new ErrorDemo("El segmento requiere aprobación", 409);
  if (!elegiblesDe(db, seg.id).length) throw new ErrorDemo(SIN_ELEGIBLES, 409);
  if (
    solicitudes.some(
      (s) =>
        s.tipo === "proponer_campana" && s.segmentoId === seg.id && activa(s),
    )
  )
    throw new ErrorDemo(
      "Ya hay una secuencia en preparación para este segmento",
      409,
    );
  const s = nuevaSolicitud({
    tipo: "proponer_campana",
    segmentoId: seg.id,
    segmento: seg.nombre,
    objetivo: d.objetivo,
    numeroCorreos: d.numeroCorreos,
    ...(d.notas ? { notas: d.notas } : {}),
  });
  solicitudes.unshift(s);
  return { ok: true as const, tareaId: s.id };
}

export function reintentar(
  db: Datos,
  solicitudes: SolicitudMock[],
  id: string,
) {
  const s = solicitudes.find((x) => x.id === id);
  if (!s) throw new ErrorDemo("Solicitud no encontrada", 404);
  if (s.estado !== "fallida")
    throw new ErrorDemo("Solo se puede reintentar una solicitud fallida", 409);
  if (s.tipo === "proponer_campana")
    return pedirIA(db, solicitudes, {
      segmentoId: s.segmentoId,
      objetivo: s.objetivo ?? OBJETIVO_POR_DEFECTO,
      numeroCorreos: s.numeroCorreos ?? 3,
      notas: s.notas,
    });
  solicitudes.unshift(
    nuevaSolicitud({
      tipo: s.tipo,
      segmentoId: s.segmentoId,
      segmento: s.segmento,
      secuenciaId: s.secuenciaId,
      propuestaId: s.propuestaId,
      comentario: s.comentario,
      orden: s.orden,
      instruccion: s.instruccion,
      original: s.original,
    }),
  );
  return { ok: true as const };
}

export function otraVersion(
  db: Datos,
  solicitudes: SolicitudMock[],
  seqId: string,
  body: unknown,
) {
  const comentario = String(
    (body as { comentario?: string })?.comentario ?? "",
  ).trim();
  if (comentario.length < 3)
    throw new ErrorDemo("El comentario requiere al menos 3 caracteres");
  const { cam, p } = asegurar(db, seqId);
  if (
    solicitudes.some(
      (s) =>
        s.tipo === "revisar_campana" && s.secuenciaId === seqId && activa(s),
    )
  )
    throw new ErrorDemo(
      "La IA ya está escribiendo una versión nueva de esta secuencia",
      409,
    );
  const v = ultima(p);
  if (!v.decision) {
    Object.assign(v, { decision: "rechazada", comentario, decididaEn: iso() });
    p.estado = "rechazada";
  }
  const seg = db.segmentos.find((x) => x.id === cam.segmentoId);
  solicitudes.unshift(
    nuevaSolicitud({
      tipo: "revisar_campana",
      secuenciaId: seqId,
      propuestaId: p.id,
      segmentoId: seg?.id,
      segmento: seg?.nombre,
      comentario,
    }),
  );
  return { ok: true as const };
}

export function mejorar(
  db: Datos,
  solicitudes: SolicitudMock[],
  seqId: string,
  orden: number,
  body: unknown,
) {
  const b = (body ?? {}) as { instruccion?: string; secuencia?: unknown };
  const instruccion = String(b.instruccion ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
  if (instruccion.length < 3 || instruccion.length > 300)
    throw new ErrorDemo("La instrucción requiere entre 3 y 300 caracteres");
  const { cam } = asegurar(db, seqId);
  if (db.archivadas[seqId]) throw new ErrorDemo(ARCHIVADA, 409);
  const s = contenidoPara(db, seqId, body);
  const paso = s.pasos.find((x) => x.orden === orden);
  if (!paso) throw new ErrorDemo("Correo no encontrado en la secuencia", 404);
  if (
    solicitudes.some(
      (x) =>
        x.tipo === "reescribir_correo" &&
        x.secuenciaId === seqId &&
        x.orden === orden &&
        activa(x),
    )
  )
    throw new ErrorDemo("La IA ya está mejorando este correo", 409);
  const llevaAsunto = orden === 1 || !paso.mismoHilo;
  solicitudes.unshift(
    nuevaSolicitud({
      tipo: "reescribir_correo",
      secuenciaId: seqId,
      segmentoId: cam.segmentoId,
      orden,
      instruccion,
      original: {
        ...(llevaAsunto && paso.asunto ? { asunto: paso.asunto } : {}),
        cuerpo: paso.cuerpo,
      },
    }),
  );
  return { ok: true as const };
}

export function sugerencias(solicitudes: SolicitudMock[], seqId: string) {
  return solicitudes
    .filter(
      (s) =>
        s.tipo === "reescribir_correo" &&
        s.secuenciaId === seqId &&
        !s.descartada,
    )
    .map((s) => ({
      id: s.id,
      orden: s.orden ?? 1,
      instruccion: s.instruccion ?? "",
      estado: s.estado,
      creadaEn: s.creadaEn,
      ...(s.resultado ?? {}),
      ...(s.original ? { original: s.original } : {}),
      ...(s.error ? { error: s.error } : {}),
    }));
}

export function descartarSugerencia(
  solicitudes: SolicitudMock[],
  seqId: string,
  id: string,
) {
  const s = solicitudes.find(
    (x) =>
      x.id === id && x.tipo === "reescribir_correo" && x.secuenciaId === seqId,
  );
  if (!s) throw new ErrorDemo("Sugerencia no encontrada", 404);
  s.descartada = true;
  return { ok: true as const };
}

/** Avanza el agente simulado: en cola → trabajando → lista (o fallida). */
export function avanzar(db: Datos, solicitudes: SolicitudMock[]) {
  const ahora = Date.now();
  for (const s of solicitudes) {
    if (s.estado === "en_cola" && ahora >= s.trabajandoEn)
      s.estado = "trabajando";
    if (s.estado !== "trabajando" || ahora < s.listaEn) continue;
    const fallar = (error: string) => {
      s.estado = "fallida";
      s.error = error;
      s.terminadaEn = iso();
    };
    if (s.tipo === "proponer_campana") {
      const seg = db.segmentos.find((x) => x.id === s.segmentoId);
      const elegibles = elegiblesDe(db, seg?.id);
      if (!seg || seg.estado !== "aprobado") {
        fallar("El segmento requiere aprobación");
        continue;
      }
      if (!elegibles.length) {
        fallar(SIN_ELEGIBLES);
        continue;
      }
      const c = secuenciaDeLaIA({
        objetivo: s.objetivo ?? OBJETIVO_POR_DEFECTO,
        numeroCorreos: s.numeroCorreos ?? 3,
        segmento: seg.nombre,
        elegibles: elegibles.length,
      });
      const { notasAgente, ...sec } = c;
      const seqId = crear(
        db,
        sec,
        seg.id,
        `Diagnóstico RSE Express · ${seg.nombre}`,
      );
      const cam = campanaDe(db, seqId)!;
      cam.estado = "en_revision";
      const p = db.propuestas.find(
        (x) => x.tipo === "campana" && x.objetivoId === cam.id,
      )!;
      p.resumen = `${c.pasos.length} correos en el mismo hilo para invitar al diagnóstico RSE Express.`;
      p.versiones[0] = {
        ...p.versiones[0],
        contenido: { ...sec, id: seqId, notasAgente },
        autor: "agente",
      };
      s.secuenciaId = seqId;
      s.propuestaId = p.id;
    } else if (s.tipo === "revisar_campana") {
      const p = db.propuestas.find((x) => x.id === s.propuestaId);
      const base = p ? leerContenido(ultima(p).contenido) : null;
      if (!p || !base) {
        fallar(
          "La secuencia propuesta no cumple: no se encontró la versión anterior",
        );
        continue;
      }
      versionar(
        p,
        versionDeLaIA(base, s.comentario ?? ultima(p).comentario ?? ""),
        "agente",
      );
      if (s.secuenciaId) db.actualizadas[s.secuenciaId] = iso();
    } else if (s.original) {
      s.resultado = reescribir(s.original, s.instruccion ?? "");
    }
    s.estado = "lista";
    s.terminadaEn = iso();
  }
}

/** Una solicitud en curso y una fallida de ejemplo. */
export function solicitudesIniciales(db: Datos): SolicitudMock[] {
  const aprobados = db.segmentos.filter((s) => s.estado === "aprobado");
  const hace = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  const valle = aprobados[0];
  const otro = aprobados[1] ?? aprobados[0];
  return [
    {
      id: "sol-en-curso",
      tipo: "proponer_campana",
      estado: "trabajando",
      segmentoId: otro?.id,
      segmento: otro?.nombre,
      objetivo: "Agendar una llamada de 20 minutos",
      numeroCorreos: 3,
      creadaEn: hace(0.05),
      // El agente simulado tarda: la solicitud sigue «trabajando» un buen rato.
      trabajandoEn: 0,
      listaEn: Date.now() + 10 * 60000,
    },
    {
      id: "sol-fallida",
      tipo: "proponer_campana",
      estado: "fallida",
      segmentoId: valle?.id,
      segmento: valle?.nombre,
      objetivo: "Que completen el diagnóstico RSE Express",
      numeroCorreos: 3,
      creadaEn: hace(20),
      terminadaEn: hace(19.9),
      error:
        "La secuencia propuesta no cumple: Se pidieron 3 correos y la secuencia tiene 2",
      trabajandoEn: 0,
      listaEn: 0,
    },
  ];
}

/**
 * La marca o el segmento cambiaron y la campaña perdió su aprobación: si la última
 * versión ya estaba decidida se crea una copia para aprobarla de nuevo. Nunca se tapa
 * un borrador más nuevo.
 */
export function trasRevocar(db: Datos, cam: T.Campana) {
  const seq = db.secuencias.find((s) => s.id === cam.secuenciaId);
  if (!seq) return;
  const p = propuestaDe(db, cam, seq);
  if (ultima(p).decision) versionar(p, ultima(p).contenido, "admin");
}

export { SIN_ELEGIBLES };
