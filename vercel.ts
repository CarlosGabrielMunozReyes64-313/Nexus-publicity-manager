/**
 * Configuración de Vercel por entorno (sustituye al antiguo vercel.json).
 *
 * El destino del backend ya no está fijo en el repositorio: se lee de la variable
 * NEXUS_BACKEND_URL, que se define por separado en Vercel → Settings → Environment
 * Variables para Production y para Preview. Si falta o no es una URL https sin ruta,
 * el despliegue se detiene: una copia de pruebas nunca apunta por error al servidor
 * de producción. Antes de compilar, scripts/verificar_backend.mjs comprueba además
 * que ese backend responda en /health.
 */
const destino = (process.env.NEXUS_BACKEND_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(destino)) {
  throw new Error(
    "Defina NEXUS_BACKEND_URL (por ejemplo https://mi-backend.up.railway.app) " +
      "en Vercel para este entorno. Use un backend distinto para Preview y Production.",
  );
}

/** Rutas que atiende el backend: API, bajas, enlaces de seguimiento y salud. */
const proxy = (prefijo: string) => ({
  source: `${prefijo}/:path*`,
  destination: `${destino}${prefijo}/:path*`,
});
// Respuestas por usuario: el CDN nunca debe guardarlas en caché.
const sinCache = (source: string) => ({
  source,
  headers: [{ key: "x-vercel-enable-rewrite-caching", value: "0" }],
});

export const config = {
  framework: "vite",
  buildCommand: "npm run build:vercel",
  outputDirectory: "dist",
  rewrites: [
    proxy("/api"),
    { source: "/health", destination: `${destino}/health` },
    proxy("/baja"),
    proxy("/r"),
    // Aplicación de una sola página: el resto de rutas sirve index.html.
    { source: "/(.*)", destination: "/index.html" },
  ],
  headers: [
    sinCache("/api/:path*"),
    sinCache("/baja/:path*"),
    sinCache("/r/:path*"),
    sinCache("/health"),
    {
      source: "/index.html",
      headers: [{ key: "Cache-Control", value: "no-cache" }],
    },
  ],
};

export default config;
