import { z } from "zod";
export const evidenciaSchema = z.object({
  campo: z.string(),
  valor: z.string().nullable(),
  fuente: z.enum(["formulario", "sitio_web", "registro", "manual", "agente"]),
  url: z.string().optional(),
  cita: z.string().optional(),
  obtenidoEn: z.string(),
  estado: z.enum(["verificado", "inferido", "pendiente"]),
});
const id = z.string(),
  str = z.string(),
  num = z.number();
export const etapaSchema = z.enum([
  "identificado",
  "contactable",
  "contactado",
  "interesado",
  "lead",
  "calificado",
  "discovery",
  "propuesta",
  "cliente",
  "postventa",
  "excluido",
  "descartado",
  "perdido",
]);
export const origenSchema = z.enum([
  "organico_busqueda",
  "organico_redes",
  "pagado",
  "correo",
  "referencia",
  "directo_desconocido",
  "manual",
  "registro",
  "descubrimiento",
]);
export const contactoSchema = z.object({
  id,
  empresaId: id,
  nombre: str.min(1),
  cargo: str.optional(),
  correo: z.string().email().optional(),
  estadoCorreo: z.enum([
    "valido",
    "riesgoso",
    "invalido",
    "desconocido",
    "catch_all",
  ]),
  telefono: str.optional(),
  etapa: etapaSchema,
  baseLegal: z.object({
    tipo: z.enum([
      "autorizacion_formulario",
      "autorizacion_registrada",
      "corporativo_generico",
      "pendiente",
    ]),
    aprobadaPorAdmin: z.boolean(),
    texto: str.optional(),
    fecha: str.optional(),
    prueba: str.optional(),
  }),
  excluido: z.boolean(),
  motivoExclusion: str.optional(),
  origen: origenSchema,
  evidencias: z.array(evidenciaSchema),
  creadoEn: str,
  actualizadoEn: str,
});
export const empresaSchema = z.object({
  id,
  razonSocial: str,
  nit: str.optional(),
  sector: str,
  tamano: z.enum(["1-10", "11-50", "51-200", "200+", "desconocido"]),
  municipio: str,
  sitioWeb: str.optional(),
  dominio: str.optional(),
  senales: z.array(
    z.object({ tipo: str, descripcion: str, url: str.optional(), fecha: str }),
  ),
  puntaje: z
    .object({
      total: num,
      incompleto: z.boolean(),
      criterios: z.array(
        z.object({
          nombre: str,
          cumple: z.boolean().nullable(),
          peso: num,
          explicacion: str,
        }),
      ),
    })
    .optional(),
  estadoCuenta: z.enum(["prospecto", "cliente"]),
  evidencias: z.array(evidenciaSchema),
});
export const reglaSchema = z.object({
  campo: str,
  operador: z.enum(["es", "no_es", "contiene", "mayor_que", "menor_que"]),
  valor: str,
});
export const segmentoSchema = z.object({
  id,
  nombre: str,
  reglas: z.array(reglaSchema),
  justificacion: str,
  tamano: num,
  version: num,
  estado: z.enum(["propuesto", "aprobado", "archivado"]),
  propuestoPor: z.enum(["admin", "agente"]),
});
export const estadosEditor = [
  "borrador",
  "cambios_sin_aprobar",
  "aprobada",
  "activa",
  "pausada",
  "finalizada",
  "archivada",
] as const;
export const pasoSchema = z.object({
  id,
  orden: num,
  asunto: str.optional(),
  /** En formato «html», `cuerpo` es la versión en texto simple. */
  cuerpo: str,
  esperaDiasHabiles: num,
  mismoHilo: z.boolean(),
  variables: z.array(
    z.object({ nombre: str, campoFuente: str, respaldo: str }),
  ),
  formato: z.enum(["texto", "html"]).optional(),
  cuerpoHtml: str.optional(),
});
export const secuenciaSchema = z.object({
  id,
  nombre: str,
  objetivo: str,
  llamadaAccion: str,
  pasos: z.array(pasoSchema),
  metricasExito: z.array(str),
  ventanaEnvio: z.object({ dias: z.array(num), desde: str, hasta: str }),
  // Campos del editor (aditivos): campaña, estado, borrador y aprobación.
  campanaId: str.optional(),
  campanaEstado: str.optional(),
  segmentoId: str.optional(),
  estadoEditor: z.enum(estadosEditor).optional(),
  versionBorrador: num.optional(),
  versionAprobada: num.optional(),
  actualizadaEn: str.optional(),
  archivada: z.boolean().optional(),
});
export const campanaSchema = z.object({
  id,
  nombre: str,
  segmentoId: id,
  secuenciaId: id,
  estado: z.enum([
    "borrador",
    "en_revision",
    "aprobada",
    "activa",
    "pausada",
    "finalizada",
    "rechazada",
  ]),
  versionAprobada: num.optional(),
  huellaAprobada: str.optional(),
  topeDiario: num,
  creadaEn: str,
  motivoPausa: str.optional(),
  metricas: z.object({
    inscritos: num,
    enviados: num,
    entregados: num,
    rebotes: num,
    bajas: num,
    clics: num,
    aperturas: num,
    respuestas: num,
    respuestasPositivas: num,
    diagnosticos: num,
    reuniones: num,
  }),
});
export const propuestaSchema = z.object({
  id,
  objetivoId: str.optional(),
  agente: z.enum([
    "investigador",
    "segmentador",
    "estratega_redactor",
    "analista",
  ]),
  tipo: z.enum([
    "enriquecimiento",
    "segmento",
    "campana",
    "mejora",
    "correo_inferido",
  ]),
  estado: z.enum(["pendiente", "aprobada", "editada", "rechazada"]),
  resumen: str,
  version: num,
  versiones: z.array(
    z.object({
      version: num,
      contenido: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.record(z.unknown()),
        z.array(z.unknown()),
        z.null(),
      ]),
      fecha: str,
      /** Quién escribió la versión: el agente o el administrador. */
      autor: z.enum(["agente", "admin"]).optional(),
      decision: z.enum(["aprobada", "rechazada"]).optional(),
      comentario: str.optional(),
      decididaEn: str.optional(),
    }),
  ),
  fuentes: z.array(evidenciaSchema),
  cambioSustancial: z.boolean().optional(),
  creadaEn: str,
  decision: z.object({ fecha: str, comentario: str.optional() }).optional(),
  /** Solo rutas de correo (tipo campana): campaña y segmento para la lista. */
  ruta: z
    .object({
      campanaNombre: str,
      campanaEstado: str,
      segmentoId: str,
      segmentoNombre: str,
    })
    .optional(),
});
export const respuestaSchema = z.object({
  id,
  contactoId: id,
  campanaId: id.optional(),
  fecha: str,
  hilo: z.array(
    z.object({ de: z.enum(["nexus", "contacto"]), fecha: str, texto: str }),
  ),
  clasificacion: z.enum([
    "interesado",
    "pide_informacion",
    "quiere_reunion",
    "objecion",
    "ahora_no",
    "no_interesado",
    "baja",
    "fuera_oficina",
    "remite_a_otra_persona",
    "necesita_revision",
  ]),
  confianza: num,
  borrador: str.optional(),
  estado: z.enum(["pendiente", "atendida"]),
});
export const oportunidadSchema = z.object({
  id,
  empresaId: id,
  etapa: z.enum(["discovery", "propuesta", "cliente", "perdido"]),
  reto: str.optional(),
  valorEstimadoCOP: num.optional(),
  creadaEn: str,
  cerradaEn: str.optional(),
});
export const resultadoSchema = z.object({
  id,
  empresa: z.object({
    razonSocial: str,
    sector: str,
    municipio: str,
    sitioWeb: str.optional(),
  }),
  contactoCorporativo: z.object({
    correo: str.optional(),
    telefono: str.optional(),
    whatsapp: str.optional(),
    formularioUrl: str.optional(),
  }),
  personas: z.array(
    z.object({
      nombre: str,
      cargo: str.optional(),
      correo: str.optional(),
      requiereBaseLegal: z.literal(true),
    }),
  ),
  evidencias: z.array(evidenciaSchema),
  posibleDuplicadoDe: str.optional(),
  estado: z.enum(["pendiente", "aceptado", "descartado"]),
});
export const busquedaSchema = z.object({
  id,
  criterios: z.object({
    consulta: str,
    municipios: z.array(str),
    sectores: z.array(str),
    tamano: str.optional(),
  }),
  estado: z.enum(["en_cola", "ejecutando", "terminada", "error"]),
  progreso: num,
  error: str.optional(),
  resultados: z.array(resultadoSchema),
  creadaEn: str,
  /** Solo en las búsquedas que lanzó la meta diaria. */
  meta: z.literal(true).optional(),
});
/** GET /descubrimiento/meta: meta diaria de contactos, filtros guardados y avance de hoy. */
export const metaDescubrimientoSchema = z.object({
  activa: z.boolean(),
  metaDiaria: num.int().min(1),
  maxBusquedas: num.int().min(1),
  tipos: z.array(str),
  municipios: z.array(str),
  sectores: z.array(str),
  tamano: z.string(),
  hoy: z.object({
    contactos: num.int().min(0),
    busquedas: num.int().min(0),
    enCurso: z.boolean(),
  }),
  combinaciones: num.int().min(0),
  creditosPorBusqueda: num.int().min(0),
  estado: str,
});
export const nivelEventoSchema = z.enum(["info", "exito", "aviso", "error"]);
/** GET /terminal: trabajador, cola y líneas nuevas de la bitácora (sin datos personales). */
export const terminalSchema = z.object({
  trabajador: z.object({ activo: z.boolean(), vistoEn: str.optional() }),
  cola: z.object({
    enProceso: num.int().min(0),
    enCola: num.int().min(0),
    esperando: num.int().min(0),
    fallidas24h: num.int().min(0),
  }),
  ahoraMismo: z.array(
    z.object({
      tareaId: id,
      descripcion: str,
      estado: z.enum(["en_proceso", "en_cola", "esperando"]),
      desde: str,
      intento: num.int().min(0),
      maxIntentos: num.int().min(1),
    }),
  ),
  eventos: z.array(
    z.object({
      id: num.int().min(1),
      fecha: str,
      nivel: nivelEventoSchema,
      mensaje: str,
    }),
  ),
});
export const supresionSchema = z.object({
  id,
  correo: str.optional(),
  dominio: str.optional(),
  motivo: str,
  fecha: str,
});
export const auditoriaSchema = z.object({
  id,
  fecha: str,
  actor: str,
  accion: str,
  entidad: str,
  entidadId: str,
  antes: z.unknown().optional(),
  despues: z.unknown().optional(),
  costoUSD: num.optional(),
});
export const integracionSchema = z.object({
  id: z.enum([
    "gmail",
    "formulario",
    "ga4",
    "search_console",
    "verificador",
    "claude",
  ]),
  nombre: str,
  estado: z.enum(["conectada", "desconectada", "error"]),
  detalle: str.optional(),
  ultimaSincronizacion: str.optional(),
});
export const inscripcionSchema = z.object({
  id,
  campanaId: id,
  contactoId: id,
  pasoActual: num,
  proximoEnvio: str.optional(),
  estado: z.enum(["activa", "pausada", "finalizada"]),
  motivoSalida: z
    .enum([
      "respondio",
      "baja",
      "rebote",
      "reunion",
      "cliente",
      "completada",
      "manual",
    ])
    .optional(),
});
export const interaccionSchema = z.object({
  id,
  contactoId: id,
  tipo: z.enum([
    "correo_enviado",
    "respuesta",
    "clic",
    "visita",
    "formulario",
    "llamada",
    "reunion",
    "nota",
  ]),
  fecha: str,
  resumen: str,
  origen: origenSchema.optional(),
});
export const marcaSchema = z.object({
  nombre: str,
  oferta: str,
  tono: str,
  firma: str,
  prohibidas: z.array(str),
  politica: str,
  baja: str,
});
export const limitesSchema = z.object({
  topeDiarioNuevos: num.int().min(1).max(500),
  separacionSegundos: z.tuple([num.min(1), num.min(1)]),
  ventana: z.object({ dias: z.array(num).min(1), desde: str, hasta: str }),
  topePorDominio: num.int().min(1),
  umbralRebotePausa: num.min(0).max(100),
});
export const metricaSchema = z.object({
  campanaId: str.optional(),
  segmentoId: str.optional(),
  leads: num.optional(),
  clientes: num.optional(),
  fecha: str,
  enviados: num,
  respuestas: num,
  visitas: num,
  fuente: origenSchema,
  costoUSD: num.nullable(),
});
export const duplicadoSchema = z.object({
  id,
  principalId: id,
  duplicadoId: id,
  motivo: str,
});
export const recomendacionSchema = z.object({
  id,
  texto: str,
  estado: z.enum(["pendiente", "aprobada", "descartada"]),
});
export const clienteIdealSchema = z.object({ criterios: z.array(str) });
export const resumenSchema = z.object({
  contactables: num,
  activas: num,
  pendientes: num,
  diagnosticos: num,
  reuniones: num,
  enviadosHoy: num,
});
export const embudoSchema = z.array(z.object({ etapa: str, conteo: num }));
export const okSchema = z.object({ ok: z.literal(true) }).passthrough();
/** GET /configuracion/cumplimiento: política de aprobación automática de la base legal. */
export const cumplimientoSchema = z.object({
  aprobacionLegalAutomatica: z.boolean(),
});
/** PUT /configuracion/cumplimiento: cuántos contactos pendientes se aprobaron al encenderla. */
export const politicaAplicadaSchema = z.object({
  ok: z.literal(true),
  aprobadas: num.int().min(0),
});
/** GET /agentes/solicitudes: pedidos recientes a los agentes que proponen. */
export const solicitudAgenteSchema = z.object({
  id,
  tipo: z.enum(["proponer_segmentos", "proponer_campana", "revisar_campana"]),
  estado: z.enum([
    "pendiente",
    "en_proceso",
    "completada",
    "fallida",
    "cancelada",
  ]),
  intentos: num,
  maxIntentos: num,
  error: str.optional(),
  creadaEn: str,
  terminadaEn: str.optional(),
  proximoIntento: str.optional(),
  segmentoId: str.optional(),
  segmento: str.optional(),
  propuestaId: str.optional(),
});
/** Resultado de POST /contactos/importar. */
export const importacionSchema = z.object({
  ok: z.literal(true),
  creados: num.int().nonnegative(),
  omitidos: num.int().nonnegative(),
  rechazados: num.int().nonnegative(),
});
/** Resultado de conectar o desconectar una integración. */
export const cambioIntegracionSchema = z.object({
  ok: z.literal(true),
  estado: z.enum(["conectada", "desconectada", "error"]),
  detalle: str,
});
/** Página del registro de auditoría filtrada en el servidor. */
export const paginaAuditoriaSchema = z.object({
  items: z.array(auditoriaSchema),
  total: num.int().nonnegative(),
  pagina: num.int().positive(),
  tamano: num.int().positive(),
});

