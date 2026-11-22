# Validación de entrega — 22 de noviembre de 2026

Entorno de comprobación: Node 22.23.5, npm 10.9.9, Chrome for Testing 153 con Playwright 1.65. Versiones exactas de dependencias en package-lock.json.

## Comprobaciones ejecutadas

- `npm run typecheck`: TypeScript estricto, sin errores.
- `npm run lint`: ESLint sin errores.
- `npm test`: 76 pruebas en 8 archivos, todas correctas. 19 nuevas de rutas de correo (`src/features/propuestas/rutas.test.tsx` y el escenario de 9 pasos en `src/mocks/flows.test.ts`); 4 pruebas anteriores de Propuestas y Segmentos se actualizaron al comportamiento nuevo (botón «Aprobar ruta», pedido de campaña que ahora funciona en demostración, panel de pedidos de segmentos).
- `npm run format:check`: formato verificado con Prettier.
- `VITE_USE_MOCKS=false npm run build`: compilación de producción en `dist`.
- Contrato: 42 respuestas reales del backend (guardadas por pytest) validadas con los esquemas Zod (`scripts/validar_contrato.ts`), incluidas las rutas nuevas; las 54 versiones reales de rutas cumplen `rutaCorreoSchema`.
- Escenario completo de rutas en modo demostración, en Chrome (Playwright): pedir una ruta de 3 correos, verla lista, previsualizarla con un contacto real, editar el correo 2, comparar la versión 1 con la 2, rechazar con comentario, recibir la versión 3 del agente, aprobar y comprobar que la campaña queda aprobada sin llamadas de inscripción, activación ni envío. Sin errores en la consola.
- Celular (390 px): Propuestas y el detalle de una ruta se leen sin desplazamiento horizontal.
- Navegador real: las 13 pantallas con la API real y un recorrido de las correcciones (sesión caída, importación CSV con cambio de empresa y resumen, integraciones, costo con fecha, embudo por periodo, auditoría filtrada y exportada, baja inválida).
- Selector múltiple en Chrome: marcar una opción al final de la lista ya no desplaza la página.
- Arranque desde los ZIP entregados con `scripts/probar_arranque.py` del backend: `npm ci`, `npm test` y `npm run build` sobre la copia extraída.

## Cobertura nueva

- Importación: invalidación de la vista previa al cambiar empresa, origen o base legal; limpieza por archivo; resumen de creadas, omitidas y rechazadas.
- Fechas de calendario frente a instantes en Bogotá.
- Informes agrupados por día y costo por lead con dos campañas el mismo día.
- Auditoría con filtros en el servidor y exportación completa.
- Sesión vencida frente a servidor caído, textos de integraciones en modo real, dirección del webhook y advertencia de envíos reales al activar.
- Configuración de Vercel por entorno.
- Versión propuesta en Propuestas y aprobación de segmentos solo con cambios guardados.
- Pedidos de propuestas a los agentes: botones, confirmación, motivo del rechazo y estado en Propuestas.
- Rutas de correo: formulario con validación y envío, error del servidor en el diálogo, filtro por rutas, panel de solicitudes con reintento y consulta cada 15 s solo con solicitudes activas, línea de tiempo con notas y «Editado por el administrador», lista de verificación, vista previa con el primer contacto elegible, Aprobar deshabilitado con su motivo (igual que el servidor), diálogo de aprobación sin envíos, comparación palabra por palabra y restauración, rechazo con y sin versión nueva, editor compartido en la ruta y en Secuencias, contenido que no es una ruta mostrado tal cual y validación Zod de las respuestas nuevas.

## Límite de la comprobación

No se probaron cuentas reales de Google, Gmail, Claude o Gemini, ni un despliegue real en Vercel. La accesibilidad se implementó con controles nativos, foco y etiquetas; no se afirma una certificación WCAG independiente.
