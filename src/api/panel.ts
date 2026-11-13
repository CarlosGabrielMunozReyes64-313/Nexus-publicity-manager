import { useResource } from "./hooks";
import * as S from "./schemas";
export const usePanel = () => useResource("/panel/resumen", S.resumenSchema);
