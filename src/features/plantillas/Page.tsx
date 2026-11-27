import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { z } from "zod";
import { request } from "../../api/client";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import { BotonEliminar } from "../eliminar/Eliminar";
import {
  Badge,
  Button,
  Card,
  QueryState,
  Table,
  useFeedback,
} from "../../components/ui";
import { fechaHora } from "../../lib/formato";
import CuerpoConFormato from "../secuencias/editor/CuerpoConFormato";
import { Intro, useCommand } from "../shared";
import EditorDiseno from "./EditorDiseno";
import { ESQUELETO, esDiseno, htmlATexto } from "./diseno";

type Plantilla = z.infer<typeof S.plantillaSchema>;
type Vista = z.infer<typeof S.vistaPlantillaSchema>;
type Modo = "texto" | "html" | "diseno";
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
  const galeria = (q.data ?? []).filter((p) => p.predeterminada);
  const propias = (q.data ?? []).filter((p) => !p.predeterminada);
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
          ) : q.isFetching ? (
            <Card>Cargando plantilla…</Card>
          ) : (
            <Card>
              Plantilla no encontrada (puede estar archivada).{" "}
              <Link to="/plantillas">Volver</Link>
            </Card>
          )
        ) : (
          <div className="stack">
            {galeria.length > 0 && (
              <Card title="Galería de NEXUS">
                <p className="muted">
                  Plantillas listas para usar. Ábrala para verla y pulse «Usar
                  como base» para crear su propia versión editable. Las imágenes
                  de ejemplo se reemplazan por las suyas.
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
                    gap: 16,
                  }}
                >
                  {galeria.map((p) => (
                    <TarjetaPlantilla key={p.id} plantilla={p} />
                  ))}
                </div>
              </Card>
            )}
            <Card title="Mis plantillas">
              <label className="row">
                <input
                  type="checkbox"
                  checked={archivadas}
                  onChange={(e) => setArchivadas(e.target.checked)}
                />
                Mostrar archivadas
              </label>
              <Table
                data={propias}
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
                    id: "tipo",
                    header: "Tipo",
                    cell: ({ row }) =>
                      row.original.diseno
                        ? "Diseño con imágenes"
                        : row.original.formato === "html"
                          ? "Texto con formato"
                          : "Texto simple",
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
          </div>
        )}
      </QueryState>
    </>
  );
}

function TarjetaPlantilla({ plantilla }: { plantilla: Plantilla }) {
  return (
    <Link
      to={`/plantillas/${plantilla.id}`}
      style={{
        display: "block",
        border: "1px solid #dde5e0",
        borderRadius: 8,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        background: "#fff",
      }}
    >
      <div
        style={{
          height: 180,
          overflow: "hidden",
          background: "#f3f6f4",
          position: "relative",
        }}
        aria-hidden
      >
        {plantilla.cuerpoHtml ? (
          <iframe
            title={`Miniatura de ${plantilla.nombre}`}
            sandbox=""
            tabIndex={-1}
            srcDoc={plantilla.cuerpoHtml}
            style={{
              width: 640,
              height: 720,
              border: 0,
              transform: "scale(0.4)",
              transformOrigin: "0 0",
              pointerEvents: "none",
            }}
          />
        ) : (
          <pre
            style={{
              margin: 0,
              padding: 12,
              fontSize: 11,
              whiteSpace: "pre-wrap",
            }}
          >
            {plantilla.cuerpo.slice(0, 260)}
          </pre>
        )}
      </div>
      <div style={{ padding: 12 }}>
        <Badge tono="info">{plantilla.categoria ?? "NEXUS"}</Badge>
        <h3 style={{ margin: "8px 0 4px" }}>{plantilla.nombre}</h3>
        <small className="muted">{plantilla.descripcion}</small>
      </div>
    </Link>
  );
}

