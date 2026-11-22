import { afterEach, describe, expect, it, vi } from "vitest";
// Punto 23: el destino del backend depende del entorno y nunca queda fijo.
describe("Configuración de Vercel por entorno", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("reenvía API, bajas, seguimiento y salud al backend del entorno", async () => {
    vi.stubEnv("NEXUS_BACKEND_URL", "https://pruebas-nexus.example/");
    const { config } = await import("../../vercel");
    const destinos = config.rewrites.map((r) => r.destination);
    expect(destinos).toEqual([
      "https://pruebas-nexus.example/api/:path*",
      "https://pruebas-nexus.example/health",
      "https://pruebas-nexus.example/baja/:path*",
      "https://pruebas-nexus.example/r/:path*",
      "/index.html",
    ]);
    expect(JSON.stringify(config)).not.toContain("railway.app");
    expect(config.buildCommand).toBe("npm run build:vercel");
  });
  it("detiene el despliegue si el entorno no define su backend", async () => {
    vi.stubEnv("NEXUS_BACKEND_URL", "");
    await expect(import("../../vercel")).rejects.toThrow("NEXUS_BACKEND_URL");
    vi.resetModules();
    vi.stubEnv("NEXUS_BACKEND_URL", "http://inseguro.example/api");
    await expect(import("../../vercel")).rejects.toThrow("NEXUS_BACKEND_URL");
  });
});
