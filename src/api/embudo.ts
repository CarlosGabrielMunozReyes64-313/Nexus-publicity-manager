import { useResource } from "./hooks";
import * as S from "./schemas";
export const useEmbudo = (query = "") =>
  useResource("/embudo?" + query, S.embudoSchema);
