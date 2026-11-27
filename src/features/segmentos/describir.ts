import { esGrupo, type ReglaSegmento } from "../../types";

const OPS: Record<string, string> = {
  es: "es",
  no_es: "no es",
  contiene: "contiene",
  mayor_que: ">",
  menor_que: "<",
};
/** «municipio es Palmira Y (sector contiene agro O hizoClic es si)». */
export function describirReglas(
  reglas: ReglaSegmento[],
  union = " Y ",
): string {
  return reglas
    .map((r) => {
      if (esGrupo(r))
        return (
          "(" + describirReglas(r.reglas, r.grupo === "o" ? " O " : " Y ") + ")"
        );
      if (r.campo === "contactoIds")
        return `${r.valor.split(",").filter(Boolean).length} contactos elegidos`;
      return `${r.campo} ${OPS[r.operador] ?? r.operador} ${r.valor}`;
    })
    .join(union);
}
