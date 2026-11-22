import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../../api/client";
import * as S from "../../api/schemas";
import { Badge, Button, Card, useFeedback } from "../../components/ui";
import { fechaHora } from "../../lib/formato";

type Solicitud = z.infer<typeof S.solicitudRutaSchema>;
const SIETE_DIAS = 7 * 86400000;
export const INTERVALO_SOLICITUDES = 15000;

const activa = (s: Solicitud) =>
  s.estado === "en_cola" || s.estado === "trabajando";

/** Consulta cada 15 s solo mientras alguna solicitud siga en cola o en proceso. */
export const intervaloSolicitudes = (datos?: Solicitud[]) =>
  datos?.some(activa) ? INTERVALO_SOLICITUDES : false;

const ESTADO: Record<
  Solicitud["estado"],
  [string, "success" | "warning" | "error" | "info"]
> = {
  en_cola: ["En cola", "warning"],
  trabajando: ["El agente está trabajando", "info"],
  lista: ["Lista", "success"],
  fallida: ["No se pudo completar", "error"],
};

const titulo = (s: Solicitud) =>
  s.tipo === "proponer_campana"
    ? `Ruta para «${s.segmento ?? "segmento eliminado"}»`
    : `Versión nueva para «${s.segmento ?? "segmento eliminado"}»`;

/** Panel «Solicitudes en curso»: pedidos de rutas de los últimos 7 días. */
export default function Solicitudes() {
  const cache = useQueryClient();
  const { notify } = useFeedback();
  const [reintentando, setReintentando] = useState("");
  const q = useQuery({
    queryKey: ["/propuestas/solicitudes"],
    queryFn: () =>
      request("/propuestas/solicitudes", S.solicitudRutaSchema.array()),
    refetchInterval: (query) => intervaloSolicitudes(query.state.data),
  });
  const listas = q.data?.filter((s) => s.estado === "lista").length ?? 0;
  useEffect(() => {
    // Una solicitud terminada deja una ruta nueva: se recarga la lista.
    if (listas) void cache.invalidateQueries({ queryKey: ["/propuestas"] });
  }, [listas, cache]);
  const recientes = (q.data ?? []).filter(
    (s) => Date.now() - new Date(s.creadaEn).getTime() <= SIETE_DIAS,
  );
  if (!recientes.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <Card title="Solicitudes en curso">
        <ul className="list">
          {recientes.map((s) => (
            <li key={s.id}>
              <div className="row">
                <strong>{titulo(s)}</strong>
                <Badge tono={ESTADO[s.estado][1]}>{ESTADO[s.estado][0]}</Badge>
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
                          `/propuestas/solicitudes/${s.id}/reintentar`,
                          S.okSchema,
                          "POST",
                          {},
                        );
                        notify(
                          "Solicitud enviada de nuevo. El agente está preparando la ruta.",
                        );
                        await cache.invalidateQueries({
                          queryKey: ["/propuestas/solicitudes"],
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
              {s.estado === "lista" && s.propuestaId && (
                <p>
                  <Link to={`/propuestas/${s.propuestaId}`}>Ver la ruta →</Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
