# Decisiones de implementación

1. El ZIP de origen contenía únicamente un README de plantilla. Se construyó la aplicación desde cero y se conservó la especificación en `ESPECIFICACION.md`.
2. La petición final de entregar el proyecto completo se interpretó como autorización para completar las cuatro fases sin confirmaciones intermedias. Las confirmaciones **dentro de la aplicación** sí se mantienen para aprobaciones y acciones sensibles.
3. Se usan las versiones mayores solicitadas: Vite 7, React 18, Router 7 y TypeScript 5. El archivo de bloqueo fija las versiones instaladas. `@vitejs/plugin-react`, los tipos de React, `typescript-eslint`, `jsdom` y `@testing-library/jest-dom` son herramientas de compilación/pruebas; no se añadieron librerías de componentes ni dependencias de producto ajenas a la lista.
4. La tipografía declara Montserrat y utiliza Helvetica/Arial si no está instalada. No descarga fuentes ni otros recursos desde servicios externos. Los colores principales del documento se preservan; las acciones con texto blanco usan verde oscuro para mantener legibilidad.
5. El modo mock simula latencia de 300–800 ms, conserva estado en el proceso de MSW y registra las mutaciones. Una recarga empieza una sesión de datos nueva. Las búsquedas nuevas completan una simulación determinista después de unos segundos; no investigan empresas reales.
6. Aprobar una campaña no inscribe ni envía automáticamente. Los contactos se inscriben explícitamente desde su ficha y la activación se confirma aparte. Las propuestas de campaña se vinculan por `objetivoId` para evitar aplicar una decisión a la campaña equivocada.
7. La revisión de secuencias, segmentos o identidad de marca invalida la aprobación vigente. Se generan propuestas de campaña para revisar el nuevo contenido. La huella incluye secuencia y reglas del segmento; la edición de marca invalida las aprobaciones explícitamente.
8. Los correos inferidos nunca se convierten en verificados al aprobar. El enriquecimiento aprobado conserva la etiqueta de inferencia. La base legal debe tener tipo, texto y prueba para poder aprobarse; seleccionar `corporativo_generico` no otorga autorización automática.
9. El CSV admite encabezado, comas, comillas escapadas y saltos de línea entre comillas; límite de 2 MB. Cada lote se vincula a una empresa seleccionada. La columna de nombre y la de correo son mapeables. Duplicados por correo se omiten sin fusionar; toda importación queda con correo desconocido y base legal sin aprobar. Se proporciona un ejemplo.
10. La fusión de empresas permite elegir razón social, sector, municipio, tamaño, web y dominio; conserva evidencias y reasigna contactos y oportunidades. La selección masiva de contactos crea un segmento mediante la extensión `contactoIds`, documentada en el contrato.
11. Las métricas diarias incluyen atribución explícita a campaña y segmento. Los filtros se aplican a esas series; las tarjetas de campaña representan su estado operativo de ejemplo. El embudo presenta distribución por etapa y cocientes entre conteos, **no afirma conversiones históricas** sin datos de transiciones. El tablero comercial muestra todas las oportunidades y lo indica explícitamente.
12. Los costos están en USD porque la auditoría y los costos de agentes del contrato usan USD; las oportunidades se muestran en COP. Los costos por lead/adquisición usan únicamente días con costo registrado y muestran cobertura. Un denominador cero o ausente produce “Sin datos”.
13. No hay un motor de envíos ni una verificación de correos reales. El navegador solo simula la respuesta enviada que confirma el administrador. Los horarios y límites configuran el contrato futuro, no ejecutan procesos en segundo plano.
14. `Enviar respuesta` bloquea contactos suprimidos aunque la clasificación se cambie después. Convertir una cuenta en cliente retira todas sus inscripciones. La API vuelve a comprobar elegibilidad, segmento y estado de aprobación; deshabilitar botones por sí solo no basta.
15. El adaptador HTTP espera `{ "ok": true }` en mutaciones y datos de dominio en consultas; errores `{ "message": "..." }`. La integración futura tiene un contrato explícito en `API.md` y no depende de datos importados desde mocks en las pantallas.
16. Los diálogos usan `<dialog>` nativo, foco inicial nativo, cierre con Escape y devolución del foco. El drag and drop de pasos tiene soporte de teclado; las oportunidades cuentan además con un selector de etapa accesible. Se emplean controles nativos etiquetados, estados textuales y `aria-live` para notificaciones.
17. La comparación de versiones muestra antes/después completos lado a lado. La vista previa de correos utiliza la última secuencia guardada y señala los campos que requieren texto de respaldo. La estimación del primer envío se expresa como próxima ventana hábil tras la activación; no se inventa una fecha de programación sin activación ni motor de colas.
18. No se implementó backend Python, OAuth real, gestión de secretos, scraping ni integraciones externas: están expresamente fuera del alcance. Los endpoints de autenticación documentados son el contrato a implementar posteriormente. La sesión de demostración no es un mecanismo de seguridad para producción.

