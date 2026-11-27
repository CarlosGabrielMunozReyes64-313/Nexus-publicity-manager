import { useEffect, useState } from "react";
import { z } from "zod";
import { request } from "../../api/client";
import * as S from "../../api/schemas";
import { Button } from "../../components/ui";
import {
  esGrupo,
  type GrupoReglas,
  type ReglaSegmento,
  type ReglaSimple,
} from "../../types";
import { Select } from "../shared";

type Tipo = "texto" | "numero" | "opciones" | "comportamiento" | "lista";
/** Atributos que guarda NEXUS y comportamientos respaldados por eventos registrados. */
export const CAMPOS: {
  campo: string;
  etiqueta: string;
  tipo: Tipo;
  grupo: "Atributos" | "Comportamiento";
  opciones?: readonly string[];
}[] = [
  {
    campo: "municipio",
    etiqueta: "Municipio de la empresa",
    tipo: "texto",
    grupo: "Atributos",
  },
  {
    campo: "sector",
    etiqueta: "Sector de la empresa",
    tipo: "texto",
    grupo: "Atributos",
  },
  {
    campo: "tamano",
    etiqueta: "Tamaño de la empresa",
    tipo: "opciones",
    grupo: "Atributos",
    opciones: ["1-10", "11-50", "51-200", "200+", "desconocido"],
  },
  {
    campo: "puntaje",
    etiqueta: "Puntaje de ajuste",
    tipo: "numero",
    grupo: "Atributos",
  },
  {
    campo: "estadoCuenta",
    etiqueta: "Estado de la cuenta",
    tipo: "opciones",
    grupo: "Atributos",
    opciones: ["prospecto", "cliente"],
  },
  { campo: "cargo", etiqueta: "Cargo", tipo: "texto", grupo: "Atributos" },
  {
    campo: "dominioCorreo",
    etiqueta: "Dominio del correo",
    tipo: "texto",
    grupo: "Atributos",
  },
  {
    campo: "estadoCorreo",
    etiqueta: "Estado del correo",
    tipo: "opciones",
    grupo: "Atributos",
    opciones: ["valido", "riesgoso", "invalido", "desconocido", "catch_all"],
  },
  {
    campo: "etapa",
    etiqueta: "Etapa",
    tipo: "opciones",
    grupo: "Atributos",
    opciones: S.etapaSchema.options,
  },
  {
    campo: "origen",
    etiqueta: "Origen",
    tipo: "opciones",
    grupo: "Atributos",
    opciones: S.origenSchema.options,
  },
  {
    campo: "baseLegal",
    etiqueta: "Base legal",
    tipo: "opciones",
    grupo: "Atributos",
    opciones: ["aprobada", "pendiente"],
  },
  {
    campo: "lista",
    etiqueta: "Miembro de la lista",
    tipo: "lista",
    grupo: "Atributos",
  },
  {
    campo: "contactoIds",
    etiqueta: "Contactos elegidos a mano",
    tipo: "texto",
    grupo: "Atributos",
  },
  {
    campo: "hizoClic",
    etiqueta: "Hizo clic en un correo (sin escáneres)",
    tipo: "comportamiento",
    grupo: "Comportamiento",
  },
  {
    campo: "respondio",
    etiqueta: "Respondió un correo",
    tipo: "comportamiento",
    grupo: "Comportamiento",
  },
  {
    campo: "recibioCorreo",
    etiqueta: "Recibió algún correo",
    tipo: "comportamiento",
    grupo: "Comportamiento",
  },
];
const OPERADORES: Record<string, string> = {
  es: "es",
  no_es: "no es",
  contiene: "contiene",
  mayor_que: "mayor que",
  menor_que: "menor que",
};
const operadoresDe = (t: Tipo) =>
  t === "comportamiento" || t === "lista" || t === "opciones"
    ? ["es", "no_es"]
    : t === "numero"
      ? ["es", "mayor_que", "menor_que"]
      : ["es", "no_es", "contiene"];

/** La raíz siempre es un grupo; al guardar, un grupo Y raíz se aplana (compatibilidad). */
export const aRaiz = (reglas: ReglaSegmento[]): GrupoReglas =>
  reglas.length === 1 && esGrupo(reglas[0]) && reglas[0].raiz
    ? reglas[0]
    : { grupo: "y", reglas };
export const deRaiz = (g: GrupoReglas): ReglaSegmento[] =>
  g.grupo === "y" ? g.reglas : [{ ...g, raiz: true }];

export const nuevaRegla = (): ReglaSimple => ({
  campo: "municipio",
  operador: "es",
  valor: "",
});

export function EditorReglas({
  reglas,
  onChange,
  listas = [],
}: {
  reglas: ReglaSegmento[];
  onChange: (r: ReglaSegmento[]) => void;
  listas?: { id: string; nombre: string }[];
}) {
  return (
    <Grupo
      g={aRaiz(reglas)}
      onChange={(g) => onChange(deRaiz(g))}
      nivel={0}
      listas={listas}
    />
  );
}

