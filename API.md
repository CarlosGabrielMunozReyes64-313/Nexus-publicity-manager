# Contrato de integración del frontend

Base: `VITE_API_URL`. Todas las peticiones incluyen `credentials: include`; contenido JSON. Los tipos están en `src/types/index.ts` y los esquemas ejecutables en `src/api/schemas.ts`.

## Convenciones

- GET de colección: arreglo JSON. GET por ID: objeto.
- POST/PATCH/PUT de mutación: `{ "ok": true }`.
- Error: estado HTTP 4xx/5xx y `{ "message": "Descripción en español" }`.
- GET sin resultados: `[]`, no `null`.
- Fechas ISO 8601; presentación en America/Bogota.
- En el mock, un error revierte la mutación completa.
- Todos los endpoints deben autorizar al administrador en el backend real.

## Endpoints

El contrato base del documento original está implementado en `src/mocks/handlers.ts`. Las siguientes rutas adicionales permiten completar las interacciones que la especificación describe sin darles un endpoint:

| Método | Ruta                                              | Propósito                                                                                                                                                                        |
| ------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/auth/session`                                   | Sesión válida: `{ok:true}`; sin sesión: 401                                                                                                                                      |
| GET    | `/auth/google`                                    | Redirección a OAuth, solo API real                                                                                                                                               |
| GET    | `/auth/logout`                                    | Cierre de sesión y redirección, solo API real                                                                                                                                    |
| GET    | `/secuencias`                                     | Listar secuencias                                                                                                                                                                |
| PATCH  | `/segmentos/:id`                                  | Guardar reglas o archivar; invalida campañas asociadas                                                                                                                           |
| POST   | `/campanas/:id/inscribir`                         | Body: arreglo de IDs de contacto; valida reglas y elegibilidad                                                                                                                   |
| POST   | `/respuestas/:id/reunion`                         | Registra reunión y finaliza la inscripción                                                                                                                                       |
| POST   | `/informes/costos`                                | `{costoUSD:number, fecha?:"AAAA-MM-DD", concepto?:string}`; fecha real del gasto (no futura). Devuelve `{ok:true, fecha}`                                                        |
| GET    | `/auditoria/pagina`                               | Filtros `actor`, `accion`, `entidad` (parte del texto), `entidadId`, `desde`, `hasta` (días de Bogotá), `pagina`, `tamano`; devuelve `{items,total,pagina,tamano}`               |
| GET    | `/auditoria/exportar`                             | Mismos filtros; CSV con todas las coincidencias (sin límite de 500)                                                                                                              |
| POST   | `/duplicados/:id/descartar`                       | Marca el par como «no es duplicado»                                                                                                                                              |
| PUT    | `/configuracion/limites?pausarIncompatibles=true` | Sin el parámetro, un horario sin coincidencia con campañas aprobadas responde 409 con sus nombres; con él, guarda y pausa esas campañas. Devuelve `{ok:true, pausadas:string[]}` |
| POST   | `/informes/recomendaciones/:id/aprobar`           | Crea propuesta de mejora pendiente                                                                                                                                               |
| POST   | `/informes/recomendaciones/:id/descartar`         | Descarta la recomendación                                                                                                                                                        |
| POST   | `/dev/reset`                                      | Solo demostración: restaura los datos                                                                                                                                            |

La sesión simulada se guarda en sessionStorage; las rutas `/auth/*` no se llaman en ese modo.

## Payloads de acciones especiales

- Importar: `{contactos: Contacto[]}`. Ignora la aprobación legal entrante, omite duplicados por correo (existentes o repetidos en el archivo) y rechaza filas inválidas. Devuelve `{ok:true, creados, omitidos, rechazados}`. La base `autorizacion_formulario` solo llega por el webhook firmado.
- Conectar o desconectar integración: devuelve `{ok:true, estado, detalle}` con el resultado real (por ejemplo, `error` si la credencial no funciona).
- Embudo: `GET /embudo?desde&hasta` filtra por fecha de creación del contacto (días de Bogotá); cada contacto aparece en su etapa actual.
- Excluir: `{motivo:string}` (mínimo 3 caracteres).
- Aprobar base legal: POST sin contenido, después de registrar sus datos vía PATCH del contacto.
- Descubrimiento: POST `/descubrimiento/busquedas` con `BusquedaDescubrimiento.criterios`.
- Resolver duplicados: objeto con campos (`razonSocial`, `sector`, `municipio`, `tamano`, `sitioWeb`, `dominio`) y valor `principal` o `duplicado`.
- Previsualizar segmento: arreglo `ReglaSegmento[]`; devuelve `{conteo:number,muestra:Contacto[]}`.
- Guardar propuesta: `{resumen?:string, contenido?:Secuencia}` (al menos uno); añade una versión del administrador y vuelve a revisión. `contenido` solo en rutas de correo (ver abajo).
- Rechazar propuesta: `{comentario:string, pedirNuevaVersion?:boolean}`; comentario obligatorio (3 caracteres o más).
- Previsualizar secuencia: `{contactoId:string}`; devuelve `{pasos:Paso[],respaldo:string[]}`.
- Enviar respuesta: `{texto:string}`. En modo mock solo guarda el mensaje.
- Cambiar clasificación: `{clasificacion:ClasificacionRespuesta}`.
- Supresión: `Supresion`, con correo o dominio y motivo.
- Marca, límites y cliente ideal: objetos completos de sus esquemas.

## Extensiones del modelo

`PropuestaAgente.objetivoId` vincula la propuesta con su campaña, segmento, empresa o contacto. En propuestas nuevas de campaña, las versiones almacenan la secuencia completa.

`MetricaDiaria` añade `campanaId`, `segmentoId`, `leads` y `clientes` para permitir agrupación y costos por periodo sin inferir atribuciones. `fecha` es un día de calendario (`AAAA-MM-DD`, Bogotá) y cada evento cuenta en su propia fecha. `costoUSD` es el total del día y aparece en una sola fila por fecha: agregue por fecha antes de calcular costo por lead y costo de adquisición.

Paginación opcional en los listados: `GET /empresas?limite=50&desplazamiento=0` (máximo 500) devuelve esa porción y el total en la cabecera `X-Total-Count`; sin parámetros se devuelve el arreglo completo. Los listados (`GET /empresas`, `GET /contactos`) devuelven `evidencias: []`; las evidencias completas están en la ficha (`GET /empresas/:id`, `GET /contactos/:id`). `Campana.motivoPausa` explica por qué una campaña no puede enviar (horario incompatible o Gmail desconectado).

La regla especial de segmento `campo: contactoIds`, `operador: es`, `valor: c1,c2,...` conserva una selección manual exacta. Los demás campos admitidos son municipio, sector, tamaño, puntaje, etapa, origen y baseLegal.

## Responsabilidades del backend futuro

El cambio de variable conecta la interfaz, pero no crea un servidor. El backend debe aplicar autenticación, autorización, validación, supresión, versionado y huellas de aprobación; verificar correos y evidencias; registrar transiciones y eventos; implementar el motor de envíos con horarios/cupos; detenerse por bajas, rebotes, respuestas, reuniones y cuentas cliente. Nunca debe confiar en que una validación visual del frontend sea una garantía de seguridad.

## Pedidos de propuestas a los agentes

- `POST /segmentos/proponer` encola al Segmentador. 409 si falta configurar el proveedor de IA, si no hay empresas o si ya hay un pedido en curso. Respuesta: `{ok: true, tareaId}`.
- `POST /segmentos/:id/proponer-campana` (se conserva) pide una ruta de 3 correos con el objetivo «Que completen el diagnóstico RSE Express». Usa la misma lógica que `POST /propuestas/rutas-correo` (abajo) y responde `{ok:true, tareaId}`.
- `GET /agentes/solicitudes`: los 10 pedidos más recientes (`proponer_segmentos`, `proponer_campana`, `revisar_campana`) con `estado` (`pendiente`, `en_proceso`, `completada`, `fallida`, `cancelada`), `intentos`, `maxIntentos`, `creadaEn`, `terminadaEn`, `proximoIntento`, `segmentoId`, `segmento` y, si falló o espera reintento, `error` con un motivo seguro.

## Rutas de correo (propuestas de tipo `campana`)

El agente Estratega-redactor solo **propone**: crea la secuencia, la campaña `en_revision` y la propuesta (o una versión nueva). Nunca aprueba, activa ni envía. Aprobar tampoco envía: los envíos empiezan al activar la campaña en Campañas. Todas las mutaciones son del administrador y ocurren en una sola transacción.

| Método | Ruta                                     | Cuerpo                                                                               | Respuesta                                                                                                                                                                                                                                                      |
| ------ | ---------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/propuestas/rutas-correo`               | `{segmentoId, objetivo (5–200), numeroCorreos? (2–5, por defecto 3), notas? (≤500)}` | `{ok:true}`. 409 «El segmento requiere aprobación», «El segmento no tiene contactos elegibles con base legal aprobada» o «Ya hay una ruta en preparación para este segmento». 400 si el cuerpo no es válido.                                                   |
| GET    | `/propuestas/rutas-correo/segmentos`     | —                                                                                    | Segmentos aprobados: `[{id, nombre, version, elegibles}]`.                                                                                                                                                                                                     |
| GET    | `/propuestas/solicitudes`                | —                                                                                    | Pedidos de los últimos 30 días: `[{id, tipo (proponer_campana \| revisar_campana), estado (en_cola \| trabajando \| lista \| fallida), segmentoId?, segmento?, propuestaId?, objetivo?, numeroCorreos?, creadaEn, terminadaEn?, error?}]`.                     |
| POST   | `/propuestas/solicitudes/:id/reintentar` | `{}`                                                                                 | `{ok:true}`; solo para una solicitud `fallida` (409 si no).                                                                                                                                                                                                    |
| PUT    | `/propuestas/:id`                        | `{resumen?, contenido?}`                                                             | `{ok:true, version}`. `contenido` es la secuencia completa; se valida igual que en Secuencias (400 con los errores unidos por «. »). Crea una versión del administrador, conserva las notas del agente y revoca la aprobación (también si ya estaba aprobada). |
| POST   | `/propuestas/:id/previsualizar`          | `{contactoId, version?}`                                                             | `{pasos, respaldo}` con el mismo `render` del motor; no crea mensajes.                                                                                                                                                                                         |
| GET    | `/propuestas/:id/revision`               | —                                                                                    | `{puedeAprobar, bloqueos, errores, advertencias, elegibles, segmento{id,nombre,estado,version}, ventanaValida, gmailConectado, duracionDiasHabiles, topeDiario}`. Aprobar usa exactamente esta lógica.                                                         |
| GET    | `/propuestas/:id/elegibles`              | —                                                                                    | Hasta 50 contactos elegibles del segmento para la vista previa: `[{id, nombre, empresa}]`.                                                                                                                                                                     |
| POST   | `/propuestas/:id/restaurar`              | `{version}`                                                                          | `{ok:true, version}`: crea una versión del administrador con ese contenido (no la actual).                                                                                                                                                                     |
| POST   | `/propuestas/:id/rechazar`               | `{comentario, pedirNuevaVersion? = true}`                                            | `{ok:true}`. Solo si `pedirNuevaVersion` es verdadero y la propuesta es del Estratega-redactor se encola `revisar_campana`.                                                                                                                                    |
| POST   | `/propuestas/:id/aprobar`                | `{}`                                                                                 | `{ok:true}`. 400 con los bloqueos y errores de `/revision` si no se puede.                                                                                                                                                                                     |

Campos nuevos (aditivos; los opcionales vacíos se omiten, nunca `null`):

- `PropuestaAgente.versiones[]`: `autor` (`agente` o `admin`), `decision` (`aprobada` o `rechazada`), `comentario`, `decididaEn`.
- `PropuestaAgente.ruta` (solo tipo `campana`): `{campanaNombre, campanaEstado, segmentoId, segmentoNombre}`.
- Contenido de una versión de ruta: la secuencia completa más `notasAgente: {general, pasos:[{orden, proposito, porQue, editadoPorAdmin?}]}`. `editadoPorAdmin` marca los correos que cambió el administrador. El frontend lo lee con `rutaCorreoSchema` (`safeParse`); si no coincide, muestra el contenido tal cual.

Bloqueos de `/revision` (impiden aprobar): versión ya decidida, propuesta ya aprobada, segmento sin aprobar, ventana fuera del horario global y correo inferido. Errores: los de la validación de secuencias. Advertencias (no impiden): más de 120 palabras en un correo (sin contar `{{firma}}` ni `{{baja}}`), asunto de más de 60 caracteres, mayúsculas sostenidas o signos repetidos en el asunto, más de un `{{enlace}}`, ruta de más de 15 días hábiles, «X de N contactos usarán el texto de respaldo» por variable de datos y Gmail desconectado.

El modo demostración (`src/mocks/handlers.ts` y `src/mocks/rutas.ts`) implementa todas estas rutas con las mismas reglas; su agente simulado responde en unos segundos. Trae una solicitud fallida de ejemplo y una ruta con dos versiones (agente y administrador).
