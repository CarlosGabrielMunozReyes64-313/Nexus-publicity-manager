# NEXUS · Publicity Manager

Frontend interno para NEXUS Innovación: contactos B2B, investigación simulada, propuestas revisadas por el administrador y seguimiento comercial. Interfaz en español de Colombia.

## Inicio rápido

Requisitos: **Node.js 22.12 o superior** (también Node 24) y npm. Necesitas conexión a Internet para instalar las dependencias una primera vez.

```bash
npm ci
npm run dev
```

Abre la dirección que muestra Vite (normalmente `http://localhost:5173`). Pulsa **Iniciar sesión con Google**: en modo demostración entra directamente, sin cuenta ni conexión a Google.

El archivo `.env` ya activa los mocks:

```dotenv
VITE_API_URL=http://localhost:8000/api
VITE_USE_MOCKS=true
```

**El estado simulado vive en memoria. Recargar la página restaura los datos.** Navega con la barra lateral y los enlaces internos para conservar los cambios durante la sesión. También puedes reiniciar desde Configuración → Opciones de desarrollo.

## Qué contiene este ZIP

- Código fuente de las 13 pantallas y fichas de detalle.
- Cliente `fetch` con errores tipados, esquemas Zod y hooks de React Query.
- MSW, su service worker y un contrato REST con mutaciones en memoria y auditoría.
- 25 empresas, 60 contactos, 2 campañas, 8 respuestas, 5 oportunidades, 2 búsquedas, propuestas de los cuatro agentes, 50 acciones iniciales y 90 días de métricas.
- `dist/`: versión compilada lista para servir por HTTP.
- `package-lock.json`: instalación reproducible.
- Pruebas unitarias y de interfaz, ejemplo CSV, decisiones y contrato de integración.
- `ESPECIFICACION.md`: documento que dio origen a la implementación.

No se distribuye `node_modules`: npm lo reconstruye desde el archivo de bloqueo. No abras `dist/index.html` mediante `file://`; los módulos, las rutas y MSW necesitan un servidor HTTP.

## Comandos

```bash
npm run dev          # desarrollo
npm run typecheck    # TypeScript estricto
npm run test         # Vitest, 39 pruebas
npm run lint         # ESLint
npm run format:check # Prettier
npm run format       # aplicar formato
npm run build        # TypeScript + producción en dist/
npm run preview      # servir la compilación
```

Si el sistema impide enumerar las interfaces de red, utiliza:

```bash
npm run dev -- --host 127.0.0.1
```

## Recorrido para probar

1. Entra al panel y revisa los indicadores, las tareas y el embudo.
2. Contactos → Importar CSV → carga `ejemplos/contactos.csv`. Mapea nombre/correo, selecciona empresa, origen y base legal; previsualiza y confirma. Se omiten duplicados y filas inválidas.
3. Abre un contacto: consulta sus evidencias, registra la prueba legal y apruébala. Importar nunca verifica un correo ni aprueba una base legal automáticamente.
4. Empresas → Duplicados: compara las dos fichas, selecciona los campos y confirma la fusión.
5. Descubrimiento → acepta Envases Guayacán: se crea una empresa y un contacto corporativo sin aprobación legal ni verificación de correo. El resultado que coincide con Samán está bloqueado por posible duplicado.
6. Segmentos → abre Industria de Palmira, revisa las reglas, la muestra y su aprobación.
7. Propuestas → abre la campaña RSE Express, revisa destinatarios, contenido, evidencias y versiones. Aprobar muestra una confirmación. Rechazar exige un motivo.
8. Secuencias → edita y reordena los pasos; guarda para revisión. Las campañas asociadas se pausan y reciben una propuesta nueva o una versión adicional.
9. Campañas → revisa las inscripciones. Reanudar no reactiva contactos que respondieron, pidieron baja, tuvieron una reunión o se convirtieron en clientes.
10. Respuestas → revisa el borrador antes de confirmar su envío simulado. Cambiar una clasificación a baja suprime inmediatamente al contacto.
11. Embudo → mueve una oportunidad a Cliente: la confirmación retira de las secuencias a todos los contactos de la empresa.
12. Informes → filtra fechas y grupos; registra un costo para probar la cobertura de los indicadores.
13. Configuración → prueba la desconexión simulada de Gmail y los límites. Auditoría → filtra y exporta el registro.

Todos los datos, dominios `.example`, pruebas legales e integraciones son ficticios. No hay scraping, llamadas a Gmail/Google/Meta/Claude ni correos reales.

## Cambiar a una API real

Con un backend compatible con `API.md`, cambia **solo** `VITE_USE_MOCKS=false`. `VITE_API_URL` ya apunta al backend local; ajústala si tu backend está en otra dirección. Reinicia Vite o reconstruye `dist` después de cambiar variables.

El frontend deja de iniciar MSW y usa los mismos endpoints y esquemas. La API debe implementar sesión y autorización reales, CORS para el origen del frontend, cookies seguras y las mismas validaciones de negocio en el servidor. No se incluye ese backend, conforme al alcance solicitado.

Para servir `dist`, configura fallback de rutas a `index.html` y usa HTTPS o localhost para MSW. Si cambias a un despliegue sin mocks, elimina cualquier service worker de demostración anterior desde las herramientas del navegador.

## Estructura

- `src/app`: rutas diferidas, sesión y layout.
- `src/api`: transporte, esquemas y hooks por módulo.
- `src/mocks`: ejemplos y handlers con estado transaccional en memoria.
- `src/types`: modelo de dominio completo.
- `src/components/ui`: componentes, tablas, diálogos y notificaciones.
- `src/features`: módulos de la aplicación.
- `src/lib`: reglas puras, CSV y formato Colombia.
- `src/styles`: tokens y estilos comunes; CSS Modules en layout y componentes.

Ver `DECISIONES.md` y `VALIDACION.md` para los detalles de implementación y verificación.