## Correcciones de noviembre de 2026 (lista de defectos 01-25 y hallazgos adicionales)

Estas decisiones actualizan las anteriores donde se contradicen (en particular 12 y 18: ya existe el backend real).

19. **Modo de la interfaz (03).** `src/lib/modo.ts` expone `MODO_DEMO` (`VITE_USE_MOCKS=true`). Integraciones, Descubrimiento y la activación de campañas muestran el efecto real (revocar Gmail, rechazar el formulario con 503, enviar correos, consumir presupuesto) o el simulado según el modo. El resultado que muestra el aviso es el que devuelve la API, incluido un estado `error`.
20. **Importación CSV (01, 02, 22).** Cambiar empresa, origen o base legal invalida la vista previa; cada archivo nuevo limpia filas, mapeo y vista previa; los duplicados se detectan en una sola pasada con conjuntos. El resumen final usa los conteos del servidor (creadas, omitidas por duplicadas, rechazadas).
21. **Fechas (10).** Una fecha de calendario (`AAAA-MM-DD`) se muestra tal cual; un instante se convierte a la hora de Bogotá. Así un costo del 2 de noviembre no aparece como 1 de noviembre.
22. **Informes (05, 06, 11, 12, 13).** Las series se agrupan por día antes de graficar. El costo por lead y por adquisición suma el costo una vez por fecha y la cobertura cuenta fechas únicas. El gasto se registra con su fecha real y un concepto. La pestaña Embudo usa el mismo periodo que el resto del informe.
23. **Auditoría (09).** Filtros (actor, acción, entidad, referencia y fechas) aplicados en el servidor, paginación del servidor y exportación CSV con todas las coincidencias.
24. **Formulario del sitio (04, 14).** La dirección del webhook se calcula con el mismo origen y `VITE_API_URL` que usa la aplicación, con botón para copiarla. En modo real no se muestra ningún secreto: se configura en el servidor.
25. **Sesión (19).** Solo un 401 lleva al inicio de sesión; una caída de red o un 5xx muestran «No pudimos comprobar su sesión» con Reintentar. Los errores 4xx no se reintentan.
26. **Despliegue (23).** (Desde el punto 48, `vercel.json` estático con `$NEXUS_BACKEND_URL`.) `vercel.ts` sustituye a `vercel.json`: el destino del backend sale de `NEXUS_BACKEND_URL`, definido por separado para Production y Preview. Si falta, o `/health` no responde, la compilación se detiene en vez de apuntar al servidor equivocado. `npm run verificar:despliegue` comprueba las rutas después de desplegar. Vite reenvía `/api`, `/baja`, `/r` y `/health` al backend local en desarrollo.
27. **Arranque (24).** README con instrucciones paso a paso, `.env.example` comentado y `main.tsx` con un mensaje claro si el modo demostración no puede iniciar su service worker.
28. **Hallazgos adicionales.** Propuestas muestra la versión propuesta que se aplicará, no la guardada. La vista previa de secuencias usa un contacto real, no uno fijo. Un segmento con cambios sin guardar no se puede aprobar (el conteo mostrado no correspondería a lo aprobado). La línea de tiempo del contacto muestra la hora. Crear oportunidad desde una respuesta conserva contacto y campaña. Las pruebas ya no dependen de una `VITE_API_URL` absoluta ni del `.env` local, y Prettier ignora el service worker generado por MSW.
29. **Selector múltiple (22 de noviembre de 2026).** La casilla oculta de cada opción quedaba posicionada fuera de la lista con desplazamiento; al marcar una opción baja, el navegador desplazaba toda la página para mostrarla. Ahora queda contenida en su opción (comprobado en Chrome: antes la página saltaba de 432 a 1.952 px; ahora no se mueve).
30. **Búsquedas de Descubrimiento.** Cada tarjeta muestra el motivo real de un fallo o de la espera entre intentos, avisa si terminó sin empresas comprobables y recuerda que «Aceptar» crea la empresa y su contacto corporativo.
31. **Propuestas a pedido.** Segmentos tiene «Pedir propuestas al agente» y, en un segmento aprobado, «Pedir campaña al agente»; cada uno confirma antes de gastar presupuesto de IA y muestra el motivo si el servidor lo rechaza. Propuestas lista los pedidos recientes con su estado (se actualiza sola mientras alguno avanza) y el motivo de un fallo. En modo demostración el Segmentador responde al instante y el Estratega explica que no redacta campañas nuevas.
32. **Descubrimiento gratuito.** El backend puede usar Tavily como buscador (plan gratuito) con Gemini gratuito para extraer los datos; la interfaz no cambia y el texto de «Conectar» la API de IA explica qué buscador se prueba.
33. **Rutas de correo en Propuestas.** Filtro rápido arriba (Rutas de correo por defecto · Otras propuestas · Todas) sin perder los filtros de estado, agente y tipo. «Pedir una ruta de correos» usa React Hook Form con un esquema Zod (`src/lib/formulario.ts` hace de resolutor para no añadir dependencias); los errores del servidor se muestran dentro del diálogo. El panel «Solicitudes en curso» consulta cada 15 s solo mientras alguna sigue en cola o en proceso.
34. **Detalle de una ruta.** Encabezado con autor de la versión, «Por qué esta ruta», línea de tiempo por correo (día hábil, mismo hilo, variables como etiquetas, propósito y porqué o «Editado por el administrador», palabras y advertencias), vista previa con el primer contacto elegible (nunca un id fijo) y la lista de verificación de `/revision` en rojo, ámbar y verde. Aprobar se deshabilita con el motivo que da el servidor: el frontend no decide quién puede recibir correos ni si se puede aprobar.
35. **Aprobar y rechazar con diálogo propio.** El de aprobar resume versión, correos, duración, ventana, elegibles y tope diario, y dice que aprobar no envía nada, con enlace a la campaña (el diálogo se cierra al seguirlo). Se quitó el texto «No se enviarán correos reales en esta demostración». Rechazar pide comentario y trae marcada «Pedir al agente una versión nueva con este comentario».
36. **Historial y comparación.** Tabla con versión, autor, fecha, decisión y comentario; dos selectores para comparar correo por correo con lo agregado y lo quitado marcado palabra por palabra (LCS sobre palabras) y «Restaurar esta versión», que crea una versión nueva del administrador.
37. **Editor compartido.** El editor de Secuencias pasó a `src/features/secuencias/EditorSecuencia.tsx` (props `inicial`, `alGuardar`, `vistaPrevia`, `contactos`, `aviso`). Secuencias se comporta igual; en la ruta, guardar hace `PUT /propuestas/:id` con `{contenido}` y muestra «Se creó la versión N. La campaña queda en revisión hasta que la apruebes». Los errores de `validarSecuencia` aparecen mientras se escribe y los del servidor, dentro del editor.
38. **Modo demostración.** Las rutas nuevas viven en `src/mocks/rutas.ts` con las mismas reglas que el backend, incluida la corrección de `revisar_pendientes` (la versión del administrador no se pisa con contenido más antiguo). El agente simulado tarda unos segundos (`demoRutas.esperaMs`; las pruebas lo ponen en 0). Los datos traen una solicitud fallida y la ruta de ejemplo con dos versiones; para que esa ruta se pueda aprobar, su campaña usa un segmento aprobado nuevo («Proveedores de ingenios · Palmira») y su propia secuencia.
39. **Segmentos.** «Pedir campaña al agente» se conserva y ahora pide una ruta de 3 correos con el objetivo por defecto; para elegir otro objetivo se usa Propuestas.
40. **Secuencias de correo en lugar de Propuestas (22 de noviembre de 2026).**
    - Se quitaron la pantalla Propuestas, su entrada del menú, el contador y su carpeta.
    - `/propuestas` lleva a `/secuencias`, y `/propuestas/:id` a la secuencia de esa campaña; si es otra propuesta, a su pantalla de origen.
    - Las propuestas que no son de secuencias aparecen donde se usan:
      - el enriquecimiento y el correo inferido, en la ficha de la empresa («Datos sugeridos por la IA»);
      - las mejoras, en Informes (si son de una secuencia, crean un borrador);
      - las de segmento se marcan aprobadas al aprobar el segmento.
    - El menú muestra «Secuencias de correo» con el número de secuencias por aprobar, y el Panel tiene la tarjeta «Secuencias por aprobar».
