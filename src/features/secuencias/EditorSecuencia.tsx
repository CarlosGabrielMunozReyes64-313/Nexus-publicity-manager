import { useState } from "react";
import type { ReactNode } from "react";
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
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import type { Secuencia } from "../../types";
import { Button, Card, Badge } from "../../components/ui";
import { Select } from "../shared";
import { validarSecuencia } from "../../lib/reglas";

export interface VistaPrevia {
  pasos: { id?: string; orden: number; asunto?: string; cuerpo: string }[];
  respaldo: string[];
}

export interface PropsEditor {
  /** Secuencia de partida; cada paso necesita un id único (solo para ordenar). */
  inicial: Secuencia;
  /** Guarda la secuencia. Si falla, el mensaje del servidor se muestra en el editor. */
  alGuardar: (s: Secuencia) => unknown;
  /** Vista previa con un contacto real (la hace el servidor con lo ya guardado). */
  vistaPrevia: (contactoId: string) => Promise<VistaPrevia>;
  /** Contactos para la vista previa; el primero es el elegido por defecto. */
  contactos: { value: string; label: string }[];
  /** Aviso que se muestra arriba del editor. */
  aviso: ReactNode;
  textoGuardar?: string;
  notaVistaPrevia?: string;
  /** Botones para insertar variables en el cuerpo. */
  variables?: string[];
  /** Tarjetas adicionales de la columna derecha (por ejemplo, condiciones). */
  extra?: ReactNode;
  alCancelar?: () => void;
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

/** Editor de secuencias de correo: lo usan Secuencias y las rutas de Propuestas. */
export default function EditorSecuencia({
  inicial,
  alGuardar,
  vistaPrevia,
  contactos,
  aviso,
  textoGuardar = "Guardar y enviar a revisión",
  notaVistaPrevia = "La vista previa usa la última versión guardada. Guarda los cambios antes de generarla.",
  variables = ["nombre", "empresa", "senal", "firma", "baja"],
  extra,
  alCancelar,
}: PropsEditor) {
  const [s, setS] = useState(inicial);
  const marca = useResource("/configuracion/marca", S.marcaSchema);
  // Sin un id fijo de demostración: por defecto, el primer contacto de la lista.
  const [elegido, setContacto] = useState("");
  const contacto = elegido || contactos[0]?.value || "";
  const [preview, setPreview] = useState<VistaPrevia | null>(null);
  const [errorPreview, setErrorPreview] = useState("");
  const [errorGuardar, setErrorGuardar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const errors = validarSecuencia(s, marca.data?.prohibidas);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const cambiar = (nueva: Secuencia) => {
    setS(nueva);
    setErrorGuardar("");
  };
  const patch = (id: string, change: Partial<Secuencia["pasos"][number]>) => {
    cambiar({
      ...s,
      pasos: s.pasos.map((p) => (p.id === id ? { ...p, ...change } : p)),
    });
    setPreview(null);
  };
  return (
    <>
      <p className="notice warning">{aviso}</p>
      <div className="grid">
        <div className="stack">
          <Card>
            <label>
              Nombre de secuencia
              <input
                value={s.nombre}
                onChange={(e) => cambiar({ ...s, nombre: e.target.value })}
              />
            </label>
            <label>
              Objetivo
              <input
                value={s.objetivo}
                onChange={(e) => cambiar({ ...s, objetivo: e.target.value })}
              />
            </label>
            <label>
              Llamada a la acción
              <input
                value={s.llamadaAccion}
                onChange={(e) =>
                  cambiar({ ...s, llamadaAccion: e.target.value })
                }
              />
            </label>
          </Card>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              if (over && active.id !== over.id)
                cambiar({
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
                        ? (p.asunto ?? inicial.pasos[0].asunto)
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
                      {variables.map((v) => (
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
                      ))}
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
                        cambiar({
                          ...s,
                          pasos: s.pasos
                            .filter((x) => x.id !== p.id)
                            .map((p, i) => ({
                              ...p,
                              orden: i + 1,
                              asunto:
                                i === 0
                                  ? (p.asunto ?? inicial.pasos[0].asunto)
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
              cambiar({
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
              options={contactos}
            />
            <p>
              <small>{notaVistaPrevia}</small>
            </p>
            <Button
              disabled={!contacto}
              onClick={async () => {
                setErrorPreview("");
                try {
                  setPreview(await vistaPrevia(contacto));
                } catch (e) {
                  setErrorPreview(e instanceof Error ? e.message : "Error");
                }
              }}
            >
              Generar vista previa
            </Button>
            {errorPreview && (
              <p role="alert" className="danger">
                {errorPreview}
              </p>
            )}
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
                  <div key={p.id ?? p.orden}>
                    <h3>Paso {p.orden}</h3>
                    {p.asunto && <strong>{p.asunto}</strong>}
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
                      cambiar({
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
                    cambiar({
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
                    cambiar({
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
          {extra}
          {errorGuardar && (
            <p role="alert" className="notice warning danger">
              {errorGuardar}
            </p>
          )}
          <div className="row">
            {alCancelar && (
              <Button disabled={guardando} onClick={alCancelar}>
                Cancelar
              </Button>
            )}
            <Button
              variant="primary"
              disabled={
                guardando ||
                errors.length > 0 ||
                !s.ventanaEnvio.dias.length ||
                s.ventanaEnvio.desde >= s.ventanaEnvio.hasta
              }
              onClick={async () => {
                setGuardando(true);
                setErrorGuardar("");
                try {
                  await alGuardar(s);
                } catch (e) {
                  setErrorGuardar(
                    e instanceof Error ? e.message : "No se pudo guardar",
                  );
                } finally {
                  setGuardando(false);
                }
              }}
            >
              {guardando ? "Guardando…" : textoGuardar}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
