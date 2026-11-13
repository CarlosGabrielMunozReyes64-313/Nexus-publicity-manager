export type EtapaEmbudo =
  | "identificado"
  | "contactable"
  | "contactado"
  | "interesado"
  | "lead"
  | "calificado"
  | "discovery"
  | "propuesta"
  | "cliente"
  | "postventa"
  | "excluido"
  | "descartado"
  | "perdido";

export type Origen =
  | "organico_busqueda"
  | "organico_redes"
  | "pagado"
  | "correo"
  | "referencia"
  | "directo_desconocido"
  | "manual"
  | "registro"
  | "descubrimiento";

export type EstadoEvidencia = "verificado" | "inferido" | "pendiente";

export interface Evidencia {
  campo: string;
  valor: string | null;
  fuente: "formulario" | "sitio_web" | "registro" | "manual" | "agente";
  url?: string;
  cita?: string; // texto exacto encontrado en la fuente
  obtenidoEn: string; // ISO
  estado: EstadoEvidencia;
}

export type EstadoCorreo =
  "valido" | "riesgoso" | "invalido" | "desconocido" | "catch_all";

export type TipoBaseLegal =
  | "autorizacion_formulario"
  | "autorizacion_registrada"
  | "corporativo_generico"
  | "pendiente";

export interface BaseLegal {
  tipo: TipoBaseLegal;
  aprobadaPorAdmin: boolean;
  texto?: string;
  fecha?: string;
  prueba?: string; // p. ej. ID del envío del formulario
}

export interface Senal {
  tipo: string;
  descripcion: string;
  url?: string;
  fecha: string;
}

export interface Puntaje {
  total: number; // 0 a 100
  incompleto: boolean;
  criterios: {
    nombre: string;
    cumple: boolean | null;
    peso: number;
    explicacion: string;
  }[];
}

export interface Empresa {
  id: string;
  razonSocial: string;
  nit?: string;
  sector: string;
  tamano: "1-10" | "11-50" | "51-200" | "200+" | "desconocido";
  municipio: string;
  sitioWeb?: string;
  dominio?: string;
  senales: Senal[];
  puntaje?: Puntaje;
  estadoCuenta: "prospecto" | "cliente";
  evidencias: Evidencia[];
}

