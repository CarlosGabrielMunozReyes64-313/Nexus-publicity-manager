import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { z } from "zod";
import { useResource } from "../../api/hooks";
import { request } from "../../api/client";
import * as S from "../../api/schemas";
import type { Secuencia } from "../../types";
import { Button, Card, QueryState, Badge } from "../../components/ui";
import { Intro, Resource, Select, useCommand } from "../shared";
import { validarSecuencia } from "../../lib/reglas";
export default function Page() {
  const q = useResource("/secuencias", S.secuenciaSchema.array());
  const id = useLocation().pathname.split("/")[2];
  const s = q.data?.find((s) => s.id === id);
  return (
    <>
      <Intro
        title="Secuencias"
        description="Conversaciones útiles, con tiempo y contexto. Revisa cada paso antes de aprobar."
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {s ? (
          <Editor key={s.id} initial={s} />
        ) : (
          <div className="grid">
            {q.data?.map((s) => (
              <Card key={s.id} title={s.nombre}>
                <p>{s.objetivo}</p>
                <p>
                  {s.pasos.length} pasos · {s.llamadaAccion}
                </p>
                <Link to={`/secuencias/${s.id}/editar`}>
                  Editar secuencia →
                </Link>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}
function Sortable({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px,${transform.y}px,0)`
          : undefined,
        transition,
      }}
    >
      <Card>
        <Button {...attributes} {...listeners} aria-label="Reordenar paso">
          <GripVertical size={16} />
          Arrastrar / usar flechas
        </Button>
        {children}
      </Card>
    </div>
  );
}
function Editor({ initial }: { initial: Secuencia }) {
  const [s, setS] = useState(initial);
  const cmd = useCommand();
  const contactos = useResource("/contactos", S.contactoSchema.array());
  const marca = useResource("/configuracion/marca", S.marcaSchema);
  const [contacto, setContacto] = useState("c1");
  const [preview, setPreview] = useState<{
    pasos: Secuencia["pasos"];
    respaldo: string[];
  } | null>(null);
  const errors = validarSecuencia(s, marca.data?.prohibidas);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const patch = (id: string, change: Partial<Secuencia["pasos"][number]>) => {
    setS({
      ...s,
      pasos: s.pasos.map((p) => (p.id === id ? { ...p, ...change } : p)),
    });
    setPreview(null);
  };
  return (
    <>
      <p className="notice warning">
        Este cambio devuelve la campaña a revisión y pausa los envíos
        pendientes.
      </p>
      <div className="grid">
        <div className="stack">
          <Card>
            <label>
              Nombre de secuencia
              <input
                value={s.nombre}
                onChange={(e) => setS({ ...s, nombre: e.target.value })}
              />
            </label>
            <label>
              Objetivo
              <input
                value={s.objetivo}
                onChange={(e) => setS({ ...s, objetivo: e.target.value })}
              />
            </label>
            <label>
              Llamada a la acción
              <input
                value={s.llamadaAccion}
                onChange={(e) => setS({ ...s, llamadaAccion: e.target.value })}
              />
            </label>
          </Card>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              if (over && active.id !== over.id)
                setS({
                  ...s,
                  pasos: arrayMove(
                    s.pasos,
                    s.pasos.findIndex((p) => p.id === active.id),
                    s.pasos.findIndex((p) => p.id === over.id),
                  ).map((p, i) => ({
                    ...p,
                    orden: i + 1,
                    asunto:
                      i === 0
                        ? (p.asunto ?? initial.pasos[0].asunto)
                        : undefined,
                    mismoHilo: i > 0,
                  })),
                });
            }}
          >
            <SortableContext
              items={s.pasos.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="stack">
                {s.pasos.map((p, i) => (
                  <Sortable key={p.id} id={p.id}>
                    <h3>Paso {i + 1}</h3>
                    {i === 0 && (
                      <label>
                        Asunto
                        <input
                          value={p.asunto ?? ""}
                          onChange={(e) =>
                            patch(p.id, { asunto: e.target.value })
                          }
                        />
                      </label>
                    )}
                    <label>
                      Cuerpo
                      <textarea
                        style={{ minHeight: 190 }}
                        value={p.cuerpo}
                        onChange={(e) =>
                          patch(p.id, { cuerpo: e.target.value })
                        }
                      />
                    </label>
                    <div className="row">
                      {["nombre", "empresa", "senal", "firma", "baja"].map(
                        (v) => (
                          <Button
                            key={v}
                            onClick={() =>
                              patch(p.id, {
                                cuerpo: p.cuerpo + " {{" + v + "}}",
                              })
                            }
                          >
                            {"{{" + v + "}}"}
                          </Button>
                        ),
                      )}
                    </div>
                    <label>
                      Días hábiles de espera desde el paso anterior
                      <input
                        type="number"
                        min={0}
                        value={p.esperaDiasHabiles}
                        onChange={(e) =>
                          patch(p.id, {
                            esperaDiasHabiles: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={p.mismoHilo}
                        disabled={i === 0}
                        onChange={(e) =>
                          patch(p.id, { mismoHilo: e.target.checked })
                        }
                      />
                      Mismo hilo
                    </label>
                    <Button
                      disabled={s.pasos.length === 1}
                      onClick={() =>
                        setS({
                          ...s,
                          pasos: s.pasos
                            .filter((x) => x.id !== p.id)
                            .map((p, i) => ({
                              ...p,
                              orden: i + 1,
                              asunto:
                                i === 0
                                  ? (p.asunto ?? initial.pasos[0].asunto)
                                  : undefined,
                            })),
                        })
                      }
                    >
                      Quitar paso
                    </Button>
                  </Sortable>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Button
            onClick={() =>
              setS({
                ...s,
                pasos: [
                  ...s.pasos,
                  {
                    id: crypto.randomUUID(),
                    orden: s.pasos.length + 1,
                    cuerpo:
                      "Hola, {{nombre}}. Gracias por su tiempo.\n{{firma}}\n{{baja}}",
                    esperaDiasHabiles: 4,
                    mismoHilo: true,
                    variables: [],
                  },
                ],
              })
            }
          >
            Añadir paso
          </Button>
        </div>
        <div className="stack" style={{ alignContent: "start" }}>
          <Card title="Vista previa personalizada">
            <Select
              all={false}
              label="Contacto"
              value={contacto}
              onChange={(v) => {
                setContacto(v);
                setPreview(null);
              }}
              options={(contactos.data ?? []).map((c) => ({
                value: c.id,
                label: c.nombre,
              }))}
            />
            <p>
              <small>
                La vista previa usa la última versión guardada. Guarda los
                cambios antes de generarla.
              </small>
            </p>
            <Button
              onClick={async () => {
                try {
                  const p = await request(
                    `/secuencias/${s.id}/previsualizar`,
                    z.object({
                      pasos: S.secuenciaSchema.shape.pasos,
                      respaldo: z.array(z.string()),
                    }),
                    "POST",
                    { contactoId: contacto },
                  );
                  setPreview(p);
                } catch (e) {
                  cmd.notify(e instanceof Error ? e.message : "Error");
                }
              }}
            >
              Generar vista previa
            </Button>
            {preview && (
              <>
                {preview.respaldo.length > 0 && (
                  <p className="notice warning">
                    Texto de respaldo usado:{" "}
                    {[...new Set(preview.respaldo)].join(", ")}. No hay
                    evidencia verificada para esos datos.
                  </p>
                )}
                {preview.pasos.map((p) => (
                  <div key={p.id}>
                    <h3>Paso {p.orden}</h3>
                    <pre>{p.cuerpo}</pre>
                  </div>
                ))}
              </>
            )}
          </Card>
          <Card title="Validaciones">
            {errors.length ? (
              errors.map((e, i) => (
                <p key={i} className="danger">
                  {e}
                </p>
              ))
            ) : (
              <Badge>Firma, baja y contenido correctos</Badge>
            )}
            <p>
              <small>
                {s.pasos.reduce((n, p) => n + p.cuerpo.length, 0)} caracteres en
                total.
              </small>
            </p>
          </Card>
          <Card title="Ventana de envío · Bogotá">
            <div className="row">
              {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d, i) => (
                <label className="check" key={d}>
                  <input
                    type="checkbox"
                    checked={s.ventanaEnvio.dias.includes(i)}
                    onChange={(e) =>
                      setS({
                        ...s,
                        ventanaEnvio: {
                          ...s.ventanaEnvio,
                          dias: e.target.checked
                            ? [...s.ventanaEnvio.dias, i]
                            : s.ventanaEnvio.dias.filter((d) => d !== i),
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
                Desde
                <input
                  type="time"
                  value={s.ventanaEnvio.desde}
                  onChange={(e) =>
                    setS({
                      ...s,
                      ventanaEnvio: {
                        ...s.ventanaEnvio,
                        desde: e.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Hasta
                <input
                  type="time"
                  value={s.ventanaEnvio.hasta}
                  onChange={(e) =>
                    setS({
                      ...s,
                      ventanaEnvio: {
                        ...s.ventanaEnvio,
                        hasta: e.target.value,
                      },
                    })
                  }
                />
              </label>
            </div>
          </Card>
          <Card title="Condiciones del sistema">
            <p>Respuesta → pausa</p>
            <p>Baja o rebote duro → supresión</p>
            <p>Reunión → sale de la secuencia</p>
            <p>Cliente → sale toda su empresa</p>
            <Resource path="/campanas" schema={S.campanaSchema.array()}>
              {(cams) => (
                <small>
                  {cams.filter((c) => c.secuenciaId === s.id).length} campañas
                  utilizan esta secuencia.
                </small>
              )}
            </Resource>
          </Card>
          <Button
            variant="primary"
            disabled={
              errors.length > 0 ||
              !s.ventanaEnvio.dias.length ||
              s.ventanaEnvio.desde >= s.ventanaEnvio.hasta
            }
            onClick={() =>
              cmd.ask(
                "Guardar nueva versión de secuencia",
                "Las campañas asociadas vuelven a revisión y sus inscripciones se pausan.",
                `/secuencias/${s.id}`,
                s,
                "PUT",
              )
            }
          >
            Guardar y enviar a revisión
          </Button>
        </div>
      </div>
    </>
  );
}
