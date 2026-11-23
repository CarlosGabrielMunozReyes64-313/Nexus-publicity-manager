import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui";
import { DIAS, type Borrador } from "../util";
import styles from "./Editor.module.css";

/** Pestaña «Configuración»: datos generales y ventana de envío (el segmento no se cambia aquí). */
export default function Configuracion({
  contenido,
  onCambiar,
  segmento,
}: {
  contenido: Borrador;
  onCambiar: (c: Borrador) => void;
  segmento?: { id: string; nombre: string };
}) {
  const [metrica, setMetrica] = useState("");
  const v = contenido.ventanaEnvio;
  const agregarMetrica = () => {
    const m = metrica.trim();
    if (m && !contenido.metricasExito.includes(m))
      onCambiar({
        ...contenido,
        metricasExito: [...contenido.metricasExito, m],
      });
    setMetrica("");
  };
  // Lunes a domingo, con 0 = domingo (igual que el resto de la aplicación).
  const orden = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="grid">
      <Card title="Datos de la secuencia">
        <div className="stack">
          <label>
            Nombre
            <input
              value={contenido.nombre}
              onChange={(e) =>
                onCambiar({ ...contenido, nombre: e.target.value })
              }
            />
          </label>
          <label>
            Objetivo
            <input
              value={contenido.objetivo}
              onChange={(e) =>
                onCambiar({ ...contenido, objetivo: e.target.value })
              }
            />
          </label>
          <label>
            Llamada a la acción
            <input
              value={contenido.llamadaAccion}
              onChange={(e) =>
                onCambiar({ ...contenido, llamadaAccion: e.target.value })
              }
            />
          </label>
          <div>
            <span>Métricas de éxito</span>
            <div className={styles.chips}>
              {contenido.metricasExito.map((m) => (
                <span key={m} className={styles.chip}>
                  {m}
                  <button
                    type="button"
                    aria-label={`Quitar ${m}`}
                    onClick={() =>
                      onCambiar({
                        ...contenido,
                        metricasExito: contenido.metricasExito.filter(
                          (x) => x !== m,
                        ),
                      })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <label>
              Agregar métrica
              <input
                value={metrica}
                placeholder="Escriba y presione Enter"
                onChange={(e) => setMetrica(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    agregarMetrica();
                  }
                }}
                onBlur={agregarMetrica}
              />
            </label>
          </div>
          <p>
            Segmento:{" "}
            {segmento ? (
              <Link to={`/segmentos/${segmento.id}`}>{segmento.nombre}</Link>
            ) : (
              "—"
            )}{" "}
            <small className="muted">(se elige al crear la secuencia)</small>
          </p>
        </div>
      </Card>
      <Card title="Ventana de envío · hora de Bogotá">
        <fieldset>
          <legend>Días</legend>
          <div className="row">
            {orden.map((d) => (
              <label className="check" key={d}>
                <input
                  type="checkbox"
                  checked={v.dias.includes(d)}
                  onChange={(e) =>
                    onCambiar({
                      ...contenido,
                      ventanaEnvio: {
                        ...v,
                        dias: e.target.checked
                          ? [...v.dias, d].sort((a, b) => a - b)
                          : v.dias.filter((x) => x !== d),
                      },
                    })
                  }
                />
                {DIAS[d]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid">
          <label>
            Hora de inicio
            <input
              type="time"
              value={v.desde}
              onChange={(e) =>
                onCambiar({
                  ...contenido,
                  ventanaEnvio: { ...v, desde: e.target.value },
                })
              }
            />
          </label>
          <label>
            Hora de fin
            <input
              type="time"
              value={v.hasta}
              onChange={(e) =>
                onCambiar({
                  ...contenido,
                  ventanaEnvio: { ...v, hasta: e.target.value },
                })
              }
            />
          </label>
        </div>
        <small className="muted">
          Debe tener días y horas en común con el horario global (Configuración
          → Límites y horarios).
        </small>
      </Card>
    </div>
  );
}
