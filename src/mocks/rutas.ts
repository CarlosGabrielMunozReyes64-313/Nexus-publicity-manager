/**
 * Rutas de correo en el modo demostración: mismas reglas que el backend
 * (app/api/rutas_correo.py), con un «agente» simulado que responde en segundos.
 */
import { z } from "zod";
import * as S from "../api/schemas";
import type * as T from "../types";
import { coincide, puedeInscribir, validarSecuencia } from "../lib/reglas";
import type { crearDatos } from "./data";

type Db = ReturnType<typeof crearDatos>;
type Ruta = z.infer<typeof S.rutaCorreoSchema>;
type Revision = z.infer<typeof S.revisionRutaSchema>;
export type SolicitudMock = z.infer<typeof S.solicitudRutaSchema> & {
  /** Momento (ms) en que el agente simulado empieza y termina. */
  trabajandoEn: number;
  listaEn: number;
  notas?: string;
};

/** Espera del agente simulado; las pruebas la ponen en 0. */
export const demoRutas = { esperaMs: 6000 };
export const OBJETIVO_POR_DEFECTO = "Que completen el diagnóstico RSE Express";
export const SIN_ELEGIBLES =
  "El segmento no tiene contactos elegibles con base legal aprobada";
export const VENTANA_GLOBAL =
  "La ventana de envío de la secuencia no coincide con el horario global (Configuración → Límites y horarios)";
const VARIABLES_DATOS = ["nombre", "empresa", "senal", "cargo", "municipio"];
const ENLACE = "https://nexus.example/rse-express";

const iso = () => new Date().toISOString();

