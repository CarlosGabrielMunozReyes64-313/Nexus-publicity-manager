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
  segmentoId: z.string().min(1, "Elija un segmento aprobado"),
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

/** Diálogo «Nueva en blanco»: crea la secuencia y abre el editor. */
export default function NuevaEnBlanco({ onClose }: { onClose: () => void }) {
  const segmentos = useResource(
    "/propuestas/rutas-correo/segmentos",
    S.segmentoRutaSchema.array(),
  );
  const cache = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Formulario, unknown, z.output<typeof formularioBlancoSchema>>({
    resolver: resolverZod(formularioBlancoSchema),
    defaultValues: {
      nombre: "",
      segmentoId: "",
      objetivo: "Que completen el diagnóstico RSE Express",
      llamadaAccion: "Completar el diagnóstico gratuito",
    },
  });
  const crear = handleSubmit(async (v) => {
    try {
      const r = await request("/secuencias", S.creadaSchema, "POST", v);
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
    <Modal title="Nueva secuencia en blanco" onClose={onClose}>
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
          Segmento
          <select
            {...register("segmentoId")}
            aria-invalid={Boolean(errors.segmentoId)}
          >
            <option value="">
              {segmentos.isPending
                ? "Cargando segmentos…"
                : "Elija un segmento"}
            </option>
            {(segmentos.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} · {s.elegibles}{" "}
                {s.elegibles === 1 ? "elegible" : "elegibles"}
              </option>
            ))}
          </select>
        </label>
        {errors.segmentoId && (
          <p className="danger">{errors.segmentoId.message}</p>
        )}
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
