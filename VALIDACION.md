# Validación de entrega — 21 de noviembre de 2026

Entorno de comprobación: Node 22.23.5, npm 10.9.9, Chrome for Testing 153 con Playwright 1.65. Versiones exactas de dependencias en package-lock.json.

## Comprobaciones ejecutadas

- `npm run typecheck`: TypeScript estricto, sin errores.
- `npm run lint`: ESLint sin errores.
- `npm test`: 54 pruebas en 7 archivos, todas correctas (39 originales y 15 nuevas). También pasan con un `.env` local de demostración presente.
- `npm run format:check`: formato verificado con Prettier.
- `VITE_USE_MOCKS=false npm run build`: compilación de producción en `dist`.
- Contrato: 33 respuestas reales del backend (guardadas por pytest) validadas con los esquemas Zod (`scripts/validar_contrato.ts`).
- Navegador real: las 13 pantallas con la API real y un recorrido de las correcciones (sesión caída, importación CSV con cambio de empresa y resumen, integraciones, costo con fecha, embudo por periodo, auditoría filtrada y exportada, baja inválida).
- Arranque desde los ZIP entregados con `scripts/probar_arranque.py` del backend: `npm ci`, `npm test` y `npm run build` sobre la copia extraída.

## Cobertura nueva

- Importación: invalidación de la vista previa al cambiar empresa, origen o base legal; limpieza por archivo; resumen de creadas, omitidas y rechazadas.
- Fechas de calendario frente a instantes en Bogotá.
- Informes agrupados por día y costo por lead con dos campañas el mismo día.
- Auditoría con filtros en el servidor y exportación completa.
- Sesión vencida frente a servidor caído, textos de integraciones en modo real, dirección del webhook y advertencia de envíos reales al activar.
- Configuración de Vercel por entorno.
- Versión propuesta en Propuestas y aprobación de segmentos solo con cambios guardados.

## Límite de la comprobación

No se probaron cuentas reales de Google, Gmail, Claude o Gemini, ni un despliegue real en Vercel. La accesibilidad se implementó con controles nativos, foco y etiquetas; no se afirma una certificación WCAG independiente.
