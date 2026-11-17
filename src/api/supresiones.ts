import { useResource } from "./hooks";
import { supresionSchema } from "./schemas";
export const useSupresiones = () =>
  useResource("/supresiones", supresionSchema.array());
