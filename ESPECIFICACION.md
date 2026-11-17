# Prompt · Frontend de Nexus-publicity-manager (Vite + React + TypeScript)

## 1. Tu rol

Actúa como un desarrollador frontend senior experto en React, TypeScript y diseño de interfaces para herramientas internas B2B. Vas a construir el frontend completo de **Nexus-publicity-manager**, siguiendo esta especificación al pie de la letra. Si algo no está definido, elige la opción más simple y déjalo anotado en un archivo `DECISIONES.md`.

## 2. Contexto del negocio

- **Empresa:** NEXUS Innovación, consultora de sostenibilidad, RSE y desarrollo territorial con sede en Candelaria, Valle del Cauca (Colombia).
- **Cliente ideal:** MiPymes de 11 a 200 empleados en Palmira, Candelaria y el resto del Valle del Cauca, idealmente proveedoras de empresas grandes que empiezan a pedirles información sobre prácticas laborales, ambientales y éticas. Personaje de referencia: Andrés Felipe Cárdenas, gerente de Empaques Samán S.A.S. (ficticio).
- **Oferta:** el diagnóstico gratuito **RSE Express** es la puerta de entrada; **RSE por Retos** es la primera oferta de pago.
- **Proceso comercial:** etapas de marketing (búsqueda de leads, captación inbound y outbound, base de datos maestra, secuencia de correos, llamada, agendamiento) y etapas comerciales (discovery, propuesta, contrato).

## 3. Qué es la aplicación

Una aplicación web interna de **un solo usuario**: el administrador de publicidad y correos. Centraliza los contactos B2B, deja que agentes de IA investiguen y propongan campañas, y solo envía por Gmail lo que el administrador aprueba. Mide cada paso en un embudo comercial.

Tres principios que la interfaz debe hacer visibles en todo momento:

1. **Humano en el circuito.** Los agentes solo proponen. Nada se envía, aprueba ni cambia de forma importante sin una acción explícita del administrador.
2. **Cada dato con procedencia.** Todo dato de una empresa o contacto muestra su fuente, fecha y estado (verificado, inferido o pendiente).
3. **Cumplimiento.** Solo se pueden inscribir en secuencias automáticas los contactos con base legal aprobada (Ley 1581 de 2012 de Colombia). Las bajas se respetan de inmediato.

Roles que nunca se mezclan:

- **Administrador:** único usuario de la app.
- **Contacto prospectado:** persona de una empresa objetivo; no accede a la app.
- **Cliente:** empresa con contrato firmado; sus personas siguen siendo contactos vinculados a una cuenta cliente.

## 4. Alcance de este trabajo

**Incluye:** todo el frontend, con una capa de API tipada y **datos simulados** (mocks) para que la app funcione completa sin backend.

**No incluye:** el backend (será Python + FastAPI más adelante), envíos reales de correo, conexión real a Gmail, Google Analytics, Search Console ni a la API de Claude, ni scraping desde el navegador.

El cambio de mocks a API real debe hacerse solo cambiando una variable de entorno.

## 5. Stack y librerías

Usa las mismas versiones mayores del sitio web actual de NEXUS: **Vite 7, React 18, React Router 7 y TypeScript 5**. Mantén las dependencias al mínimo:

| Necesidad                  | Librería                          | Motivo                                                                        |
| -------------------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Rutas                      | react-router-dom                  | Ya se usa en el sitio de NEXUS.                                               |
| Datos del servidor y caché | @tanstack/react-query             | Estados de carga, error y reintento sin código repetido.                      |
| Formularios y validación   | react-hook-form + zod             | Validación tipada; los esquemas zod también validan las respuestas de la API. |
| Tablas                     | @tanstack/react-table             | Filtros, orden y paginación sin imponer estilos.                              |
| Gráficos                   | chart.js + react-chartjs-2        | Chart.js ya se usa en el sitio.                                               |
| Arrastrar y soltar         | @dnd-kit/core y @dnd-kit/sortable | Kanban del embudo y orden de pasos.                                           |
| Íconos                     | lucide-react                      | Ligero y consistente.                                                         |
| Mocks                      | msw                               | Simula la API real a nivel de red.                                            |
| Pruebas                    | vitest + @testing-library/react   | Integrado con Vite.                                                           |
| Calidad                    | ESLint + Prettier                 | Estilo uniforme.                                                              |

