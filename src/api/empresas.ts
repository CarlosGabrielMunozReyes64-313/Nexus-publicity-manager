import { useResource } from "./hooks";
import { empresaSchema } from "./schemas";
export const useEmpresas = () =>
  useResource("/empresas", empresaSchema.array());
