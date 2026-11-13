# Validación de entrega

Entorno de comprobación: Node 24.22.1, npm 11.9.0. Versiones exactas de dependencias en package-lock.json.

## Comprobaciones ejecutadas

- `npm run typecheck`: TypeScript estricto, sin errores.
- `npm run lint`: ESLint sin errores.
- `npm run test`: 39 pruebas, 4 archivos, todas correctas.
- `npm run build`: compilación de producción generada en `dist`.
- `npm run format:check`: formato verificado con Prettier.

## Cobertura

- Base legal, validez del correo, exclusiones y supresión por correo o dominio.
- Revocación de aprobación y huella al editar.
- Ausencia de datos frente a ceros reales y tasas sin denominador.
- CSV con comillas, comas y saltos de línea; omisión de duplicados.
- Fechas en Bogotá y moneda colombiana.
- Flujos REST: aprobación, rechazo, edición versionada, importación, descubrimiento, inscripciones, baja y conversión a cliente.
- Tres flujos de interfaz con Testing Library: aprobar propuesta, importar CSV y aceptar resultado. Verifican que no se mute antes de confirmar.
- Dieciséis pruebas de renderizado de pantallas y fichas con respuestas validadas de la API simulada. Los gráficos se sustituyen en estas pruebas por un componente de prueba, de modo que no verifican píxeles de Chart.js.

## Límite de la comprobación

Se intentó abrir Chromium para una revisión visual, pero el entorno impidió crear los sockets del proceso del navegador (`Operation not permitted`). Por tanto, **no se afirma una revisión visual manual ni un recorrido E2E en navegador real**. Las pantallas sí se renderizaron en JSDOM mediante Testing Library, y la aplicación compiló con Vite.

La autenticación e integraciones reales no se probaron porque pertenecen al backend futuro, fuera del alcance. La accesibilidad se implementó con controles nativos, foco y etiquetas; no se afirma una certificación WCAG independiente.
