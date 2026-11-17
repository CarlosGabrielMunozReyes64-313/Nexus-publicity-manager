import { useResource } from "./hooks";
import { segmentoSchema } from "./schemas";
export const useSegmentos = () =>
  useResource("/segmentos", segmentoSchema.array());