41. **Lista al estilo de Listmonk.**
    - Tabla con nombre, segmento, correos, estado y métricas.
    - Búsqueda, filtro por estado y «Ver archivadas».
    - Diálogos «Nueva con IA» (React Hook Form + Zod) y «Nueva en blanco».
    - Panel «Solicitudes a la IA», que consulta cada 15 s solo mientras alguna avanza, y estado vacío.
42. **Editor `/secuencias/:id`.**
    - Barra superior: nombre editable, estado, segmento, «Borrador vN · aprobada vM», Guardar (también con Ctrl/Cmd+S), Enviar prueba y Aprobar o Aprobar cambios, desactivado con el motivo que da el servidor (o «Guarda los cambios antes de aprobar»). El menú tiene Duplicar, Archivar, Pedir otra versión a la IA y Ver campaña.
    - Pestaña Correos, en 3 columnas:
      - lista de correos con arrastre (dnd-kit), botones subir/bajar accesibles por teclado e íconos de error o advertencia;
      - editor del correo;
      - vista previa en vivo con un contacto real, medio segundo después de dejar de escribir, en escritorio o celular.
      - Debajo va la lista de verificación.
    - Otras pestañas: Configuración, Vista previa (el hilo con fechas estimadas) e Historial (comparación palabra por palabra y «Restaurar como borrador»).
    - `/secuencias/:id/editar` sigue funcionando.
