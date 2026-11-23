# NEXUS · Publicity Manager (frontend)

Frontend interno para NEXUS Innovación: contactos B2B, investigación con evidencia, propuestas revisadas por el administrador y seguimiento comercial. Interfaz en español de Colombia.

Funciona en dos modos, que la interfaz indica en la franja superior:

| Modo             | `VITE_USE_MOCKS` | Qué ocurre                                                                                                                                                                       |
| ---------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Demostración** | `true`           | Datos ficticios en memoria (MSW). No hay correos, llamadas a Google, Gmail ni IA.                                                                                                |
| **API real**     | `false`          | Cada acción llega al backend: puede revocar permisos, pausar campañas, enviar correos o consumir presupuesto de IA. Las confirmaciones explican el efecto real antes de aceptar. |

## Requisitos

Node.js 22.12 o superior (también Node 24) y npm. La primera instalación necesita Internet.

## Probar la demostración

El ZIP no incluye `.env` ni `dist/` (se generan en su equipo). Desde esta carpeta:

```bash
npm ci
cp .env.example .env        # Windows: copy .env.example .env
npm run dev
```

`.env.example` ya trae `VITE_USE_MOCKS=true`. Abra la dirección que muestra Vite (normalmente `http://localhost:5173`) y pulse **Iniciar sesión con Google**: en la demostración entra directamente, sin cuenta.

El estado vive en memoria: recargar la página restaura los datos (también desde Configuración → Opciones de desarrollo). Si el sistema impide enumerar las interfaces de red, use `npm run dev -- --host 127.0.0.1`.

## Usar el backend real en desarrollo

1. Arranque el backend (carpeta `Nexus-publicity-manager-bakend-main`, ver su README) y, en su `.env`, defina `APP_URL=http://localhost:5173` para que el inicio de sesión y la protección de origen acepten a Vite.
2. En el `.env` de esta carpeta ponga `VITE_USE_MOCKS=false` y deje `VITE_API_URL=/api`.
3. Reinicie `npm run dev`. Vite reenvía `/api`, `/baja`, `/r` y `/health` al backend (`VITE_PROXY_DESTINO`, por defecto `http://localhost:8000`), así que navegador y API comparten origen y la cookie de sesión funciona sin CORS.

Si antes usó la demostración en el mismo origen, elimine el service worker de MSW desde las herramientas del navegador (Aplicación → Service workers).

## Compilar

```bash
VITE_USE_MOCKS=false npm run build      # PowerShell: $env:VITE_USE_MOCKS="false"; npm run build
```

Genera `dist/` (TypeScript estricto + Vite). Las variables `VITE_*` se fijan en la compilación: cambie el `.env` y vuelva a compilar. `dist/` debe servirse por HTTP con todas las rutas desconocidas apuntando a `index.html`; no lo abra con `file://`.

- **Docker (todo en un contenedor):** el `docker-compose.yml` del backend compila esta carpeta automáticamente.
- **Backend sin Docker:** compile aquí y en el `.env` del backend defina `FRONTEND_DIST=../Nexus-publicity-manager-main/dist` (lo escribe `python scripts/entorno_desarrollo.py`).
- `npm run preview` sirve la compilación localmente con el mismo proxy de desarrollo.

## Desplegar en Vercel

`vercel.json` es estático y **no contiene ninguna dirección fija**. Sus reescrituras usan `$NEXUS_BACKEND_URL`, que Vercel sustituye en cada petición con el valor de la variable del despliegue (propiedad `env` de cada reescritura). Así, cada entorno llega a su propio backend.

