import { useState } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Sparkles, Plus } from "lucide-react";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import type { Secuencia } from "../../types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  QueryState,
  Table,
} from "../../components/ui";
import { fechaHora } from "../../lib/formato";
import { Intro, Select, useCommand } from "../shared";
import NuevaConIA from "./NuevaConIA";
import NuevaEnBlanco from "./NuevaEnBlanco";
import Solicitudes from "./Solicitudes";
import { ESTADO_EDITOR } from "./util";

/** Lista de secuencias de correo, al estilo de Listmonk. */
export default function Lista() {
  const [archivadas, setArchivadas] = useState(false);
  const q = useResource(
    archivadas ? "/secuencias?archivadas=true" : "/secuencias",
    S.secuenciaSchema.array(),
  );
  const segmentos = useResource("/segmentos", S.segmentoSchema.array());
  const campanas = useResource("/campanas", S.campanaSchema.array());
  const cmd = useCommand();
  const [buscar, setBuscar] = useState("");
  const [estado, setEstado] = useState("");
  const [dialogo, setDialogo] = useState<"ia" | "blanco" | null>(null);
  const filas = (q.data ?? []).filter(
    (s) =>
      s.nombre.toLowerCase().includes(buscar.trim().toLowerCase()) &&
      (!estado || s.estadoEditor === estado),
  );
  const nombreSegmento = (id?: string) =>
    segmentos.data?.find((x) => x.id === id)?.nombre ?? "—";
  const metricas = (id?: string) =>
    campanas.data?.find((c) => c.id === id)?.metricas;
  const columnas: ColumnDef<Secuencia>[] = [
    {
      accessorKey: "nombre",
      header: "Nombre",
      cell: (c) => (
        <Link to={`/secuencias/${c.row.original.id}`}>
          <strong>{c.row.original.nombre}</strong>
        </Link>
      ),
    },
    {
      id: "segmento",
      header: "Segmento",
      accessorFn: (s) => nombreSegmento(s.segmentoId),
    },
    {
      id: "correos",
      header: "Correos",
      accessorFn: (s) => s.pasos.length,
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (s) => s.estadoEditor ?? "borrador",
      cell: (c) => {
        const [texto, tono] =
          ESTADO_EDITOR[c.row.original.estadoEditor ?? "borrador"];
        return <Badge tono={tono}>{texto}</Badge>;
      },
    },
    {
      id: "edicion",
      header: "Última edición",
      accessorFn: (s) => s.actualizadaEn ?? "",
      cell: (c) =>
        c.row.original.actualizadaEn
          ? fechaHora(c.row.original.actualizadaEn)
          : "—",
    },
    {
      id: "enviados",
      header: "Enviados",
      accessorFn: (s) => metricas(s.campanaId)?.enviados ?? 0,
    },
    {
      id: "respuestas",
      header: "Respuestas",
      accessorFn: (s) => metricas(s.campanaId)?.respuestas ?? 0,
    },
    {
      id: "diagnosticos",
      header: "Diagnósticos",
      accessorFn: (s) => metricas(s.campanaId)?.diagnosticos ?? 0,
    },
    {
      id: "acciones",
      header: () => <span className="srOnly">Acciones</span>,
      cell: (c) => {
        const s = c.row.original;
        const activa = s.campanaEstado === "activa";
        return (
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <Link to={`/secuencias/${s.id}`} aria-label={`Editar ${s.nombre}`}>
              Editar
            </Link>
            <Button
              aria-label={`Duplicar ${s.nombre}`}
              onClick={() =>
                cmd.ask(
                  "Duplicar secuencia",
                  `Se creará «Copia de ${s.nombre}» con el borrador actual, en una campaña nueva del mismo segmento.`,
                  `/secuencias/${s.id}/duplicar`,
                )
              }
            >
              Duplicar
            </Button>
            {!s.archivada && (
              <Button
                aria-label={`Archivar ${s.nombre}`}
                disabled={activa}
                title={
                  activa ? "Pause la campaña antes de archivar" : undefined
                }
                onClick={() =>
                  cmd.ask(
                    "Archivar secuencia",
                    "Deja de aparecer en la lista (puede verla con «Ver archivadas»). No se borra nada.",
                    `/secuencias/${s.id}/archivar`,
                  )
                }
              >
                Archivar
              </Button>
            )}
          </div>
        );
      },
    },
  ];
  const sinNinguna = q.data && !q.data.length && !archivadas;
  return (
    <>
      <Intro
        title="Secuencias de correo"
        description="La IA propone; tú editas y apruebas. Nada sale sin tu aprobación."
        action={
          <div className="row">
            <Button onClick={() => setDialogo("blanco")}>
              <Plus size={16} aria-hidden /> Nueva en blanco
            </Button>
            <Button variant="primary" onClick={() => setDialogo("ia")}>
              <Sparkles size={16} aria-hidden /> Nueva con IA
            </Button>
          </div>
        }
      />
      {dialogo === "ia" && <NuevaConIA onClose={() => setDialogo(null)} />}
      {dialogo === "blanco" && (
        <NuevaEnBlanco onClose={() => setDialogo(null)} />
      )}
      <Solicitudes />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {sinNinguna ? (
          <EmptyState
            action={
              <Button variant="primary" onClick={() => setDialogo("ia")}>
                <Sparkles size={16} aria-hidden /> Nueva con IA
              </Button>
            }
          >
            Aún no tienes secuencias. Pídele a la IA la primera
          </EmptyState>
        ) : (
          <Card>
            <div className="toolbar">
              <label>
                Buscar
                <input
                  type="search"
                  value={buscar}
                  placeholder="Nombre de la secuencia"
                  onChange={(e) => setBuscar(e.target.value)}
                />
              </label>
              <Select
                label="Estado"
                value={estado}
                onChange={setEstado}
                options={Object.entries(ESTADO_EDITOR)
                  .filter(([k]) => archivadas || k !== "archivada")
                  .map(([value, [label]]) => ({ value, label }))}
              />
              <label className="check">
                <input
                  type="checkbox"
                  role="switch"
                  checked={archivadas}
                  onChange={(e) => setArchivadas(e.target.checked)}
                />
                Ver archivadas
              </label>
            </div>
            <Table data={filas} columns={columnas} />
          </Card>
        )}
      </QueryState>
    </>
  );
}
