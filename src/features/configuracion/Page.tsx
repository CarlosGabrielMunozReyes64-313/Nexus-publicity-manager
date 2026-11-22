import { API_URL, ApiError } from "../../api/client";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import type { Marca, LimitesEnvio, Integracion } from "../../types";
import * as S from "../../api/schemas";
import { Button, Card, Badge, Tabs, Table } from "../../components/ui";
import { Intro, Resource, useCommand } from "../shared";
import { fecha, fechaHora } from "../../lib/formato";
import { MODO_DEMO } from "../../lib/modo";
type Efecto = { conectar: string; desconectar: string };
/** Qué ocurre realmente con la API activa, explicado antes de confirmar. */
const EFECTO_REAL: Record<Integracion["id"], Efecto> = {
  gmail: {
    conectar:
      "Se abrirá Google para autorizar el envío y la lectura de respuestas con la cuenta de envío configurada en el servidor (GMAIL_CUENTA_ENVIO).",
    desconectar:
      "Se revocará la autorización de Gmail en Google, se pausarán todas las campañas activas y se cancelarán los envíos programados. Para volver a enviar deberá autorizar de nuevo y reanudar cada campaña.",
  },
  formulario: {
    conectar:
      "El receptor empezará a aceptar envíos firmados del formulario del sitio (requiere FORMULARIO_WEBHOOK_SECRETO en el servidor). Cada envío crea o actualiza un contacto con la autorización pendiente de su aprobación.",
    desconectar:
      "El receptor rechazará los envíos del formulario (respuesta 503) y no creará contactos hasta que vuelva a conectarlo. El sitio puede reintentar después con el mismo identificador sin duplicar datos.",
  },
  verificador: {
    conectar:
      "Se hará una consulta de prueba a Hunter con la clave del servidor. Después, los correos nuevos se verificarán con Hunter además de DNS.",
    desconectar:
      "Se borrará la clave comprobada. Los correos nuevos solo se comprobarán por sintaxis y DNS y quedarán como «desconocido».",
  },
  claude: {
    conectar:
      "Se hará una llamada mínima de prueba al proveedor de agentes activo en el servidor (Claude o Gemini) y una búsqueda de prueba con el buscador de Descubrimiento (Tavily si está configurado; si no, el del proveedor). Consume unos pocos tokens y una búsqueda.",
    desconectar:
      "Se borrará la clave comprobada. Con Claude como proveedor, el informe semanal automático deja de programarse; con Gemini, las tareas automáticas siguen las variables del servidor.",
  },
  ga4: {
    conectar:
      "Se hará una consulta de prueba a Google Analytics 4 con la cuenta de servicio. Después se importarán visitas diarias agregadas.",
    desconectar:
      "Se dejarán de importar visitas de GA4. Los datos ya importados se conservan.",
  },
  search_console: {
    conectar:
      "Se hará una consulta de prueba a Search Console. Después se importarán consultas de búsqueda diarias.",
    desconectar:
      "Se dejarán de importar consultas de Search Console. Los datos ya importados se conservan.",
  },
};
const RESULTADO_GMAIL: Record<string, string> = {
  conectado: "Gmail quedó conectado. Reanude las campañas que desee activar.",
  cancelado: "La autorización de Gmail se canceló; no se hizo ningún cambio.",
  cuenta:
    "La cuenta elegida no es la cuenta de envío configurada (GMAIL_CUENTA_ENVIO). Vuelva a intentar con esa cuenta.",
  permisos:
    "Google no concedió todos los permisos (enviar y leer). Vuelva a conectar y acepte ambos.",
  sin_conexion:
    "Google no entregó permiso sin conexión. Quite el acceso de la aplicación en su cuenta de Google y vuelva a conectar.",
  sesion: "Su sesión venció durante la autorización. Inicie sesión y repita.",
  solicitud:
    "La solicitud de autorización venció o no es válida. Vuelva a pulsar Conectar.",
};
/** Dirección pública del receptor: el mismo origen por el que el navegador llega a la API. */
export const urlWebhook = () =>
  new URL(`${API_URL}/webhooks/formulario`, window.location.origin).href;
function Copiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        } catch {
          window.prompt("Copie la dirección:", texto);
        }
      }}
    >
      {copiado ? "Copiada ✓" : "Copiar dirección"}
    </Button>
  );
}
function Integraciones({ items }: { items: Integracion[] }) {
  const cmd = useCommand();
  return (
    <div className="grid">
      {items.map((i) => {
        const conectada = i.estado === "conectada";
        const accion = conectada ? "desconectar" : "conectar";
        const efecto = MODO_DEMO
          ? "Modo demostración: solo cambia el estado simulado; no se conecta a servicios externos."
          : EFECTO_REAL[i.id][accion];
        return (
          <Card key={i.id} title={i.nombre}>
            <Badge>{i.estado}</Badge>
            <p>{i.detalle}</p>
            <p>
              <small>
                Última sincronización:{" "}
                {i.ultimaSincronizacion
                  ? fechaHora(i.ultimaSincronizacion)
                  : "Sin datos"}
              </small>
            </p>
            {i.id === "formulario" && (
              <>
                <label>
                  {MODO_DEMO
                    ? "Webhook (demostración)"
                    : "Dirección del webhook (POST firmado)"}
                  <input readOnly value={urlWebhook()} />
                </label>
                <Copiar texto={urlWebhook()} />
                <p>
                  <small>
                    {MODO_DEMO
                      ? "Secreto ficticio de demostración: no-es-un-secreto-real."
                      : "El secreto se configura en el servidor (FORMULARIO_WEBHOOK_SECRETO) y en el backend del sitio. Nunca se muestra ni se envía al navegador."}
                  </small>
                </p>
              </>
            )}
            <p className="muted">
              <small>
                {conectada ? "Al desconectar: " : "Al conectar: "}
                {efecto}
              </small>
            </p>
            <Button
              variant={conectada ? "danger" : undefined}
              onClick={() =>
                i.id === "gmail" && !conectada && !MODO_DEMO
                  ? cmd.confirm({
                      title: "Conectar Gmail",
                      summary: efecto,
                      run: async () => {
                        window.location.assign(
                          `${API_URL}/integraciones/gmail/autorizar`,
                        );
                        return "Abriendo Google…";
                      },
                    })
                  : cmd.confirm({
                      title: `${conectada ? "Desconectar" : "Conectar"} ${i.nombre}`,
                      summary: <p>{efecto}</p>,
                      run: async () => {
                        const r = S.cambioIntegracionSchema.safeParse(
                          await cmd.run(`/integraciones/${i.id}/${accion}`),
                        );
                        if (!r.success) return "Cambio guardado correctamente.";
                        return r.data.estado === "error"
                          ? `No se pudo conectar: ${r.data.detalle}`
                          : r.data.detalle;
                      },
                    })
              }
            >
              {conectada ? "Desconectar" : "Conectar"}
              {MODO_DEMO ? " (simulado)" : ""}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
export default function Page() {
  const location = useLocation();
  const navigate = useNavigate();
  const resultadoGmail = new URLSearchParams(location.search).get("gmail");
  const [tab, setTab] = useState(resultadoGmail ? "Integraciones" : "Marca");
  const cmd = useCommand();
  const { notify } = cmd;
  useEffect(() => {
    if (!resultadoGmail) return;
    notify(
      RESULTADO_GMAIL[resultadoGmail] ??
        "No se pudo completar la autorización de Gmail.",
    );
    navigate("/configuracion", { replace: true });
  }, [resultadoGmail, navigate, notify]);
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
          {(items) => <Integraciones items={items} />}
        </Resource>
      )}
      {MODO_DEMO && (
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
const pausadasSchema = z.object({ pausadas: z.array(z.string()).optional() });
function Limits({ initial }: { initial: LimitesEnvio }) {
  const [l, setL] = useState(initial);
  const [conflicto, setConflicto] = useState("");
  const cmd = useCommand();
  const errores = [
    !l.ventana.dias.length && "Elija al menos un día de envío.",
    l.ventana.desde >= l.ventana.hasta &&
      "La hora «desde» debe ser anterior a «hasta».",
    l.separacionSegundos[0] > l.separacionSegundos[1] &&
      "La separación mínima no puede superar la máxima.",
  ].filter(Boolean) as string[];
  const guardar = async (pausar: boolean) => {
    const r = pausadasSchema.parse(
      await cmd.run(
        `/configuracion/limites${pausar ? "?pausarIncompatibles=true" : ""}`,
        { ...l, ventana: { ...l.ventana, dias: [...l.ventana.dias].sort() } },
        "PUT",
      ),
    );
    setConflicto("");
    return r.pausadas?.length
      ? `Límites guardados. En pausa por horario incompatible: ${r.pausadas.join(", ")}.`
      : "Límites guardados.";
  };
  return (
    <Card title="Ritmo y horarios de envío">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (errores.length) return;
          cmd.confirm({
            title: "Actualizar límites",
            summary:
              "Estos límites regirán las próximas ventanas de envío. Se comprobará que el nuevo horario siga coincidiendo con las campañas aprobadas.",
            run: async () => {
              try {
                return await guardar(false);
              } catch (error) {
                if (error instanceof ApiError && error.status === 409) {
                  setConflicto(error.message);
                  return "No se guardó: el horario no coincide con algunas campañas.";
                }
                throw error;
              }
            },
          });
        }}
      >
        {conflicto && (
          <div className="notice warning" role="alert">
            <p>{conflicto}</p>
            <Button
              variant="danger"
              onClick={() =>
                cmd.confirm({
                  title: "Guardar y pausar campañas afectadas",
                  summary:
                    "Se guardará el nuevo horario y se pausarán las campañas cuya ventana aprobada ya no tiene días u horas en común. Las demás campañas siguen enviando.",
                  run: () => guardar(true),
                })
              }
            >
              Guardar y pausar las campañas afectadas
            </Button>
          </div>
        )}
        {errores.map((e) => (
          <p key={e} role="alert" className="danger">
            {e}
          </p>
        ))}
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
        <Button type="submit" variant="primary" disabled={errores.length > 0}>
          Guardar límites
        </Button>
      </form>
    </Card>
  );
}