1. Vercel → Settings → Environment Variables:
   - `NEXUS_BACKEND_URL` = `https://su-backend-de-produccion…` solo para **Production**.
   - `NEXUS_BACKEND_URL` = `https://su-backend-de-pruebas…` solo para **Preview**.
   - Escríbala sin barra final ni espacios.
   - **No la marque como «Sensitive»**: Vercel no pasa el valor de una variable sensible a las reescrituras, y cada llamada a `/api` fallaría. No es un secreto, porque es la dirección pública del backend.
   - Si cambia la variable, vuelva a desplegar: el valor queda fijo en cada despliegue.
   - No defina `VITE_USE_MOCKS=true` en producción ni cambie `VITE_API_URL` (debe quedar vacía o en `/api`).
2. Despliegue. El comando `npm run build:vercel` comprueba la variable y que `NEXUS_BACKEND_URL/health` responda antes de compilar; si algo falta, el despliegue se detiene en lugar de apuntar a otro servidor. Solo si el backend aún no está publicado puede definir `NEXUS_OMITIR_VERIFICACION=1`.
3. Tras desplegar, verifique las rutas: `npm run verificar:despliegue -- https://su-app.vercel.app` (salud, API, bajas, seguimiento y carga de la aplicación).

En el backend de cada entorno, `APP_URL` debe ser el dominio público de Vercel de ese entorno (las mutaciones verifican el origen y Google redirige a esa dirección). Las respuestas de `/api`, `/baja`, `/r` y `/health` no se guardan en la caché de Vercel.

## Comandos

```bash
npm run dev                   # desarrollo
npm run typecheck             # TypeScript estricto
npm test                      # Vitest
npm run lint                  # ESLint
npm run format:check          # Prettier
npm run build                 # producción en dist/
npm run preview               # servir la compilación
npm run build:vercel          # verificación + compilación (Vercel)
npm run verificar:despliegue -- https://su-app.vercel.app
```

`npm test` no necesita variables ni depende de su `.env`: la configuración de pruebas fija `VITE_API_URL=/api` y el modo de la API real, y cada prueba simula las respuestas del servidor.

## Recorrido para probar (demostración)

1. Panel: indicadores, tareas y embudo.
2. Contactos → Importar CSV → `ejemplos/contactos.csv`. Mapee nombre/correo, elija empresa, origen y base legal, previsualice y confirme. Cambiar cualquiera de esas opciones obliga a previsualizar de nuevo; al terminar se muestra cuántas filas se crearon, omitieron y rechazaron.
3. Abra un contacto: evidencias, prueba legal y aprobación. Importar nunca verifica un correo ni aprueba una base legal.
4. Empresas → Duplicados: compare, fusione o marque «No es duplicado».
5. Descubrimiento: acepte un resultado; el que coincide con una empresa existente queda bloqueado.
6. Segmentos, Secuencias de correo y Campañas: aprobar no envía; activar sí (en la API real). En Secuencias de correo, guardar crea un borrador y lo aprobado se sigue enviando hasta aprobar los cambios.
7. Respuestas: revise el borrador antes de enviar. Crear oportunidad la vincula con la respuesta y su campaña.
8. Embudo: mover una oportunidad a Cliente retira a sus contactos de las secuencias.
9. Informes: elija el periodo; el embudo de esa pestaña sigue las mismas fechas. Registre un costo con su fecha real.
10. Configuración → Integraciones: cada botón explica qué ocurrirá. Auditoría: los filtros se aplican en el servidor y la exportación incluye todas las coincidencias.

## Estructura

- `src/app`: rutas diferidas, sesión (distingue sesión vencida de caída del servidor) y layout.
- `src/api`: transporte, esquemas Zod y hooks.
- `src/mocks`: datos y handlers en memoria del modo demostración.
- `src/types`: modelo de dominio.
- `src/components/ui`: componentes, tablas, diálogos y notificaciones.
- `src/features`: pantallas.
- `src/lib`: reglas puras, CSV, fechas de Bogotá y modo activo.
- `scripts`: verificación de despliegue y validación del contrato con respuestas reales.
- `vercel.json`: rutas de Vercel; el backend sale de `NEXUS_BACKEND_URL` de cada despliegue.

Ver `DECISIONES.md` y `VALIDACION.md`.
