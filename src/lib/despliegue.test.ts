import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getTransformedRoutes, rewritesSchema } from "@vercel/routing-utils";

// Punto 23: el destino del backend depende del entorno y nunca queda fijo.
// vercel.json es estático: Vercel valida en su lado un vercel.ts que calcula el destino
// con process.env y lo rechaza («rewrites[0] missing required property destination»).
const raiz = resolve(__dirname, "../..");
type Reescritura = {
  source: string;
  destination: string;
  env?: string[];
  respectOriginCacheControl?: boolean;
};
const config = JSON.parse(
  readFileSync(resolve(raiz, "vercel.json"), "utf8"),
) as {
  buildCommand: string;
  outputDirectory: string;
  rewrites: Reescritura[];
};

describe("Configuración de Vercel por entorno", () => {
  it("reenvía API, salud, bajas y seguimiento al backend de cada despliegue, sin caché", () => {
    expect(config.rewrites.map((r) => [r.source, r.destination])).toEqual([
      ["/api/:path*", "$NEXUS_BACKEND_URL/api/:path*"],
      ["/health", "$NEXUS_BACKEND_URL/health"],
      ["/baja/:path*", "$NEXUS_BACKEND_URL/baja/:path*"],
      ["/r/:path*", "$NEXUS_BACKEND_URL/r/:path*"],
      ["/(.*)", "/index.html"],
    ]);
    for (const r of config.rewrites.slice(0, 4)) {
      expect(r.env).toEqual(["NEXUS_BACKEND_URL"]);
      expect(r.respectOriginCacheControl).toBe(false);
    }
    // Ninguna dirección fija: ni producción ni otro servidor.
    expect(JSON.stringify(config.rewrites)).not.toMatch(/https?:\/\//);
    expect(config.buildCommand).toBe("npm run build:vercel");
    expect(config.outputDirectory).toBe("dist");
  });

  it("cumple el esquema oficial de Vercel y su normalizador de rutas lo acepta", () => {
    const { properties, required } = rewritesSchema.items;
    for (const r of config.rewrites) {
      for (const k of required) expect(r).toHaveProperty(k);
      for (const k of Object.keys(r))
        expect(Object.keys(properties)).toContain(k);
    }
    const { error, routes } = getTransformedRoutes(config);
    expect(error).toBeNull();
    const api = routes?.find(
      (x) => "dest" in x && String(x.dest).includes("/api/"),
    );
    expect(api).toMatchObject({
      dest: "$NEXUS_BACKEND_URL/api/$1",
      env: ["NEXUS_BACKEND_URL"],
    });
  });

  it("detiene la compilación si el entorno no define bien su backend", () => {
    const correr = (valor: string) => {
      try {
        execFileSync("node", ["scripts/verificar_backend.mjs"], {
          cwd: raiz,
          env: {
            ...process.env,
            NEXUS_BACKEND_URL: valor,
            NEXUS_OMITIR_VERIFICACION: "1",
            VERCEL_ENV: "preview",
          },
          stdio: "pipe",
        });
        return "ok";
      } catch (e) {
        return String((e as { stderr?: Buffer }).stderr);
      }
    };
    expect(correr("https://pruebas-nexus.example")).toBe("ok");
    expect(correr("")).toContain(
      "NEXUS_BACKEND_URL no está definida para Preview",
    );
    const casos: [string, string][] = [
      ["https://pruebas-nexus.example/", "termina en /"],
      [" https://pruebas-nexus.example", "tiene espacios"],
      ["http://pruebas-nexus.example", "usa http://"],
      ["pruebas-nexus.example", "le falta https://"],
      ["https://pruebas-nexus.example/api", "incluye una ruta («/api»)"],
    ];
    for (const [malo, motivo] of casos) {
      const salida = correr(malo);
      expect(salida).toContain(motivo);
      // Siempre dice el valor exacto que hay que poner.
      expect(salida).toContain(
        "Cámbiela en Vercel a exactamente: https://pruebas-nexus.example",
      );
    }
  });
});
