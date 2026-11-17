import { z } from "zod";
export const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(
  /\/$/,
  "",
);
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    let message = "No fue posible completar la solicitud";
    try {
      const error = z
        .object({ message: z.string() })
        .parse(await response.json());
      message = error.message;
    } catch {
      /* No exponer la respuesta sin validar. */
    }
    throw new ApiError(response.status, message);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new ApiError(502, "La API devolvió datos con un formato inesperado");
  return parsed.data;
}
