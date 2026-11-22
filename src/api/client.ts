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
/** Error de autenticación (sesión vencida o inexistente), no una caída del servidor. */
export const esSesionVencida = (error: unknown) =>
  error instanceof ApiError && error.status === 401;
async function llamar(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    // Sin respuesta: red caída, servidor apagado o bloqueado por el navegador.
    throw new ApiError(
      0,
      "No hay conexión con el servidor. Revise su red e intente de nuevo.",
    );
  }
  if (!response.ok) {
    let message =
      response.status >= 500
        ? "El servidor no pudo completar la solicitud. Intente de nuevo en unos minutos."
        : "No fue posible completar la solicitud";
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
  return response;
}
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await llamar(path, method, body);
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success)
    throw new ApiError(502, "La API devolvió datos con un formato inesperado");
  return parsed.data;
}
/** Descarga un archivo generado por la API (por ejemplo, un CSV). */
export async function descargar(path: string): Promise<Blob> {
  const response = await llamar(path);
  return response.blob();
}
