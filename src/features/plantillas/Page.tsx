import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import type { z } from "zod";
import { request } from "../../api/client";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import { Badge, Button, Card, QueryState, Table } from "../../components/ui";
import { fechaHora } from "../../lib/formato";
import CuerpoConFormato from "../secuencias/editor/CuerpoConFormato";
import { Intro, useCommand } from "../shared";

type Plantilla = z.infer<typeof S.plantillaSchema>;
type Vista = z.infer<typeof S.vistaPlantillaSchema>;
export const ADMITIDAS = [
  "nombre",
  "cargo",
  "empresa",
  "municipio",
  "senal",
  "firma",
  "baja",
  "enlace",
];

export default function Page() {
  const id = useLocation().pathname.split("/")[2];
  const [archivadas, setArchivadas] = useState(false);
  const q = useResource(
    `/plantillas${archivadas ? "?archivadas=true" : ""}`,
    S.plantillaSchema.array(),
  );
  const navigate = useNavigate();
  const item = q.data?.find((p) => p.id === id);
  return (
    <>
      <Intro
        title={
          id === "nueva"
            ? "Nueva plantilla"
            : (item?.nombre ?? "Plantillas de correo")
        }
        description="Contenido reutilizable para los pasos de tus secuencias. Al usar una plantilla en un paso se copia su contenido: lo aprobado no cambia si después editas o archivas la plantilla."
        action={
          !id && (
            <Button
              variant="primary"
              onClick={() => navigate("/plantillas/nueva")}
            >
              <Plus size={16} /> Nueva plantilla
            </Button>
          )
        }
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {id ? (
          id === "nueva" || item ? (
            <EditorPlantilla key={id} plantilla={item} />
          ) : (
            <Card>
              Plantilla no encontrada (puede estar archivada).{" "}
              <Link to="/plantillas">Volver</Link>
            </Card>
          )
        ) : (
          <Card>
            <label className="row">
              <input
                type="checkbox"
                checked={archivadas}
                onChange={(e) => setArchivadas(e.target.checked)}
              />
              Mostrar archivadas
            </label>
            <Table
              data={q.data ?? []}
              columns={[
                {
                  accessorKey: "nombre",
                  header: "Plantilla",
                  cell: ({ row }) => (
                    <Link to={`/plantillas/${row.original.id}`}>
                      <strong>{row.original.nombre}</strong>
                    </Link>
                  ),
                },
                { accessorKey: "asunto", header: "Asunto" },
                {
                  id: "variables",
                  header: "Variables",
                  cell: ({ row }) =>
                    row.original.variables.map((v) => `{{${v}}}`).join(" "),
                },
                {
                  id: "estado",
                  header: "Estado",
                  cell: ({ row }) =>
                    row.original.archivada ? (
                      <Badge>archivada</Badge>
                    ) : (
                      <Badge tono="success">activa</Badge>
                    ),
                },
                {
                  id: "fecha",
                  header: "Actualizada",
                  cell: ({ row }) => fechaHora(row.original.actualizadoEn),
                },
              ]}
            />
          </Card>
        )}
      </QueryState>
    </>
  );
}

