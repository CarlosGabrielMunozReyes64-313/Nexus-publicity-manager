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
export const secuenciaSchema = z.object({
  id,
  nombre: str,
  objetivo: str,
  llamadaAccion: str,
  pasos: z.array(
    z.object({
      id,
      orden: num,
      asunto: str.optional(),
      cuerpo: str,
      esperaDiasHabiles: num,
      mismoHilo: z.boolean(),
      variables: z.array(
        z.object({ nombre: str, campoFuente: str, respaldo: str }),
      ),
    }),
  ),
  metricasExito: z.array(str),
  ventanaEnvio: z.object({ dias: z.array(num), desde: str, hasta: str }),
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
    }),
  ),
  fuentes: z.array(evidenciaSchema),
  cambioSustancial: z.boolean().optional(),
  creadaEn: str,
  decision: z.object({ fecha: str, comentario: str.optional() }).optional(),
});
export const respuestaSchema = z.object({
  id,
  contactoId: id,
  campanaId: id,
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
  resultados: z.array(resultadoSchema),
  creadaEn: str,
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
export const okSchema = z.object({ ok: z.literal(true) });