export function elegiblesDe(db: Db, segmentoId?: string): T.Contacto[] {
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

export const leerRuta = (contenido: unknown): Ruta | null => {
  const r = S.rutaCorreoSchema.safeParse(contenido);
  return r.success ? r.data : null;
};

/** Ruta normalizada (sin ids ni notas) para comparar contenidos. */
export const huellaRuta = (r: Ruta | T.Secuencia) =>
  JSON.stringify({
    nombre: r.nombre,
    objetivo: r.objetivo,
    llamadaAccion: r.llamadaAccion,
    metricasExito: r.metricasExito,
    ventanaEnvio: r.ventanaEnvio,
    pasos: r.pasos.map((p) => [
      p.asunto ?? "",
      p.cuerpo,
      p.esperaDiasHabiles,
      p.mismoHilo,
      p.variables,
    ]),
  });

// ------------------------------------------------------------ agente simulado
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

export function rutaDelAgente(opciones: {
  objetivo: string;
  numeroCorreos: number;
  segmento: string;
  elegibles: number;
}): Ruta {
  const llamada = /llamada/i.test(opciones.objetivo);
  const plan = PLAN[opciones.numeroCorreos] ?? PLAN[3];
  return {
    nombre: `Ruta RSE Express · ${opciones.segmento}`,
    objetivo: opciones.objetivo,
    llamadaAccion: llamada
      ? "Responder para agendar 20 minutos"
      : "Completar el diagnóstico RSE Express",
    metricasExito: ["Respuestas positivas", "Diagnósticos completados"],
    ventanaEnvio: { dias: [2, 3, 4], desde: "08:00", hasta: "10:30" },
    pasos: plan.map(([tipo, espera], i) => ({
      id: `paso-${i + 1}`,
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
    })),
    notasAgente: {
      general: `«${opciones.segmento}» reúne ${opciones.elegibles} contactos elegibles de empresas que venden a compañías grandes, que cada vez piden información de sostenibilidad a sus proveedores. Una ruta corta en el mismo hilo, con una sola llamada a la acción por correo, respeta su tiempo.`,
      pasos: plan.map(([tipo], i) => ({
        orden: i + 1,
        proposito: PROPOSITO[tipo][0],
        porQue: PROPOSITO[tipo][1],
      })),
    },
  };
}

/** Versión nueva del agente a partir de la rechazada y del comentario. */
export function revisionDelAgente(base: Ruta, comentario: string): Ruta {
  const pasos = base.pasos.map((p, i) =>
    i === 0
      ? {
          ...p,
          cuerpo: CORREOS.contexto(false).replace(
            "Cada vez más empresas grandes les piden a sus proveedores información de sostenibilidad, y muchas MiPymes no tienen cómo responder con evidencia. ",
            "Las empresas grandes piden cada vez más información de sostenibilidad a sus proveedores. ",
          ),
        }
      : p,
  );
  return {
    ...base,
    pasos,
    notasAgente: {
      general: `Versión ajustada según su comentario: «${comentario}». Acorté el primer correo y mantuve el resto de la ruta.`,
      pasos: pasos.map((p, i) => ({
        orden: i + 1,
        proposito:
          base.notasAgente?.pasos.find((n) => n.orden === i + 1)?.proposito ??
          "Correo de la ruta",
        porQue:
          i === 0
            ? "Más corto y directo, como pidió el comentario."
            : (base.notasAgente?.pasos.find((n) => n.orden === i + 1)?.porQue ??
              "Se mantiene de la versión anterior."),
      })),
    },
  };
}

/** Conserva las notas del agente y marca los correos que cambió el administrador. */
export function notasEditadas(anterior: Ruta | null, nueva: Ruta) {
  if (!anterior?.notasAgente) return undefined;
  const claves = [
    "asunto",
    "cuerpo",
    "esperaDiasHabiles",
    "mismoHilo",
  ] as const;
  return {
    general: anterior.notasAgente.general,
    pasos: nueva.pasos.map((p, i) => {
      const antes = anterior.pasos[i];
      const nota = anterior.notasAgente!.pasos.find(
        (n) => n.orden === i + 1,
      ) ?? {
        orden: i + 1,
      };
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

// ------------------------------------------------------------ vista previa
export function renderMock(
  db: Db,
  pasos: {
    id?: string;
    orden: number;
    asunto?: string;
    cuerpo: string;
    variables: T.Secuencia["pasos"][number]["variables"];
  }[],
  c: T.Contacto,
) {
  const e = db.empresas.find((e) => e.id === c.empresaId);
  const values: Record<string, string | undefined> = {
    nombre: c.nombre,
    empresa: e?.razonSocial,
    senal: e?.senales[0]?.descripcion,
    cargo: c.cargo,
    municipio: e?.municipio,
  };
  const sistema: Record<string, string> = {
    firma: db.marca.firma,
    baja: db.marca.baja + "\n[Enlace de baja al enviar]",
    enlace: ENLACE,
  };
  const defaults: Record<string, string> = {
    nombre: "equipo",
    empresa: "su empresa",
    senal: "trabaja con empresas grandes de la región",
    cargo: "su equipo",
    municipio: "su región",
  };
  const respaldo: string[] = [];
  const evidencias = [...c.evidencias, ...(e?.evidencias ?? [])];
  const out = pasos.map((p) => {
    const reemplazar = (texto: string) =>
      texto.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
        if (key in sistema) return sistema[key];
        const verified = evidencias.some(
          (ev) =>
            (ev.campo === key ||
              (key === "empresa" && ev.campo === "razonSocial")) &&
            ev.estado === "verificado",
        );
        if (verified && values[key]) return values[key]!;
        if (!respaldo.includes(key)) respaldo.push(key);
        return (
          p.variables.find((v) => v.nombre === key)?.respaldo ??
          defaults[key] ??
          ""
        );
      });
    return {
      ...p,
      ...(p.asunto ? { asunto: reemplazar(p.asunto) } : {}),
      cuerpo: reemplazar(p.cuerpo),
    };
  });
  return { pasos: out, respaldo };
}

// ------------------------------------------------------------ revisión
const palabras = (cuerpo: string) =>
  cuerpo
    .replace(/\{\{(firma|baja)\}\}/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

function ventanasCompatibles(
  a: T.Secuencia["ventanaEnvio"],
  b: T.LimitesEnvio["ventana"],
) {
  return (
    a.dias.some((d) => b.dias.includes(d)) &&
    (a.desde > b.desde ? a.desde : b.desde) <
      (a.hasta < b.hasta ? a.hasta : b.hasta)
  );
}

export function advertenciasDe(r: Ruta): string[] {
  const avisos: string[] = [];
  r.pasos.forEach((p, i) => {
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
    if ((p.cuerpo.match(/\{\{enlace\}\}/g) ?? []).length > 1)
      avisos.push(
        `Correo ${i + 1}: tiene más de un {{enlace}}; use una sola llamada a la acción`,
      );
  });
  const dias = r.pasos.reduce((n, p) => n + p.esperaDiasHabiles, 0);
  if (dias > 15)
    avisos.push(
      `La ruta dura ${dias} días hábiles; se recomienda no pasar de 15`,
    );
  return avisos;
}

/** La misma lista de verificación que usa aprobar en el backend. */
export function revisionMock(db: Db, p: T.PropuestaAgente): Revision {
  const v =
    p.versiones.find((x) => x.version === p.version) ?? p.versiones.at(-1);
  const bloqueos: string[] = [];
  const errores: string[] = [];
  if (p.estado === "aprobada") bloqueos.push("Propuesta ya aprobada");
  if (v?.decision)
    bloqueos.push("Esta versión ya fue decidida; cree una versión nueva");
  if (p.tipo === "correo_inferido")
    bloqueos.push(
      "Un correo inferido requiere verificación; no se aprueba para envíos",
    );
  if (p.tipo !== "campana")
    return {
      puedeAprobar: !bloqueos.length,
      bloqueos,
      errores,
      advertencias: [],
      elegibles: 0,
    };
  const cam = db.campanas.find((c) => c.id === p.objetivoId);
  const seg = db.segmentos.find((s) => s.id === cam?.segmentoId);
  const r = leerRuta(v?.contenido);
  const advertencias: string[] = [];
  let ventanaValida = false;
  if (!r) errores.push("El contenido no es una ruta de correos válida");
  else {
    errores.push(...validarSecuencia(r as T.Secuencia, db.marca.prohibidas));
    ventanaValida = ventanasCompatibles(r.ventanaEnvio, db.limites.ventana);
    if (!ventanaValida) bloqueos.push(VENTANA_GLOBAL);
    advertencias.push(...advertenciasDe(r));
  }
  if (seg?.estado !== "aprobado")
    bloqueos.push("El segmento requiere aprobación");
  const elegibles = elegiblesDe(db, seg?.id);
  if (r && elegibles.length) {
    const usadas = new Set(
      r.pasos.flatMap((x) =>
        [...(x.cuerpo + (x.asunto ?? "")).matchAll(/\{\{(\w+)\}\}/g)].map(
          (m) => m[1],
        ),
      ),
    );
    for (const variable of VARIABLES_DATOS) {
      if (!usadas.has(variable)) continue;
      const faltan = elegibles.filter(
        (c) =>
          renderMock(
            db,
            [{ orden: 1, cuerpo: `{{${variable}}}`, variables: [] }],
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
    gmailConectado: gmail,
    duracionDiasHabiles: r
      ? r.pasos.reduce((n, x) => n + x.esperaDiasHabiles, 0)
      : 0,
    topeDiario: cam?.topeDiario ?? 20,
  };
}

/** Propuesta con los datos de la ruta para la lista (campaña y segmento). */
export function conRuta(db: Db, p: T.PropuestaAgente): T.PropuestaAgente {
  if (p.tipo !== "campana") return p;
  const cam = db.campanas.find((c) => c.id === p.objetivoId);
  const seg = db.segmentos.find((s) => s.id === cam?.segmentoId);
  if (!cam || !seg) return p;
  return {
    ...p,
    ruta: {
      campanaNombre: cam.nombre,
      campanaEstado: cam.estado,
      segmentoId: seg.id,
      segmentoNombre: seg.nombre,
    },
  };
}

// ------------------------------------------------------------ solicitudes
export function validarPedido(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;
  const segmentoId = String(b.segmentoId ?? "").trim();
  if (!segmentoId) throw Error("Elija un segmento");
  const objetivo = String(b.objetivo ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
  if (objetivo.length < 5 || objetivo.length > 200)
    throw Error("El objetivo requiere entre 5 y 200 caracteres");
  const numero = b.numeroCorreos ?? 3;
  if (
    typeof numero !== "number" ||
    !Number.isInteger(numero) ||
    numero < 2 ||
    numero > 5
  )
    throw Error("El número de correos debe ser un entero entre 2 y 5");
  const notas = String(b.notas ?? "").trim();
  if (notas.length > 500) throw Error("Las notas admiten hasta 500 caracteres");
  return { segmentoId, objetivo, numeroCorreos: numero, notas };
}

export function nuevaSolicitud(
  datos: Omit<
    SolicitudMock,
    "id" | "estado" | "creadaEn" | "trabajandoEn" | "listaEn"
  >,
): SolicitudMock {
  const ahora = Date.now();
  return {
    ...datos,
    id: crypto.randomUUID(),
    estado: "en_cola",
    creadaEn: iso(),
    trabajandoEn: ahora + demoRutas.esperaMs / 3,
    listaEn: ahora + demoRutas.esperaMs,
  };
}

export const publica = (s: SolicitudMock) => {
  const { trabajandoEn, listaEn, notas, ...resto } = s;
  void trabajandoEn;
  void listaEn;
  void notas;
  return resto;
};

/**
 * Avanza las solicitudes del agente simulado: en cola → trabajando → lista.
 * Al terminar crea, igual que el backend, la secuencia, la campaña en revisión y
 * la propuesta (o una versión nueva del agente si era una revisión).
 */
export function avanzar(db: Db, solicitudes: SolicitudMock[]) {
  const ahora = Date.now();
  for (const s of solicitudes) {
    if (s.estado === "en_cola" && ahora >= s.trabajandoEn)
      s.estado = "trabajando";
    if (s.estado !== "trabajando" || ahora < s.listaEn) continue;
    if (s.tipo === "proponer_campana") {
      const seg = db.segmentos.find((x) => x.id === s.segmentoId);
      const elegibles = elegiblesDe(db, seg?.id);
      if (!seg || seg.estado !== "aprobado" || !elegibles.length) {
        s.estado = "fallida";
        s.error =
          !seg || seg.estado !== "aprobado"
            ? "El segmento requiere aprobación"
            : SIN_ELEGIBLES;
        s.terminadaEn = iso();
        continue;
      }
      const ruta = rutaDelAgente({
        objetivo: s.objetivo ?? OBJETIVO_POR_DEFECTO,
        numeroCorreos: s.numeroCorreos ?? 3,
        segmento: seg.nombre,
        elegibles: elegibles.length,
      });
      const secuenciaId = crypto.randomUUID();
      const { notasAgente, ...secuencia } = ruta;
      db.secuencias.push({
        ...(secuencia as T.Secuencia),
        id: secuenciaId,
        pasos: secuencia.pasos.map((p) => ({ ...p, id: crypto.randomUUID() })),
      });
      const campanaId = crypto.randomUUID();
      db.campanas.push({
        id: campanaId,
        nombre: `Diagnóstico RSE Express · ${seg.nombre}`,
        segmentoId: seg.id,
        secuenciaId,
        estado: "en_revision",
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
      const propuestaId = crypto.randomUUID();
      db.propuestas.unshift({
        id: propuestaId,
        objetivoId: campanaId,
        agente: "estratega_redactor",
        tipo: "campana",
        estado: "pendiente",
        resumen: `${ruta.pasos.length} correos en el mismo hilo para invitar al diagnóstico RSE Express.`,
        version: 1,
        versiones: [
          {
            version: 1,
            contenido: { ...secuencia, id: secuenciaId, notasAgente },
            fecha: iso(),
            autor: "agente",
          },
        ],
        fuentes: [],
        creadaEn: iso(),
      });
      s.propuestaId = propuestaId;
    } else {
      const p = db.propuestas.find((x) => x.id === s.propuestaId);
      const v = p?.versiones.find((x) => x.version === p.version);
      const base = leerRuta(v?.contenido);
      if (!p || !base) {
        s.estado = "fallida";
        s.error =
          "La ruta propuesta no cumple: no se encontró la versión rechazada";
        s.terminadaEn = iso();
        continue;
      }
      p.version++;
      p.estado = "pendiente";
      p.decision = undefined;
      p.versiones.push({
        version: p.version,
        contenido: revisionDelAgente(base, v?.comentario ?? "Sin comentario"),
        fecha: iso(),
        autor: "agente",
      });
    }
    s.estado = "lista";
    s.terminadaEn = iso();
  }
}

/** Solicitud fallida de ejemplo (para ver el motivo y el botón Reintentar). */
export function solicitudesIniciales(db: Db): SolicitudMock[] {
  const seg = db.segmentos.find((s) => s.estado === "aprobado");
  const hace = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
  return [
    {
      id: "sol-fallida",
      tipo: "proponer_campana",
      estado: "fallida",
      segmentoId: seg?.id,
      segmento: seg?.nombre,
      objetivo: "Agendar una llamada de 20 minutos",
      numeroCorreos: 3,
      creadaEn: hace(20),
      terminadaEn: hace(19.9),
      error:
        "La ruta propuesta no cumple: Se pidieron 3 correos y la ruta tiene 2",
      trabajandoEn: 0,
      listaEn: 0,
    },
  ];
}
