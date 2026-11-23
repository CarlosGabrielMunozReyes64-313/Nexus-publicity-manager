// Verificación previa al despliegue en Vercel (npm run build:vercel).
// Comprueba la variable del entorno, el modo de la compilación y que el backend
// de ESTE entorno responda antes de publicar el frontend.
// vercel.json usa este valor tal cual en cada petición ($NEXUS_BACKEND_URL/api/…), así que
// aquí no se corrige: una barra final o un espacio romperían las rutas en producción.
const destino = process.env.NEXUS_BACKEND_URL ?? "";
const entorno = process.env.VERCEL_ENV ?? "local";
const NOMBRES = { production: "Production", preview: "Preview" };
const errores = [];

/** Explica qué tiene mal el valor y cuál es el valor correcto para pegar en Vercel. */
function problemasDelDestino(valor) {
  if (!valor.trim())
    return [
      `NEXUS_BACKEND_URL no está definida para ${NOMBRES[entorno] ?? entorno}. ` +
        "Agréguela en Vercel → Settings → Environment Variables marcando ese entorno " +
        "(sin «Sensitive») y vuelva a desplegar. Ejemplo: https://mi-backend.up.railway.app",
    ];
  if (/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(valor)) return [];
  const motivos = [];
  if (valor !== valor.trim())
    motivos.push("tiene espacios al inicio o al final");
  let texto = valor.trim();
  if (/^http:\/\//i.test(texto)) {
    motivos.push("usa http:// en vez de https://");
    texto = texto.replace(/^http:/i, "https:");
  } else if (!/^https:\/\//i.test(texto)) {
    motivos.push("le falta https:// al inicio");
    texto = `https://${texto}`;
  }
  let sugerido = "";
  try {
    const u = new URL(texto);
    if (u.pathname !== "/" || u.search || u.hash)
      motivos.push(`incluye una ruta («${u.pathname}${u.search}${u.hash}»)`);
    else if (texto.endsWith("/")) motivos.push("termina en /");
    sugerido = u.origin;
  } catch {
    motivos.push("no es una dirección web válida");
  }
  return [
    `NEXUS_BACKEND_URL («${valor}») ${motivos.join(", ")}. ` +
      (sugerido
        ? `Cámbiela en Vercel a exactamente: ${sugerido}`
        : "Use la dirección pública del backend, por ejemplo https://mi-backend.up.railway.app") +
      " y vuelva a desplegar. Vercel la usa tal cual en cada petición a /api.",
  ];
}

errores.push(...problemasDelDestino(destino));
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
