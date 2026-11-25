import { useResource } from "./hooks";
import { solicitudAccesoSchema } from "./schemas";
export const RUTA_SOLICITUDES = "/solicitudes-acceso";
export const useSolicitudesAcceso = (enabled = true) =>
  useResource(RUTA_SOLICITUDES, solicitudAccesoSchema.array(), enabled);
