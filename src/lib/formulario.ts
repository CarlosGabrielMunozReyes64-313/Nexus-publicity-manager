import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Validación de React Hook Form con un esquema Zod (sin dependencias extra).
 * Equivale a `zodResolver` de @hookform/resolvers para los casos de este proyecto:
 * cada campo recibe el primer mensaje de error de Zod.
 */
export function resolverZod<S extends z.ZodTypeAny>(
  schema: S,
): Resolver<z.input<S> & FieldValues, unknown, z.output<S> & FieldValues> {
  return async (values) => {
    const r = await schema.safeParseAsync(values);
    if (r.success) return { values: r.data, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of r.error.issues) {
      const campo = issue.path.join(".") || "root";
      errors[campo] ??= { type: issue.code, message: issue.message };
    }
    return {
      values: {},
      errors: errors as FieldErrors<z.input<S> & FieldValues>,
    };
  };
}
