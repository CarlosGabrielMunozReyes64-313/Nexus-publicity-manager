import { useResource } from "./hooks";
import * as S from "./schemas";
export const useMarca = () =>
  useResource("/configuracion/marca", S.marcaSchema);
export const useLimites = () =>
  useResource("/configuracion/limites", S.limitesSchema);