export interface Contacto {
  id: string;
  empresaId: string;
  nombre: string;
  cargo?: string;
  correo?: string;
  estadoCorreo: EstadoCorreo;
  telefono?: string;
  etapa: EtapaEmbudo;
  baseLegal: BaseLegal;
  excluido: boolean;
  motivoExclusion?: string;
  origen: Origen;
  evidencias: Evidencia[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface Interaccion {
  id: string;
  contactoId: string;
  tipo:
    | "correo_enviado"
    | "respuesta"
    | "clic"
    | "visita"
    | "formulario"
    | "llamada"
    | "reunion"
    | "nota";
  fecha: string;
  resumen: string;
  origen?: Origen;
}

export interface ReglaSegmento {
  campo: string;
  operador: "es" | "no_es" | "contiene" | "mayor_que" | "menor_que";
  valor: string;
}

export interface Segmento {
  id: string;
  nombre: string;
  reglas: ReglaSegmento[];
  justificacion: string;
  tamano: number;
  version: number;
  estado: "propuesto" | "aprobado" | "archivado";
  propuestoPor: "admin" | "agente";
}

export interface VariableUsada {
  nombre: string;
  campoFuente: string;
  respaldo: string;
}

export interface Paso {
  id: string;
  orden: number;
  asunto?: string; // solo el primero; los demás van en el mismo hilo
  cuerpo: string; // texto simple con variables {{nombre}}
  esperaDiasHabiles: number;
  mismoHilo: boolean;
  variables: VariableUsada[];
}

export interface Secuencia {
  id: string;
  nombre: string;
  objetivo: string;
  llamadaAccion: string;
  pasos: Paso[];
  metricasExito: string[];
  ventanaEnvio: { dias: number[]; desde: string; hasta: string };
}

export type EstadoCampana =
  | "borrador"
  | "en_revision"
  | "aprobada"
  | "activa"
  | "pausada"
  | "finalizada"
  | "rechazada";

export interface MetricasCampana {
  inscritos: number;
  enviados: number;
  entregados: number;
  rebotes: number;
  bajas: number;
  clics: number;
  aperturas: number;
  respuestas: number;
  respuestasPositivas: number;
  diagnosticos: number;
  reuniones: number;
}

export interface Campana {
  id: string;
  nombre: string;
  segmentoId: string;
  secuenciaId: string;
  estado: EstadoCampana;
  versionAprobada?: number;
  huellaAprobada?: string;
  topeDiario: number;
  creadaEn: string;
  metricas: MetricasCampana;
}

export interface Inscripcion {
  id: string;
  campanaId: string;
  contactoId: string;
  pasoActual: number;
  proximoEnvio?: string;
  estado: "activa" | "pausada" | "finalizada";
  motivoSalida?:
    | "respondio"
    | "baja"
    | "rebote"
    | "reunion"
    | "cliente"
    | "completada"
    | "manual";
}

export type ClasificacionRespuesta =
  | "interesado"
  | "pide_informacion"
  | "quiere_reunion"
  | "objecion"
  | "ahora_no"
  | "no_interesado"
  | "baja"
  | "fuera_oficina"
  | "remite_a_otra_persona"
  | "necesita_revision";

export interface Respuesta {
  id: string;
  contactoId: string;
  campanaId: string;
  fecha: string;
  hilo: { de: "nexus" | "contacto"; fecha: string; texto: string }[];
  clasificacion: ClasificacionRespuesta;
  confianza: number; // 0 a 1
  borrador?: string;
  estado: "pendiente" | "atendida";
}

export interface Oportunidad {
  id: string;
  empresaId: string;
  etapa: "discovery" | "propuesta" | "cliente" | "perdido";
  reto?: string;
  valorEstimadoCOP?: number;
  creadaEn: string;
  cerradaEn?: string;
}

export interface PropuestaAgente {
  objetivoId?: string;
  id: string;
  agente: "investigador" | "segmentador" | "estratega_redactor" | "analista";
  tipo:
    "enriquecimiento" | "segmento" | "campana" | "mejora" | "correo_inferido";
  estado: "pendiente" | "aprobada" | "editada" | "rechazada";
  resumen: string;
  version: number;
  versiones: { version: number; contenido: unknown; fecha: string }[];
  fuentes: Evidencia[];
  cambioSustancial?: boolean;
  creadaEn: string;
  decision?: { fecha: string; comentario?: string };
}

export interface ResultadoDescubrimiento {
  id: string;
  empresa: Pick<Empresa, "razonSocial" | "sector" | "municipio" | "sitioWeb">;
  contactoCorporativo: {
    correo?: string;
    telefono?: string;
    whatsapp?: string;
    formularioUrl?: string;
  };
  personas: {
    nombre: string;
    cargo?: string;
    correo?: string;
    requiereBaseLegal: true;
  }[];
  evidencias: Evidencia[];
  posibleDuplicadoDe?: string; // id de empresa existente
  estado: "pendiente" | "aceptado" | "descartado";
}

export interface BusquedaDescubrimiento {
  id: string;
  criterios: {
    consulta: string;
    municipios: string[];
    sectores: string[];
    tamano?: string;
  };
  estado: "en_cola" | "ejecutando" | "terminada" | "error";
  progreso: number; // 0 a 100
  resultados: ResultadoDescubrimiento[];
  creadaEn: string;
}

export interface Supresion {
  id: string;
  correo?: string;
  dominio?: string;
  motivo: string;
  fecha: string;
}

export interface RegistroAuditoria {
  id: string;
  fecha: string;
  actor: string; // 'admin', 'agente:investigador', 'proceso:motor_secuencias'...
  accion: string;
  entidad: string;
  entidadId: string;
  antes?: unknown;
  despues?: unknown;
  costoUSD?: number;
}

export interface Integracion {
  id:
    | "gmail"
    | "formulario"
    | "ga4"
    | "search_console"
    | "verificador"
    | "claude";
  nombre: string;
  estado: "conectada" | "desconectada" | "error";
  detalle?: string;
  ultimaSincronizacion?: string;
}

export interface LimitesEnvio {
  topeDiarioNuevos: number;
  separacionSegundos: [number, number];
  ventana: { dias: number[]; desde: string; hasta: string };
  topePorDominio: number;
  umbralRebotePausa: number; // porcentaje
}

export interface Duplicado {
  id: string;
  principalId: string;
  duplicadoId: string;
  motivo: string;
}
export interface Marca {
  nombre: string;
  oferta: string;
  tono: string;
  firma: string;
  prohibidas: string[];
  politica: string;
  baja: string;
}
export interface MetricaDiaria {
  campanaId?: string;
  segmentoId?: string;
  leads?: number;
  clientes?: number;
  fecha: string;
  enviados: number;
  respuestas: number;
  visitas: number;
  fuente: Origen;
  costoUSD: number | null;
}
export interface Recomendacion {
  id: string;
  texto: string;
  estado: "pendiente" | "aprobada" | "descartada";
}
export interface ClienteIdeal {
  criterios: string[];
}
