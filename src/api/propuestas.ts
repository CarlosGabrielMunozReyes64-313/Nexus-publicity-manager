import { useResource } from "./hooks";
import { propuestaSchema } from "./schemas";
export const usePropuestas = () =>
  useResource("/propuestas", propuestaSchema.array());
