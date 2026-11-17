import { useResource } from "./hooks";
import * as S from "./schemas";
export const useMetricas = (query = "") =>
  useResource("/informes/metricas?" + query, S.metricaSchema.array());
