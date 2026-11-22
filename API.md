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
- Guardar propuesta: `{resumen:string}`; añade versión y vuelve a revisión.
- Rechazar propuesta: `{comentario:string}` obligatorio.
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
- `POST /segmentos/:id/proponer-campana` encola al Estratega-redactor para un segmento **aprobado** con contactos elegibles. 409 con el motivo si no se cumple o si ya hay una campaña en preparación para ese segmento.
- `GET /agentes/solicitudes`: los 10 pedidos más recientes (`proponer_segmentos`, `proponer_campana`, `revisar_campana`) con `estado` (`pendiente`, `en_proceso`, `completada`, `fallida`, `cancelada`), `intentos`, `maxIntentos`, `creadaEn`, `terminadaEn`, `proximoIntento`, `segmentoId`, `segmento` y, si falló o espera reintento, `error` con un motivo seguro.
