import { createContext, useContext } from "react";
import type { z } from "zod";
import type { sesionSchema } from "./schemas";
export type Sesion = z.infer<typeof sesionSchema>;
/** Sesión verificada por la API; la entrega la ruta protegida a toda la interfaz. */
export const SesionContext = createContext<Sesion | null>(null);
/** Pantalla de una ruta ("" o "/" es el panel). */
export const pantallaDe = (ruta: string) =>
  ruta.split("?")[0].replace(/^\/+/, "").split("/")[0] || "panel";
export function useSesion() {
  const sesion = useContext(SesionContext);
  return {
    sesion,
    esAdmin: sesion?.cuenta.rol === "administrador",
    /** Los permisos los define la API: el frontend solo los refleja. */
    puede: (capacidad: string) =>
      Boolean(sesion?.permisos.capacidades.includes(capacidad)),
    veo: (ruta: string) =>
      Boolean(sesion?.permisos.pantallas.includes(pantallaDe(ruta))),
  };
}
