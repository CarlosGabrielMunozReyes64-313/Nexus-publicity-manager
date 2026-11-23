import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { request } from "../../api/client";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import { Badge, Button, Card, QueryState } from "../../components/ui";
import { useCommand } from "../shared";
import st from "./Descubrimiento.module.css";

export interface Filtros {
  tipos: string[];
  municipios: string[];
  sectores: string[];
  tamano: string;
}
type Meta = z.infer<typeof S.metaDescubrimientoSchema>;

const lista = (v: string[], vacio: string) =>
  v.length === 0
    ? vacio
    : v.length <= 3
      ? v.join(", ")
      : `${v.slice(0, 3).join(", ")} y ${v.length - 3} más`;

export const combinacionesDe = (f: Filtros) =>
  f.tipos.length * Math.max(1, f.municipios.length);

const igual = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** Meta diaria de contactos: el sistema busca solo hasta cumplirla (con tope de búsquedas). */
export function MetaDiaria({
  filtros,
  cargar,
}: {
  filtros: Filtros;
  cargar: (f: Filtros) => void;
}) {
  const q = useResource("/descubrimiento/meta", S.metaDescubrimientoSchema);
  const activa = q.data?.activa;
  // Al abrir la pantalla, el formulario de arriba muestra los filtros guardados de la meta
  // (si el administrador todavía no eligió tipos).
  const cargada = useRef(false);
  useEffect(() => {
    if (!q.data || cargada.current) return;
    cargada.current = true;
    if (q.data.tipos.length && !filtros.tipos.length)
      cargar({
        tipos: q.data.tipos,
        municipios: q.data.municipios,
        sectores: q.data.sectores,
        tamano: q.data.tamano,
      });
  }, [q.data]);
  useEffect(() => {
    if (!activa) return;
    const timer = setInterval(() => void q.refetch(), 10_000);
    return () => clearInterval(timer);
  }, [activa]);
  return (
    <Card title="Meta de contactos diarios">
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {q.data && (
          <FormularioMeta
            // Al guardar, el formulario vuelve a los valores del servidor.
            key={`${q.data.activa}-${q.data.metaDiaria}-${q.data.maxBusquedas}`}
            meta={q.data}
            filtros={filtros}
            cargar={cargar}
          />
        )}
      </QueryState>
    </Card>
  );
}

