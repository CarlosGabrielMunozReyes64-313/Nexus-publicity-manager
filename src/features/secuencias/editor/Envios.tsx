import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { request } from "../../../api/client";
import { useResource } from "../../../api/hooks";
import * as S from "../../../api/schemas";
import {
  Badge,
  Button,
  Card,
  QueryState,
  Table,
  useFeedback,
} from "../../../components/ui";
import { fechaHora } from "../../../lib/formato";
import type { Secuencia } from "../../../types";

type Envios = z.infer<typeof S.enviosSchema>;
type Dest = Envios["destinatarios"][number];

/** Etiqueta y color de cada estado visible. «Aceptado por Gmail» solo con confirmación. */
export const ESTADOS: Record<
  Dest["estado"],
  [string, "success" | "warning" | "error" | "info" | undefined]
> = {
  programado: ["Programado", "info"],
  entregando: ["Entregándose a Gmail", "info"],
  aceptado: ["Aceptado por Gmail", "success"],
  completada: ["Aceptado por Gmail · completada", "success"],
  conciliar: ["Por conciliar", "warning"],
  fallido: ["Fallido", "error"],
  pausada: ["Pausado", "warning"],
  finalizada: ["Finalizado", "info"],
  pendiente: ["Sin programar", "info"],
};
const CAMPANA: Record<string, string> = {
  borrador: "Borrador: sin aprobar",
  en_revision: "Cambios sin aprobar: envíos detenidos",
  aprobada: "Aprobada · sin programar",
  activa: "Programada: enviando según ventana y cuotas",
  pausada: "Pausada",
  finalizada: "Finalizada",
};

