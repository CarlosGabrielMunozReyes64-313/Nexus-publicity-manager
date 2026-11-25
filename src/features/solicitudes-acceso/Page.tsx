import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, UserCheck, UserX } from "lucide-react";
import { ApiError, request } from "../../api/client";
import { RUTA_SOLICITUDES, useSolicitudesAcceso } from "../../api/accesos";
import { RUTA_NOTIFICACIONES } from "../../api/notificaciones";
import * as S from "../../api/schemas";
import type { z } from "zod";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  QueryState,
  useFeedback,
} from "../../components/ui";
import { fechaHora } from "../../lib/formato";
import { Intro } from "../shared";

type Solicitud = z.infer<typeof S.solicitudAccesoSchema>;
const TONO = { aprobada: "success", rechazada: "error" } as const;

export default function Page() {
  const q = useSolicitudesAcceso();
  const destacada = new URLSearchParams(useLocation().search).get("id");
  const cache = useQueryClient();
  const { confirm } = useFeedback();
  const pendientes = q.data?.filter((s) => s.estado === "pendiente") ?? [];
  const historial = q.data?.filter((s) => s.estado !== "pendiente") ?? [];
  const decidir = (s: Solicitud, accion: "aprobar" | "rechazar") =>
    confirm({
      title:
        accion === "aprobar"
          ? "Aprobar solicitud de acceso"
          : "Rechazar solicitud de acceso",
      summary:
        accion === "aprobar" ? (
          <p>
            <strong>{s.nombre ?? s.correo}</strong> podrá entrar con el rol
            «Usuario» la próxima vez que se identifique con Google. Solo verá el
            panel general.
          </p>
        ) : (
          <p>
            <strong>{s.nombre ?? s.correo}</strong> seguirá sin acceso. Si
            vuelve a identificarse con Google verá que su solicitud fue
            rechazada.
          </p>
        ),
      run: async () => {
        try {
          const r = await request(
            `${RUTA_SOLICITUDES}/${s.id}/${accion}`,
            S.decisionSolicitudSchema,
            "POST",
            {},
          );
          return r.solicitud.estado === "aprobada"
            ? `Solicitud aprobada: ${s.correo} ya puede entrar como Usuario.`
            : `Solicitud rechazada: ${s.correo} sigue sin acceso.`;
        } catch (e) {
          // Otro administrador decidió primero: se muestra el estado definitivo.
          if (e instanceof ApiError && e.status === 409) return e.message;
          throw e;
        } finally {
          await cache.invalidateQueries({ queryKey: [RUTA_SOLICITUDES] });
          await cache.invalidateQueries({ queryKey: [RUTA_NOTIFICACIONES] });
        }
      },
    });
  return (
    <>
      <Intro
        title="Solicitudes de acceso"
        description="Personas que se identificaron con Google y piden entrar a NEXUS. Al aprobarlas reciben el rol «Usuario»."
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        <div style={{ display: "grid", gap: 24 }}>
          <Card title={`Pendientes (${pendientes.length})`}>
            {!pendientes.length ? (
              <EmptyState>No hay solicitudes pendientes.</EmptyState>
            ) : (
              <div className="scroll">
                <table aria-label="Solicitudes pendientes">
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th>Correo verificado</th>
                      <th>Solicitada</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendientes.map((s) => (
                      <tr
                        key={s.id}
                        aria-current={s.id === destacada ? "true" : undefined}
                        style={
                          s.id === destacada
                            ? { background: "var(--nx-light)" }
                            : undefined
                        }
                      >
                        <td>
                          <strong>{s.nombre ?? "Sin nombre en Google"}</strong>
                          {s.identificaciones > 1 && (
                            <>
                              <br />
                              <small className="muted">
                                Intentó entrar {s.identificaciones} veces
                              </small>
                            </>
                          )}
                        </td>
                        <td>
                          <span className="row">
                            <BadgeCheck size={14} aria-label="Verificado" />
                            {s.correo}
                          </span>
                        </td>
                        <td>{fechaHora(s.creadaEn)}</td>
                        <td>
                          <span className="row">
                            <Button
                              variant="primary"
                              aria-label={`Aprobar a ${s.correo}`}
                              onClick={() => decidir(s, "aprobar")}
                            >
                              <UserCheck size={14} /> Aprobar
                            </Button>
                            <Button
                              variant="danger"
                              aria-label={`Rechazar a ${s.correo}`}
                              onClick={() => decidir(s, "rechazar")}
                            >
                              <UserX size={14} /> Rechazar
                            </Button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Historial de decisiones">
            {!historial.length ? (
              <EmptyState>
                Todavía no se ha decidido ninguna solicitud.
              </EmptyState>
            ) : (
              <div className="scroll">
                <table aria-label="Historial de decisiones">
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th>Correo</th>
                      <th>Decisión</th>
                      <th>Decidida por</th>
                      <th>Fecha de la decisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((s) => (
                      <tr key={s.id}>
                        <td>{s.nombre ?? "—"}</td>
                        <td>{s.correo}</td>
                        <td>
                          <Badge tono={TONO[s.estado as keyof typeof TONO]}>
                            {s.estado === "aprobada" ? "Aprobada" : "Rechazada"}
                          </Badge>
                        </td>
                        <td>{s.decididaPor?.nombre ?? "—"}</td>
                        <td>{s.decididaEn ? fechaHora(s.decididaEn) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </QueryState>
    </>
  );
}
