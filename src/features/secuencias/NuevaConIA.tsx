import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { request } from "../../api/client";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import { Button, Modal, useFeedback } from "../../components/ui";
import { resolverZod } from "../../lib/formulario";

export const OBJETIVOS = {
  rse: "Que completen el diagnóstico RSE Express",
  llamada: "Agendar una llamada de 20 minutos",
  otro: "Otro",
} as const;

export const formularioIASchema = z
  .object({
    segmentoId: z.string().min(1, "Elija un segmento aprobado"),
    objetivo: z.enum(["rse", "llamada", "otro"]),
    objetivoOtro: z.string().optional(),
    numeroCorreos: z.coerce
      .number()
      .int()
      .min(2, "Entre 2 y 5 correos")
      .max(5, "Entre 2 y 5 correos"),
    notas: z
      .string()
      .max(500, "Las notas admiten hasta 500 caracteres")
      .optional(),
  })
  .superRefine((v, ctx) => {
    const otro = (v.objetivoOtro ?? "").trim();
    if (v.objetivo === "otro" && (otro.length < 5 || otro.length > 200))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["objetivoOtro"],
        message: "Describa el objetivo en 5 a 200 caracteres",
      });
  });
type Formulario = z.input<typeof formularioIASchema>;

/** Cuerpo de POST /secuencias/ia a partir del formulario. */
export function cuerpoSolicitud(v: z.output<typeof formularioIASchema>) {
  const notas = (v.notas ?? "").trim();
  return {
    segmentoId: v.segmentoId,
    objetivo:
      v.objetivo === "otro"
        ? (v.objetivoOtro ?? "").trim()
        : OBJETIVOS[v.objetivo],
    numeroCorreos: v.numeroCorreos,
    ...(notas ? { notas } : {}),
  };
}

/** Diálogo «Nueva con IA» (React Hook Form + Zod). */
export default function NuevaConIA({ onClose }: { onClose: () => void }) {
  const segmentos = useResource(
    "/propuestas/rutas-correo/segmentos",
    S.segmentoRutaSchema.array(),
  );
  const cache = useQueryClient();
  const { notify } = useFeedback();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Formulario, unknown, z.output<typeof formularioIASchema>>({
    resolver: resolverZod(formularioIASchema),
    defaultValues: {
      segmentoId: "",
      objetivo: "rse",
      objetivoOtro: "",
      numeroCorreos: 3,
      notas: "",
    },
  });
  const conElegibles = useMemo(
    () => (segmentos.data ?? []).filter((s) => s.elegibles > 0),
    [segmentos.data],
  );
  useEffect(() => {
    // Por defecto, el primer segmento aprobado que tenga contactos elegibles.
    if (!getValues("segmentoId") && conElegibles[0])
      setValue("segmentoId", conElegibles[0].id);
  }, [conElegibles, getValues, setValue]);
  const objetivo = watch("objetivo");
  const notas = watch("notas") ?? "";
  const enviar = handleSubmit(async (v) => {
    try {
      await request("/secuencias/ia", S.okSchema, "POST", cuerpoSolicitud(v));
    } catch (e) {
      setError("root.servidor", {
        message: e instanceof Error ? e.message : "No se pudo enviar",
      });
      return;
    }
    await cache.invalidateQueries({ queryKey: ["/secuencias/solicitudes"] });
    onClose();
    notify(
      "La IA está escribiendo tu secuencia. Aparecerá aquí en unos minutos",
    );
  });
  return (
    <Modal title="Nueva secuencia con IA" onClose={onClose}>
      <form onSubmit={enviar} noValidate className="stack">
        <p className="muted">
          La IA propone la secuencia completa; después tú la editas y la
          apruebas. Pedirla consume presupuesto de IA y no envía ningún correo.
        </p>
        <label>
          Segmento
          <select
            {...register("segmentoId")}
            aria-invalid={Boolean(errors.segmentoId)}
            disabled={segmentos.isPending}
          >
            <option value="">
              {segmentos.isPending
                ? "Cargando segmentos…"
                : "Elija un segmento"}
            </option>
            {(segmentos.data ?? []).map((s) => (
              <option key={s.id} value={s.id} disabled={s.elegibles === 0}>
                {s.nombre} · {s.elegibles}{" "}
                {s.elegibles === 1 ? "elegible" : "elegibles"}
              </option>
            ))}
          </select>
        </label>
        {errors.segmentoId && (
          <p className="danger">{errors.segmentoId.message}</p>
        )}
        {segmentos.data && !conElegibles.length && (
          <p className="notice warning">
            No hay segmentos aprobados con contactos elegibles.{" "}
            <Link to="/segmentos" onClick={onClose}>
              Revise los segmentos
            </Link>
            .
          </p>
        )}
        <fieldset>
          <legend>Objetivo</legend>
          {(Object.keys(OBJETIVOS) as (keyof typeof OBJETIVOS)[]).map((k) => (
            <label className="check" key={k}>
              <input type="radio" value={k} {...register("objetivo")} />
              {OBJETIVOS[k]}
            </label>
          ))}
          {objetivo === "otro" && (
            <label>
              Describa el objetivo
              <input
                {...register("objetivoOtro")}
                maxLength={200}
                aria-invalid={Boolean(errors.objetivoOtro)}
              />
            </label>
          )}
          {errors.objetivoOtro && (
            <p className="danger">{errors.objetivoOtro.message}</p>
          )}
        </fieldset>
        <label>
          Número de correos
          <input
            type="number"
            min={2}
            max={5}
            {...register("numeroCorreos")}
            aria-invalid={Boolean(errors.numeroCorreos)}
          />
        </label>
        {errors.numeroCorreos && (
          <p className="danger">{errors.numeroCorreos.message}</p>
        )}
        <label>
          Notas para la IA (opcional)
          <textarea
            {...register("notas")}
            placeholder="Ejemplo: muchas de estas empresas venden a ingenios azucareros; mencione los cuestionarios de proveedores y evite hablar de certificaciones."
            aria-invalid={Boolean(errors.notas)}
          />
        </label>
        <small className={notas.length > 500 ? "danger" : "muted"}>
          {notas.length}/500 caracteres
        </small>
        {errors.notas && <p className="danger">{errors.notas.message}</p>}
        {errors.root?.servidor && (
          <p role="alert" className="danger">
            {errors.root.servidor.message}
          </p>
        )}
        <footer>
          <Button disabled={isSubmitting} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !conElegibles.length}
          >
            {isSubmitting ? "Enviando…" : "Pedir a la IA"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
