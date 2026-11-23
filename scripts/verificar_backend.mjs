// Verificación previa al despliegue en Vercel (npm run build:vercel).
// Comprueba la variable del entorno, el modo de la compilación y que el backend
// de ESTE entorno responda antes de publicar el frontend.
// vercel.json usa este valor tal cual en cada petición ($NEXUS_BACKEND_URL/api/…), así que
// aquí no se corrige: una barra final o un espacio romperían las rutas en producción.
const destino = process.env.NEXUS_BACKEND_URL ?? "";
const entorno = process.env.VERCEL_ENV ?? "local";
const errores = [];

if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(destino))
  errores.push(
    "NEXUS_BACKEND_URL debe ser una URL https sin ruta, sin barra final ni espacios (p. ej. https://mi-backend.up.railway.app).",
  );
if (process.env.VITE_USE_MOCKS === "true" && entorno === "production")
  errores.push(
    "VITE_USE_MOCKS=true no se permite en producción: publicaría la demostración.",
  );
const api = process.env.VITE_API_URL;
if (api && api !== "/api")
  errores.push(
    "VITE_API_URL debe quedar vacía o en /api: el navegador usa el mismo dominio y Vercel reenvía al backend.",
  );

if (!errores.length && process.env.NEXUS_OMITIR_VERIFICACION !== "1") {
  try {
    const r = await fetch(`${destino}/health`, {
      signal: AbortSignal.timeout(15000),
    });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok || cuerpo.estado !== "ok")
      errores.push(
        `${destino}/health respondió ${r.status}; el backend o su base de datos no están listos.`,
      );
  } catch (e) {
    errores.push(
      `No se pudo consultar ${destino}/health (${e instanceof Error ? e.message : e}).`,
    );
  }
}

if (errores.length) {
  console.error(
    `\n✗ Despliegue detenido (${entorno}):\n  - ${errores.join("\n  - ")}\n`,
  );
  console.error(
    "Defina las variables en Vercel → Settings → Environment Variables para este entorno.\n" +
      "Solo si el backend aún no está publicado puede usar NEXUS_OMITIR_VERIFICACION=1.\n",
  );
  process.exit(1);
}
console.log(
  `✓ Entorno ${entorno}: el frontend usará ${destino} (vía /api, /baja, /r y /health).`,
);
