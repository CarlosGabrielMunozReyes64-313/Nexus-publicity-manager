import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Contenido } from "../util";

/**
 * Pide confirmar antes de salir con cambios sin guardar: al cerrar o recargar la
 * pestaña (beforeunload) y al seguir un enlace de la aplicación (menú, «Volver»…).
 * El botón «atrás» del navegador no se puede frenar con este router; para ese caso
 * queda la copia local.
 */
export function useAvisoSalida(
  sucio: boolean,
  confirmar: () => Promise<boolean>,
) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!sucio) return;
    const alCerrar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const alClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey)
        return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!a || a.getAttribute("target") === "_blank") return;
      const url = new URL(a.getAttribute("href")!, window.location.href);
      if (url.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      void confirmar().then((ok) => {
        if (ok) navigate(url.pathname + url.search + url.hash);
      });
    };
    window.addEventListener("beforeunload", alCerrar);
    document.addEventListener("click", alClic, true);
    return () => {
      window.removeEventListener("beforeunload", alCerrar);
      document.removeEventListener("click", alClic, true);
    };
  }, [sucio, confirmar, navigate]);
}

export interface CopiaLocal {
  guardadaEn: string;
  version: number;
  contenido: Contenido;
}
const clave = (id: string) => `nexus-borrador-${id}`;

/** Copia local de los cambios sin guardar (el almacenamiento puede no existir). */
export const copiaLocal = {
  leer(id: string): CopiaLocal | null {
    try {
      const v = window.localStorage.getItem(clave(id));
      return v ? (JSON.parse(v) as CopiaLocal) : null;
    } catch {
      return null;
    }
  },
  guardar(id: string, c: CopiaLocal) {
    try {
      window.localStorage.setItem(clave(id), JSON.stringify(c));
    } catch {
      // Sin almacenamiento (modo privado, cuota llena…): solo se pierde la copia.
    }
  },
  borrar(id: string) {
    try {
      window.localStorage.removeItem(clave(id));
    } catch {
      // Igual que arriba.
    }
  },
};
