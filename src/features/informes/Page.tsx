import { useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import {
  Button,
  Card,
  Tabs,
  KpiTile,
  Table,
  QueryState,
  FunnelChart,
} from "../../components/ui";
import { Intro, Select, Resource, useCommand } from "../shared";
import { fecha, porcentaje } from "../../lib/formato";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
);
export default function Page() {
  const [tab, setTab] = useState("Correo");
  const [group, setGroup] = useState("campana");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const q = useResource(
    `/informes/metricas?agrupacion=${group}&desde=${desde}&hasta=${hasta}`,
    S.metricaSchema.array(),
  );
  const cams = useResource("/campanas", S.campanaSchema.array());
  const seg = useResource("/segmentos", S.segmentoSchema.array());
  const cmd = useCommand();
  const data = q.data ?? [];
  const sent = data.reduce((n, d) => n + d.enviados, 0);
  const replies = data.reduce((n, d) => n + d.respuestas, 0);
  const costos = data.filter((d) => d.costoUSD !== null);
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: "bottom" as const } },
    scales: { y: { beginAtZero: true } },
  };
  const groups =
    group === "fuente"
      ? [...new Set(data.map((d) => d.fuente))].map((f) => ({
          grupo:
            f === "directo_desconocido"
              ? "Desconocido"
              : f.replaceAll("_", " "),
          enviados: data
            .filter((d) => d.fuente === f)
            .reduce((n, d) => n + d.enviados, 0),
          respuestas: data
            .filter((d) => d.fuente === f)
            .reduce((n, d) => n + d.respuestas, 0),
        }))
      : group === "periodo"
        ? data.map((d) => ({
            grupo: fecha(d.fecha),
            enviados: d.enviados,
            respuestas: d.respuestas,
          }))
        : group === "segmento"
          ? (seg.data ?? []).map((s) => {
              const rows = data.filter((d) => d.segmentoId === s.id);
              return {
                grupo: s.nombre,
                enviados: rows.length
                  ? rows.reduce((n, d) => n + d.enviados, 0)
                  : "Sin datos",
                respuestas: rows.length
                  ? rows.reduce((n, d) => n + d.respuestas, 0)
                  : "Sin datos",
              };
            })
          : (cams.data ?? []).map((c) => {
              const rows = data.filter((d) => d.campanaId === c.id);
              return {
                grupo: c.nombre,
                enviados: rows.length
                  ? rows.reduce((n, d) => n + d.enviados, 0)
                  : "Sin datos",
                respuestas: rows.length
                  ? rows.reduce((n, d) => n + d.respuestas, 0)
                  : "Sin datos",
              };
            });
  return (
    <>
      <Intro
        title="Informes"
        description="Mide lo que acerca una conversación a una oportunidad real."
      />
      <Tabs
        items={["Correo", "Sitio web", "Embudo", "Costos"]}
        value={tab}
        onChange={setTab}
      />
      <div className="toolbar">
        <label>
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </label>
        <Select
          all={false}
          label="Agrupar por"
          value={group}
          onChange={setGroup}
          options={["campana", "segmento", "fuente", "periodo"]}
        />
      </div>
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        <div className="grid three" style={{ marginBottom: 20 }}>
          <KpiTile
            label="Correos del periodo"
            value={data.length ? sent : "Sin datos"}
          />
          <KpiTile
            label="Tasa de respuesta"
            value={porcentaje(data.length ? replies : null, sent)}
          />
          <KpiTile
            label="Visitas registradas"
            value={
              data.length
                ? data.reduce((n, d) => n + d.visitas, 0)
                : "Sin datos"
            }
          />
        </div>
        {tab === "Costos" ? (
          <Card title="Costos y adquisición">
            {costos.length ? (
              <>
                <p>
                  Costo registrado: USD{" "}
                  {costos.reduce((n, d) => n + (d.costoUSD ?? 0), 0).toFixed(2)}
                </p>
                <p>
                  Costo por lead (USD):{" "}
                  {costos.reduce((n, d) => n + (d.leads ?? 0), 0) > 0
                    ? (
                        costos.reduce((n, d) => n + (d.costoUSD ?? 0), 0) /
                        costos.reduce((n, d) => n + (d.leads ?? 0), 0)
                      ).toFixed(2)
                    : "Sin datos"}
                </p>
                <p>
                  Costo de adquisición (USD):{" "}
                  {costos.reduce((n, d) => n + (d.clientes ?? 0), 0) > 0
                    ? (
                        costos.reduce((n, d) => n + (d.costoUSD ?? 0), 0) /
                        costos.reduce((n, d) => n + (d.clientes ?? 0), 0)
                      ).toFixed(2)
                    : "Sin datos"}
                </p>
                <p className="notice">
                  Cobertura: {costos.length} de {data.length} días. Estos
                  indicadores solo usan los días con costo registrado y su
                  atribución simulada.
                </p>
              </>
            ) : (
              <p className="notice warning">Faltan datos de costos</p>
            )}
            <form
              className="toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                cmd.ask(
                  "Registrar costo",
                  "Se asociará al último día de métricas disponibles.",
                  "/informes/costos",
                  { costoUSD: Number(f.get("costo")) },
                );
              }}
            >
              <label>
                Costo (USD)
                <input
                  required
                  type="number"
                  step="0.01"
                  min={0}
                  name="costo"
                />
              </label>
              <Button type="submit">Registrar costos</Button>
            </form>
          </Card>
        ) : (
          <div className="grid">
            <Card
              title={
                tab === "Sitio web"
                  ? "Visitas por día"
                  : tab === "Embudo"
                    ? "Respuestas por día"
                    : "Evolución de envíos y respuestas"
              }
            >
              <div className="charts">
                <Line
                  options={options}
                  data={{
                    labels: data.map((d) => fecha(d.fecha)),
                    datasets:
                      tab === "Sitio web"
                        ? [
                            {
                              label: "Visitas",
                              data: data.map((d) => d.visitas),
                              borderColor: "#025873",
                              backgroundColor: "#025873",
                              pointRadius: 0,
                            },
                          ]
                        : [
                            {
                              label: "Envíos",
                              data: data.map((d) => d.enviados),
                              borderColor: "#025873",
                              backgroundColor: "#025873",
                              pointRadius: 0,
                            },
                            {
                              label: "Respuestas",
                              data: data.map((d) => d.respuestas),
                              borderColor: "#16804e",
                              backgroundColor: "#16804e",
                              pointRadius: 0,
                            },
                          ],
                  }}
                />
              </div>
            </Card>
            <Card
              title={
                tab === "Sitio web"
                  ? "Visitas por canal"
                  : "Comparación de resultados"
              }
            >
              <div className="charts">
                <Bar
                  options={options}
                  data={
                    tab === "Sitio web"
                      ? {
                          labels: [
                            "Orgánico de búsqueda",
                            "Orgánico de redes",
                            "Pagado",
                            "Correo",
                            "Referencias",
                            "Desconocido",
                          ],
                          datasets: [
                            {
                              label: "Visitas",
                              data: [
                                "organico_busqueda",
                                "organico_redes",
                                "pagado",
                                "correo",
                                "referencia",
                                "directo_desconocido",
                              ].map((f) =>
                                data
                                  .filter((d) => d.fuente === f)
                                  .reduce((n, d) => n + d.visitas, 0),
                              ),
                              backgroundColor: "#025873",
                            },
                          ],
                        }
                      : {
                          labels: groups.slice(0, 10).map((g) => g.grupo),
                          datasets: [
                            {
                              label: "Respuestas",
                              data: groups
                                .slice(0, 10)
                                .map((g) =>
                                  typeof g.respuestas === "number"
                                    ? g.respuestas
                                    : null,
                                ),
                              backgroundColor: "#16804e",
                            },
                          ],
                        }
                  }
                />
              </div>
            </Card>
          </div>
        )}
        <p className="notice">
          ⓘ Tasa de apertura: poco fiable; Apple Mail y Gmail alteran las
          aperturas. Las series y canales son ejemplos simulados. Los filtros de
          fecha se aplican a las series y a sus grupos; los grupos sin registros
          se muestran como Sin datos.
        </p>
        {tab === "Embudo" && (
          <Card title="Distribución actual del embudo">
            <Resource path="/embudo" schema={S.embudoSchema}>
              {(items) => <FunnelChart items={items} />}
            </Resource>
          </Card>
        )}
        <Card title="Detalle de métricas">
          <Table
            data={groups}
            columns={[
              { accessorKey: "grupo", header: "Grupo" },
              { accessorKey: "enviados", header: "Enviados" },
              { accessorKey: "respuestas", header: "Respuestas" },
            ]}
          />
        </Card>
      </QueryState>
      <h2 style={{ marginTop: 24 }}>Recomendaciones semanales del Analista</h2>
      <Resource
        path="/informes/recomendaciones"
        schema={S.recomendacionSchema.array()}
      >
        {(items) => (
          <div className="grid">
            {items.map((r) => (
              <Card key={r.id}>
                <p>{r.texto}</p>
                <small>{r.estado}</small>
                <div className="row">
                  <Button
                    disabled={r.estado !== "pendiente"}
                    onClick={() =>
                      cmd.ask(
                        "Crear propuesta desde recomendación",
                        "Se creará una propuesta pendiente; no se modifica ninguna campaña.",
                        `/informes/recomendaciones/${r.id}/aprobar`,
                      )
                    }
                  >
                    Aprobar recomendación
                  </Button>
                  <Button
                    disabled={r.estado !== "pendiente"}
                    onClick={() =>
                      cmd.ask(
                        "Descartar recomendación",
                        "Se marcará descartada.",
                        `/informes/recomendaciones/${r.id}/descartar`,
                      )
                    }
                  >
                    Descartar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Resource>
    </>
  );
}
