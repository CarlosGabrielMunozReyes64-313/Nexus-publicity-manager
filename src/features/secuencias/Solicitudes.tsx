import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../../api/client";
import * as S from "../../api/schemas";
import { Badge, Button, Card, useFeedback } from "../../components/ui";
import { fechaHora } from "../../lib/formato";

type Solicitud = z.infer<typeof S.solicitudSecuenciaSchema>;
export const INTERVALO_SOLICITUDES = 15000;
const SIETE_DIAS = 7 * 86400000;

const enCurso = (s: Solicitud) =>
  s.estado === "en_cola" || s.estado === "trabajando";

/** Consulta cada 15 s solo mientras alguna solicitud siga en curso. */
export const intervaloSolicitudes = (datos?: Solicitud[]) =>
  datos?.some(enCurso) ? INTERVALO_SOLICITUDES : false;

function texto(s: Solicitud) {
  const seg = s.segmento ?? "un segmento";
  if (s.tipo === "revisar_campana")
    return enCurso(s)
      ? `La IA está escribiendo otra versión para ${seg}…`
      : `Otra versión para ${seg}`;
  if (s.tipo === "reescribir_correo")
    return enCurso(s)
      ? "La IA está mejorando un correo…"
      : "Mejora de un correo";
  return enCurso(s)
    ? `La IA está escribiendo una secuencia para ${seg}…`
    : `Secuencia para ${seg}`;
}

/** Solicitudes a la IA de los últimos 7 días (arriba de la lista). */
export default function Solicitudes() {
  const cache = useQueryClient();
  const { notify } = useFeedback();
  const [reintentando, setReintentando] = useState("");
  const q = useQuery({
    queryKey: ["/secuencias/solicitudes"],
    queryFn: () =>
      request("/secuencias/solicitudes", S.solicitudSecuenciaSchema.array()),
    refetchInterval: (query) => intervaloSolicitudes(query.state.data),
  });
  const listas = q.data?.filter((s) => s.estado === "lista").length ?? 0;
  useEffect(() => {
    // Una solicitud terminada deja una secuencia nueva o un borrador.
    if (listas) void cache.invalidateQueries({ queryKey: ["/secuencias"] });
  }, [listas, cache]);
  const recientes = (q.data ?? []).filter(
    (s) =>
      s.tipo !== "reescribir_correo" &&
      Date.now() - new Date(s.creadaEn).getTime() <= SIETE_DIAS,
  );
  if (!recientes.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <Card title="Solicitudes a la IA">
        <ul className="list">
          {recientes.map((s) => (
            <li key={s.id}>
              <div className="row">
                <strong>{texto(s)}</strong>
                {s.estado === "fallida" && (
                  <Badge tono="error">No se pudo completar</Badge>
                )}
                {s.estado === "lista" && <Badge tono="success">Lista</Badge>}
                {s.estado === "en_cola" && (
                  <Badge tono="warning">En cola</Badge>
                )}
                <small className="muted">{fechaHora(s.creadaEn)}</small>
              </div>
              {s.objetivo && (
                <p className="muted">
                  {s.objetivo}
                  {s.numeroCorreos ? ` · ${s.numeroCorreos} correos` : ""}
                </p>
              )}
              {s.estado === "fallida" && (
                <div className="row">
                  <p className="danger">{s.error}</p>
                  <Button
                    disabled={reintentando === s.id}
                    onClick={async () => {
                      setReintentando(s.id);
                      try {
                        await request(
                          `/secuencias/solicitudes/${s.id}/reintentar`,
                          S.okSchema,
                          "POST",
                          {},
                        );
                        notify("Solicitud enviada de nuevo a la IA.");
                        await cache.invalidateQueries({
                          queryKey: ["/secuencias/solicitudes"],
                        });
                      } catch (e) {
                        notify(
                          e instanceof Error
                            ? e.message
                            : "No se pudo reintentar",
                        );
                      } finally {
                        setReintentando("");
                      }
                    }}
                  >
                    Reintentar
                  </Button>
                </div>
              )}
              {s.estado === "lista" && s.secuenciaId && (
                <Link to={`/secuencias/${s.secuenciaId}`}>Abrir</Link>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
