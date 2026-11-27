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
export const reglaSimpleSchema = z.object({
  campo: str,
  operador: z.enum(["es", "no_es", "contiene", "mayor_que", "menor_que"]),
  valor: str,
});
/** Compatibilidad: el nombre anterior (reglas simples). */
export const reglaSchema = reglaSimpleSchema;
type ReglaZ =
  z.infer<typeof reglaSimpleSchema> | { grupo: "y" | "o"; reglas: ReglaZ[] };
/** Regla simple o grupo Y/O (anidado). La lista de primer nivel se combina con Y. */
export const reglaSegmentoSchema: z.ZodType<ReglaZ> = z.lazy(() =>
  z.union([
    reglaSimpleSchema,
    z.object({
      grupo: z.enum(["y", "o"]),
      reglas: z.array(reglaSegmentoSchema),
      raiz: z.boolean().optional(),
    }),
  ]),
);
export const segmentoSchema = z.object({
  id,
  nombre: str,
  reglas: z.array(reglaSegmentoSchema),
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
  /** Plantilla de la que se copió el contenido (solo referencia). */
  plantillaId: str.optional(),
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
  listaId: str.optional(),
  incorporarNuevos: z.boolean().optional(),
  motivoNoProgramada: str.optional(),
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
  origen: str.optional(),
  /** Copia en la base secundaria de bajas (la baja ya es efectiva sin ella). */
  sincronizacion: z
    .object({
      estado: z.enum(["pendiente", "sincronizada"]),
      intentos: num,
      ultimoError: str.optional(),
      sincronizadaEn: str.optional(),
    })
    .optional(),
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
  candidatos: num.optional(),
  noElegibles: z.record(num).optional(),
  audiencia: z
    .object({
      tipo: z.enum(["segmento", "lista"]),
      id,
      nombre: str,
      incorporarNuevos: z.boolean(),
    })
    .optional(),
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
/** Roles: el administrador gestiona todo; el usuario solo consulta el panel. */
export const rolSchema = z.enum(["administrador", "usuario"]);
export const cuentaSchema = z.object({
  id,
  correo: str,
  nombre: str,
  rol: rolSchema,
  rolEtiqueta: str,
});
/** GET /auth/session: identidad real y permisos publicados por la API. */
export const sesionSchema = z.object({
  ok: z.literal(true),
  cuenta: cuentaSchema,
  permisos: z.object({
    /** Pantallas visibles ("panel" es la raíz). */
    pantallas: z.array(str),
    capacidades: z.array(str),
  }),
});
export const estadoSolicitudSchema = z.enum([
  "pendiente",
  "aprobada",
  "rechazada",
]);
/** GET /solicitudes-acceso (solo administradores). */
export const solicitudAccesoSchema = z.object({
  id,
  correo: str,
  nombre: str.optional(),
  estado: estadoSolicitudSchema,
  creadaEn: str,
  ultimaIdentificacionEn: str,
  identificaciones: num,
  decididaEn: str.optional(),
  decididaPor: z.object({ id, nombre: str, correo: str }).optional(),
});
/** POST /solicitudes-acceso/:id/aprobar|rechazar. */
export const decisionSolicitudSchema = z.object({
  ok: z.literal(true),
  solicitud: solicitudAccesoSchema,
});
export const notificacionSchema = z.object({
  id,
  tipo: z.enum([
    "solicitud_acceso",
    "acceso_aprobado",
    "pausa_envios",
    "fallo_integracion",
    "tarea_fallida",
  ]),
  titulo: str,
  descripcion: str,
  /** Solo si el destinatario tiene permiso para esa pantalla. */
  enlace: str.optional(),
  repeticiones: num,
  creadaEn: str,
  ultimaVez: str,
  leida: z.boolean(),
  leidaEn: str.optional(),
});
/** GET /notificaciones: bandeja propia (avisos recientes y total sin leer). */
export const bandejaNotificacionesSchema = z.object({
  sinLeer: num,
  items: z.array(notificacionSchema),
});

// ------------------------------------------------------------------ envíos

/** Resultado de programar al aprobar, reanudar o «Programar envíos». */
export const programacionSchema = z.object({
  activada: z.boolean(),
  inscritos: num,
  reanudadas: num,
  elegibles: num,
  motivo: str.optional(),
});
export const aprobadaSchema = z
  .object({
    ok: z.literal(true),
    version: num.optional(),
    programacion: programacionSchema.optional(),
  })
  .passthrough();
export const estadoDestinatarioSchema = z.enum([
  "programado",
  "entregando",
  "aceptado",
  "completada",
  "conciliar",
  "fallido",
  "pausada",
  "finalizada",
  "pendiente",
]);
/** GET /secuencias/:id/envios */
export const enviosSchema = z.object({
  aprobada: z.boolean(),
  campanaId: str.optional(),
  campanaEstado: str.optional(),
  programadaEn: str.optional(),
  motivoNoProgramada: str.optional(),
  audiencia: z
    .object({
      tipo: z.enum(["segmento", "lista"]),
      id,
      nombre: str,
      incorporarNuevos: z.boolean(),
      candidatos: num,
      elegibles: num,
      noElegibles: z.record(num),
    })
    .optional(),
  gmail: z.object({ estado: str, detalle: str.optional() }).optional(),
  trabajador: z
    .object({ vivo: z.boolean(), ultimoLatido: str.optional() })
    .optional(),
  cuota: z
    .object({
      nuevosHoy: num,
      topeGlobal: num,
      campanaHoy: num,
      topeCampana: num,
    })
    .optional(),
  inscripciones: z.record(num).optional(),
  mensajes: z.record(num).optional(),
  porPaso: z
    .array(
      z.object({
        paso: num,
        programados: num,
        entregando: num,
        aceptados: num,
        fallidos: num,
        cancelados: num,
      }),
    )
    .optional(),
  proximoEnvio: str.optional(),
  diagnostico: z.array(
    z.object({
      nivel: z.enum(["info", "aviso", "error"]),
      texto: str,
      accion: str,
    }),
  ),
  destinatarios: z.array(
    z.object({
      inscripcionId: id,
      contactoId: id,
      nombre: str,
      correo: str.optional(),
      estado: estadoDestinatarioSchema,
      texto: str,
      pasoActual: num,
      proximoEnvio: str.optional(),
      enviadoEn: str.optional(),
      mensajeId: str.optional(),
      error: str.optional(),
    }),
  ),
});

// ------------------------------------------------------------------ listas

export const listaSchema = z.object({
  id,
  nombre: str,
  tipo: z.enum(["estatica", "vinculada"]),
  segmentoId: str.optional(),
  descripcion: str.optional(),
  archivada: z.boolean(),
  miembros: num,
  elegibles: num,
  retirados: num,
  creadoEn: str,
  campanas: z
    .array(z.object({ id, nombre: str, estado: str, secuenciaId: id }))
    .optional(),
});
export const miembrosListaSchema = z.object({
  total: num,
  miembros: z.array(
    z.object({
      id,
      nombre: str,
      correo: str.optional(),
      cargo: str.optional(),
      empresa: str,
      elegible: z.boolean(),
      motivo: str.optional(),
    }),
  ),
  retirados: z.array(
    z.object({
      id,
      nombre: str,
      retiradoEn: str,
      motivoRetiro: str,
    }),
  ),
});

// ------------------------------------------------------------------ plantillas

export const plantillaSchema = z.object({
  id,
  nombre: str,
  asunto: str,
  cuerpo: str,
  formato: z.enum(["texto", "html"]),
  cuerpoHtml: str.optional(),
  version: num,
  archivada: z.boolean(),
  variables: z.array(str),
  sinBaja: z.boolean(),
  actualizadoEn: str,
  /** Plantilla de la galería de NEXUS: no se modifica, se duplica. */
  predeterminada: z.boolean().optional(),
  categoria: str.optional(),
  descripcion: str.optional(),
  /** Lleva tablas o imágenes: se edita con el editor de diseño. */
  diseno: z.boolean().optional(),
});
export const imagenSchema = z.object({
  id,
  nombre: str,
  tipo: str,
  tamano: num,
  ejemplo: z.boolean(),
  creadoEn: str,
  /** Ruta relativa que se guarda en el HTML (/img/<id>). */
  ruta: str,
  /** Dirección pública absoluta. */
  url: str,
});
export const vistaPlantillaSchema = z.object({
  asunto: str,
  texto: str,
  html: str.optional(),
  respaldo: z.array(str),
  pieAgregado: z.boolean(),
  variables: z.array(str),
  admitidas: z.array(str),
});
export const plantillaParaPasoSchema = z.object({
  plantillaId: id,
  plantillaVersion: num,
  asunto: str,
  cuerpo: str,
  formato: z.enum(["texto", "html"]),
  cuerpoHtml: str.optional(),
});

// ------------------------------------------------------------------ importación

export const campoImportacionSchema = z.enum([
  "nombre",
  "correo",
  "cargo",
  "telefono",
  "empresa",
  "nit",
  "municipio",
  "sector",
  "sitioWeb",
]);
export const analisisImportacionSchema = z.object({
  columnas: z.array(str),
  filas: z.array(z.object({ fila: num, valores: z.array(str) })),
  totalFilas: num,
  filasVacias: num,
  mapeoSugerido: z.record(num),
  hojas: z.array(str),
  hoja: str.optional(),
  limites: z.object({ bytes: num, filas: num, lote: num }),
});
export const previaImportacionSchema = z.object({
  resumen: z.object({
    crear: num,
    actualizar: num,
    omitir: num,
    error: num,
  }),
  filas: z.array(
    z.object({
      fila: num,
      accion: z.enum(["crear", "actualizar", "omitir", "error"]),
      motivo: str,
      nombre: str,
      correo: str,
      empresa: str,
    }),
  ),
});
export const resultadoImportacionSchema = z.object({
  ok: z.literal(true),
  creados: num,
  actualizados: num,
  omitidos: num,
  fallidos: num,
  filas: z.array(
    z.object({
      fila: num,
      resultado: z.enum(["creado", "actualizado", "omitir", "error"]),
      motivo: str,
    }),
  ),
});
export const coincidenciaEmpresaSchema = z.object({
  id,
  razonSocial: str,
  municipio: str.optional(),
  motivo: str,
  exacta: z.boolean(),
});
export const contactoCreadoSchema = z.object({
  ok: z.literal(true),
  id,
  empresaId: id,
  empresaCreada: z.boolean(),
});
export const resumenBajasSchema = z.object({
  configurada: z.boolean(),
  pendientes: num,
  sincronizadas: num,
  ultimaSincronizacion: str.optional(),
  ultimoError: str.optional(),
  proximoIntento: str.optional(),
});

// ------------------------------------------------------------------ eliminación

export const recursoEliminableSchema = z.enum([
  "contactos",
  "segmentos",
  "listas",
  "plantillas",
  "empresas",
  "imagenes",
]);
export const previaEliminacionSchema = z.object({
  recurso: recursoEliminableSchema,
  ids: z.array(id),
  titulo: str,
  detalle: str.nullish(),
  efectos: z.array(str),
  /** Secuencias activas afectadas por la eliminación. */
  secuenciasActivas: z.array(
    z
      .object({
        id,
        nombre: str,
        estado: str.optional(),
        secuenciaId: str.nullish(),
        contactos: num.optional(),
      })
      .passthrough(),
  ),
  bloqueo: str.nullish(),
  puedeEliminar: z.boolean(),
});