function Grupo({
  g,
  onChange,
  nivel,
  listas,
  onQuitar,
}: {
  g: GrupoReglas;
  onChange: (g: GrupoReglas) => void;
  nivel: number;
  listas: { id: string; nombre: string }[];
  onQuitar?: () => void;
}) {
  const cambiar = (i: number, r: ReglaSegmento) =>
    onChange({ ...g, reglas: g.reglas.map((x, k) => (k === i ? r : x)) });
  const quitar = (i: number) =>
    onChange({ ...g, reglas: g.reglas.filter((_, k) => k !== i) });
  return (
    <fieldset
      className="stack"
      style={nivel ? { borderStyle: "dashed" } : undefined}
    >
      <legend>{nivel ? `Grupo ${nivel}` : "Reglas"}</legend>
      <label>
        {nivel
          ? "Este grupo coincide si cumple"
          : "El contacto entra si cumple"}
        <select
          value={g.grupo}
          onChange={(e) =>
            onChange({ ...g, grupo: e.target.value as "y" | "o" })
          }
        >
          <option value="y">todas las reglas (Y)</option>
          <option value="o">al menos una regla (O)</option>
        </select>
      </label>
      {g.reglas.map((r, i) =>
        esGrupo(r) ? (
          <Grupo
            key={i}
            g={r}
            nivel={nivel + 1}
            listas={listas}
            onChange={(x) => cambiar(i, x)}
            onQuitar={() => quitar(i)}
          />
        ) : (
          <Regla
            key={i}
            n={i + 1}
            r={r}
            listas={listas}
            onChange={(x) => cambiar(i, x)}
            onQuitar={() => quitar(i)}
          />
        ),
      )}
      <div className="row">
        <Button
          onClick={() =>
            onChange({ ...g, reglas: [...g.reglas, nuevaRegla()] })
          }
        >
          Añadir regla
        </Button>
        {nivel < 2 && (
          <Button
            onClick={() =>
              onChange({
                ...g,
                reglas: [
                  ...g.reglas,
                  {
                    grupo: g.grupo === "y" ? "o" : "y",
                    reglas: [nuevaRegla()],
                  },
                ],
              })
            }
          >
            Añadir grupo {g.grupo === "y" ? "O" : "Y"}
          </Button>
        )}
        {onQuitar && <Button onClick={onQuitar}>Quitar grupo</Button>}
      </div>
    </fieldset>
  );
}

function Regla({
  n,
  r,
  onChange,
  onQuitar,
  listas,
}: {
  n: number;
  r: ReglaSimple;
  onChange: (r: ReglaSimple) => void;
  onQuitar: () => void;
  listas: { id: string; nombre: string }[];
}) {
  const meta = CAMPOS.find((x) => x.campo === r.campo) ?? CAMPOS[0];
  const ops = operadoresDe(meta.tipo);
  return (
    <div className="row" role="group" aria-label={`Regla ${n}`}>
      <Select
        all={false}
        label="Campo"
        value={r.campo}
        onChange={(v) => {
          const m = CAMPOS.find((x) => x.campo === v) ?? CAMPOS[0];
          const o = operadoresDe(m.tipo);
          onChange({
            campo: v,
            operador: (o.includes(r.operador)
              ? r.operador
              : o[0]) as ReglaSimple["operador"],
            valor:
              m.tipo === "comportamiento"
                ? "si"
                : m.tipo === "opciones"
                  ? (m.opciones?.[0] ?? "")
                  : m.tipo === "lista"
                    ? (listas[0]?.id ?? "")
                    : "",
          });
        }}
        options={CAMPOS.map((x) => ({
          value: x.campo,
          label: `${x.grupo === "Comportamiento" ? "Comportamiento · " : ""}${x.etiqueta}`,
        }))}
      />
      <Select
        all={false}
        label="Operador"
        value={r.operador}
        onChange={(v) =>
          onChange({ ...r, operador: v as ReglaSimple["operador"] })
        }
        options={ops.map((o) => ({ value: o, label: OPERADORES[o] }))}
      />
      {meta.tipo === "comportamiento" ? (
        <Select
          all={false}
          label="Valor"
          value={r.valor}
          onChange={(v) => onChange({ ...r, valor: v })}
          options={[
            { value: "si", label: "sí" },
            { value: "no", label: "no" },
          ]}
        />
      ) : meta.tipo === "opciones" ? (
        <Select
          all={false}
          label="Valor"
          value={r.valor}
          onChange={(v) => onChange({ ...r, valor: v })}
          options={[...(meta.opciones ?? [])]}
        />
      ) : meta.tipo === "lista" ? (
        <Select
          all={false}
          label="Valor"
          value={r.valor}
          onChange={(v) => onChange({ ...r, valor: v })}
          options={listas.map((l) => ({ value: l.id, label: l.nombre }))}
        />
      ) : (
        <label>
          Valor
          <input
            required
            value={r.valor}
            inputMode={meta.tipo === "numero" ? "numeric" : undefined}
            onChange={(e) => onChange({ ...r, valor: e.target.value })}
          />
        </label>
      )}
      <Button onClick={onQuitar}>Quitar regla</Button>
    </div>
  );
}

const previaSchema = z.object({
  conteo: z.number(),
  muestra: S.contactoSchema.array(),
});
/** Vista previa del servidor: la misma lógica que selecciona destinatarios al aprobar. */
export function useVistaPrevia(reglas: ReglaSegmento[]) {
  const [estado, setEstado] = useState<{
    conteo?: number;
    muestra: z.infer<typeof S.contactoSchema>[];
    error?: string;
    cargando: boolean;
  }>({ muestra: [], cargando: true });
  const clave = JSON.stringify(reglas);
  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true }));
    const t = setTimeout(() => {
      request(
        "/segmentos/previsualizar",
        previaSchema,
        "POST",
        JSON.parse(clave),
      )
        .then((r) => vigente && setEstado({ ...r, cargando: false }))
        .catch(
          (e: unknown) =>
            vigente &&
            setEstado({
              muestra: [],
              cargando: false,
              error: e instanceof Error ? e.message : "No se pudo calcular",
            }),
        );
    }, 350);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [clave]);
  return estado;
}
