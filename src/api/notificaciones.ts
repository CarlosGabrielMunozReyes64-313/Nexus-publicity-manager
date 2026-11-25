import { useQuery } from "@tanstack/react-query";
import { request } from "./client";
import { bandejaNotificacionesSchema } from "./schemas";
export const RUTA_NOTIFICACIONES = "/notificaciones";
/** Bandeja propia; se actualiza sola cada minuto mientras la página está abierta. */
export const useNotificaciones = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: [RUTA_NOTIFICACIONES],
    queryFn: () => request(RUTA_NOTIFICACIONES, bandejaNotificacionesSchema),
    refetchInterval: 60000,
  });
