import { useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import type { Oportunidad } from "../../types";
import {
  Button,
  Card,
  FunnelChart,
  Badge,
  QueryState,
} from "../../components/ui";
import { Intro, Select, useCommand } from "../shared";
import { moneda, fecha } from "../../lib/formato";
function Lane({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className="lane"
      style={{ outline: isOver ? "2px solid #04a97a" : undefined }}
    >
      <h3>{id}</h3>
      {children}
    </section>
  );
}
function Opportunity({
  o,
  nombre,
  onMove,
}: {
  o: Oportunidad;
  nombre: string;
  onMove: (id: string, etapa: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: o.id,
  });
  const dias = Math.floor(
    (Date.now() - new Date(o.creadaEn).getTime()) / 86400000,
  );
  return (
    <article
      ref={setNodeRef}
      className="kanbanCard"
      style={{
        transform: transform
          ? `translate3d(${transform.x}px,${transform.y}px,0)`
          : undefined,
      }}
    >
      <Button {...attributes} {...listeners} aria-label={`Mover ${nombre}`}>
        <GripVertical size={14} />
      </Button>
      <h3>{nombre}</h3>
      <p>{o.reto}</p>
      <strong>{moneda(o.valorEstimadoCOP)}</strong>
      <p>
        <small>Creada {fecha(o.creadaEn)}</small>
      </p>
      {dias > 21 && !["cliente", "perdido"].includes(o.etapa) && (
        <Badge>{`${dias} días sin cierre`}</Badge>
      )}
      <Select
        all={false}
        label="Mover a etapa"
        value={o.etapa}
        onChange={(v) => onMove(o.id, v)}
        options={["discovery", "propuesta", "cliente", "perdido"]}
      />
    </article>
  );
}
export default function Page() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  ).toString();
  const q = useResource(`/embudo?${query}`, S.embudoSchema);
  const o = useResource("/oportunidades", S.oportunidadSchema.array());
  const e = useResource("/empresas", S.empresaSchema.array());
  const c = useResource("/campanas", S.campanaSchema.array());
  const s = useResource("/segmentos", S.segmentoSchema.array());
  const cmd = useCommand();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const move = (id: string, etapa: string) =>
    cmd.ask(
      "Mover oportunidad",
      etapa === "cliente"
        ? "La empresa será cliente y todos sus contactos saldrán de las secuencias."
        : etapa === "perdido"
          ? "La oportunidad se cerrará como perdida."
          : `La oportunidad pasará a ${etapa}.`,
      `/oportunidades/${id}`,
      { etapa },
      "PATCH",
    );
  return (
    <>
      <Intro
        title="Embudo comercial"
        description="De una primera señal a una relación sostenible."
      />
      <div className="toolbar">
        {["desde", "hasta"].map((k) => (
          <label key={k}>
            {k}
            <input
              type="date"
              value={filters[k] ?? ""}
              onChange={(e) => setFilters({ ...filters, [k]: e.target.value })}
            />
          </label>
        ))}
        <Select
          label="Campaña"
          value={filters.campana ?? ""}
          onChange={(v) => setFilters({ ...filters, campana: v })}
          options={(c.data ?? []).map((c) => ({
            value: c.id,
            label: c.nombre,
          }))}
        />
        <Select
          label="Segmento"
          value={filters.segmento ?? ""}
          onChange={(v) => setFilters({ ...filters, segmento: v })}
          options={(s.data ?? []).map((s) => ({
            value: s.id,
            label: s.nombre,
          }))}
        />
        <Select
          label="Fuente"
          value={filters.fuente ?? ""}
          onChange={(v) => setFilters({ ...filters, fuente: v })}
          options={S.origenSchema.options}
        />
      </div>
      <Card title="Distribución de contactos">
        <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
          {q.data && <FunnelChart items={q.data} />}
        </QueryState>
      </Card>
      <h2 style={{ marginTop: 28 }}>Oportunidades · tablero comercial</h2>
      <p className="muted">
        Arrastra las tarjetas o usa el selector de etapa. El tablero muestra
        todas las oportunidades.
      </p>
      <QueryState
        loading={o.isPending || e.isPending}
        error={o.error ?? e.error}
        retry={() => {
          o.refetch();
          e.refetch();
        }}
      >
        <DndContext
          sensors={sensors}
          onDragEnd={({ active, over }) => {
            if (over) move(String(active.id), String(over.id));
          }}
        >
          <div className="kanban">
            {["discovery", "propuesta", "cliente", "perdido"].map((etapa) => (
              <Lane key={etapa} id={etapa}>
                {o.data
                  ?.filter((o) => o.etapa === etapa)
                  .map((o) => (
                    <Opportunity
                      key={o.id}
                      o={o}
                      nombre={
                        e.data?.find((e) => e.id === o.empresaId)
                          ?.razonSocial ?? o.empresaId
                      }
                      onMove={move}
                    />
                  ))}
              </Lane>
            ))}
          </div>
        </DndContext>
      </QueryState>
    </>
  );
}
