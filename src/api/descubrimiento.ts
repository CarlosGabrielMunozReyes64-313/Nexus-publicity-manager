import { useResource } from "./hooks";
import * as S from "./schemas";
export const useBusquedas = () =>
  useResource("/descubrimiento/busquedas", S.busquedaSchema.array());
