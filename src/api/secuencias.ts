import { useResource } from "./hooks";
import { secuenciaSchema } from "./schemas";
export const useSecuencias = () =>
  useResource("/secuencias", secuenciaSchema.array());
