import { useResource } from "./hooks";
import { duplicadoSchema } from "./schemas";
export const useDuplicados = () =>
  useResource("/duplicados", duplicadoSchema.array());