// ---------------------------------------------------------------- Rutas de correo
/** Nota del agente por correo; `editadoPorAdmin` marca los que cambió el administrador. */
export const notaPasoSchema = z.object({
  orden: num,
  proposito: str.optional(),
  porQue: str.optional(),
  editadoPorAdmin: z.boolean().optional(),
});
export const notasAgenteSchema = z.object({
  general: str,
  pasos: z.array(notaPasoSchema),
});
/** Contenido de una versión de ruta: la secuencia completa y, si existen, las notas. */
export const rutaCorreoSchema = secuenciaSchema.extend({
  id: str.optional(),
  pasos: z.array(
    secuenciaSchema.shape.pasos.element.extend({ id: str.optional() }),
  ),
  notasAgente: notasAgenteSchema.optional(),
});
/** GET /propuestas/solicitudes: pedidos de rutas de los últimos 30 días. */
export const solicitudRutaSchema = z.object({
  id,
  tipo: z.enum(["proponer_campana", "revisar_campana"]),
  estado: z.enum(["en_cola", "trabajando", "lista", "fallida"]),
  segmentoId: str.optional(),
  segmento: str.optional(),
  propuestaId: str.optional(),
  objetivo: str.optional(),
  numeroCorreos: num.optional(),
  creadaEn: str,
  terminadaEn: str.optional(),
  error: str.optional(),
});
/** GET /propuestas/rutas-correo/segmentos: segmentos aprobados con sus elegibles. */
export const segmentoRutaSchema = z.object({
  id,
  nombre: str,
  version: num,
  elegibles: num.int().nonnegative(),
});
/** GET /propuestas/:id/revision: la lista de verificación que también usa aprobar. */
export const revisionRutaSchema = z.object({
  puedeAprobar: z.boolean(),
  bloqueos: z.array(str),
  errores: z.array(str),
  advertencias: z.array(str),
  elegibles: num,
  segmento: z.object({ id, nombre: str, estado: str, version: num }).optional(),
  ventanaValida: z.boolean().optional(),
  gmailConectado: z.boolean().optional(),
  duracionDiasHabiles: num.optional(),
  topeDiario: num.optional(),
});
/** GET /propuestas/:id/elegibles: contactos para la vista previa (máximo 50). */
export const contactoElegibleSchema = z.object({
  id,
  nombre: str,
  empresa: str,
});
/** POST /propuestas/:id/previsualizar (y /secuencias/:id/previsualizar). */
export const vistaPreviaSchema = z.object({
  pasos: z.array(pasoSchema.extend({ id: str.optional() })),
  respaldo: z.array(str),
});
/** Respuesta de PUT /propuestas/:id y POST /propuestas/:id/restaurar. */
export const versionCreadaSchema = z.object({
  ok: z.literal(true),
  version: num.optional(),
});

