import { useResource } from "./hooks";
import { oportunidadSchema } from "./schemas";
export const useOportunidades = () =>
  useResource("/oportunidades", oportunidadSchema.array());
