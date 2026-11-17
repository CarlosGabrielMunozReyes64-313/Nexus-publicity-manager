import { useResource } from "./hooks";
import { campanaSchema } from "./schemas";
export const useCampanas = () =>
  useResource("/campanas", campanaSchema.array());