43. **No perder cambios.**
    - `BrowserRouter` no tiene `useBlocker`. Por eso los enlaces de la aplicación se interceptan en fase de captura y piden confirmar, y `beforeunload` cubre cerrar o recargar.
    - El botón «atrás» del navegador no se puede frenar con este router. Para ese caso, mientras haya cambios sin guardar se guarda una copia local (`nexus-borrador-<id>`), que se ofrece con «Recuperar» si es más nueva que el borrador del servidor.
    - Si otra versión llega del servidor (la IA, restaurar) y no hay cambios locales, se carga; si los hay, se avisa.
44. **Aviso de borrador.** Con una versión aprobada, al editar aparece «Lo que estás editando es un borrador. Se sigue enviando la versión aprobada hasta que apruebes los cambios». Si todo está aprobado, el motivo de no poder aprobar se muestra como texto neutro, no como error.
45. **Texto con formato.**
    - Editor TipTap (StarterKit sin títulos, citas ni código; Link solo con `https://` o `{{enlace}}`). Las variables son fichas que no se pueden romper y vuelven a ser `{{x}}` al guardar.
    - La barra de herramientas no le quita el foco al texto.
    - «Ver versión en texto simple».
    - TipTap se carga aparte, solo al usar formato (unos 133 kB comprimidos).
    - La vista previa usa `iframe` con `sandbox=""` y `srcdoc`; el HTML del usuario nunca entra en la página.
