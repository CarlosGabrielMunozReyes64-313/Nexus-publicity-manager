import { Link, useLocation } from "react-router-dom";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import {
  Button,
  Card,
  Badge,
  Table,
  KpiTile,
  QueryState,
} from "../../components/ui";
import { Intro, Resource, useCommand } from "../shared";
import { fecha } from "../../lib/formato";
import type { Campana } from "../../types";
export default function Page() {
  const q = useResource("/campanas", S.campanaSchema.array());
  const id = useLocation().pathname.split("/")[2];
  const c = q.data?.find((c) => c.id === id);
  return (
    <>
      <Intro
        title={c?.nombre ?? "Campañas"}
        description="Cada campaña, bajo control. Estado, destinatarios y resultados en un solo lugar."
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {c ? (
          <Detail c={c} />
        ) : (
          <div className="stack">
            {q.data?.map((c) => (
              <Card key={c.id}>
                <div className="row">
                  <Badge>{c.estado}</Badge>
                  <small>
                    Tope: {c.topeDiario}/día · {c.metricas.inscritos} inscritos
                  </small>
                </div>
                <h2 style={{ marginTop: 14 }}>
                  <Link to={`/campanas/${c.id}`}>{c.nombre}</Link>
                </h2>
                <div className="row">
                  <span>{c.metricas.enviados} envíos</span>
                  <span>{c.metricas.respuestas} respuestas</span>
                  <span>{c.metricas.diagnosticos} diagnósticos</span>
                </div>
                <progress
                  aria-label="Avance de pasos de campaña"
                  max={Math.max(c.metricas.inscritos * 3, 1)}
                  value={c.metricas.enviados}
                />
                <Actions c={c} />
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}
function Actions({ c }: { c: Campana }) {
  const cmd = useCommand();
  return (
    <div className="row" style={{ marginTop: 18 }}>
      <Button
        disabled={c.estado !== "activa"}
        onClick={() =>
          cmd.ask(
            "Pausar campaña",
            "Se pausarán los envíos pendientes; no se eliminará el historial.",
            `/campanas/${c.id}/pausar`,
          )
        }
      >
        Pausar
      </Button>
      <Button
        variant="primary"
        disabled={!["aprobada", "pausada"].includes(c.estado)}
        onClick={() =>
          cmd.ask(
            "Activar o reanudar campaña",
            `${c.nombre}: máximo ${c.topeDiario} contactos diarios; solo inscripciones elegibles sin motivo de salida. Simulación sin envío real.`,
            `/campanas/${c.id}/reanudar`,
          )
        }
      >
        Activar / reanudar
      </Button>
      <Button
        variant="danger"
        disabled={c.estado === "finalizada"}
        onClick={() =>
          cmd.ask(
            "Detener campaña",
            "Se finalizarán todas sus inscripciones. El historial se conserva.",
            `/campanas/${c.id}/detener`,
          )
        }
      >
        Detener
      </Button>
    </div>
  );
}
function Detail({ c }: { c: Campana }) {
  return (
    <>
      <Link to="/campanas">← Campañas</Link>
      <Card>
        <Badge>{c.estado}</Badge>
        <Actions c={c} />
        <p>
          <Link to={`/secuencias/${c.secuenciaId}/editar`}>
            Revisar secuencia
          </Link>{" "}
          · Versión aprobada: {c.versionAprobada ?? "Pendiente"}
        </p>
      </Card>
      <div className="grid three" style={{ margin: "20px 0" }}>
        {Object.entries(c.metricas).map(([k, v]) => (
          <KpiTile key={k} label={k} value={v} />
        ))}
      </div>
      <Card title="Inscripciones y calendario de próximos envíos">
        <Resource
          path={`/campanas/${c.id}/inscripciones`}
          schema={S.inscripcionSchema.array()}
        >
          {(items) => (
            <Resource path="/contactos" schema={S.contactoSchema.array()}>
              {(contacts) => (
                <Table
                  data={items}
                  columns={[
                    {
                      id: "contacto",
                      header: "Contacto",
                      cell: (r) => (
                        <Link to={`/contactos/${r.row.original.contactoId}`}>
                          {
                            contacts.find(
                              (c) => c.id === r.row.original.contactoId,
                            )?.nombre
                          }
                        </Link>
                      ),
                    },
                    { accessorKey: "pasoActual", header: "Paso" },
                    {
                      accessorKey: "estado",
                      header: "Estado",
                      cell: (r) => <Badge>{r.row.original.estado}</Badge>,
                    },
                    { accessorKey: "motivoSalida", header: "Motivo de salida" },
                    {
                      id: "fecha",
                      header: "Próximo envío",
                      cell: (r) =>
                        r.row.original.proximoEnvio
                          ? fecha(r.row.original.proximoEnvio)
                          : "Sin programación",
                    },
                  ]}
                />
              )}
            </Resource>
          )}
        </Resource>
      </Card>
    </>
  );
}
