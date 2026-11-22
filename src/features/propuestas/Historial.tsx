import { useState } from "react";
import { request } from "../../api/client";
import * as S from "../../api/schemas";
import { Button, Card } from "../../components/ui";
import { fechaHora } from "../../lib/formato";
import type { PropuestaAgente } from "../../types";
import { useCommand } from "../shared";
import { AUTOR, diferencia, leerRuta, type RutaCorreo } from "./ruta";
import styles from "./Ruta.module.css";
import { useQueryClient } from "@tanstack/react-query";

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
          <ins key={i} aria-label={`Agregado: ${t.texto}`}>
            {t.texto}
          </ins>
        ) : t.tipo === "quitado" ? (
          <del key={i} aria-label={`Quitado: ${t.texto}`}>
            {t.texto}
          </del>
        ) : (
          <span key={i}>{t.texto}</span>
        ),
      )}
    </div>
  );
}

function Comparacion({ a, b }: { a: RutaCorreo; b: RutaCorreo }) {
  const total = Math.max(a.pasos.length, b.pasos.length);
  return (
    <div className={styles.comparacion}>
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

/** Historial de versiones: quién la escribió, decisión, comparación y restauración. */
export default function Historial({ p }: { p: PropuestaAgente }) {
  const cmd = useCommand();
  const cache = useQueryClient();
  const versiones = p.versiones;
  // Sin elección del usuario, se comparan las dos últimas (y siguen a las nuevas).
  const [elegidas, setElegidas] = useState<{ a?: number; b?: number }>({});
  const a = elegidas.a ?? versiones.at(-2)?.version ?? versiones[0]?.version;
  const b = elegidas.b ?? versiones.at(-1)?.version ?? versiones[0]?.version;
  const setA = (v: number) => setElegidas((x) => ({ ...x, a: v }));
  const setB = (v: number) => setElegidas((x) => ({ ...x, b: v }));
  const va = versiones.find((v) => v.version === a);
  const vb = versiones.find((v) => v.version === b);
  const ra = leerRuta(va?.contenido);
  const rb = leerRuta(vb?.contenido);
  const opciones = versiones.map((v) => (
    <option key={v.version} value={v.version}>
      Versión {v.version} · {AUTOR[v.autor ?? ""] ?? "sin autor"}
    </option>
  ));
  return (
    <Card title="Historial de versiones">
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
                  {v.version === p.version ? " (actual)" : ""}
                </td>
                <td>{AUTOR[v.autor ?? ""] ?? "—"}</td>
                <td>{fechaHora(v.fecha)}</td>
                <td>
                  {v.decision ? DECISION[v.decision] : "—"}
                  {v.decididaEn ? ` · ${fechaHora(v.decididaEn)}` : ""}
                </td>
                <td>{v.comentario ?? "—"}</td>
                <td>
                  {v.version !== p.version && (
                    <Button
                      aria-label={`Restaurar esta versión (${v.version})`}
                      onClick={() =>
                        cmd.confirm({
                          title: `Restaurar la versión ${v.version}`,
                          summary: `Se creará la versión ${p.version + 1} con el contenido de la versión ${v.version}, escrita por usted. La campaña queda en revisión hasta que la apruebe.`,
                          run: async () => {
                            const r = await request(
                              `/propuestas/${p.id}/restaurar`,
                              S.versionCreadaSchema,
                              "POST",
                              { version: v.version },
                            );
                            await cache.invalidateQueries();
                            return `Se creó la versión ${r.version ?? p.version + 1} con el contenido de la versión ${v.version}.`;
                          },
                        })
                      }
                    >
                      Restaurar esta versión
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {versiones.length > 1 && (
        <>
          <h3>Comparar versiones</h3>
          <div className="toolbar">
            <label>
              Versión anterior
              <select value={a} onChange={(e) => setA(Number(e.target.value))}>
                {opciones}
              </select>
            </label>
            <label>
              Versión nueva
              <select value={b} onChange={(e) => setB(Number(e.target.value))}>
                {opciones}
              </select>
            </label>
          </div>
          {ra && rb ? (
            <Comparacion a={ra} b={rb} />
          ) : (
            <div className="grid">
              <pre>{JSON.stringify(va?.contenido ?? null, null, 2)}</pre>
              <pre>{JSON.stringify(vb?.contenido ?? null, null, 2)}</pre>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
