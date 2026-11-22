import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useResource } from "../../api/hooks";
import { descargar } from "../../api/client";
import * as S from "../../api/schemas";
import { Button, Card, Table, DiffView, QueryState } from "../../components/ui";
import { Intro, useCommand } from "../shared";
import { descargarArchivo, fechaHora } from "../../lib/formato";
const TAMANO = 50;
const CAMPOS: { clave: string; etiqueta: string; tipo: "text" | "date" }[] = [
  { clave: "actor", etiqueta: "Actor", tipo: "text" },
  { clave: "accion", etiqueta: "Acción", tipo: "text" },
  { clave: "entidad", etiqueta: "Entidad", tipo: "text" },
  { clave: "entidadId", etiqueta: "Referencia exacta", tipo: "text" },
  { clave: "desde", etiqueta: "Desde", tipo: "date" },
  { clave: "hasta", etiqueta: "Hasta", tipo: "date" },
];
const consultaDe = (filtros: Record<string, string>) =>
  new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v.trim()),
  ).toString();
export default function Page() {
  const location = useLocation();
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const url = new URLSearchParams(location.search);
    return Object.fromEntries(
      CAMPOS.map((c) => [c.clave, url.get(c.clave) ?? ""]).filter(([, v]) => v),
    );
  });
  // Los filtros se envían al servidor; se espera a que el usuario deje de escribir.
  const [aplicados, setAplicados] = useState(filters);
  const [pagina, setPagina] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setAplicados(filters);
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [filters]);
  const rangoValido =
    !aplicados.desde || !aplicados.hasta || aplicados.desde <= aplicados.hasta;
  const consulta = consultaDe(aplicados);
  const q = useResource(
    `/auditoria/pagina?${consulta}${consulta ? "&" : ""}pagina=${pagina}&tamano=${TAMANO}`,
    S.paginaAuditoriaSchema,
    rangoValido,
  );
  const cmd = useCommand();
  const [exportando, setExportando] = useState(false);
  const total = q.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANO));
  return (
    <>
      <Intro
        title="Registro de acciones"
        description="Cada decisión deja una huella. Revisa quién cambió qué y cuándo."
        action={
          <Button
            disabled={!total || exportando || !rangoValido}
            onClick={async () => {
              setExportando(true);
              try {
                // Exporta todas las coincidencias del servidor, no solo la página visible.
                descargarArchivo(
                  "nexus-auditoria.csv",
                  await descargar(`/auditoria/exportar?${consulta}`),
                );
                cmd.notify(`Exportadas ${total} acciones.`);
              } catch (e) {
                cmd.notify(
                  e instanceof Error ? e.message : "No se pudo exportar",
                );
              } finally {
                setExportando(false);
              }
            }}
          >
            {exportando ? "Exportando…" : `Exportar CSV (${total})`}
          </Button>
        }
      />
      <Card>
        <div className="toolbar">
          {CAMPOS.map((c) => (
            <label key={c.clave}>
              {c.etiqueta}
              <input
                type={c.tipo}
                value={filters[c.clave] ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, [c.clave]: e.target.value })
                }
              />
            </label>
          ))}
          {Object.values(filters).some(Boolean) && (
            <Button onClick={() => setFilters({})}>Limpiar filtros</Button>
          )}
        </div>
        {!rangoValido && (
          <p role="alert" className="notice danger">
            La fecha «Desde» debe ser anterior o igual a «Hasta».
          </p>
        )}
        <p className="muted">
          <small>
            Búsqueda en todo el registro. Actor, acción y entidad aceptan parte
            del texto; las fechas son días de Bogotá.
          </small>
        </p>
        <QueryState
          loading={rangoValido && q.isPending}
          error={q.error}
          retry={q.refetch}
        >
          <Table
            paginar={false}
            data={q.data?.items ?? []}
            columns={[
              {
                id: "fecha",
                header: "Fecha",
                cell: (c) => fechaHora(c.row.original.fecha),
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
          {total > 0 && (
            <div className="row" style={{ marginTop: 12 }}>
              <small>
                {total} registros · Página {pagina} de {paginas}
              </small>
              <Button
                disabled={pagina <= 1 || q.isFetching}
                onClick={() => setPagina(pagina - 1)}
              >
                Anterior
              </Button>
              <Button
                disabled={pagina >= paginas || q.isFetching}
                onClick={() => setPagina(pagina + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </QueryState>
      </Card>
    </>
  );
}
