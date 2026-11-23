import { Suspense, lazy, useRef, type ReactNode } from "react";
import { AlertTriangle, XCircle } from "lucide-react";
import { Card } from "../../../components/ui";
import type { z } from "zod";
import type * as S from "../../../api/schemas";
import {
  CAMPO_FUENTE,
  RESPALDO_POR_DEFECTO,
  VARIABLES,
  palabras,
  variablesUsadas,
  type CorreoEditor as Correo,
} from "../util";
import styles from "./Editor.module.css";
import { textoAHtml } from "./textoAHtml";

// TipTap solo se descarga cuando un correo usa «Texto con formato».
const CuerpoConFormato = lazy(() => import("./CuerpoConFormato"));

type Nota = z.infer<typeof S.notaPasoSchema>;

/** Editor de un correo: asunto, espera, hilo, cuerpo, respaldos y notas de la IA. */
export default function CorreoEditor({
  correo,
  i,
  nota,
  editadoPorTi,
  errores,
  avisos,
  onCambiar,
  extra,
}: {
  correo: Correo;
  i: number;
  nota?: Nota;
  editadoPorTi: boolean;
  errores: string[];
  avisos: string[];
  onCambiar: (c: Correo) => void;
  /** Bloques adicionales (por ejemplo, «Mejorar con IA»). */
  extra?: ReactNode;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const cambiar = (x: Partial<Correo>) => onCambiar({ ...correo, ...x });
  const conAsunto = i === 0 || !correo.mismoHilo;
  const usadas = variablesUsadas(correo);
  const insertar = (v: string) => {
    if (!v) return;
    const t = area.current;
    const marca = `{{${v}}}`;
    if (!t) return cambiar({ cuerpo: correo.cuerpo + marca });
    const ini = t.selectionStart ?? correo.cuerpo.length;
    const fin = t.selectionEnd ?? ini;
    const cuerpo =
      correo.cuerpo.slice(0, ini) + marca + correo.cuerpo.slice(fin);
    cambiar({ cuerpo });
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  };
  const respaldo = (v: string) =>
    correo.variables.find((x) => x.nombre === v)?.respaldo ?? "";
  const ponerRespaldo = (v: string, texto: string) => {
    const otras = correo.variables.filter((x) => x.nombre !== v);
    cambiar({
      variables: [
        ...otras,
        { nombre: v, campoFuente: CAMPO_FUENTE[v] ?? v, respaldo: texto },
      ],
    });
  };
  return (
    <Card title={`Correo ${i + 1}`}>
      <div className="stack">
        {conAsunto ? (
          <div className="stack" style={{ gap: 4 }}>
            <label>
              Asunto
              <input
                value={correo.asunto ?? ""}
                maxLength={200}
                aria-describedby={`contador-${correo.id}`}
                onChange={(e) => cambiar({ asunto: e.target.value })}
              />
            </label>
            <span
              id={`contador-${correo.id}`}
              className={styles.contador}
              data-excede={(correo.asunto ?? "").length > 60}
            >
              {(correo.asunto ?? "").length}/60 caracteres
            </span>
          </div>
        ) : (
          <p className="muted">
            Usa el asunto del correo anterior (mismo hilo).
          </p>
        )}
        <div className="grid">
          <label>
            {i === 0
              ? "Espera desde la inscripción (días hábiles)"
              : "Espera desde el correo anterior (días hábiles)"}
            <input
              type="number"
              min={0}
              value={correo.esperaDiasHabiles}
              onChange={(e) =>
                cambiar({
                  esperaDiasHabiles: Math.max(0, Number(e.target.value)),
                })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              role="switch"
              checked={i > 0 && correo.mismoHilo}
              disabled={i === 0}
              onChange={(e) =>
                cambiar({
                  mismoHilo: e.target.checked,
                  ...(e.target.checked ? {} : { asunto: correo.asunto ?? "" }),
                })
              }
            />
            Mismo hilo
          </label>
        </div>
        <label>
          Formato
          <select
            value={correo.formato ?? "texto"}
            onChange={(e) =>
              e.target.value === "html"
                ? cambiar({
                    formato: "html",
                    cuerpoHtml: textoAHtml(correo.cuerpo),
                  })
                : cambiar({ formato: "texto", cuerpoHtml: undefined })
            }
          >
            <option value="texto">Texto simple (recomendado)</option>
            <option value="html">Texto con formato</option>
          </select>
        </label>
        {correo.formato === "html" ? (
          <>
            <p className="muted">
              Los correos en texto simple parecen escritos por una persona y
              suelen llegar mejor. El texto simple de este correo se genera solo
              a partir del formato.
            </p>
            <Suspense fallback={<small>Cargando el editor…</small>}>
              <CuerpoConFormato
                html={correo.cuerpoHtml ?? ""}
                onCambiar={(cuerpoHtml, cuerpo) =>
                  cambiar({ cuerpoHtml, cuerpo })
                }
              />
            </Suspense>
          </>
        ) : (
          <>
            <div className="row">
              <label>
                Insertar variable
                <select
                  value=""
                  onChange={(e) => insertar(e.target.value)}
                  aria-label="Insertar variable"
                >
                  <option value="">Elegir…</option>
                  {VARIABLES.map((v) => (
                    <option key={v} value={v}>{`{{${v}}}`}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Cuerpo
              <textarea
                ref={area}
                style={{ minHeight: 260, fontFamily: "inherit" }}
                value={correo.cuerpo}
                onChange={(e) => cambiar({ cuerpo: e.target.value })}
              />
            </label>
          </>
        )}
        <small className="muted">{palabras(correo.cuerpo)} palabras</small>
        {(errores.length > 0 || avisos.length > 0) && (
          <ul className={styles.verificacion}>
            {errores.map((e) => (
              <li key={e} className={styles.error}>
                <XCircle size={14} aria-hidden /> {e}
              </li>
            ))}
            {avisos.map((a) => (
              <li key={a} className={styles.aviso}>
                <AlertTriangle size={14} aria-hidden /> {a}
              </li>
            ))}
          </ul>
        )}
        {usadas.length > 0 && (
          <div>
            <h3>Respaldos</h3>
            <p className="muted">
              Se usan cuando el contacto no tiene ese dato verificado.
            </p>
            <table className={styles.respaldos}>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Texto de respaldo</th>
                </tr>
              </thead>
              <tbody>
                {usadas.map((v) => (
                  <tr key={v}>
                    <td>
                      <code>{`{{${v}}}`}</code>
                    </td>
                    <td>
                      <input
                        aria-label={`Respaldo de {{${v}}}`}
                        value={respaldo(v)}
                        placeholder={RESPALDO_POR_DEFECTO[v]}
                        onChange={(e) => ponerRespaldo(v, e.target.value)}
                      />
                      {!respaldo(v).trim() && (
                        <small className={styles.aviso}>
                          Escriba un respaldo para guardar sin advertencias.
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details className={styles.notas}>
          <summary>Por qué la IA lo escribió así</summary>
          {editadoPorTi ? (
            <p>Editado por ti.</p>
          ) : nota?.proposito || nota?.porQue ? (
            <>
              {nota.proposito && (
                <p>
                  <strong>Propósito:</strong> {nota.proposito}
                </p>
              )}
              {nota.porQue && (
                <p>
                  <strong>Por qué así:</strong> {nota.porQue}
                </p>
              )}
            </>
          ) : (
            <p className="muted">Este correo no trae notas de la IA.</p>
          )}
        </details>
        {extra}
      </div>
    </Card>
  );
}

/** Advertencias locales de respaldo vacío (se suman a las del servidor). */
export function respaldosVacios(c: Correo) {
  return variablesUsadas(c)
    .filter((v) => !c.variables.find((x) => x.nombre === v)?.respaldo?.trim())
    .map((v) => `{{${v}}} sin texto de respaldo`);
}
