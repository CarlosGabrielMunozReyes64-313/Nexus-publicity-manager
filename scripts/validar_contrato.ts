import { readFileSync } from 'node:fs';
import * as S from '../src/api/schemas';
const schemas = S as Record<string, { parse: (v: unknown) => unknown; array: () => {parse:(v:unknown)=>unknown} }>;
const records = JSON.parse(readFileSync('../pruebas/salidas/contratos.json','utf8'));
for (const r of records) {
 const schema = schemas[r.schema+'Schema'];
 if (!schema) throw new Error('Esquema desconocido: '+r.schema);
 (r.array ? schema.array() : schema).parse(r.data);
 console.log('OK '+r.ruta);
}
console.log(records.length+' respuestas reales validadas con Zod');
