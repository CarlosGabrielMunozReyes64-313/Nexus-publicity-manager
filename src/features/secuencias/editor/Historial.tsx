import { useState } from "react";
import { useResource } from "../../../api/hooks";
import * as S from "../../../api/schemas";
import { Button, Card, QueryState } from "../../../components/ui";
import { fechaHora } from "../../../lib/formato";
import { AUTOR, diferencia, leerContenido, type Contenido } from "../util";
import styles from "./Editor.module.css";

const DECISION: Record<string, string> = {
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

/** Texto con lo agregado y lo quitado marcado palabra por palabra. */
export function Diferencia({
  antes,
  despues,
}: {
  antes: string;
  despues: string;
}) {
  if (antes === despues)
    return <div className={styles.diff}>{despues || "—"}</div>;
  return (
    <div className={styles.diff}>
      {diferencia(antes, despues).map((t, i) =>
        t.tipo === "agregado" ? (
          <ins key={i}>{t.texto}</ins>
        ) : t.tipo === "quitado" ? (
          <del key={i}>{t.texto}</del>
        ) : (
          <span key={i}>{t.texto}</span>
        ),
      )}
    </div>
  );
}

function Comparacion({ a, b }: { a: Contenido; b: Contenido }) {
  const total = Math.max(a.pasos.length, b.pasos.length);
  return (
    <div className="stack">
      {Array.from({ length: total }, (_, i) => {
        const x = a.pasos[i];
        const y = b.pasos[i];
        const igual =
          x &&
          y &&
          (x.asunto ?? "") === (y.asunto ?? "") &&
          x.cuerpo === y.cuerpo;
        return (
          <section key={i} aria-label={`Comparación del correo ${i + 1}`}>
            <h3>
              Correo {i + 1}
              {!x
                ? " · agregado"
                : !y
                  ? " · quitado"
                  : igual
                    ? " · sin cambios"
                    : " · con cambios"}
            </h3>
            {(x?.asunto || y?.asunto) && (
              <>
                <small>Asunto</small>
                <Diferencia antes={x?.asunto ?? ""} despues={y?.asunto ?? ""} />
              </>
            )}
            <small>Cuerpo</small>
            <Diferencia antes={x?.cuerpo ?? ""} despues={y?.cuerpo ?? ""} />
          </section>
        );
      })}
    </div>
  );
}

/** Pestaña «Historial»: versiones, comparación correo por correo y restaurar. */
export default function Historial({
  secuenciaId,
  versionBorrador,
  onRestaurar,
}: {
  secuenciaId: string;
  versionBorrador: number;
  onRestaurar: (version: number) => void;
}) {
  const q = useResource(
    `/secuencias/${secuenciaId}/versiones`,
    S.versionSecuenciaSchema.array(),
  );
  const versiones = q.data ?? [];
  const [elegidas, setElegidas] = useState<{ a?: number; b?: number }>({});
  const a = elegidas.a ?? versiones.at(-2)?.version ?? versiones[0]?.version;
  const b = elegidas.b ?? versiones.at(-1)?.version;
  const ca = leerContenido(versiones.find((v) => v.version === a)?.contenido);
  const cb = leerContenido(versiones.find((v) => v.version === b)?.contenido);
  const opciones = versiones.map((v) => (
    <option key={v.version} value={v.version}>
      Versión {v.version} · {AUTOR[v.autor]}
    </option>
  ));
  return (
    <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
      <Card title="Versiones">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Versión</th>
                <th>Autor</th>
                <th>Fecha</th>
                <th>Decisión</th>
                <th>Comentario</th>
                <th>
                  <span className="srOnly">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...versiones].reverse().map((v) => (
                <tr key={v.version}>
                  <td>
                    {v.version}
                    {v.version === versionBorrador ? " (borrador)" : ""}
                  </td>
                  <td>{AUTOR[v.autor]}</td>
                  <td>{fechaHora(v.fecha)}</td>
                  <td>{v.decision ? DECISION[v.decision] : "—"}</td>
                  <td>{v.comentario ?? "—"}</td>
                  <td>
                    {v.version !== versionBorrador && (
                      <Button
                        aria-label={`Restaurar como borrador la versión ${v.version}`}
                        onClick={() => onRestaurar(v.version)}
                      >
                        Restaurar como borrador
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {versiones.length > 1 && (
        <Card title="Comparar versiones">
          <div className="toolbar">
            <label>
              Versión anterior
              <select
                value={a}
                onChange={(e) =>
                  setElegidas((x) => ({ ...x, a: Number(e.target.value) }))
                }
              >
                {opciones}
              </select>
            </label>
            <label>
              Versión nueva
              <select
                value={b}
                onChange={(e) =>
                  setElegidas((x) => ({ ...x, b: Number(e.target.value) }))
                }
              >
                {opciones}
              </select>
            </label>
          </div>
          {ca && cb ? (
            <Comparacion a={ca} b={cb} />
          ) : (
            <p className="notice warning">
              Una de las versiones no tiene el formato de una secuencia.
            </p>
          )}
        </Card>
      )}
    </QueryState>
  );
}