// ---------------------------------------------------------------- Editor de secuencias
/** Contenido de un borrador o versión: la secuencia (ids opcionales) y las notas de la IA. */
export const contenidoSecuenciaSchema = secuenciaSchema
  .pick({
    nombre: true,
    objetivo: true,
    llamadaAccion: true,
    metricasExito: true,
    ventanaEnvio: true,
  })
  .extend({
    id: str.optional(),
    pasos: z.array(pasoSchema.extend({ id: str.optional() })),
    notasAgente: notasAgenteSchema.optional(),
  });
/** GET /secuencias/:id/borrador. */
export const borradorSchema = z.object({
  version: num,
  autor: z.enum(["agente", "admin"]),
  fecha: str,
  contenido: contenidoSecuenciaSchema,
});
/** GET /secuencias/:id/versiones (el contenido se lee con contenidoSecuenciaSchema). */
export const versionSecuenciaSchema = z.object({
  version: num,
  autor: z.enum(["agente", "admin"]),
  fecha: str,
  decision: z.enum(["aprobada", "rechazada"]).optional(),
  comentario: str.optional(),
  contenido: z.unknown(),
});
/** GET /secuencias/:id/revision: la misma lógica que usa aprobar. */
export const revisionSecuenciaSchema = z.object({
  puedeAprobar: z.boolean(),
  bloqueos: z.array(str),
  errores: z.array(str),
  advertencias: z.array(str),
  elegibles: num,
  gmailConectado: z.boolean(),
  duracionDiasHabiles: num,
  hayCambiosSinAprobar: z.boolean(),
  segmento: z.object({ id, nombre: str, estado: str, version: num }).optional(),
  ventanaValida: z.boolean().optional(),
  topeDiario: num.optional(),
  campanaEstado: str.optional(),
});
/** GET /secuencias/solicitudes: pedidos a la IA de los últimos 30 días. */
export const solicitudSecuenciaSchema = z.object({
  id,
  tipo: z.enum(["proponer_campana", "revisar_campana", "reescribir_correo"]),
  estado: z.enum(["en_cola", "trabajando", "lista", "fallida"]),
  segmentoId: str.optional(),
  segmento: str.optional(),
  secuenciaId: str.optional(),
  objetivo: str.optional(),
  numeroCorreos: num.optional(),
  creadaEn: str,
  terminadaEn: str.optional(),
  error: str.optional(),
});
export const creadaSchema = z.object({ ok: z.literal(true), id });
export const guardadoSchema = z.object({
  ok: z.literal(true),
  version: num.optional(),
});
export const pruebaEnviadaSchema = z.object({
  ok: z.literal(true),
  destinatario: str,
  enviados: num,
});
/** GET /secuencias/:id/sugerencias: «Mejorar con IA» por correo. */
export const sugerenciaSchema = z.object({
  id,
  orden: num,
  instruccion: str,
  estado: z.enum(["en_cola", "trabajando", "lista", "fallida"]),
  creadaEn: str,
  asunto: str.optional(),
  cuerpo: str.optional(),
  porQue: str.optional(),
  original: z.object({ asunto: str.optional(), cuerpo: str }).optional(),
  error: str.optional(),
});