Estilos con **CSS Modules + variables CSS**, sin Tailwind ni librerías de componentes pesadas (MUI, Ant Design). Construye un pequeño sistema de componentes propio.

Variables de entorno:

```
VITE_API_URL=http://localhost:8000/api
VITE_USE_MOCKS=true
```

## 6. Identidad visual

Usa la paleta y tipografía del sitio de NEXUS en `src/styles/tokens.css`:

```css
:root {
  --nx-dark: #024029; /* verde oscuro: barra lateral, títulos */
  --nx-teal: #025873; /* azul petróleo: acciones secundarias */
  --nx-mid: #04a97a; /* verde medio: acción principal */
  --nx-bright: #35a644; /* verde vivo: éxito */
  --nx-light: #e8f5ef; /* fondo suave */
  --nx-white: #ffffff;
  --nx-gray: #f4f7f5; /* fondo de página */
  --nx-text: #1a2e24;
  --nx-muted: #5a7068;
  --font: "Montserrat", "Helvetica Neue", Arial, sans-serif;
}
```

Añade colores de estado (advertencia ámbar, error rojo, información azul) con contraste AA. Estética limpia y profesional, densidad media (es una herramienta de trabajo diario), esquinas de 8 px, sin sombras pesadas ni degradados.

Código de color del embudo, como en el diagrama original de NEXUS: etapas de **marketing** (identificado → calificado) en un tono y etapas **comerciales** (discovery → post-venta) en otro.

Toda la interfaz en **español de Colombia**: fechas `dd/mm/aaaa`, hora de América/Bogotá, moneda COP con `Intl.NumberFormat('es-CO')`.

## 7. Estructura del proyecto

```
src/
  app/            # router, layout, proveedores (QueryClient, auth), rutas protegidas
  api/            # cliente HTTP, endpoints por módulo, esquemas zod
  mocks/          # handlers de MSW, datos ficticios, estado en memoria
  types/          # tipos del dominio
  components/ui/  # Button, Badge, EvidenceChip, Table, Modal, Drawer, Tabs, Toast,
                  # ConfirmDialog, EmptyState, Skeleton, KpiTile, FunnelChart, DiffView
  features/       # una carpeta por módulo: contactos, empresas, descubrimiento,
                  # segmentos, propuestas, secuencias, campanas, respuestas,
                  # embudo, informes, configuracion, auditoria, panel
  lib/            # formateo es-CO, utilidades, reglas de negocio puras
  styles/         # tokens.css, global.css
```

Las reglas de negocio (por ejemplo, «¿se puede inscribir este contacto?») van como funciones puras en `src/lib/reglas.ts`, con pruebas.

## 8. Modelo de datos

Crea estos tipos en `src/types/` (ajusta detalles si lo necesitas, sin perder campos):

```ts
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
```

## 9. Capa de API y datos simulados

- Cliente HTTP propio basado en `fetch` en `src/api/client.ts`, con base `VITE_API_URL`, manejo de errores tipado y validación de respuestas con zod.
- Un archivo por módulo con hooks de React Query (`useContactos`, `useAprobarPropuesta`...).
- Con `VITE_USE_MOCKS=true`, MSW intercepta las llamadas. El estado simulado vive en memoria (y se puede reiniciar desde un botón oculto en Configuración). Simula una latencia de 300 a 800 ms.
- Las mutaciones simuladas deben **cambiar el estado** de forma coherente (aprobar una propuesta de campaña la vuelve «aprobada», pausar una campaña la pausa, aceptar un resultado de descubrimiento crea la empresa) y registrar cada acción en la auditoría.

Contrato REST (base `/api`):

