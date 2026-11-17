import { useResource } from "./hooks";
import { contactoSchema } from "./schemas";
export const useContactos = () =>
  useResource("/contactos", contactoSchema.array());
