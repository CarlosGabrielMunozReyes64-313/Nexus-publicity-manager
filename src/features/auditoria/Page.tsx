import { useState } from "react";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import { Button, Card, Table, DiffView, QueryState } from "../../components/ui";
import { Intro } from "../shared";
import { fecha, descargarCSV } from "../../lib/formato";
export default function Page() {
  const q = useResource("/auditoria", S.auditoriaSchema.array());
  const [filters, setFilters] = useState<Record<string, string>>({});
  const data = (q.data ?? []).filter(
    (a) =>
      (!filters.actor || a.actor.includes(filters.actor)) &&
      (!filters.accion || a.accion.includes(filters.accion)) &&
      (!filters.entidad || a.entidad.includes(filters.entidad)) &&
      (!filters.desde || a.fecha >= filters.desde) &&
      (!filters.hasta || a.fecha.slice(0, 10) <= filters.hasta),
  );
  return (
    <>
      <Intro
        title="Registro de acciones"
        description="Cada decisión deja una huella. Revisa quién cambió qué y cuándo."
        action={
          <Button
            disabled={!data.length}
            onClick={() =>
              descargarCSV(
                "nexus-auditoria.csv",
                data.map((a) => ({ ...a })),
              )
            }
          >
            Exportar CSV
          </Button>
        }
      />
      <Card>
        <div className="toolbar">
          {["actor", "accion", "entidad", "desde", "hasta"].map((k) => (
            <label key={k}>
              {k}
              <input
                type={["desde", "hasta"].includes(k) ? "date" : "text"}
                value={filters[k] ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, [k]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
          <Table
            data={data}
            columns={[
              {
                id: "fecha",
                header: "Fecha",
                cell: (c) => fecha(c.row.original.fecha),
              },
              { accessorKey: "actor", header: "Actor" },
              { accessorKey: "accion", header: "Acción" },
              { accessorKey: "entidad", header: "Entidad" },
              { accessorKey: "entidadId", header: "Referencia" },
              {
                id: "detalle",
                header: "Cambios",
                cell: (c) => (
                  <details>
                    <summary>Antes / después</summary>
                    <DiffView
                      before={c.row.original.antes}
                      after={c.row.original.despues}
                    />
                  </details>
                ),
              },
            ]}
          />
        </QueryState>
      </Card>
    </>
  );
}