46. **Mejorar con IA.**
    - Por correo, con instrucciones rápidas.
    - Envía lo que hay en pantalla (sin guardar) y la instrucción.
    - La sugerencia se compara palabra por palabra con el texto actual. «Usar sugerencia» la aplica al borrador sin guardar (en formato, como párrafos), y también se puede descartar o reintentar.
    - Consulta cada 5 s solo mientras la IA escribe.
47. **Modo demostración.** `src/mocks/secuencias.ts` reemplaza a `src/mocks/rutas.ts` con las mismas reglas que el backend. Trae una secuencia escrita por la IA, una editada por el administrador con 2 versiones, una solicitud en curso y una fallida.
48. **`vercel.json` estático en lugar de `vercel.ts` (22 de noviembre de 2026).**
    - **El fallo:** Vercel rechazaba el despliegue antes de compilar con «`rewrites[0]` missing required property `destination`». La validación que Vercel hace en su lado no acepta un `vercel.ts` que calcula el destino con `process.env`, aunque localmente `@vercel/config compile` y `validate` lo acepten. Otros proyectos documentan el mismo fallo.
    - **El arreglo:**
      - `vercel.json` es estático. Cada reescritura al backend usa `$NEXUS_BACKEND_URL` con `env: ["NEXUS_BACKEND_URL"]`, que Vercel sustituye en cada petición con el valor del despliegue (está en el esquema oficial de `@vercel/routing-utils`).
      - `respectOriginCacheControl: false` desactiva la caché de esas reescrituras; reemplaza a la cabecera `x-vercel-enable-rewrite-caching`.
      - Se conserva la separación entre Production y Preview.
    - **La comprobación antes de compilar** (`npm run build:vercel`) sigue deteniendo el despliegue si falta la variable o si `/health` no responde. Ahora también lo detiene si el valor trae barra final o espacios, porque en el destino se usa tal cual.
    - **Requisito:** la variable no debe ser «Sensitive», porque Vercel no pasa su valor a las reescrituras.
    - **Pruebas:** `src/lib/despliegue.test.ts` valida `vercel.json` con el esquema y el normalizador de rutas oficiales de Vercel (`@vercel/routing-utils`, dependencia de desarrollo) y prueba el script de comprobación con valores válidos e inválidos.
49. **Verificar correo desde la ficha del contacto (23 de noviembre de 2026).** Si el correo no está verificado como válido, la ficha lo explica y ofrece «Verificar correo» (con confirmación, porque consume una verificación de Hunter). El estado lo pone el verificador del backend; la demo lo simula.
50. **Aprobación automática de la base legal (23 de noviembre de 2026).** En Configuración → Cumplimiento hay un interruptor, apagado por defecto. Al encenderlo (con confirmación) el backend llena la evidencia y aprueba la base de cada contacto cuyo correo aparece publicado en una página con cita verificada, y lo hace también con cada correo que se verifique después. El aviso muestra cuántos aprobó. La ficha del contacto dice cuándo una base se aprobó así; «Registrar evidencia legal» y «Aprobar base» siguen disponibles para cambiarla. La demo aplica la misma regla.