```
GET    /panel/resumen
GET    /empresas            POST /empresas          GET|PATCH /empresas/:id
GET    /contactos           POST /contactos         GET|PATCH /contactos/:id
POST   /contactos/importar  POST /contactos/:id/excluir
POST   /contactos/:id/base-legal/aprobar
GET    /contactos/:id/interacciones
GET    /duplicados          POST /duplicados/:id/resolver
GET    /descubrimiento/busquedas        POST /descubrimiento/busquedas
GET    /descubrimiento/busquedas/:id
POST   /descubrimiento/resultados/:id/aceptar
POST   /descubrimiento/resultados/:id/descartar
GET    /segmentos           POST /segmentos         POST /segmentos/:id/aprobar
POST   /segmentos/previsualizar          (reglas → conteo y muestra)
GET    /propuestas?estado=&agente=&tipo=
GET    /propuestas/:id      PUT /propuestas/:id     (guardar edición = nueva versión)
POST   /propuestas/:id/aprobar           POST /propuestas/:id/rechazar
GET    /secuencias/:id      PUT /secuencias/:id
POST   /secuencias/:id/previsualizar     (body: contactoId)
GET    /campanas            GET /campanas/:id       GET /campanas/:id/inscripciones
POST   /campanas/:id/pausar|reanudar|detener
GET    /respuestas?estado=  GET /respuestas/:id
POST   /respuestas/:id/enviar-respuesta  POST /respuestas/:id/atender
PATCH  /respuestas/:id      (cambiar clasificación)
GET    /embudo?desde=&hasta=&campana=&segmento=&fuente=
GET    /oportunidades       POST /oportunidades     PATCH /oportunidades/:id
GET    /informes/metricas?agrupacion=campana|segmento|fuente|periodo&desde=&hasta=
GET    /informes/recomendaciones
GET    /auditoria?actor=&accion=&entidad=&desde=&hasta=
GET|PUT /configuracion/marca   GET|PUT /configuracion/limites
GET|PUT /configuracion/cliente-ideal
GET    /integraciones       POST /integraciones/:id/conectar|desconectar
GET    /supresiones         POST /supresiones
```

## 10. Navegación y estructura general

- **Inicio de sesión** (`/login`): botón «Iniciar sesión con Google». En modo mock entra directo. Más adelante el backend hará el OAuth; el frontend solo redirige y lee la sesión.
- **Barra lateral** agrupada:
  - Inicio: Panel general
  - Captación: Contactos, Empresas, Descubrimiento, Segmentos
  - Campañas: Propuestas (con contador de pendientes), Secuencias, Campañas activas
  - Seguimiento: Respuestas (con contador sin atender), Embudo, Informes
  - Sistema: Configuración, Registro de acciones
- **Barra superior:** búsqueda global (contactos y empresas), indicador del cupo de envío del día («12 de 20»), estado de Gmail (punto verde, ámbar o rojo) y menú del administrador.
- Carga diferida por ruta, migas de pan, títulos de página claros y estados de **cargando** (skeletons), **vacío** (con acción sugerida) y **error** (con reintentar) en todas las pantallas.

## 11. Pantallas

### 11.1 Panel general (`/`)

- Tarjetas: contactos contactables, campañas activas, respuestas sin atender, diagnósticos del mes, reuniones del mes.
- «Tareas de hoy»: propuestas pendientes, respuestas sin atender, duplicados por revisar y alertas (rebotes altos, Gmail desconectado, campaña pausada automáticamente).
- Mini embudo con conteos y actividad reciente de los agentes.

### 11.2 Contactos (`/contactos`, `/contactos/:id`)

- Tabla con búsqueda, filtros (etapa, municipio, sector, base legal, estado del correo, fuente, excluido) y acciones masivas (añadir a segmento, excluir).
- Si un contacto no tiene base legal aprobada, la acción de inscribir en campañas aparece deshabilitada con el motivo en un tooltip.
- Asistente de **importación CSV**: subir, mapear columnas, previsualizar, detectar duplicados y obligar a elegir el origen y la base legal antes de importar.
- Ficha del contacto: cada dato con un **EvidenceChip** (verde verificado, ámbar inferido, gris pendiente) que al pasar el cursor o enfocarlo muestra fuente, URL, cita y fecha; tarjeta de base legal con botón «Aprobar base»; línea de tiempo de interacciones; campañas en las que está; botón excluir con motivo.

