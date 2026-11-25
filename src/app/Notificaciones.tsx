import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { request } from "../api/client";
import { okSchema } from "../api/schemas";
import { RUTA_NOTIFICACIONES, useNotificaciones } from "../api/notificaciones";
import { useFeedback } from "../components/ui";
import { fechaHora } from "../lib/formato";
import styles from "./Layout.module.css";

/** Campana de la cabecera: avisos propios guardados en la API (lectura por destinatario). */
export function CampanaNotificaciones() {
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const { notify } = useFeedback();
  const q = useNotificaciones();
  const sinLeer = q.data?.sinLeer ?? 0;
  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node))
        setAbierta(false);
    };
    const escape = (e: KeyboardEvent) =>
      e.key === "Escape" && setAbierta(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierta]);
  const marcar = async (ruta: string) => {
    try {
      await request(ruta, okSchema, "POST", {});
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se pudo marcar el aviso");
    } finally {
      await cache.invalidateQueries({ queryKey: [RUTA_NOTIFICACIONES] });
    }
  };
  return (
    <div className={styles.campana} ref={caja}>
      <button
        type="button"
        className={styles.campanaBoton}
        aria-label={`Notificaciones${sinLeer ? ` (${sinLeer} sin leer)` : ""}`}
        aria-expanded={abierta}
        onClick={() => setAbierta((v) => !v)}
      >
        <Bell size={17} />
        {sinLeer > 0 && (
          <span className={styles.campanaContador} aria-hidden>
            {sinLeer > 99 ? "99+" : sinLeer}
          </span>
        )}
      </button>
      {abierta && (
        <div
          className={styles.bandeja}
          role="dialog"
          aria-label="Notificaciones"
        >
          <div className={styles.bandejaCabecera}>
            <strong>Notificaciones</strong>
            <button
              type="button"
              className={styles.bandejaAccion}
              disabled={!sinLeer}
              onClick={() => void marcar(`${RUTA_NOTIFICACIONES}/leer-todas`)}
            >
              <CheckCheck size={14} /> Marcar todas como leídas
            </button>
          </div>
          {q.isPending && <p className="muted">Cargando avisos…</p>}
          {q.error && <p role="alert">{q.error.message}</p>}
          {q.data && !q.data.items.length && (
            <p className="muted">No tienes avisos todavía.</p>
          )}
          <ul className={styles.bandejaLista}>
            {q.data?.items.map((a) => (
              <li
                key={a.id}
                className={a.leida ? styles.avisoLeido : styles.avisoNuevo}
              >
                <div className={styles.avisoTitulo}>
                  {!a.leida && <span className={styles.punto} aria-hidden />}
                  <strong>{a.titulo}</strong>
                  {a.repeticiones > 1 && (
                    <small className="muted"> · {a.repeticiones} veces</small>
                  )}
                </div>
                <p>{a.descripcion}</p>
                <div className={styles.avisoPie}>
                  <small className="muted">{fechaHora(a.ultimaVez)}</small>
                  <span className="row">
                    {a.enlace && (
                      <button
                        type="button"
                        className={styles.bandejaAccion}
                        onClick={() => {
                          setAbierta(false);
                          if (!a.leida)
                            void marcar(`${RUTA_NOTIFICACIONES}/${a.id}/leer`);
                          navigate(a.enlace!);
                        }}
                      >
                        Ver
                      </button>
                    )}
                    {!a.leida && (
                      <button
                        type="button"
                        className={styles.bandejaAccion}
                        aria-label={`Marcar como leída: ${a.titulo}`}
                        onClick={() =>
                          void marcar(`${RUTA_NOTIFICACIONES}/${a.id}/leer`)
                        }
                      >
                        Marcar como leída
                      </button>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
