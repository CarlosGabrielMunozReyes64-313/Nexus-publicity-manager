import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const destino = env.VITE_PROXY_DESTINO || "http://localhost:8000";
  // En desarrollo con la API real, el navegador habla con Vite (mismo origen) y Vite
  // reenvía /api, /baja, /r y /health al backend local; las cookies de sesión funcionan.
  const proxy = Object.fromEntries(
    ["/api", "/baja", "/r", "/health"].map((ruta) => [
      ruta,
      { target: destino, changeOrigin: false },
    ]),
  );
  return {
    plugins: [react()],
    server: { proxy },
    preview: { proxy },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
      restoreMocks: true,
      // Las pruebas no dependen del .env local del desarrollador: siempre usan la
      // ruta relativa /api (el fetch simulado la resuelve contra location) y deciden
      // el modo por sí mismas.
      env: { VITE_USE_MOCKS: "false", VITE_API_URL: "/api" },
    },
  };
});
