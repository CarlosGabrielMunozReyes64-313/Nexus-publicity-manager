import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { z } from "zod";
import { request } from "../../api/client";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import {
  Badge,
  Button,
  Card,
  Modal,
  QueryState,
  useFeedback,
} from "../../components/ui";
import { fechaHora } from "../../lib/formato";
import type { PropuestaAgente, VersionPropuesta } from "../../types";
import EditorSecuencia from "../secuencias/EditorSecuencia";
import { useCommand } from "../shared";
import Historial from "./Historial";
import {
  AUTOR,
  avisosDeCorreo,
  diasDeEnvio,
  duracion,
  leerRuta,
  palabras,
  paraEditor,
  partesConVariables,
  tituloCorreo,
  ventanaTexto,
  versionActual,
  type NotaPaso,
  type RutaCorreo,
} from "./ruta";
import styles from "./Ruta.module.css";

type Revision = z.infer<typeof S.revisionRutaSchema>;

/** Texto con las variables ({{nombre}}) resaltadas como etiquetas. */
export function ConVariables({ texto }: { texto: string }) {
  return (
    <>
      {partesConVariables(texto).map((p, i) =>
        p.variable ? (
          <span key={i} className={styles.variable}>
            {p.texto}
          </span>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </>
  );
}

/** Detalle de una propuesta de ruta de correos (tipo «campana»). */
export default function RutaDetalle({ p }: { p: PropuestaAgente }) {
  const v = versionActual(p);
  const ruta = leerRuta(v?.contenido);
  const revision = useResource(
    `/propuestas/${p.id}/revision`,
    S.revisionRutaSchema,
  );
  const elegibles = useResource(
    `/propuestas/${p.id}/elegibles`,
    S.contactoElegibleSchema.array(),
  );
  const [editando, setEditando] = useState(false);
  const [dialogo, setDialogo] = useState<"aprobar" | "rechazar" | null>(null);
  const cache = useQueryClient();
  const { notify } = useFeedback();
  const nombre = p.ruta?.campanaNombre ?? ruta?.nombre ?? p.resumen;
  const rev = revision.data;
  const motivo = rev ? [...rev.bloqueos, ...rev.errores][0] : undefined;
  return (
    <>
      <Link to="/propuestas">← Propuestas</Link>
      <header style={{ margin: "18px 0" }}>
        <div className="row">
          <Badge>{p.estado}</Badge>
          {p.estado === "pendiente" && (
            <Badge tono="warning">Espera tu revisión</Badge>
          )}
          <small className="muted">
            Versión {p.version} · {AUTOR[v?.autor ?? ""] ?? "Autor sin dato"}
            {v?.fecha ? ` · ${fechaHora(v.fecha)}` : ""}
          </small>
        </div>
        <h2 style={{ margin: "10px 0 4px" }}>{nombre}</h2>
        <div className={styles.datos}>
          {p.ruta && (
            <span>
              Segmento:{" "}
              <Link to={`/segmentos/${p.ruta.segmentoId}`}>
                {p.ruta.segmentoNombre}
              </Link>
            </span>
          )}
          {rev && (
            <span>
              {rev.elegibles}{" "}
              {rev.elegibles === 1
                ? "contacto elegible"
                : "contactos elegibles"}
            </span>
          )}
          {ruta && (
            <span>
              {ruta.pasos.length} correos · {duracion(ruta.pasos)} días hábiles
            </span>
          )}
        </div>
      </header>
      {p.estado === "aprobada" && (
        <p className="notice" style={{ marginBottom: 18 }}>
          Ruta aprobada. Aprobar no envía ningún correo: los envíos empiezan
          cuando actives la campaña en{" "}
          <Link to={`/campanas/${p.objetivoId}`}>Campañas</Link>.
        </p>
      )}
      {editando && ruta ? (
        <EditorSecuencia
          inicial={paraEditor(ruta, p.objetivoId ?? p.id)}
          aviso="Guardar crea una versión nueva de la propuesta, escrita por usted. La campaña queda en revisión hasta que la apruebes; la secuencia en uso no cambia hasta aprobar."
          textoGuardar="Guardar versión nueva"
          notaVistaPrevia="La vista previa usa la versión guardada de la propuesta. Guarde los cambios antes de generarla."
          variables={[
            "nombre",
            "empresa",
            "senal",
            "cargo",
            "municipio",
            "enlace",
            "firma",
            "baja",
          ]}
          contactos={(elegibles.data ?? []).map((c) => ({
            value: c.id,
            label: `${c.nombre} · ${c.empresa}`,
          }))}
          vistaPrevia={(contactoId) =>
            request(
              `/propuestas/${p.id}/previsualizar`,
              S.vistaPreviaSchema,
              "POST",
              {
                contactoId,
              },
            )
          }
          alCancelar={() => setEditando(false)}
          alGuardar={async (s) => {
            const r = await request(
              `/propuestas/${p.id}`,
              S.versionCreadaSchema,
              "PUT",
              { contenido: s },
            );
            await cache.invalidateQueries();
            setEditando(false);
            notify(
              `Se creó la versión ${r.version ?? p.version + 1}. La campaña queda en revisión hasta que la apruebes`,
            );
          }}
        />
      ) : (
        <div className="grid">
          <div className="stack" style={{ alignContent: "start" }}>
            <Card title="Por qué esta ruta">
              <p>
                {ruta?.notasAgente?.general ??
                  "Esta versión no trae notas del agente."}
              </p>
            </Card>
            {ruta ? (
              <LineaDeTiempo
                ruta={ruta}
                advertencias={rev?.advertencias ?? []}
              />
            ) : (
              <Card title="Contenido de la versión">
                <p className="notice warning">
                  El contenido no tiene el formato de una ruta de correos; se
                  muestra tal como llegó.
                </p>
                <pre>{JSON.stringify(v?.contenido ?? null, null, 2)}</pre>
              </Card>
            )}
          </div>
          <div className="stack" style={{ alignContent: "start" }}>
            <Card title="Acciones">
              <div className={styles.acciones}>
                <Button
                  variant="primary"
                  disabled={!rev?.puedeAprobar}
                  onClick={() => setDialogo("aprobar")}
                >
                  Aprobar ruta
                </Button>
                <Button disabled={!ruta} onClick={() => setEditando(true)}>
                  Editar
                </Button>
                <Button
                  variant="danger"
                  disabled={Boolean(v?.decision)}
                  onClick={() => setDialogo("rechazar")}
                >
                  Rechazar
                </Button>
              </div>
              {rev && !rev.puedeAprobar && motivo && (
                <p className="danger" style={{ marginBottom: 0 }}>
                  No se puede aprobar: {motivo}
                </p>
              )}
              {revision.isPending && <small>Revisando la ruta…</small>}
            </Card>
            <QueryState
              loading={revision.isPending}
              error={revision.error}
              retry={revision.refetch}
            >
              {rev && <Verificacion rev={rev} />}
            </QueryState>
            {ruta && (
              <VistaPreviaReal
                propuesta={p.id}
                version={p.version}
                contactos={elegibles.data}
                cargando={elegibles.isPending}
              />
            )}
          </div>
        </div>
      )}
      <div style={{ marginTop: 20 }}>
        <Historial p={p} />
      </div>
      {dialogo === "aprobar" && rev && ruta && v && (
        <Aprobar
          p={p}
          v={v}
          ruta={ruta}
          rev={rev}
          onClose={() => setDialogo(null)}
        />
      )}
      {dialogo === "rechazar" && (
        <Rechazar p={p} onClose={() => setDialogo(null)} />
      )}
    </>
  );
}

function LineaDeTiempo({
  ruta,
  advertencias,
}: {
  ruta: RutaCorreo;
  advertencias: string[];
}) {
  const dias = diasDeEnvio(ruta.pasos);
  const notas = new Map<number, NotaPaso>(
    (ruta.notasAgente?.pasos ?? []).map((n) => [n.orden, n]),
  );
  return (
    <Card title="La ruta">
      <p className="muted">
        Ventana: {ventanaTexto(ruta.ventanaEnvio)} · Llamada a la acción:{" "}
        {ruta.llamadaAccion}
      </p>
      <ol className={styles.linea} aria-label="Correos de la ruta">
        {ruta.pasos.map((paso, i) => {
          const nota = notas.get(i + 1);
          const avisos = avisosDeCorreo(advertencias, i);
          return (
            <li key={paso.id ?? i} className={styles.correo}>
              <div className={styles.etiquetaCorreo}>
                {tituloCorreo(i, dias[i], paso.mismoHilo)}
              </div>
              <p className={styles.asunto}>
                {paso.asunto ? (
                  <>
                    Asunto: <ConVariables texto={paso.asunto} />
                  </>
                ) : (
                  <span className="muted">Responde en el mismo hilo</span>
                )}
              </p>
              <div className={styles.cuerpo}>
                <ConVariables texto={paso.cuerpo} />
              </div>
              <div className={styles.nota}>
                {nota?.editadoPorAdmin ? (
                  <p>
                    <strong>Editado por el administrador</strong>
                  </p>
                ) : nota?.proposito || nota?.porQue ? (
                  <>
                    {nota.proposito && (
                      <p>
                        <strong>Propósito:</strong> {nota.proposito}
                      </p>
                    )}
                    {nota.porQue && (
                      <p>
                        <strong>Por qué así:</strong> {nota.porQue}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    Sin notas del agente para este correo.
                  </p>
                )}
              </div>
              <div className={styles.datos}>
                <span>{palabras(paso.cuerpo)} palabras</span>
                {i > 0 && (
                  <span className={styles.espera}>
                    Espera {paso.esperaDiasHabiles} días hábiles
                  </span>
                )}
              </div>
              {avisos.map((a) => (
                <p key={a} className={styles.aviso}>
                  <AlertTriangle size={14} aria-hidden /> {a}
                </p>
              ))}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** Lista de verificación: rojo lo que bloquea, ámbar lo que conviene revisar, verde lo que está bien. */
export function Verificacion({ rev }: { rev: Revision }) {
  const bien: string[] = [];
  if (!rev.errores.length) bien.push("Firma, enlace de baja y asunto en orden");
  if (rev.segmento?.estado === "aprobado") bien.push("Segmento aprobado");
  if (rev.elegibles > 0)
    bien.push(
      `${rev.elegibles} ${rev.elegibles === 1 ? "contacto elegible" : "contactos elegibles"} con base legal aprobada`,
    );
  if (rev.ventanaValida) bien.push("Ventana dentro del horario global");
  if (rev.gmailConectado) bien.push("Gmail conectado");
  if (rev.puedeAprobar) bien.push("Lista para aprobar");
  return (
    <Card title="Lista de verificación">
      <ul className={styles.verificacion}>
        {[...rev.bloqueos, ...rev.errores].map((t) => (
          <li key={"b" + t} className={styles.bloqueo}>
            <XCircle size={16} aria-label="Bloquea" /> {t}
          </li>
        ))}
        {rev.advertencias.map((t) => (
          <li key={"a" + t} className={styles.aviso}>
            <AlertTriangle size={16} aria-label="Revisar" /> {t}
          </li>
        ))}
        {bien.map((t) => (
          <li key={"o" + t} className={styles.ok}>
            <CheckCircle2 size={16} aria-label="Correcto" /> {t}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function VistaPreviaReal({
  propuesta,
  version,
  contactos,
  cargando,
}: {
  propuesta: string;
  version: number;
  contactos?: z.infer<typeof S.contactoElegibleSchema>[];
  cargando: boolean;
}) {
  const [elegido, setElegido] = useState("");
  // Por defecto, el primer contacto elegible (nunca un id fijo).
  const contacto = elegido || contactos?.[0]?.id || "";
  const q = useQuery({
    enabled: Boolean(contacto),
    queryKey: ["previsualizar", propuesta, version, contacto],
    queryFn: () =>
      request(
        `/propuestas/${propuesta}/previsualizar`,
        S.vistaPreviaSchema,
        "POST",
        {
          contactoId: contacto,
          version,
        },
      ),
  });
  return (
    <Card title="Ver con un contacto real">
      {cargando ? (
        <small>Cargando contactos…</small>
      ) : !contactos?.length ? (
        <p className="muted">
          El segmento no tiene contactos elegibles para la vista previa.
        </p>
      ) : (
        <>
          <label>
            Contacto elegible
            <select
              value={contacto}
              onChange={(e) => setElegido(e.target.value)}
            >
              {contactos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {c.empresa}
                </option>
              ))}
            </select>
          </label>
          <small className="muted">
            Así recibiría la versión {version}. No se crea ni se envía ningún
            mensaje.
          </small>
          <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
            {q.data && (
              <>
                {q.data.respaldo.length > 0 && (
                  <p className="notice warning">
                    Se usó el texto de respaldo en:{" "}
                    {[...new Set(q.data.respaldo)]
                      .map((x) => `{{${x}}}`)
                      .join(", ")}
                    . No hay evidencia verificada de ese dato para este
                    contacto.
                  </p>
                )}
                {q.data.pasos.map((paso, i) => (
                  <div key={paso.id ?? i}>
                    <h3>Correo {i + 1}</h3>
                    {paso.asunto && (
                      <p className={styles.asunto}>Asunto: {paso.asunto}</p>
                    )}
                    <div className={styles.cuerpo}>{paso.cuerpo}</div>
                  </div>
                ))}
              </>
            )}
          </QueryState>
        </>
      )}
    </Card>
  );
}

function Aprobar({
  p,
  v,
  ruta,
  rev,
  onClose,
}: {
  p: PropuestaAgente;
  v: VersionPropuesta;
  ruta: RutaCorreo;
  rev: Revision;
  onClose: () => void;
}) {
  const cmd = useCommand();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Aprobar ruta" onClose={() => !busy && onClose()}>
      <ul>
        <li>
          Versión {p.version} ({AUTOR[v.autor ?? ""] ?? "autor sin dato"})
        </li>
        <li>{ruta.pasos.length} correos</li>
        <li>
          Duración: {rev.duracionDiasHabiles ?? duracion(ruta.pasos)} días
          hábiles
        </li>
        <li>Ventana: {ventanaTexto(ruta.ventanaEnvio)}</li>
        <li>
          {rev.elegibles}{" "}
          {rev.elegibles === 1 ? "contacto elegible" : "contactos elegibles"}
        </li>
        <li>Tope diario: {rev.topeDiario ?? "sin dato"} correos nuevos</li>
      </ul>
      <p className="notice">
        Aprobar no envía ningún correo. Los envíos empiezan cuando actives la
        campaña en Campañas.{" "}
        <Link to={`/campanas/${p.objetivoId}`} onClick={onClose}>
          Ir a la campaña
        </Link>
      </p>
      {rev.advertencias.length > 0 && (
        <p className="muted">
          Hay {rev.advertencias.length}{" "}
          {rev.advertencias.length === 1 ? "advertencia" : "advertencias"} en la
          lista de verificación; no impiden aprobar.
        </p>
      )}
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      <footer>
        <Button disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await cmd.run(`/propuestas/${p.id}/aprobar`, {});
              onClose();
              cmd.notify(
                "Ruta aprobada. No se envió ningún correo: active la campaña en Campañas cuando quiera empezar.",
              );
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo aprobar");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Aprobando…" : "Aprobar ruta"}
        </Button>
      </footer>
    </Modal>
  );
}

function Rechazar({ p, onClose }: { p: PropuestaAgente; onClose: () => void }) {
  const cmd = useCommand();
  const [comentario, setComentario] = useState("");
  const delAgente = p.agente === "estratega_redactor";
  const [pedir, setPedir] = useState(delAgente);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const valido = comentario.trim().length >= 3;
  return (
    <Modal title="Rechazar ruta" onClose={() => !busy && onClose()}>
      <p>El comentario queda en el historial de la versión {p.version}.</p>
      <label>
        Comentario (mínimo 3 caracteres)
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          aria-invalid={comentario.length > 0 && !valido}
        />
      </label>
      {delAgente && (
        <label className="check">
          <input
            type="checkbox"
            checked={pedir}
            onChange={(e) => setPedir(e.target.checked)}
          />
          Pedir al agente una versión nueva con este comentario
        </label>
      )}
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      <footer>
        <Button disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          disabled={busy || !valido}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await cmd.run(`/propuestas/${p.id}/rechazar`, {
                comentario: comentario.trim(),
                pedirNuevaVersion: delAgente && pedir,
              });
              onClose();
              cmd.notify(
                delAgente && pedir
                  ? "Ruta rechazada. El agente preparará una versión nueva con su comentario."
                  : "Ruta rechazada.",
              );
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo rechazar");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Rechazando…" : "Rechazar"}
        </Button>
      </footer>
    </Modal>
  );
}
