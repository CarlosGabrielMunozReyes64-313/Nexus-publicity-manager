import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { Trash2 } from "lucide-react";
import { request } from "../../api/client";
import * as S from "../../api/schemas";
import { Button, Modal, useFeedback } from "../../components/ui";

export type Recurso = z.infer<typeof S.recursoEliminableSchema>;
type Previa = z.infer<typeof S.previaEliminacionSchema>;

const NOMBRE: Record<Recurso, string> = {
  contactos: "contacto",
  segmentos: "segmento",
  listas: "lista de envío",
  plantillas: "plantilla",
  empresas: "empresa",
  imagenes: "imagen",
};

/**
 * Confirmación de eliminación: antes de borrar consulta a la API qué registro
 * se elimina, qué efectos tiene y qué secuencias activas se ven afectadas.
 */
export function ConfirmarEliminacion({
  recurso,
  ids,
  onClose,
  onDone,
}: {
  recurso: Recurso;
  ids: string[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cache = useQueryClient();
  const { notify } = useFeedback();
  const clave = ids.join(",");
  useEffect(() => {
    let vivo = true;
    request("/eliminacion/previa", S.previaEliminacionSchema, "POST", {
      recurso,
      ids: clave.split(","),
    })
      .then((p) => vivo && setPrevia(p))
      .catch(
        (e: unknown) =>
          vivo &&
          setError(e instanceof Error ? e.message : "No se pudo revisar"),
      );
    return () => {
      vivo = false;
    };
  }, [recurso, clave]);

  const esContacto = recurso === "contactos";
  const titulo = esContacto
    ? ids.length > 1
      ? `Eliminar ${ids.length} contactos de la aplicación`
      : "Eliminar contacto de la aplicación"
    : `Eliminar ${NOMBRE[recurso]}`;

  const confirmar = async () => {
    setEnviando(true);
    setError(null);
    try {
      await request("/eliminacion", S.okSchema, "POST", { recurso, ids });
      await cache.invalidateQueries();
      notify(
        esContacto
          ? "Contacto eliminado. Sus envíos pendientes se cancelaron."
          : `${NOMBRE[recurso][0].toUpperCase()}${NOMBRE[recurso].slice(1)} eliminada(o).`,
      );
      onClose();
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
      setEnviando(false);
    }
  };

  return (
    <Modal title={titulo} onClose={onClose}>
      <div className="stack" aria-live="polite">
        {!previa && !error && <p className="muted">Revisando el impacto…</p>}
        {previa && (
          <>
            <p>
              Se eliminará: <strong>{previa.titulo}</strong>
            </p>
            {previa.detalle && <p className="muted">{previa.detalle}</p>}
            {previa.secuenciasActivas.length > 0 ? (
              <div role="note">
                <strong>Afecta a secuencias activas:</strong>
                <ul className="list">
                  {previa.secuenciasActivas.map((s) => (
                    <li key={s.id}>
                      {s.secuenciaId ? (
                        <Link to={`/secuencias/${s.secuenciaId}`}>
                          {s.nombre}
                        </Link>
                      ) : (
                        s.nombre
                      )}
                      {s.contactos ? ` · ${s.contactos} contacto(s)` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="muted">No afecta a ninguna secuencia activa.</p>
            )}
            {previa.efectos.length > 0 && (
              <ul className="list">
                {previa.efectos.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            {previa.bloqueo && (
              <p role="alert" className="danger">
                No se puede eliminar: {previa.bloqueo}
              </p>
            )}
            {previa.puedeEliminar && (
              <p className="danger">Esta acción no se puede deshacer.</p>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="danger">
            {error}
          </p>
        )}
        <footer>
          <Button onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={!previa?.puedeEliminar || enviando}
            onClick={() => void confirmar()}
          >
            {enviando ? "Eliminando…" : titulo}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

/** Botón «Eliminar» que abre la confirmación con vista previa del impacto. */
export function BotonEliminar({
  recurso,
  ids,
  etiqueta,
  onDone,
  compacto,
}: {
  recurso: Recurso;
  ids: string[];
  etiqueta?: string;
  onDone?: () => void;
  compacto?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const texto =
    etiqueta ??
    (recurso === "contactos"
      ? "Eliminar contacto de la aplicación"
      : "Eliminar");
  return (
    <>
      <Button
        variant="danger"
        disabled={!ids.length}
        aria-label={compacto ? texto : undefined}
        title={texto}
        onClick={() => setAbierto(true)}
      >
        <Trash2 size={16} />
        {compacto ? null : ` ${texto}`}
      </Button>
      {abierto && (
        <ConfirmarEliminacion
          recurso={recurso}
          ids={ids}
          onClose={() => setAbierto(false)}
          onDone={onDone}
        />
      )}
    </>
  );
}
