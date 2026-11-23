# Validación de entrega — 22 de noviembre de 2026

Entorno de comprobación: Node 22.23.5, npm 10.9.9, Chrome for Testing 153 con Playwright. Versiones exactas de dependencias en package-lock.json.

## Comprobaciones ejecutadas

- **`npm run typecheck`:** TypeScript estricto, sin errores.
- **`npm run lint`:** ESLint sin errores.
- **`npm run format:check`:** Prettier sin diferencias.
- **23 de noviembre de 2026, aprobación automática de la base legal:** `npm test` 100 pruebas en 12 archivos, todas correctas (3 nuevas en `src/features/configuracion/cumplimiento.test.tsx`: apagada por defecto, al encenderla aprueba solo los que tienen prueba publicada, se puede apagar sin deshacer lo aprobado, y verificar un correo con la política encendida aprueba la base). Contrato: 69 respuestas reales validadas, incluida `configuracion/cumplimiento`. Typecheck, ESLint, Prettier y compilación sin errores.
- **`npm test`:** 95 pruebas en 10 archivos, todas correctas. Las nuevas:
  - `src/features/secuencias/editor/editor.test.tsx` (21);
  - `src/features/secuencias/lista.test.tsx` (10);
  - `src/features/sin-propuestas.test.tsx` (5);
  - el escenario de 9 pasos y la validación Zod de todas las respuestas nuevas en `src/mocks/flows.test.ts`.
  - Las pruebas que dependían de Propuestas se actualizaron a la pantalla nueva.
- **`VITE_USE_MOCKS=false npm run build`:** compilación de producción. El editor con formato (TipTap) va en un archivo aparte, de unos 133 kB comprimidos, que solo se descarga al usarlo.
- **Contrato:** 68 respuestas reales del backend (guardadas por pytest) validadas con los esquemas Zod (`scripts/validar_contrato.ts`), 28 de ellas de las rutas del editor.
- **Recorrido de 9 pasos en Chrome contra la API y la base reales** (solo la IA y Gmail simulados): pedir a la IA, abrir, editar el correo 2, vista previa con un contacto real, enviar una prueba, aprobar, activar la campaña, editar otra vez (se sigue enviando lo aprobado) y aprobar y reanudar. Además: «Mejorar con IA», texto con formato e historial. No hubo errores en la consola.
- **Modo demostración en Chrome:** lista, editor, texto con formato (negrita, listas, variables, vista previa aislada) y «Mejorar con IA», sin errores en la consola.
- **Celular (390 px):** la lista y el editor se leen sin desplazamiento horizontal.
- **Navegador real:** las 13 pantallas con la API real; `/propuestas` lleva a `/secuencias`.
- **Despliegue en Vercel:** `vercel.json` pasa el esquema y el normalizador de rutas oficiales de Vercel (`@vercel/routing-utils` 6.6.1). Las reescrituras al backend usan `$NEXUS_BACKEND_URL`, sin direcciones fijas. `npm run build:vercel` se detiene si la variable falta, trae barra final o espacios, no es https o lleva una ruta. No se pudo desplegar en Vercel desde aquí: confírmelo con el siguiente despliegue y `npm run verificar:despliegue`.
- **Arranque desde los ZIP:** `scripts/probar_arranque.py` del backend ejecuta `npm ci`, `npm test` y `npm run build` sobre la copia extraída.

## Cobertura nueva

- **Sin Propuestas:**
  - el menú no la tiene y las rutas antiguas redirigen;
  - el contador «Secuencias por aprobar» y su tarjeta en el Panel;
  - «Datos sugeridos por la IA» en Empresas, las mejoras en Informes y los pedidos en Segmentos.
- **Lista:**
  - estado, segmento, métricas, búsqueda, filtro y archivadas;
  - solicitudes con consulta cada 15 s solo si hay alguna activa, y reintento;
  - «Nueva con IA» con validación y errores del servidor;
  - «Nueva en blanco», que abre el editor;
  - duplicar y archivar.
- **Editor:**
  - agregar, duplicar, reordenar (también con botones) y eliminar correos;
  - insertar variables;
  - guardar con botón y con Ctrl+S, y que la versión sube sin aprobar nada;
  - errores por correo y Aprobar bloqueado con su motivo;
  - el aviso del borrador;
  - la confirmación al salir y la copia local con «Recuperar»;
  - la vista previa con un contacto real y los cambios sin guardar;
  - la lista de verificación;
  - el historial con comparación y restauración;
  - los diálogos de aprobar (con y sin «Aprobar y reanudar») y de enviar prueba (incluido Gmail desconectado);
  - pedir otra versión a la IA.
- **Texto con formato:**
  - variables como fichas y vuelta a `{{x}}`;
  - lista blanca;
  - texto simple derivado;
  - `iframe` con `sandbox` vacío;
  - lo que se guarda.
- **Mejorar con IA:** se envía solo la instrucción y la secuencia en pantalla; la sugerencia se compara, se usa sin guardar o se descarta.

## Límite de la comprobación

No se probaron cuentas reales de Google, Gmail, Claude o Gemini, ni un despliegue real en Vercel. La accesibilidad se implementó con controles nativos, foco y etiquetas; no se afirma una certificación WCAG independiente. `npm audit --omit=dev` informa una alerta alta de zod 3 (memoria con colecciones enormes) que ya existía; corregirla exige pasar a zod 4.
