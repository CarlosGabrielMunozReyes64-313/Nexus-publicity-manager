import { useResource } from "./hooks";
import { auditoriaSchema } from "./schemas";
export const useAuditoria = () =>
  useResource("/auditoria", auditoriaSchema.array());
