// Valida con los esquemas Zod del frontend las respuestas reales guardadas por pytest.
// Uso: npx tsx scripts/validar_contrato.ts [ruta/a/contratos.json]
import { existsSync, readFileSync } from "node:fs";
import * as S from "../src/api/schemas";
const candidatos = [
  process.argv[2],
  process.env.CONTRATOS_JSON,
  "../Nexus-publicity-manager-bakend-main/pruebas/salidas/contratos.json",
  "../pruebas/salidas/contratos.json",
].filter((x): x is string => Boolean(x));
const ruta = candidatos.find((x) => existsSync(x));
if (!ruta)
  throw new Error(
    "No se encontró contratos.json. Ejecute pytest en el backend o indique la ruta.",
  );
const schemas = S as unknown as Record<
  string,
  {
    parse: (v: unknown) => unknown;
    array: () => { parse: (v: unknown) => unknown };
  }
>;
const records = JSON.parse(readFileSync(ruta, "utf8"));
for (const r of records) {
  const schema = schemas[r.schema + "Schema"];
  if (!schema) throw new Error("Esquema desconocido: " + r.schema);
  (r.array ? schema.array() : schema).parse(r.data);
  console.log("OK " + r.ruta);
}
console.log(
  records.length + " respuestas reales validadas con Zod (" + ruta + ")",
);
