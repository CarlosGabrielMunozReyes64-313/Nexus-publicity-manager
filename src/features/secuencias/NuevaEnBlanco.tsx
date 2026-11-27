import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { request } from "../../api/client";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import { Button, Modal, useFeedback } from "../../components/ui";
import { resolverZod } from "../../lib/formulario";

export const formularioBlancoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre requiere entre 3 y 120 caracteres")
    .max(120, "El nombre requiere entre 3 y 120 caracteres"),
  /** «seg:<id>» o «lista:<id>». */
  audiencia: z.string().min(1, "Elija un segmento aprobado o una lista"),
  plantillaId: z.string(),
  objetivo: z
    .string()
    .trim()
    .min(5, "El objetivo requiere entre 5 y 200 caracteres")
    .max(200, "El objetivo requiere entre 5 y 200 caracteres"),
  llamadaAccion: z
    .string()
    .trim()
    .min(3, "La llamada a la acción requiere entre 3 y 200 caracteres")
    .max(200, "La llamada a la acción requiere entre 3 y 200 caracteres"),
});
type Formulario = z.input<typeof formularioBlancoSchema>;

type Vista = z.infer<typeof S.vistaPlantillaSchema>;

/** Vista previa (con datos de ejemplo) de la plantilla elegida. */
function PreviaPlantilla({
  plantilla,
}: {
  plantilla?: z.infer<typeof S.plantillaSchema>;
}) {
  const [vista, setVista] = useState<Vista | null>(null);
  const [error, setError] = useState("");
  const id = plantilla?.id;
  useEffect(() => {
    setVista(null);
    setError("");
    if (!plantilla) return;
    let vivo = true;
    request("/plantillas/previsualizar", S.vistaPlantillaSchema, "POST", {
      nombre: plantilla.nombre,
      asunto: plantilla.asunto,
      cuerpo: plantilla.cuerpo,
      formato: plantilla.formato,
      cuerpoHtml:
        plantilla.formato === "html" ? plantilla.cuerpoHtml : undefined,
    })
      .then((v) => vivo && setVista(v))
      .catch(
        (e: unknown) =>
          vivo && setError(e instanceof Error ? e.message : "Sin vista previa"),
      );
    return () => {
      vivo = false;
    };
  }, [id]);
  if (!plantilla)
    return (
      <p className="muted">
        El primer correo empezará vacío; lo escribe en el editor.
      </p>
    );
  if (error) return <p className="danger">{error}</p>;
  if (!vista) return <p className="muted">Preparando la vista previa…</p>;
  return (
    <section aria-label="Vista previa del primer correo" className="stack">
      <p>
        <strong>Asunto:</strong> {vista.asunto}
      </p>
      {vista.html ? (
        <iframe
          title="Vista previa del primer correo"
          sandbox=""
          srcDoc={vista.html}
          style={{
            width: "100%",
            minHeight: 320,
            border: "1px solid var(--borde, #ddd)",
          }}
        />
      ) : (
        <pre
          style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}
        >
          {vista.texto}
        </pre>
      )}
      <p className="muted">
        Es una copia: en el editor puede cambiar el asunto y el cuerpo, y
        revisar la vista previa antes de aprobar el envío.
      </p>
    </section>
  );
}