function EditorPlantilla({ plantilla }: { plantilla?: Plantilla }) {
  const navigate = useNavigate();
  const cmd = useCommand();
  const [nombre, setNombre] = useState(plantilla?.nombre ?? "");
  const [asunto, setAsunto] = useState(plantilla?.asunto ?? "");
  const [cuerpo, setCuerpo] = useState(
    plantilla?.cuerpo ?? "Buenos días, {{nombre}}:\n\n\n\n{{firma}}\n{{baja}}",
  );
  const [formato, setFormato] = useState<"texto" | "html">(
    plantilla?.formato ?? "texto",
  );
  const [html, setHtml] = useState(plantilla?.cuerpoHtml ?? "");
  const [vista, setVista] = useState<Vista | null>(null);
  const [error, setError] = useState("");
  const usadas = [
    ...new Set(
      [
        ...`${asunto} ${cuerpo} ${formato === "html" ? html : ""}`.matchAll(
          /\{\{\s*(\w+)\s*\}\}/g,
        ),
      ].map((m) => m[1]),
    ),
  ];
  const desconocidas = usadas.filter((v) => !ADMITIDAS.includes(v));
  const datos = {
    nombre,
    asunto,
    cuerpo,
    formato,
    cuerpoHtml: formato === "html" ? html : undefined,
  };
  const clave = JSON.stringify(datos);
  useEffect(() => {
    if (!cuerpo.trim() || desconocidas.length) return;
    const t = setTimeout(() => {
      request("/plantillas/previsualizar", S.vistaPlantillaSchema, "POST", {
        ...JSON.parse(clave),
        nombre: nombre || "Vista previa",
      })
        .then((v) => {
          setVista(v);
          setError("");
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : "Sin vista previa"),
        );
    }, 400);
    return () => clearTimeout(t);
  }, [clave]);
  const archivada = plantilla?.archivada;
  return (
    <div className="grid">
      <Card title="Contenido">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              if (plantilla) {
                await cmd.run(`/plantillas/${plantilla.id}`, datos, "PUT");
                cmd.notify(
                  "Plantilla guardada. Las secuencias aprobadas no cambian.",
                );
              } else {
                const r = await request(
                  "/plantillas",
                  S.creadaSchema,
                  "POST",
                  datos,
                );
                cmd.notify("Plantilla creada.");
                navigate(`/plantillas/${r.id}`);
              }
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "No se pudo guardar",
              );
            }
          }}
        >
          <label>
            Nombre
            <input
              required
              maxLength={120}
              value={nombre}
              disabled={archivada}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label>
            Asunto
            <input
              maxLength={200}
              value={asunto}
              disabled={archivada}
              onChange={(e) => setAsunto(e.target.value)}
            />
          </label>
          <label>
            Formato
            <select
              value={formato}
              disabled={archivada}
              onChange={(e) => setFormato(e.target.value as "texto" | "html")}
            >
              <option value="texto">Texto simple (recomendado)</option>
              <option value="html">Texto con formato</option>
            </select>
          </label>
          {formato === "html" ? (
            <CuerpoConFormato
              html={html}
              onCambiar={(h, t) => {
                setHtml(h);
                setCuerpo(t);
              }}
            />
          ) : (
            <label>
              Cuerpo
              <textarea
                rows={12}
                required
                value={cuerpo}
                disabled={archivada}
                onChange={(e) => setCuerpo(e.target.value)}
              />
            </label>
          )}
          <p className="muted">
            Variables admitidas: {ADMITIDAS.map((v) => `{{${v}}}`).join(" ")}.
            Si falta {"{{baja}}"}, NEXUS añade igualmente «Rechazar / Darme de
            baja» al enviar.
          </p>
          {desconocidas.length > 0 && (
            <p role="alert" className="danger">
              Variable no admitida:{" "}
              {desconocidas.map((v) => `{{${v}}}`).join(", ")}. Corríjala antes
              de guardar; se enviaría en blanco.
            </p>
          )}
          {error && (
            <p role="alert" className="danger">
              {error}
            </p>
          )}
          <div className="row">
            <Button
              type="submit"
              variant="primary"
              disabled={cmd.pending || archivada || desconocidas.length > 0}
            >
              Guardar
            </Button>
            {plantilla && (
              <>
                <Button
                  onClick={async () => {
                    const r = await request(
                      `/plantillas/${plantilla.id}/duplicar`,
                      S.creadaSchema,
                      "POST",
                      {},
                    );
                    cmd.notify("Copia creada.");
                    navigate(`/plantillas/${r.id}`);
                  }}
                >
                  Duplicar
                </Button>
                {archivada ? (
                  <Button
                    onClick={() =>
                      cmd.ask(
                        "Restaurar plantilla",
                        "Vuelve a la lista de plantillas.",
                        `/plantillas/${plantilla.id}/restaurar`,
                      )
                    }
                  >
                    Restaurar
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      cmd.ask(
                        "Archivar plantilla",
                        "Deja de ofrecerse para nuevos pasos. Los pasos que ya la usaron conservan su copia y lo aprobado no cambia.",
                        `/plantillas/${plantilla.id}/archivar`,
                      )
                    }
                  >
                    Archivar
                  </Button>
                )}
              </>
            )}
          </div>
        </form>
      </Card>
      <Card title="Vista previa con datos de ejemplo">
        {vista ? (
          <div className="stack">
            <p>
              <strong>Asunto:</strong>{" "}
              {vista.asunto || "(sin asunto: va en el mismo hilo)"}
            </p>
            {vista.html ? (
              <iframe
                title="Vista previa HTML"
                sandbox=""
                srcDoc={vista.html}
                style={{
                  width: "100%",
                  minHeight: 280,
                  border: "1px solid var(--borde, #ddd)",
                }}
              />
            ) : null}
            <h3>Texto simple</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>{vista.texto}</pre>
            {vista.pieAgregado && (
              <p className="notice">
                Se añadió el pie «Rechazar / Darme de baja» porque la plantilla
                no tiene {"{{baja}}"}.
              </p>
            )}
            {vista.respaldo.length > 0 && (
              <p className="muted">
                Usan texto de respaldo si el contacto no tiene el dato
                verificado: {vista.respaldo.map((v) => `{{${v}}}`).join(", ")}.
              </p>
            )}
          </div>
        ) : (
          <p className="muted">Escriba el cuerpo para ver cómo llegará.</p>
        )}
      </Card>
    </div>
  );
}

/** Selector para copiar una plantilla en el paso que se está editando. */
export function UsarPlantilla({
  onUsar,
}: {
  onUsar: (c: z.infer<typeof S.plantillaParaPasoSchema>) => void;
}) {
  const q = useResource("/plantillas", S.plantillaSchema.array());
  const [elegida, setElegida] = useState("");
  const [error, setError] = useState("");
  if (!q.data?.length) return null;
  return (
    <div className="row" style={{ alignItems: "end" }}>
      <label>
        Usar una plantilla
        <select value={elegida} onChange={(e) => setElegida(e.target.value)}>
          <option value="">Elija una plantilla</option>
          {q.data.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={!elegida}
        onClick={async () => {
          try {
            onUsar(
              await request(
                `/plantillas/${elegida}/para-paso`,
                S.plantillaParaPasoSchema,
              ),
            );
            setError("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo usar");
          }
        }}
      >
        Copiar en este correo
      </Button>
      {error && <small className="danger">{error}</small>}
    </div>
  );
}
