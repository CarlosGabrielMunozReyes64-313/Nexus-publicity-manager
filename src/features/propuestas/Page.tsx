import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import type { PropuestaAgente } from "../../types";
import {
  Button,
  Card,
  Badge,
  EvidenceList,
  DiffView,
  QueryState,
} from "../../components/ui";
import { Intro, Select, Resource, useCommand } from "../shared";
import { puedeInscribir, coincide } from "../../lib/reglas";
export default function Page() {
  const q = useResource("/propuestas", S.propuestaSchema.array());
  const [estado, setEstado] = useState("");
  const [agente, setAgente] = useState("");
  const [tipo, setTipo] = useState("");
  const id = useLocation().pathname.split("/")[2];
  const item = q.data?.find((p) => p.id === id);
  return (
    <>
      <Intro
        title="Propuestas de agentes"
        description="La inteligencia artificial propone. Tu criterio tiene la última palabra."
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {item ? (
          <Detail key={item.id} p={item} />
        ) : (
          <>
            <div className="toolbar">
              <Select
                label="Estado"
                value={estado}
                onChange={setEstado}
                options={S.propuestaSchema.shape.estado.options}
              />
              <Select
                label="Agente"
                value={agente}
                onChange={setAgente}
                options={S.propuestaSchema.shape.agente.options}
              />
              <Select
                label="Tipo"
                value={tipo}
                onChange={setTipo}
                options={S.propuestaSchema.shape.tipo.options}
              />
            </div>
            <div className="grid">
              {q.data
                ?.filter(
                  (p) =>
                    (!estado || p.estado === estado) &&
                    (!agente || p.agente === agente) &&
                    (!tipo || p.tipo === tipo),
                )
                .map((p) => (
                  <Card key={p.id}>
                    <div className="row">
                      <Badge>{p.estado}</Badge>
                      <small>
                        {p.agente} · v{p.version}
                      </small>
                    </div>
                    <h2 style={{ marginTop: 16 }}>{p.resumen}</h2>
                    <p className="muted">
                      {p.tipo.replaceAll("_", " ")} · {p.fuentes.length} fuentes
                    </p>
                    <Link to={`/propuestas/${p.id}`}>Revisar propuesta →</Link>
                  </Card>
                ))}
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
function Detail({ p }: { p: PropuestaAgente }) {
  const cmd = useCommand();
  const [text, setText] = useState(p.resumen);
  const [editing, setEditing] = useState(false);
  const cs = useResource("/contactos", S.contactoSchema.array());
  const es = useResource("/empresas", S.empresaSchema.array());
  const sup = useResource("/supresiones", S.supresionSchema.array());
  const segs = useResource("/segmentos", S.segmentoSchema.array());
  const cams = useResource("/campanas", S.campanaSchema.array());
  const campaign = cams.data?.find((c) => c.id === p.objetivoId);
  const seg = segs.data?.find((s) => s.id === campaign?.segmentoId);
  const destinatarios = (cs.data ?? []).filter(
    (c) =>
      puedeInscribir(c, sup.data ?? []) &&
      es.data?.find((e) => e.id === c.empresaId)?.estadoCuenta !== "cliente" &&
      coincide(c, es.data ?? [], seg?.reglas ?? []),
  ).length;
  return (
    <>
      <Link to="/propuestas">← Propuestas</Link>
      <div className="grid" style={{ marginTop: 20 }}>
        <Card title="Revisión de propuesta">
          <Badge>{p.estado}</Badge>
          <p>{p.resumen}</p>
          {editing && (
            <label>
              Contenido de la propuesta
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <Button
                onClick={async () => {
                  if (
                    await cmd.save(
                      `/propuestas/${p.id}`,
                      { resumen: text },
                      "PUT",
                    )
                  )
                    setEditing(false);
                }}
              >
                Guardar nueva versión
              </Button>
            </label>
          )}
          {p.tipo === "correo_inferido" && (
            <p className="notice warning">
              Correo inferido: requiere verificación. Aprobar la propuesta no
              puede convertirlo en un correo válido.
            </p>
          )}
          {p.tipo === "campana" && campaign && (
            <Resource
              path={`/secuencias/${campaign.secuenciaId}`}
              schema={S.secuenciaSchema}
            >
              {(s) => (
                <>
                  <h3>{campaign.nombre}</h3>
                  <p>Objetivo: {s.objetivo}</p>
                  <p>
                    Segmento: {seg?.nombre} · {destinatarios} destinatarios
                    elegibles
                  </p>
                  <p>{seg?.justificacion}</p>
                  <p>Llamada a la acción: {s.llamadaAccion}</p>
                  {s.pasos.map((p) => (
                    <details key={p.id} open>
                      <summary>
                        Paso {p.orden} · espera {p.esperaDiasHabiles} días
                        hábiles
                      </summary>
                      <h3>{p.asunto ?? "Continúa en el mismo hilo"}</h3>
                      <pre>{p.cuerpo}</pre>
                      <small>
                        Variables:{" "}
                        {p.variables
                          .map(
                            (v) =>
                              `${v.nombre} → ${v.campoFuente}; respaldo: ${v.respaldo}`,
                          )
                          .join(" · ") ||
                          "Nombre y empresa: solo evidencia verificada; si falta, texto genérico."}
                      </small>
                    </details>
                  ))}
                  <p>Métricas: {s.metricasExito.join(" · ")}</p>
                  <p>
                    Ventana: {s.ventanaEnvio.desde}–{s.ventanaEnvio.hasta} ·
                    días {s.ventanaEnvio.dias.join(", ")} · America/Bogota
                  </p>
                  <p className="notice">
                    Respuesta: pausa. Baja o rebote duro: supresión. Reunión o
                    cliente: salida.
                  </p>
                  <Link to={`/secuencias/${s.id}/editar`}>
                    Editar secuencia
                  </Link>
                </>
              )}
            </Resource>
          )}
          <hr />
          <div className="row">
            <Button
              variant="primary"
              disabled={
                p.estado === "aprobada" ||
                p.tipo === "correo_inferido" ||
                cs.isPending ||
                es.isPending ||
                sup.isPending ||
                segs.isPending ||
                cams.isPending
              }
              onClick={() =>
                cmd.ask(
                  "Aprobar propuesta",
                  p.tipo === "campana" ? (
                    <>
                      <p>
                        {destinatarios} destinatarios elegibles · Tope diario:{" "}
                        {campaign?.topeDiario}.
                      </p>
                      <p>
                        Primer envío estimado: próxima ventana hábil tras
                        activar la campaña; no se programa al aprobar. No se
                        enviarán correos reales en esta demostración.
                      </p>
                      <p>{campaign?.nombre}</p>
                    </>
                  ) : (
                    <p>
                      Se aprobará la versión {p.version}: {p.resumen}. Los
                      correos inferidos no se validan automáticamente.
                    </p>
                  ),
                  `/propuestas/${p.id}/aprobar`,
                )
              }
            >
              Aprobar propuesta
            </Button>
            <Button onClick={() => setEditing(!editing)}>Editar</Button>
            <Button
              variant="danger"
              onClick={() => {
                let comentario = "";
                cmd.confirm({
                  title: "Rechazar propuesta",
                  summary:
                    "El comentario quedará registrado en el historial de decisiones.",
                  reason: true,
                  onReason: (s) => {
                    comentario = s;
                  },
                  run: () =>
                    cmd.run(`/propuestas/${p.id}/rechazar`, { comentario }),
                });
              }}
            >
              Rechazar
            </Button>
          </div>
        </Card>
        <div className="stack">
          <Card title="Fuentes y evidencias">
            <EvidenceList items={p.fuentes} />
            {!p.fuentes.length && (
              <p>
                Sin evidencia externa; recomendación basada en las métricas del
                entorno.
              </p>
            )}
          </Card>
          <Card title="Historial de versiones">
            <DiffView
              before={p.versiones.at(-2)?.contenido ?? "Sin versión anterior"}
              after={p.versiones.at(-1)?.contenido}
            />
            <small>
              Versión actual: {p.version} · Las ediciones vuelven a revisión.
            </small>
            {p.decision && <p>Decisión: {p.decision.comentario ?? p.estado}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