/** Diálogo «Nueva en blanco»: crea la secuencia (opcionalmente desde una plantilla) y abre el editor. */
export default function NuevaEnBlanco({ onClose }: { onClose: () => void }) {
  const segmentos = useResource(
    "/propuestas/rutas-correo/segmentos",
    S.segmentoRutaSchema.array(),
  );
  const listas = useResource("/listas", S.listaSchema.array());
  const plantillas = useResource("/plantillas", S.plantillaSchema.array());
  const cache = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Formulario, unknown, z.output<typeof formularioBlancoSchema>>({
    resolver: resolverZod(formularioBlancoSchema),
    defaultValues: {
      nombre: "",
      audiencia: "",
      plantillaId: "",
      objetivo: "Que completen el diagnóstico RSE Express",
      llamadaAccion: "Completar el diagnóstico gratuito",
    },
  });
  const disponibles = (plantillas.data ?? []).filter((p) => !p.archivada);
  const predeterminada =
    disponibles.find(
      (p) => p.predeterminada && p.nombre.startsWith("Primer contacto"),
    ) ?? disponibles.find((p) => p.predeterminada);
  // Por defecto se propone la plantilla predeterminada de primer contacto.
  useEffect(() => {
    if (predeterminada && !getValues("plantillaId"))
      setValue("plantillaId", predeterminada.id);
  }, [predeterminada, getValues, setValue]);
  const plantillaId = watch("plantillaId");
  const elegida = disponibles.find((p) => p.id === plantillaId);
  const crear = handleSubmit(async ({ audiencia, plantillaId: pid, ...v }) => {
    const [tipo, ident] = audiencia.split(":");
    try {
      const r = await request("/secuencias", S.creadaSchema, "POST", {
        ...v,
        ...(tipo === "lista" ? { listaId: ident } : { segmentoId: ident }),
        ...(pid ? { plantillaId: pid } : {}),
      });
      await cache.invalidateQueries({ queryKey: ["/secuencias"] });
      onClose();
      notify(
        "Secuencia creada. Escribe tus correos y apruébala cuando esté lista.",
      );
      navigate(`/secuencias/${r.id}`);
    } catch (e) {
      setError("root.servidor", {
        message: e instanceof Error ? e.message : "No se pudo crear",
      });
    }
  });
  return (
    <Modal title="Nueva secuencia" onClose={onClose}>
      <form onSubmit={crear} noValidate className="stack">
        <label>
          Nombre
          <input
            {...register("nombre")}
            aria-invalid={Boolean(errors.nombre)}
          />
        </label>
        {errors.nombre && <p className="danger">{errors.nombre.message}</p>}
        <label>
          Audiencia
          <select
            {...register("audiencia")}
            aria-invalid={Boolean(errors.audiencia)}
          >
            <option value="">
              {segmentos.isPending
                ? "Cargando audiencias…"
                : "Elija un segmento o una lista"}
            </option>
            <optgroup label="Segmentos aprobados">
              {(segmentos.data ?? []).map((s) => (
                <option key={s.id} value={`seg:${s.id}`}>
                  {s.nombre} · {s.elegibles}{" "}
                  {s.elegibles === 1 ? "elegible" : "elegibles"}
                </option>
              ))}
            </optgroup>
            <optgroup label="Listas de envío">
              {(listas.data ?? [])
                .filter((l) => !l.archivada)
                .map((l) => (
                  <option key={l.id} value={`lista:${l.id}`}>
                    {l.nombre} · {l.elegibles}{" "}
                    {l.elegibles === 1 ? "elegible" : "elegibles"}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
        {errors.audiencia && (
          <p className="danger">{errors.audiencia.message}</p>
        )}
        <label>
          Plantilla del primer correo
          <select {...register("plantillaId")}>
            <option value="">En blanco (sin plantilla)</option>
            <optgroup label="Galería de NEXUS">
              {disponibles
                .filter((p) => p.predeterminada)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Mis plantillas">
              {disponibles
                .filter((p) => !p.predeterminada)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
        <PreviaPlantilla plantilla={elegida} />
        <label>
          Objetivo
          <input
            {...register("objetivo")}
            aria-invalid={Boolean(errors.objetivo)}
          />
        </label>
        {errors.objetivo && <p className="danger">{errors.objetivo.message}</p>}
        <label>
          Llamada a la acción
          <input
            {...register("llamadaAccion")}
            aria-invalid={Boolean(errors.llamadaAccion)}
          />
        </label>
        {errors.llamadaAccion && (
          <p className="danger">{errors.llamadaAccion.message}</p>
        )}
        {errors.root?.servidor && (
          <p role="alert" className="danger">
            {errors.root.servidor.message}
          </p>
        )}
        <footer>
          <Button disabled={isSubmitting} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Creando…" : "Crear y abrir el editor"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