function FormularioMeta({
  meta,
  filtros,
  cargar,
}: {
  meta: Meta;
  filtros: Filtros;
  cargar: (f: Filtros) => void;
}) {
  const cmd = useCommand();
  const cache = useQueryClient();
  const [activa, setActiva] = useState(meta.activa);
  const [diaria, setDiaria] = useState(String(meta.metaDiaria));
  const [tope, setTope] = useState(String(meta.maxBusquedas));
  const n = Number(diaria);
  const t = Number(tope);
  const combos = combinacionesDe(filtros);
  const error =
    !Number.isInteger(n) || n < 1 || n > 200
      ? "La meta debe ser un número entre 1 y 200."
      : !Number.isInteger(t) || t < 1 || t > 500
        ? "El tope de búsquedas debe ser un número entre 1 y 500."
        : activa && !filtros.tipos.length
          ? "Elija arriba al menos un tipo de empresa: la meta busca con esos filtros."
          : null;
  const distintos =
    meta.tipos.length > 0 &&
    !(
      igual(meta.tipos, filtros.tipos) &&
      igual(meta.municipios, filtros.municipios) &&
      igual(meta.sectores, filtros.sectores) &&
      meta.tamano === filtros.tamano
    );
  const guardar = () =>
    cmd.confirm({
      title: activa ? "Encender la meta diaria" : "Guardar la meta apagada",
      summary: activa ? (
        <>
          <p>
            Cada día el sistema buscará solo, un tipo de empresa y un municipio
            a la vez ({combos} combinaciones con los filtros de arriba), hasta
            conseguir {n} contactos nuevos o hacer {t} búsquedas.
          </p>
          <p>
            Las empresas cuyo nombre, país y correo genérico se comprueban en su
            sitio oficial se aceptan solas y crean su contacto. Las demás
            esperan su revisión en la lista.
          </p>
          <p>
            Cada búsqueda usa hasta {meta.creditosPorBusqueda} créditos de
            Tavily y una llamada al modelo de IA: hasta{" "}
            {t * meta.creditosPorBusqueda} créditos al día.
          </p>
        </>
      ) : (
        "Se guardan la meta y los filtros, pero el sistema no buscará solo hasta que la encienda."
      ),
      run: async () => {
        await request("/descubrimiento/meta", S.okSchema, "PUT", {
          activa,
          metaDiaria: n,
          maxBusquedas: t,
          ...filtros,
        });
        await cache.invalidateQueries();
        return activa
          ? "Meta encendida. La primera búsqueda empieza en unos segundos."
          : "Meta guardada. Está apagada.";
      },
    });
  const pct = Math.min(
    100,
    Math.round((meta.hoy.contactos / meta.metaDiaria) * 100),
  );
  return (
    <div className="stack">
      <p>
        El sistema busca solo cada día con los filtros de «Nueva búsqueda»,
        hasta conseguir la meta. Una búsqueda por tipo de empresa y municipio,
        para que cada una lea páginas de ese caso.
      </p>
      <div className={st.metaFila}>
        <label className={st.interruptor}>
          <input
            type="checkbox"
            checked={activa}
            onChange={(e) => setActiva(e.target.checked)}
          />
          Buscar sola cada día
        </label>
        <label>
          Meta de contactos diarios
          <input
            type="number"
            min={1}
            max={200}
            value={diaria}
            onChange={(e) => setDiaria(e.target.value)}
          />
        </label>
        <label>
          Tope de búsquedas por día
          <input
            type="number"
            min={1}
            max={500}
            value={tope}
            onChange={(e) => setTope(e.target.value)}
          />
        </label>
        <Button
          variant="primary"
          disabled={!!error || cmd.pending}
          onClick={guardar}
        >
          Guardar meta
        </Button>
      </div>
      {error ? (
        <small role="alert">{error}</small>
      ) : (
        <small className="muted">
          Con los filtros de arriba: {combos} combinaciones de tipo y municipio.
        </small>
      )}
      <div className={st.avance}>
        <div className={st.cifras}>
          <span>
            <Badge tono={meta.activa ? "success" : undefined}>
              {meta.activa ? "Encendida" : "Apagada"}
            </Badge>
          </span>
          <span>
            Hoy: {meta.hoy.contactos} de {meta.metaDiaria} contactos
          </span>
          <span>
            {meta.hoy.busquedas} de {meta.maxBusquedas} búsquedas
          </span>
        </div>
        <progress aria-label="Avance de la meta de hoy" value={pct} max={100} />
        <p className="notice" aria-live="polite">
          {meta.estado}
        </p>
      </div>
      {meta.tipos.length > 0 && (
        <p>
          <small>
            Filtros guardados: {lista(meta.tipos, "")} ·{" "}
            {lista(meta.municipios, "cualquier municipio")} ·{" "}
            {lista(meta.sectores, "cualquier sector")} ·{" "}
            {meta.tamano || "cualquier tamaño"} ({meta.combinaciones}{" "}
            combinaciones).
          </small>{" "}
          {distintos && (
            <Button
              onClick={() =>
                cargar({
                  tipos: meta.tipos,
                  municipios: meta.municipios,
                  sectores: meta.sectores,
                  tamano: meta.tamano,
                })
              }
            >
              Poner los filtros guardados arriba
            </Button>
          )}
        </p>
      )}
      {distintos && (
        <small className="muted">
          Los filtros de arriba son distintos de los guardados. Pulse «Guardar
          meta» para que la meta use los de arriba.
        </small>
      )}
    </div>
  );
}