### 11.3 Empresas (`/empresas`, `/empresas/:id`)

- Tabla con razón social, sector, municipio, tamaño, puntaje y estado de cuenta.
- Ficha: datos con evidencias, señales comerciales, puntaje con desglose por criterio (y aviso si está incompleto), contactos, oportunidades e historial.
- Pestaña **Duplicados**: comparación lado a lado y fusión campo por campo. Nada se fusiona sin confirmación.

### 11.4 Descubrimiento (`/descubrimiento`)

Es el modo en que el agente Investigador busca empresas en la web.

- Formulario de criterios: consulta (p. ej. «fabricantes de empaques en Palmira»), municipios, sectores y tamaño.
- Lista de búsquedas con estado y barra de progreso.
- Resultados: empresa, sitio web, contacto corporativo (correo genérico, teléfono, WhatsApp, formulario), evidencias y aviso de posible duplicado.
- Las personas encontradas se muestran con la etiqueta **«Requiere base legal»** y no pueden pasar a campañas desde aquí.
- Acciones: aceptar (crea la empresa y su contacto corporativo) o descartar.
- Aviso fijo: «Solo se consultan sitios web públicos de empresas y registros abiertos. No se consultan redes sociales».

### 11.5 Segmentos (`/segmentos`, `/segmentos/:id`)

- Constructor de reglas (campo, operador, valor) con conteo y muestra en vivo.
- Segmentos propuestos por el agente con su justificación; acciones aprobar, editar o archivar.

### 11.6 Propuestas pendientes (`/propuestas`, `/propuestas/:id`)

- Bandeja filtrable por agente, tipo y estado.
- Detalle en dos columnas: a la izquierda la propuesta; a la derecha sus fuentes y evidencias.
- Una propuesta de campaña muestra su ficha completa: objetivo, destinatarios, justificación del segmento, asunto y contenido de cada correo, personalización (qué dato verificado usa cada variable), intervalos, llamada a la acción, condiciones y métricas de éxito.
- Comparación entre versiones con un **DiffView**.
- Acciones:
  - **Aprobar:** abre una confirmación con el número de destinatarios, el tope diario y la fecha estimada del primer envío.
  - **Editar:** abre el editor; guardar crea una nueva versión que vuelve a revisión.
  - **Rechazar:** exige un comentario.

### 11.7 Editor de secuencias (`/secuencias/:id/editar`)

- Lista de pasos reordenable (arrastrar y soltar). En cada paso: asunto (solo el primero), cuerpo en texto simple con inserción de variables como chips (`{{nombre}}`, `{{empresa}}`, `{{senal}}`), días hábiles de espera y opción de mismo hilo.
- Panel de vista previa con un selector de contacto real: muestra las variables resueltas y resalta cuando se usa el texto de respaldo porque el dato no está verificado.
- Validaciones visibles: enlace de baja presente, firma, longitud y palabras prohibidas.
- Condiciones del sistema en solo lectura: una respuesta pausa, una baja suprime, un rebote duro suprime, una reunión saca de la secuencia, un cliente saca a toda su empresa.
- Ventana de envío (días y horas).
- Al editar una campaña ya aprobada, mostrar el aviso: «Este cambio devuelve la campaña a revisión y pausa los envíos pendientes».

### 11.8 Campañas activas (`/campanas`, `/campanas/:id`)

- Lista con estado, avance por paso y próximos envíos.
- Botones pausar, reanudar y detener, siempre con confirmación.
- Detalle: métricas, inscripciones con su estado y motivo de salida, y calendario de envíos programados.

### 11.9 Respuestas y oportunidades (`/respuestas`)