export default function Envios({ secuencia }: { secuencia: Secuencia }) {
  const id = secuencia.id;
  const cache = useQueryClient();
  const { notify } = useFeedback();
  const q = useQuery({
    queryKey: [`/secuencias/${id}/envios`],
    queryFn: () => request(`/secuencias/${id}/envios`, S.enviosSchema),
    refetchInterval: (query) =>
      query.state.data?.campanaEstado === "activa" ? 15000 : false,
  });
  const [ocupado, setOcupado] = useState(false);
  const refrescar = () => cache.invalidateQueries();
  const programar = async () => {
    setOcupado(true);
    try {
      const r = await request(
        `/secuencias/${id}/programar`,
        S.aprobadaSchema,
        "POST",
        {},
      );
      const p = r.programacion;
      notify(
        p?.activada
          ? `Envíos programados: ${p.inscritos} destinatario(s) nuevos${p.reanudadas ? ` y ${p.reanudadas} reanudados` : ""}.`
          : `No se programó: ${p?.motivo ?? "revise el diagnóstico"}`,
      );
      await refrescar();
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se pudo programar");
    } finally {
      setOcupado(false);
    }
  };
  const conciliar = async (d: Dest, resultado: "enviado" | "no_enviado") => {
    try {
      await request(`/mensajes/${d.mensajeId}/conciliar`, S.okSchema, "POST", {
        resultado,
      });
      notify(
        resultado === "enviado"
          ? "Registrado como enviado, sin reenviar."
          : "Se programará de nuevo con el mismo identificador.",
      );
      await refrescar();
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se pudo conciliar");
    }
  };
  return (
    <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
      {q.data && (
        <div className="stack">
          <Card title="Estado de los envíos">
            <p>
              <Badge
                tono={
                  q.data.campanaEstado === "activa"
                    ? "success"
                    : q.data.campanaEstado === "pausada"
                      ? "warning"
                      : undefined
                }
              >
                {CAMPANA[q.data.campanaEstado ?? "borrador"] ??
                  q.data.campanaEstado}
              </Badge>{" "}
              {q.data.programadaEn && (
                <small className="muted">
                  programada el {fechaHora(q.data.programadaEn)}
                </small>
              )}
            </p>
            {q.data.diagnostico.length ? (
              <ul className="list" aria-label="Diagnóstico">
                {q.data.diagnostico.map((d, i) => (
                  <li
                    key={i}
                    className={
                      d.nivel === "error"
                        ? "danger"
                        : d.nivel === "aviso"
                          ? "notice warning"
                          : "muted"
                    }
                  >
                    {d.texto}{" "}
                    {d.accion === "configuracion" && (
                      <Link to="/configuracion">Ir a Configuración</Link>
                    )}
                    {d.accion === "contactos" && (
                      <Link to="/contactos">Revisar contactos</Link>
                    )}
                    {d.accion === "trabajador" && (
                      <Link to="/terminal">Ver Terminal</Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Sin problemas detectados.</p>
            )}
            {q.data.aprobada && (
              <Button
                variant="primary"
                disabled={ocupado || q.data.campanaEstado === "activa"}
                onClick={() => void programar()}
              >
                {ocupado
                  ? "Programando…"
                  : q.data.campanaEstado === "pausada"
                    ? "Reanudar y programar"
                    : "Programar envíos"}
              </Button>
            )}
            {q.data.cuota && (
              <p className="muted">
                Primeros correos hoy: {q.data.cuota.nuevosHoy}/
                {q.data.cuota.topeGlobal} (global) · {q.data.cuota.campanaHoy}/
                {q.data.cuota.topeCampana} (esta campaña). Gmail:{" "}
                {q.data.gmail?.estado ?? "sin dato"} · Trabajador:{" "}
                {q.data.trabajador?.vivo ? "activo" : "sin señales"}
                {q.data.trabajador?.ultimoLatido
                  ? ` (último latido ${fechaHora(q.data.trabajador.ultimoLatido)})`
                  : ""}
              </p>
            )}
          </Card>
          <Audiencia secuencia={secuencia} envios={q.data} />
          {q.data.porPaso?.length ? (
            <Card title="Por correo">
              <Table
                data={q.data.porPaso}
                columns={[
                  { accessorKey: "paso", header: "Correo" },
                  { accessorKey: "programados", header: "Programados" },
                  { accessorKey: "entregando", header: "Entregándose" },
                  { accessorKey: "aceptados", header: "Aceptados por Gmail" },
                  { accessorKey: "fallidos", header: "Fallidos" },
                  { accessorKey: "cancelados", header: "Cancelados" },
                ]}
              />
            </Card>
          ) : null}
          <Card title={`Destinatarios (${q.data.destinatarios.length})`}>
            <Table
              data={q.data.destinatarios}
              columns={[
                {
                  accessorKey: "nombre",
                  header: "Contacto",
                  cell: ({ row }) => (
                    <>
                      <Link to={`/contactos/${row.original.contactoId}`}>
                        {row.original.nombre}
                      </Link>
                      <br />
                      <small>{row.original.correo}</small>
                    </>
                  ),
                },
                {
                  id: "estado",
                  header: "Estado",
                  cell: ({ row }) => (
                    <span title={row.original.texto}>
                      <Badge tono={ESTADOS[row.original.estado][1]}>
                        {ESTADOS[row.original.estado][0]}
                      </Badge>
                      <br />
                      <small className="muted">{row.original.texto}</small>
                    </span>
                  ),
                },
                {
                  id: "proximo",
                  header: "Próximo envío",
                  cell: ({ row }) =>
                    row.original.proximoEnvio
                      ? fechaHora(row.original.proximoEnvio)
                      : "—",
                },
                {
                  id: "enviado",
                  header: "Aceptado por Gmail",
                  cell: ({ row }) =>
                    row.original.enviadoEn
                      ? fechaHora(row.original.enviadoEn)
                      : "—",
                },
                {
                  id: "acciones",
                  header: "",
                  cell: ({ row }) =>
                    row.original.estado === "conciliar" &&
                    row.original.mensajeId ? (
                      <div className="row">
                        <Button
                          onClick={() =>
                            void conciliar(row.original, "enviado")
                          }
                        >
                          Sí salió
                        </Button>
                        <Button
                          onClick={() =>
                            void conciliar(row.original, "no_enviado")
                          }
                        >
                          No salió
                        </Button>
                      </div>
                    ) : null,
                },
              ]}
            />
            <p className="muted">
              «Aceptado por Gmail» significa que Gmail confirmó el envío (no
              garantiza que llegue a la bandeja). «Por conciliar»: Gmail pudo
              aceptarlo pero no hay confirmación; NEXUS no lo reenvía solo.
              Búsquelo en Enviados de la cuenta de envío y elija.
            </p>
          </Card>
        </div>
      )}
    </QueryState>
  );
}

function Audiencia({
  secuencia,
  envios,
}: {
  secuencia: Secuencia;
  envios: Envios;
}) {
  const segmentos = useResource("/segmentos", S.segmentoSchema.array());
  const listas = useResource("/listas", S.listaSchema.array());
  const cache = useQueryClient();
  const { notify, confirm } = useFeedback();
  const actual = envios.audiencia;
  const [tipo, setTipo] = useState<"segmento" | "lista">(
    actual?.tipo ?? (secuencia.listaId ? "lista" : "segmento"),
  );
  const [segmento, setSegmento] = useState(secuencia.segmentoId ?? "");
  const [lista, setLista] = useState(secuencia.listaId ?? "");
  const [nuevos, setNuevos] = useState(
    actual?.incorporarNuevos ?? Boolean(secuencia.incorporarNuevos),
  );
  const cambiado =
    (tipo === "segmento"
      ? segmento !== (secuencia.segmentoId ?? "") || Boolean(secuencia.listaId)
      : lista !== (secuencia.listaId ?? "")) ||
    nuevos !== Boolean(actual?.incorporarNuevos);
  return (
    <Card title="Audiencia">
      {actual && (
        <p>
          {actual.tipo === "lista" ? "Lista" : "Segmento"}:{" "}
          <Link
            to={`/${actual.tipo === "lista" ? "listas" : "segmentos"}/${actual.id}`}
          >
            {actual.nombre}
          </Link>{" "}
          · {actual.candidatos} contactos ·{" "}
          <strong>{actual.elegibles} elegibles</strong>
          {Object.keys(actual.noElegibles).length > 0 && (
            <small className="muted">
              {" "}
              (fuera:{" "}
              {Object.entries(actual.noElegibles)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
              )
            </small>
          )}
        </p>
      )}
      <p className="muted">
        {actual?.incorporarNuevos
          ? "Nuevos miembros: se incorporan solos mientras la campaña esté programada (revisión cada minuto)."
          : "Nuevos miembros: solo reciben los que eran elegibles al aprobar o al pulsar «Programar envíos»."}{" "}
        Las bajas y los contactos no elegibles se excluyen siempre, y nadie
        recibe dos veces el mismo correo.
      </p>
      <details>
        <summary>Cambiar audiencia</summary>
        <div className="stack">
          <label className="row">
            <input
              type="radio"
              checked={tipo === "segmento"}
              onChange={() => setTipo("segmento")}
            />{" "}
            Segmento
          </label>
          {tipo === "segmento" && (
            <select
              aria-label="Segmento"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
            >
              <option value="">Elija un segmento</option>
              {(segmentos.data ?? [])
                .filter((s) => s.estado !== "archivado")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.estado}, {s.tamano})
                  </option>
                ))}
            </select>
          )}
          <label className="row">
            <input
              type="radio"
              checked={tipo === "lista"}
              onChange={() => setTipo("lista")}
            />{" "}
            Lista de envío
          </label>
          {tipo === "lista" && (
            <select
              aria-label="Lista"
              value={lista}
              onChange={(e) => setLista(e.target.value)}
            >
              <option value="">Elija una lista</option>
              {(listas.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre} (
                  {l.tipo === "vinculada" ? "vinculada" : "estática"},{" "}
                  {l.elegibles} elegibles)
                </option>
              ))}
            </select>
          )}
          <label className="row">
            <input
              type="checkbox"
              checked={nuevos}
              onChange={(e) => setNuevos(e.target.checked)}
            />
            Incorporar automáticamente a los nuevos miembros mientras esté
            programada
          </label>
          <Button
            disabled={!cambiado || (tipo === "segmento" ? !segmento : !lista)}
            onClick={() =>
              confirm({
                title: "Cambiar audiencia",
                summary: secuencia.versionAprobada
                  ? "La audiencia es parte de lo aprobado: se revocará la aprobación vigente, se pausarán los envíos y tendrá que aprobar de nuevo."
                  : "Se guardará la nueva audiencia.",
                run: async () => {
                  await request(
                    `/secuencias/${secuencia.id}/audiencia`,
                    S.okSchema,
                    "PUT",
                    {
                      ...(tipo === "segmento"
                        ? { segmentoId: segmento }
                        : { listaId: lista }),
                      incorporarNuevos: nuevos,
                    },
                  );
                  await cache.invalidateQueries();
                  notify("Audiencia actualizada.");
                },
              })
            }
          >
            Guardar audiencia
          </Button>
        </div>
      </details>
    </Card>
  );
}
