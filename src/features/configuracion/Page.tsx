import { useState } from "react";
import type { Marca, LimitesEnvio } from "../../types";
import * as S from "../../api/schemas";
import { Button, Card, Badge, Tabs, Table } from "../../components/ui";
import { Intro, Resource, useCommand } from "../shared";
import { fecha } from "../../lib/formato";
export default function Page() {
  const [tab, setTab] = useState("Marca");
  const cmd = useCommand();
  return (
    <>
      <Intro
        title="Configuración"
        description="Define la voz de NEXUS y los límites de cada conversación."
      />
      <Tabs
        items={[
          "Marca",
          "Cliente ideal",
          "Límites y horarios",
          "Cumplimiento",
          "Integraciones",
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Marca" && (
        <Resource path="/configuracion/marca" schema={S.marcaSchema}>
          {(m) => <Brand initial={m} />}
        </Resource>
      )}
      {tab === "Cliente ideal" && (
        <Resource
          path="/configuracion/cliente-ideal"
          schema={S.clienteIdealSchema}
        >
          {(c) => (
            <Card title="Criterios de calificación">
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  cmd.ask(
                    "Guardar cliente ideal",
                    "Se actualizarán los criterios para futuras propuestas.",
                    "/configuracion/cliente-ideal",
                    {
                      criterios: String(f.get("criterios"))
                        .split("\n")
                        .filter(Boolean),
                    },
                    "PUT",
                  );
                }}
              >
                <label>
                  Un criterio por línea
                  <textarea
                    name="criterios"
                    defaultValue={c.criterios.join("\n")}
                  />
                </label>
                <Button type="submit" variant="primary">
                  Guardar criterios
                </Button>
              </form>
            </Card>
          )}
        </Resource>
      )}
      {tab === "Límites y horarios" && (
        <Resource path="/configuracion/limites" schema={S.limitesSchema}>
          {(l) => <Limits initial={l} />}
        </Resource>
      )}
      {tab === "Cumplimiento" && (
        <div className="stack">
          <Resource path="/configuracion/marca" schema={S.marcaSchema}>
            {(m) => (
              <Card title="Protección de datos y bajas">
                <form
                  className="stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    cmd.ask(
                      "Guardar cumplimiento",
                      "Se actualizarán la política y el texto de baja.",
                      "/configuracion/marca",
                      {
                        ...m,
                        politica: String(f.get("politica")),
                        baja: String(f.get("baja")),
                      },
                      "PUT",
                    );
                  }}
                >
                  <label>
                    URL de política de datos
                    <input
                      type="url"
                      required
                      name="politica"
                      defaultValue={m.politica}
                    />
                  </label>
                  <label>
                    Línea de baja
                    <textarea required name="baja" defaultValue={m.baja} />
                  </label>
                  <Button type="submit">Guardar</Button>
                </form>
                <p className="notice">
                  Base legal revisada por el administrador antes de cualquier
                  inscripción. Las bajas y supresiones prevalecen sobre las
                  aprobaciones.
                </p>
              </Card>
            )}
          </Resource>
          <Card title="Lista de supresión">
            <form
              className="toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                cmd.ask(
                  "Agregar supresión",
                  "Se excluirán inmediatamente los contactos coincidentes y se finalizarán sus inscripciones.",
                  "/supresiones",
                  {
                    id: "nuevo",
                    correo: String(f.get("correo")) || undefined,
                    dominio: String(f.get("dominio")) || undefined,
                    motivo: String(f.get("motivo")),
                    fecha: new Date().toISOString(),
                  },
                );
              }}
            >
              <label>
                Correo
                <input
                  type="email"
                  name="correo"
                  placeholder="persona@empresa.example"
                />
              </label>
              <label>
                O dominio
                <input
                  name="dominio"
                  placeholder="empresa.example"
                  pattern="[^@ /]+\.[^@ /]+"
                />
              </label>
              <label>
                Motivo
                <input required minLength={3} name="motivo" />
              </label>
              <Button type="submit" variant="primary">
                Agregar supresión
              </Button>
            </form>
            <Resource path="/supresiones" schema={S.supresionSchema.array()}>
              {(s) => (
                <Table
                  data={s}
                  columns={[
                    { accessorKey: "correo", header: "Correo" },
                    { accessorKey: "dominio", header: "Dominio" },
                    { accessorKey: "motivo", header: "Motivo" },
                    {
                      id: "fecha",
                      header: "Fecha",
                      cell: (c) => fecha(c.row.original.fecha),
                    },
                  ]}
                />
              )}
            </Resource>
          </Card>
        </div>
      )}
      {tab === "Integraciones" && (
        <Resource path="/integraciones" schema={S.integracionSchema.array()}>
          {(items) => (
            <div className="grid">
              {items.map((i) => (
                <Card key={i.id} title={i.nombre}>
                  <Badge>{i.estado}</Badge>
                  <p>{i.detalle}</p>
                  <p>
                    <small>
                      Última sincronización:{" "}
                      {i.ultimaSincronizacion
                        ? fecha(i.ultimaSincronizacion)
                        : "Sin datos"}
                    </small>
                  </p>
                  {i.id === "formulario" && (
                    <>
                      <label>
                        Webhook (demostración)
                        <input
                          readOnly
                          value="https://nexus.example/api/formulario/webhook"
                        />
                      </label>
                      <label>
                        Secreto
                        <input
                          type="password"
                          readOnly
                          value="no-es-un-secreto-real"
                        />
                      </label>
                    </>
                  )}
                  <Button
                    onClick={() =>
                      cmd.ask(
                        i.estado === "conectada"
                          ? "Desconectar integración"
                          : "Conectar integración",
                        `${i.nombre}: solo se actualizará el estado simulado; no se conectará a servicios externos.`,
                        `/integraciones/${i.id}/${i.estado === "conectada" ? "desconectar" : "conectar"}`,
                      )
                    }
                  >
                    {i.estado === "conectada"
                      ? "Desconectar"
                      : "Conectar (simulado)"}
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </Resource>
      )}
      {import.meta.env.VITE_USE_MOCKS === "true" && (
        <details style={{ marginTop: 32 }}>
          <summary>Opciones de desarrollo</summary>
          <p>El estado vive en memoria y se reinicia al recargar la página.</p>
          <Button
            variant="danger"
            onClick={() =>
              cmd.ask(
                "Reiniciar datos simulados",
                "Se perderán los cambios de esta sesión y se restaurarán los datos de ejemplo.",
                "/dev/reset",
              )
            }
          >
            Reiniciar demostración
          </Button>
        </details>
      )}
    </>
  );
}
function Brand({ initial }: { initial: Marca }) {
  const [m, setM] = useState(initial);
  const cmd = useCommand();
  return (
    <Card title="Identidad de marca">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          cmd.ask(
            "Guardar marca",
            "Se actualizará el contexto para las próximas propuestas.",
            "/configuracion/marca",
            m,
            "PUT",
          );
        }}
      >
        {(["nombre", "oferta", "tono", "firma"] as const).map((k) => (
          <label key={k}>
            {k}
            <input
              required
              value={m[k]}
              onChange={(e) => setM({ ...m, [k]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Palabras prohibidas (separadas por coma)
          <input
            value={m.prohibidas.join(", ")}
            onChange={(e) =>
              setM({
                ...m,
                prohibidas: e.target.value.split(",").map((v) => v.trim()),
              })
            }
          />
        </label>
        <Button type="submit" variant="primary">
          Guardar marca
        </Button>
      </form>
    </Card>
  );
}
function Limits({ initial }: { initial: LimitesEnvio }) {
  const [l, setL] = useState(initial);
  const cmd = useCommand();
  return (
    <Card title="Ritmo y horarios de envío">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          cmd.ask(
            "Actualizar límites",
            "Estos límites regirán las próximas ventanas de envío.",
            "/configuracion/limites",
            l,
            "PUT",
          );
        }}
      >
        <div className="grid">
          {(
            [
              {
                key: "topeDiarioNuevos",
                label: "Tope diario de nuevos contactos",
              },
              { key: "topePorDominio", label: "Tope por dominio" },
              {
                key: "umbralRebotePausa",
                label: "Umbral de rebote para pausa (%)",
              },
            ] as const
          ).map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                required
                type="number"
                min={1}
                max={f.key === "umbralRebotePausa" ? 100 : 500}
                value={l[f.key]}
                onChange={(e) =>
                  setL({ ...l, [f.key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
          {[0, 1].map((i) => (
            <label key={i}>
              Separación {i === 0 ? "mínima" : "máxima"} (segundos)
              <input
                type="number"
                min={1}
                value={l.separacionSegundos[i]}
                onChange={(e) =>
                  setL({
                    ...l,
                    separacionSegundos:
                      i === 0
                        ? [Number(e.target.value), l.separacionSegundos[1]]
                        : [l.separacionSegundos[0], Number(e.target.value)],
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="row">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d, i) => (
            <label className="check" key={d}>
              <input
                type="checkbox"
                checked={l.ventana.dias.includes(i)}
                onChange={(e) =>
                  setL({
                    ...l,
                    ventana: {
                      ...l.ventana,
                      dias: e.target.checked
                        ? [...l.ventana.dias, i]
                        : l.ventana.dias.filter((d) => d !== i),
                    },
                  })
                }
              />
              {d}
            </label>
          ))}
        </div>
        <div className="grid">
          <label>
            Desde (Bogotá)
            <input
              required
              type="time"
              value={l.ventana.desde}
              onChange={(e) =>
                setL({ ...l, ventana: { ...l.ventana, desde: e.target.value } })
              }
            />
          </label>
          <label>
            Hasta (Bogotá)
            <input
              required
              type="time"
              value={l.ventana.hasta}
              onChange={(e) =>
                setL({ ...l, ventana: { ...l.ventana, hasta: e.target.value } })
              }
            />
          </label>
        </div>
        <Button type="submit" variant="primary">
          Guardar límites
        </Button>
      </form>
    </Card>
  );
}