- Bandeja con la clasificación como chip, la confianza y un extracto.
- Detalle: hilo completo, ficha resumida del contacto, borrador sugerido editable.
- Acciones: **Enviar respuesta** (con confirmación explícita), marcar atendida, cambiar clasificación, crear oportunidad y registrar reunión.
- Si la confianza es baja: aviso «Revisar: contacto en pausa».
- Las bajas aparecen como ya procesadas: no necesitan acción.

### 11.10 Embudo comercial (`/embudo`)

- Embudo proporcional real (el ancho de cada etapa según su conteo) con el porcentaje que pasa de una etapa a la siguiente, coloreado por marketing y comercial.
- Filtros por periodo, campaña, segmento y fuente.
- Kanban de oportunidades (discovery, propuesta, cliente, perdido). Mover a Cliente o Perdido pide confirmación.
- Alertas de estancamiento (días en la etapa).

### 11.11 Informes (`/informes`)

- Pestañas: Correo, Sitio web, Embudo y Costos.
- Gráficos de línea para la evolución en el tiempo y de barras para comparar; tabla agrupable por campaña, segmento, fuente o periodo.
- Visitas por canal: orgánico de búsqueda, orgánico de redes, pagado, correo, referencias y **Desconocido**.
- La tasa de apertura lleva un ícono de información: «Poco fiable: Apple Mail y Gmail alteran las aperturas».
- Costo por lead y de adquisición solo si hay costos registrados; si no, mostrar «Faltan datos de costos» con un botón para registrarlos.
- Tarjetas de recomendaciones semanales del agente Analista, con aprobar (crea una propuesta) o descartar.

### 11.12 Configuración (`/configuracion`)

Pestañas:

- **Marca:** nombre, oferta, tono, firma y palabras prohibidas.
- **Cliente ideal:** lista de calificación editable.
- **Límites y horarios:** tope diario, separación entre envíos, ventana, tope por dominio y umbral de rebote para pausa automática.
- **Cumplimiento:** URL de la política de datos, texto de la línea de baja y lista de supresión (ver y agregar).
- **Integraciones:** tarjetas para Gmail (Workspace), formulario del sitio (URL del webhook y secreto oculto), GA4, Search Console, verificador de correo y API de Claude, con estado, última sincronización y conectar o desconectar. **Nunca mostrar secretos en texto plano.**

### 11.13 Registro de acciones (`/auditoria`)

- Tabla filtrable por actor, acción, entidad y fecha.
- Fila expandible con el antes y el después.
- Exportar a CSV.

## 12. Reglas de negocio que la interfaz debe respetar

1. Ninguna pantalla envía correos automáticamente. El único envío desde la interfaz es «Enviar respuesta», con confirmación.
2. Solo se inscriben en campañas contactos con base legal aprobada, correo válido y sin exclusión.
3. Un contacto excluido o en la lista de supresión nunca aparece como seleccionable para campañas.
4. Toda aprobación muestra antes un resumen de lo que va a pasar.
5. Toda edición de una propuesta crea una nueva versión; un cambio sustancial en una campaña aprobada la devuelve a revisión.
6. Rechazar exige comentario.
7. Los datos inferidos o pendientes nunca se ven igual que los verificados.
8. Las personas encontradas por el descubrimiento requieren base legal antes de cualquier campaña.
9. Las bajas se muestran como procesadas, sin pedir aprobación.
10. Mover una oportunidad a Cliente o Perdido requiere confirmación.
11. Las métricas sin datos suficientes se muestran como «Sin datos», nunca como 0.
12. El origen desconocido se muestra como «Desconocido», sin adivinar.

Las reglas 2, 3, 5 y 11 deben tener pruebas unitarias.

## 13. Datos de ejemplo

Todos ficticios, con dominios terminados en `.example`:

