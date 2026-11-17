import { useResource } from "./hooks";
import { respuestaSchema } from "./schemas";
export const useRespuestas = () =>
  useResource("/respuestas", respuestaSchema.array());
