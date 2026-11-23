import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { Sparkles } from "lucide-react";
import { request } from "../../../api/client";
import * as S from "../../../api/schemas";
import { Badge, Button, useFeedback } from "../../../components/ui";
import type { Borrador, CorreoEditor } from "../util";
import { Diferencia } from "./Historial";
import { textoAHtml } from "./textoAHtml";
import styles from "./Editor.module.css";

type Sugerencia = z.infer<typeof S.sugerenciaSchema>;
const RAPIDAS = ["Más corto", "Más cercano", "Más formal", "Más directo"];
const EN_CURSO = new Set(["en_cola", "trabajando"]);
/** Mientras la IA escribe se consulta cada 5 s (exportado para las pruebas). */
export const intervaloSugerencias = { ms: 5000 };

const mensaje = (e: unknown, defecto: string) =>
  e instanceof Error ? e.message : defecto;

/**
 * «Mejorar con IA» de un correo: la IA recibe el texto del correo (con sus variables) y
 * la instrucción, nunca datos de los contactos. La sugerencia se compara con lo que hay
 * en pantalla; «Usar sugerencia» la pone en el borrador sin guardar.
 */
export default function MejorarConIA({
  secuenciaId,
  orden,
  correo,
  contenido,
  onUsar,
}: {
  secuenciaId: string;
  orden: number;
  correo: CorreoEditor;
  contenido: Borrador;
  onUsar: (c: CorreoEditor) => void;
}) {
  const cache = useQueryClient();
  const { notify } = useFeedback();
  const [abierto, setAbierto] = useState(false);
  const [instruccion, setInstruccion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ruta = `/secuencias/${secuenciaId}/sugerencias`;
  const q = useQuery({
    queryKey: [ruta],
    queryFn: () => request(ruta, S.sugerenciaSchema.array()),
    refetchInterval: (x) =>
      x.state.data?.some((s) => EN_CURSO.has(s.estado))
        ? intervaloSugerencias.ms
        : false,
  });
  const mias = (q.data ?? []).filter((s) => s.orden === orden);
  const ocupada = mias.some((s) => EN_CURSO.has(s.estado));
  const valida = instruccion.trim().length >= 3;
  const recargar = () => cache.invalidateQueries({ queryKey: [ruta] });

  const pedir = async () => {
    setBusy(true);
    setError("");
    try {
      await request(
        `/secuencias/${secuenciaId}/correos/${orden}/mejorar`,
        S.okSchema,
        "POST",
        { instruccion: instruccion.trim(), secuencia: contenido },
      );
      setInstruccion("");
      setAbierto(false);
      await recargar();
      notify("La IA está mejorando el correo. La sugerencia aparecerá aquí.");
    } catch (e) {
      setError(mensaje(e, "No se pudo pedir la sugerencia"));
    } finally {
      setBusy(false);
    }
  };
  const descartar = async (s: Sugerencia, aviso?: string) => {
    try {
      await request(`${ruta}/${s.id}`, S.okSchema, "DELETE");
      await recargar();
      if (aviso) notify(aviso);
    } catch (e) {
      notify(mensaje(e, "No se pudo descartar"));
    }
  };
  const usar = (s: Sugerencia) => {
    if (!s.cuerpo) return;
    onUsar({
      ...correo,
      cuerpo: s.cuerpo,
      ...(s.asunto ? { asunto: s.asunto } : {}),
      // En «Texto con formato» la sugerencia (texto simple) se pasa a párrafos.
      ...(correo.formato === "html"
        ? { cuerpoHtml: textoAHtml(s.cuerpo) }
        : {}),
    });
    void descartar(
      s,
      "Sugerencia aplicada. Guarda el borrador para conservarla.",
    );
  };
  const reintentar = async (s: Sugerencia) => {
    try {
      await request(
        `/secuencias/solicitudes/${s.id}/reintentar`,
        S.okSchema,
        "POST",
        {},
      );
      await recargar();
    } catch (e) {
      notify(mensaje(e, "No se pudo reintentar"));
    }
  };

  return (
    <section className={styles.mejorar} aria-label="Mejorar con IA">
      {!abierto ? (
        <Button onClick={() => setAbierto(true)} disabled={ocupada}>
          <Sparkles size={14} aria-hidden /> Mejorar con IA
        </Button>
      ) : (
        <div className="stack">
          <label>
            ¿Qué quieres cambiar de este correo?
            <input
              value={instruccion}
              maxLength={300}
              onChange={(e) => setInstruccion(e.target.value)}
              placeholder="Por ejemplo: más corto y con el enlace al principio"
            />
          </label>
          <div className="row" role="group" aria-label="Instrucciones rápidas">
            {RAPIDAS.map((r) => (
              <Button key={r} onClick={() => setInstruccion(r)}>
                {r}
              </Button>
            ))}
          </div>
          <small className="muted">
            La IA recibe solo el texto de la secuencia y la instrucción; ningún
            dato de los contactos. Usa lo que hay en pantalla, aunque no esté
            guardado.
          </small>
          {error && (
            <p role="alert" className="danger">
              {error}
            </p>
          )}
          <div className="row">
            <Button
              variant="primary"
              disabled={!valida || busy}
              onClick={() => void pedir()}
            >
              {busy ? "Enviando…" : "Pedir sugerencia"}
            </Button>
            <Button onClick={() => setAbierto(false)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {mias.map((s) => (
        <article key={s.id} className={styles.sugerencia}>
          <header>
            <strong>«{s.instruccion}»</strong>{" "}
            {EN_CURSO.has(s.estado) ? (
              <Badge tono="info">La IA está escribiendo…</Badge>
            ) : s.estado === "fallida" ? (
              <Badge tono="error">No se pudo</Badge>
            ) : (
              <Badge tono="success">Sugerencia lista</Badge>
            )}
          </header>
          {s.estado === "lista" && s.cuerpo && (
            <>
              {s.asunto && s.asunto !== correo.asunto && (
                <>
                  <small>Asunto</small>
                  <Diferencia antes={correo.asunto ?? ""} despues={s.asunto} />
                </>
              )}
              <small>Cuerpo (comparado con lo que hay en pantalla)</small>
              <Diferencia antes={correo.cuerpo} despues={s.cuerpo} />
              {s.porQue && (
                <p className="muted">
                  <strong>Por qué:</strong> {s.porQue}
                </p>
              )}
              <div className="row">
                <Button variant="primary" onClick={() => usar(s)}>
                  Usar sugerencia
                </Button>
                <Button onClick={() => void descartar(s)}>Descartar</Button>
              </div>
            </>
          )}
          {s.estado === "fallida" && (
            <>
              <p className="danger">
                {s.error ?? "La solicitud no pudo completarse"}
              </p>
              <div className="row">
                <Button onClick={() => void reintentar(s)}>Reintentar</Button>
                <Button onClick={() => void descartar(s)}>Descartar</Button>
              </div>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
