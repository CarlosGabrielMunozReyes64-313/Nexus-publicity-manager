// Comprobación posterior al despliegue: node scripts/verificar_despliegue.mjs https://su-app.vercel.app
// Verifica que cada ruta llegue al backend correcto y que la aplicación cargue.
const base = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!/^https?:\/\/[^/]+$/.test(base)) {
  console.error(
    "Uso: node scripts/verificar_despliegue.mjs https://su-dominio",
  );
  process.exit(2);
}
const pruebas = [
  [
    "Salud del backend",
    "/health",
    (r, t) => r.status === 200 && t.includes('"ok"'),
  ],
  [
    "API sin sesión responde JSON 401",
    "/api/auth/session",
    (r, t) => r.status === 401 && t.includes("message"),
  ],
  [
    "Enlace de baja inválido lo atiende el backend",
    "/baja/enlace-de-prueba",
    (r, t) => r.status === 400 && t.includes("No pudimos procesar"),
  ],
  [
    "Seguimiento de clics redirige",
    "/r/referencia-de-prueba",
    (r) => r.status === 302,
  ],
  [
    "La aplicación carga",
    "/configuracion",
    (r, t) => r.status === 200 && t.includes('id="root"'),
  ],
];
let fallos = 0;
for (const [nombre, ruta, ok] of pruebas) {
  try {
    const r = await fetch(base + ruta, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const texto = await r.text();
    const bien = ok(r, texto);
    fallos += bien ? 0 : 1;
    console.log(`${bien ? "✓" : "✗"} ${nombre} (${ruta} → ${r.status})`);
  } catch (e) {
    fallos += 1;
    console.log(`✗ ${nombre} (${ruta}): ${e instanceof Error ? e.message : e}`);
  }
}
process.exit(fallos ? 1 : 0);
