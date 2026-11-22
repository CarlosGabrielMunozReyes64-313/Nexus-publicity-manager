import { z } from "zod";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useResource } from "../../api/hooks";
import { request } from "../../api/client";
import { fechaHora } from "../../lib/formato";
import * as S from "../../api/schemas";
import type { PropuestaAgente } from "../../types";
import {
  Button,
  Card,
  Badge,
  EvidenceList,
  DiffView,
  QueryState,
  EmptyState,
} from "../../components/ui";
import { Intro, Select, useCommand } from "../shared";
import PedirRuta from "./PedirRuta";
import Solicitudes from "./Solicitudes";
import RutaDetalle from "./RutaDetalle";
import { AUTOR, duracion, leerRuta, versionActual } from "./ruta";
import styles from "./Ruta.module.css";

export type Vista = "rutas" | "otras" | "todas";
const VISTAS: [Vista, string][] = [
  ["rutas", "Rutas de correo"],
  ["otras", "Otras propuestas"],
  ["todas", "Todas"],
];
/** Filtro rápido: las rutas de correo son las propuestas de tipo «campana». */
export const enVista = (p: PropuestaAgente, vista: Vista) =>
  vista === "todas" || (vista === "rutas") === (p.tipo === "campana");

export default function Page() {
  const q = useResource("/propuestas", S.propuestaSchema.array());
  const [vista, setVista] = useState<Vista>("rutas");
  const [estado, setEstado] = useState("");
  const [agente, setAgente] = useState("");
  const [tipo, setTipo] = useState("");
  const [pidiendo, setPidiendo] = useState(false);
  const id = useLocation().pathname.split("/")[2];
  const item = q.data?.find((p) => p.id === id);
  const visibles = (q.data ?? []).filter(
    (p) =>
      enVista(p, vista) &&
      (!estado || p.estado === estado) &&
      (!agente || p.agente === agente) &&
      (!tipo || p.tipo === tipo),
  );
  return (
    <>
      <Intro
        title="Propuestas de agentes"
        description="La inteligencia artificial propone. Tu criterio tiene la última palabra."
        action={
          !item && (
            <Button variant="primary" onClick={() => setPidiendo(true)}>
              <Mail size={16} aria-hidden /> Pedir una ruta de correos
            </Button>
          )
        }
      />
      {pidiendo && <PedirRuta onClose={() => setPidiendo(false)} />}
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {item ? (
          item.tipo === "campana" ? (
            <RutaDetalle key={item.id} p={item} />
          ) : (
            <Detail key={item.id} p={item} />
          )
        ) : (
          <>
            {vista !== "otras" && <Solicitudes />}
            {vista !== "rutas" && <PedidosAgentes />}
            <div
              className={styles.filtro}
              role="group"
              aria-label="Tipo de propuestas"
            >
              {VISTAS.map(([v, texto]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={vista === v}
                  onClick={() => setVista(v)}
                >
                  {texto}
                </button>
              ))}
            </div>
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
            {!visibles.length && (
              <EmptyState>
                {vista === "rutas"
                  ? "No hay rutas de correo con estos filtros. Pida una con «Pedir una ruta de correos»."
                  : undefined}
              </EmptyState>
            )}
            <div className="grid">
              {visibles.map((p) =>
                p.tipo === "campana" ? (
                  <TarjetaRuta key={p.id} p={p} />
                ) : (
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
                ),
              )}
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}

/** Tarjeta de una ruta: campaña, segmento, correos, duración, elegibles y estado. */
function TarjetaRuta({ p }: { p: PropuestaAgente }) {
  const segmentos = useResource(
    "/propuestas/rutas-correo/segmentos",
    S.segmentoRutaSchema.array(),
  );
  const v = versionActual(p);
  const ruta = leerRuta(v?.contenido);
  const seg = segmentos.data?.find((s) => s.id === p.ruta?.segmentoId);
  return (
    <Card>
      <div className="row">
        <Badge>{p.estado}</Badge>
        {p.estado === "pendiente" && (
          <Badge tono="warning">Espera tu revisión</Badge>
        )}
        <small>
          v{p.version} · {AUTOR[v?.autor ?? ""] ?? p.agente}
        </small>
      </div>
      <h2 style={{ marginTop: 16 }}>
        {p.ruta?.campanaNombre ?? ruta?.nombre ?? p.resumen}
      </h2>
      <div className={styles.datos}>
        <span>Segmento: {p.ruta?.segmentoNombre ?? "sin dato"}</span>
        {ruta && (
          <>
            <span>{ruta.pasos.length} correos</span>
            <span>{duracion(ruta.pasos)} días hábiles</span>
          </>
        )}
        <span>
          {seg
            ? `${seg.elegibles} ${seg.elegibles === 1 ? "elegible" : "elegibles"}`
            : segmentos.isPending
              ? "Contando elegibles…"
              : "Segmento sin aprobar"}
        </span>
      </div>
      <p className="muted">{p.resumen}</p>
      <Link to={`/propuestas/${p.id}`}>Revisar ruta →</Link>
    </Card>
  );
}

type Pedido = z.infer<typeof S.solicitudAgenteSchema>;
const pedidoActivo = (p: Pedido) =>
  p.estado === "pendiente" || p.estado === "en_proceso";
function estadoPedido(
  p: Pedido,
): [string, "success" | "warning" | "error" | "info"] {
  if (p.estado === "pendiente")
    return [p.intentos > 0 ? "Reintento programado" : "En cola", "warning"];
  if (p.estado === "en_proceso") return ["El agente está trabajando", "info"];
  if (p.estado === "completada") return ["Lista", "success"];
  if (p.estado === "fallida") return ["No se pudo completar", "error"];
  return ["Cancelado", "info"];
}
/** Pedidos de segmentos al agente (las rutas tienen su propio panel). */
function PedidosAgentes() {
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ["/agentes/solicitudes"],
    queryFn: () =>
      request("/agentes/solicitudes", S.solicitudAgenteSchema.array()),
    refetchInterval: (query) =>
      query.state.data?.some(
        (p) => p.tipo === "proponer_segmentos" && pedidoActivo(p),
      )
        ? 4000
        : false,
  });
  const pedidos = (q.data ?? []).filter((p) => p.tipo === "proponer_segmentos");
  const listas = pedidos.filter((p) => p.estado === "completada").length;
  useEffect(() => {
    // Un pedido terminado deja propuestas nuevas: se recarga la lista.
    if (listas) void cache.invalidateQueries({ queryKey: ["/propuestas"] });
  }, [listas, cache]);
  if (!pedidos.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <Card title="Pedidos de segmentos al agente">
        <ul className="list">
          {pedidos.map((p) => (
            <li key={p.id}>
              <div className="row">
                <strong>Propuestas de segmentos</strong>
                <Badge tono={estadoPedido(p)[1]}>{estadoPedido(p)[0]}</Badge>
                <small className="muted">{fechaHora(p.creadaEn)}</small>
              </div>
              {p.error && (
                <p className={p.estado === "fallida" ? "danger" : "muted"}>
                  {p.error}
                  {p.estado === "pendiente" && p.proximoIntento
                    ? ` Nuevo intento: ${fechaHora(p.proximoIntento)}.`
                    : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Propuestas que no son rutas de correo (se muestran como antes). */
function Detail({ p }: { p: PropuestaAgente }) {
  const cmd = useCommand();
  const [text, setText] = useState(p.resumen);
  const [editing, setEditing] = useState(false);
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
          <hr />
          <div className="row">
            <Button
              variant="primary"
              disabled={p.estado === "aprobada" || p.tipo === "correo_inferido"}
              onClick={() =>
                cmd.ask(
                  "Aprobar propuesta",
                  <p>
                    Se aprobará la versión {p.version}: {p.resumen}. Los correos
                    inferidos no se validan automáticamente.
                  </p>,
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
