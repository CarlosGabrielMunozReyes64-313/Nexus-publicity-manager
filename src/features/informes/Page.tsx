import { useMemo, useState } from "react";
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
import {
  claveDia,
  diaBogota,
  fecha,
  porcentaje,
  sumarDias,
} from "../../lib/formato";
import { MODO_DEMO } from "../../lib/modo";
import type { MetricaDiaria as Metrica } from "../../types";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
);
interface Dia {
  fecha: string;
  enviados: number;
  respuestas: number;
  visitas: number;
  leads: number;
  clientes: number;
  costo: number | null;
}
/** Suma todas las filas de una misma fecha (campañas y canales) y ordena por día. */
export function agruparPorDia(filas: Metrica[]): Dia[] {
  const dias = new Map<string, Dia>();
  for (const d of filas) {
    const clave = claveDia(d.fecha);
    const x = dias.get(clave) ?? {
      fecha: clave,
      enviados: 0,
      respuestas: 0,
      visitas: 0,
      leads: 0,
      clientes: 0,
      costo: null,
    };
    x.enviados += d.enviados;
    x.respuestas += d.respuestas;
    x.visitas += d.visitas;
    x.leads += d.leads ?? 0;
    x.clientes += d.clientes ?? 0;
    if (d.costoUSD != null) x.costo = (x.costo ?? 0) + d.costoUSD;
    dias.set(clave, x);
  }
  return [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
/** Costo por lead y por cliente calculados por fecha, con cobertura en días únicos. */
export function indicadoresDeCosto(dias: Dia[]) {
  const conCosto = dias.filter((d) => d.costo !== null);
  const costo = conCosto.reduce((n, d) => n + (d.costo ?? 0), 0);
  const leads = conCosto.reduce((n, d) => n + d.leads, 0);
  const clientes = conCosto.reduce((n, d) => n + d.clientes, 0);
  return {
    costo,
    leads,
    clientes,
    costoPorLead: leads > 0 ? costo / leads : null,
    costoAdquisicion: clientes > 0 ? costo / clientes : null,
    diasConCosto: conCosto.length,
    diasConActividad: dias.length,
  };
}
const usd = (n: number | null) => (n == null ? "Sin datos" : n.toFixed(2));
export default function Page() {
  const [tab, setTab] = useState("Correo");
  const [group, setGroup] = useState("campana");
  const hoy = diaBogota();
  const [desde, setDesde] = useState(sumarDias(hoy, -30));
  const [hasta, setHasta] = useState(hoy);
  const rangoValido = !desde || !hasta || desde <= hasta;
  const rango = `desde=${desde}&hasta=${hasta}`;
  const q = useResource(
    `/informes/metricas?agrupacion=${group}&${rango}`,
    S.metricaSchema.array(),
    rangoValido,
  );
  const cams = useResource("/campanas", S.campanaSchema.array());
  const seg = useResource("/segmentos", S.segmentoSchema.array());
  const cmd = useCommand();
  const data = useMemo(() => q.data ?? [], [q.data]);
  const dias = useMemo(() => agruparPorDia(data), [data]);
  const costos = indicadoresDeCosto(dias);
  const sent = dias.reduce((n, d) => n + d.enviados, 0);
  const replies = dias.reduce((n, d) => n + d.respuestas, 0);
  const [costoFecha, setCostoFecha] = useState(hoy);
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
        ? dias.map((d) => ({
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
            max={hasta || undefined}
            onChange={(e) => setDesde(e.target.value)}
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={hasta}
            min={desde || undefined}
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
      {!rangoValido && (
        <p role="alert" className="notice danger">
          La fecha «Desde» debe ser anterior o igual a «Hasta».
        </p>
      )}
      <QueryState
        loading={rangoValido && q.isPending}
        error={q.error}
        retry={q.refetch}
      >
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
            {costos.diasConCosto ? (
              <>
                <p>Costo registrado: USD {usd(costos.costo)}</p>
                <p>
                  Costo por lead (USD): {usd(costos.costoPorLead)}{" "}
                  <small>({costos.leads} leads)</small>
                </p>
                <p>
                  Costo de adquisición (USD): {usd(costos.costoAdquisicion)}{" "}
                  <small>({costos.clientes} clientes)</small>
                </p>
                <p className="notice">
                  Cobertura: {costos.diasConCosto} de {costos.diasConActividad}{" "}
                  días con actividad tienen costo registrado. Los indicadores
                  suman, para cada uno de esos días, el gasto y todos sus leads
                  y clientes (de todas las campañas y canales).
                </p>
              </>
            ) : (
              <p className="notice warning">
                Faltan datos de costos en el periodo
              </p>
            )}
            <form
              className="toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const monto = Number(f.get("costo"));
                const concepto = String(f.get("concepto") ?? "").trim();
                const dia = costoFecha;
                const fuera = dia < desde || dia > hasta;
                cmd.confirm({
                  title: "Registrar costo",
                  summary: (
                    <>
                      <p>
                        Se registrará un gasto de USD {monto.toFixed(2)} con
                        fecha <strong>{fecha(dia)}</strong>
                        {concepto ? ` · ${concepto}` : ""}.
                      </p>
                      {fuera && (
                        <p className="notice warning">
                          Esa fecha está fuera del periodo filtrado; amplíe
                          «Desde» y «Hasta» para verla en estos indicadores.
                        </p>
                      )}
                    </>
                  ),
                  run: async () => {
                    await cmd.run("/informes/costos", {
                      costoUSD: monto,
                      fecha: dia,
                      concepto,
                    });
                    return `Gasto registrado para el ${fecha(dia)}.`;
                  },
                });
              }}
            >
              <label>
                Fecha del gasto
                <input
                  required
                  type="date"
                  max={hoy}
                  value={costoFecha}
                  onChange={(e) => setCostoFecha(e.target.value)}
                />
              </label>
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
              <label>
                Concepto (opcional)
                <input name="concepto" maxLength={200} />
              </label>
              <Button type="submit">Registrar costo</Button>
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
                    labels: dias.map((d) => fecha(d.fecha)),
                    datasets:
                      tab === "Sitio web"
                        ? [
                            {
                              label: "Visitas",
                              data: dias.map((d) => d.visitas),
                              borderColor: "#025873",
                              backgroundColor: "#025873",
                              pointRadius: 0,
                            },
                          ]
                        : [
                            {
                              label: "Envíos",
                              data: dias.map((d) => d.enviados),
                              borderColor: "#025873",
                              backgroundColor: "#025873",
                              pointRadius: 0,
                            },
                            {
                              label: "Respuestas",
                              data: dias.map((d) => d.respuestas),
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
          aperturas.{" "}
          {MODO_DEMO
            ? "Las series y canales son ejemplos simulados."
            : "Cada envío, respuesta, visita, formulario y cierre se cuenta en su propia fecha (hora de Bogotá)."}{" "}
          Los filtros de fecha se aplican a las series y a sus grupos; los
          grupos sin registros se muestran como Sin datos.
        </p>
        {tab === "Embudo" && rangoValido && (
          <Card
            title={
              desde && hasta
                ? `Embudo de contactos creados entre el ${fecha(desde)} y el ${fecha(hasta)}`
                : "Embudo de todos los contactos"
            }
          >
            <p className="muted">
              <small>
                Sigue el filtro «Desde / Hasta» por fecha de creación del
                contacto; cada contacto aparece en su etapa actual.
              </small>
            </p>
            <Resource path={`/embudo?${rango}`} schema={S.embudoSchema}>
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