function EditorPlantilla({ plantilla }: { plantilla?: Plantilla }) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const cmd = useCommand();
  const { notify } = useFeedback();
  const [nombre, setNombre] = useState(plantilla?.nombre ?? "");
  const [asunto, setAsunto] = useState(plantilla?.asunto ?? "");
  const [cuerpo, setCuerpo] = useState(
    plantilla?.cuerpo ?? "Buenos días, {{nombre}}:\n\n\n\n{{firma}}\n{{baja}}",
  );
  const [modo, setModo] = useState<Modo>(
    plantilla?.formato === "html"
      ? esDiseno(plantilla.cuerpoHtml)
        ? "diseno"
        : "html"
      : "texto",
  );
  const [html, setHtml] = useState(plantilla?.cuerpoHtml ?? "");
  const [vista, setVista] = useState<Vista | null>(null);
  const [ancho, setAncho] = useState<"escritorio" | "celular">("escritorio");
  const [error, setError] = useState("");
  const soloLectura = Boolean(
    plantilla?.predeterminada || plantilla?.archivada,
  );
  const formato = modo === "texto" ? "texto" : "html";
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
        ...(JSON.parse(clave) as object),
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
  const cambiarModo = (m: Modo) => {
    setModo(m);
    if (m === "diseno" && !esDiseno(html)) {
      setHtml(ESQUELETO);
      setCuerpo(htmlATexto(ESQUELETO));
    }
    if (m === "html" && esDiseno(html)) setHtml("");
  };
  const usarComoBase = async () => {
    if (!plantilla) return;
    const r = await request(
      `/plantillas/${plantilla.id}/duplicar`,
      S.creadaSchema,
      "POST",
      {},
    );
    // Recarga la lista antes de abrir la copia: si no, la ficha no la encuentra.
    await cache.invalidateQueries();
    notify("Se creó su versión editable.");
    navigate(`/plantillas/${r.id}`);
  };
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
                await cache.invalidateQueries();
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
          {plantilla?.predeterminada && (
            <p className="notice">
              Plantilla de la galería de NEXUS: no se modifica. Pulse «Usar como
              base» para crear su versión editable y reemplazar las imágenes de
              ejemplo.
            </p>
          )}
          <label>
            Nombre
            <input
              required
              maxLength={120}
              value={nombre}
              disabled={soloLectura}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label>
            Asunto
            <input
              maxLength={200}
              value={asunto}
              disabled={soloLectura}
              onChange={(e) => setAsunto(e.target.value)}
            />
          </label>
          <label>
            Formato
            <select
              value={modo}
              disabled={soloLectura}
              onChange={(e) => cambiarModo(e.target.value as Modo)}
            >
              <option value="texto">
                Texto simple (recomendado para el primer contacto)
              </option>
              <option value="html">Texto con formato</option>
              <option value="diseno">Diseño con imágenes</option>
            </select>
          </label>
          {modo === "diseno" ? (
            <EditorDiseno
              html={html}
              soloLectura={soloLectura}
              onCambiar={(h, t) => {
                setHtml(h);
                setCuerpo(t);
              }}
            />
          ) : modo === "html" ? (
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
                disabled={soloLectura}
                onChange={(e) => setCuerpo(e.target.value)}
              />
            </label>
          )}
          {modo === "diseno" && (
            <p className="notice warning">
              Un correo con imágenes suele ir a «Promociones» en Gmail y muchos
              programas ocultan las imágenes hasta que el destinatario las
              permite. Úselo para seguimientos y boletines; para el primer
              contacto, mejor texto simple.
            </p>
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
            {plantilla?.predeterminada ? (
              <Button variant="primary" onClick={() => void usarComoBase()}>
                Usar como base
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                disabled={cmd.pending || soloLectura || desconocidas.length > 0}
              >
                Guardar
              </Button>
            )}
            {plantilla && !plantilla.predeterminada && (
              <>
                <Button onClick={() => void usarComoBase()}>Duplicar</Button>
                {plantilla.archivada ? (
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
                <BotonEliminar
                  recurso="plantillas"
                  ids={[plantilla.id]}
                  etiqueta="Eliminar plantilla"
                  onDone={() => navigate("/plantillas")}
                />
              </>
            )}
          </div>
        </form>
      </Card>
      <Card title="Vista previa con datos de ejemplo">
        {vista ? (
          <div className="stack">
            <div className="row">
              <Button
                variant={ancho === "escritorio" ? "primary" : undefined}
                onClick={() => setAncho("escritorio")}
              >
                Escritorio
              </Button>
              <Button
                variant={ancho === "celular" ? "primary" : undefined}
                onClick={() => setAncho("celular")}
              >
                Celular
              </Button>
            </div>
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
                  width: ancho === "celular" ? 375 : "100%",
                  maxWidth: "100%",
                  minHeight: 560,
                  border: "1px solid var(--borde, #ddd)",
                  display: "block",
                  margin: "0 auto",
                }}
              />
            ) : null}
            <h3>Texto simple (viaja junto al diseño)</h3>
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