- 25 empresas de Palmira, Candelaria y Cali, en los sectores del formulario del piloto (comercio, industria y manufactura, agroindustria y agricultura, servicios, construcción, turismo y alimentos, transporte y logística).
- 60 contactos repartidos en todas las etapas, con distintas bases legales y estados de correo.
- Incluye **Empaques Samán S.A.S.** (Palmira, 45 empleados, proveedora de agroindustria) con Andrés Felipe Cárdenas (gerente), Claudia Mejía (gerente administrativa y financiera) y Laura Gómez (coordinadora de calidad y SST).
- Una campaña activa, **«Proveedores agroindustriales · Palmira y Candelaria»**, con estos tres pasos:
  - Paso 1, día 0. Asunto: «Los cuestionarios de proveedores que llegan a {{empresa}}». Cuerpo: «Buenos días, {{nombre}}: Vimos que {{empresa}} {{senal}}. Cada vez más empresas grandes les piden a sus proveedores información sobre prácticas laborales, ambientales y éticas, y muchas MiPymes no tienen cómo responder con evidencia. En NEXUS, desde Candelaria, creamos un diagnóstico rápido, el RSE Express, que muestra el punto de partida de su empresa y por dónde empezar. Es gratuito y el resultado lo revisa nuestro equipo. ¿Le sirve hacerlo esta semana?»
  - Paso 2, 4 días hábiles, mismo hilo: tres temas que suelen aparecer en los cuestionarios de proveedores (residuos, condiciones laborales y de seguridad, relación con la comunidad) e invitación al diagnóstico.
  - Paso 3, 9 días hábiles, mismo hilo: último mensaje, enlace al diagnóstico y ofrecimiento de 20 minutos de conversación.
  - Respaldo de `{{senal}}`: «trabaja con empresas grandes de la región». Todos los pasos terminan con firma y línea de baja.
- Una campaña en revisión, con dos versiones para probar el DiffView.
- 8 respuestas con clasificaciones variadas (incluidas una baja, un fuera de oficina y una de confianza baja).
- 5 oportunidades en distintas etapas, con valores en COP.
- Propuestas de los cuatro agentes (enriquecimiento, segmento, campaña, mejora y correo inferido).
- 2 búsquedas de descubrimiento (una terminada con resultados, una en curso).
- 50 registros de auditoría y métricas diarias de los últimos 90 días.

## 14. Calidad

- TypeScript en modo estricto, sin `any`. ESLint y Prettier sin errores.
- Accesibilidad: etiquetas en todos los campos, foco visible, navegación completa con teclado, contraste AA, `aria-live` para notificaciones, diálogos accesibles. Los chips de color siempre llevan texto o ícono, no solo color.
- Diseño pensado primero para escritorio (1280 px o más) y usable en tablet.
- Pruebas con Vitest: reglas de negocio, formateo es-CO y al menos una prueba de flujo por pantalla crítica (aprobar propuesta, importar CSV, aceptar resultado de descubrimiento).
- Un `README.md` con cómo instalar, ejecutar con mocks, cambiar a la API real y correr pruebas.

## 15. Plan de trabajo

Trabaja por fases. Al terminar cada una: `npm run build`, `npm run typecheck` y `npm run test` deben pasar sin errores; resume lo que hiciste, cómo probarlo y espera mi confirmación antes de seguir.

1. **Base:** proyecto Vite, tokens y estilos, layout con barra lateral y superior, rutas, inicio de sesión simulado, tipos, cliente de API, MSW con todos los datos de ejemplo y los componentes de `components/ui`.
2. **Captación:** Contactos, Empresas, Duplicados, importación CSV, Descubrimiento y Segmentos.
3. **Campañas:** Propuestas, Editor de secuencias y Campañas activas.
4. **Seguimiento y sistema:** Respuestas, Embudo, Informes, Configuración, Registro de acciones y el Panel general completo.

## 16. Lo que no debes hacer

- No escribas código de backend ni llames a APIs reales de Gmail, Google, Meta, LinkedIn, TikTok o Claude.
- No hagas scraping ni peticiones a sitios externos desde el navegador.
- No pongas claves, tokens ni secretos en el código.
- No uses datos personales reales.
- No agregues librerías fuera de la lista sin justificarlo en `DECISIONES.md`.
- No crees botones que envíen o aprueben algo sin confirmación.
