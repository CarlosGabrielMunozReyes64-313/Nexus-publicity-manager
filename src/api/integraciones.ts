import { useResource } from "./hooks";
import { integracionSchema } from "./schemas";
export const useIntegraciones = () =>
  useResource("/integraciones", integracionSchema.array());
