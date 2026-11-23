import { useState } from "react";
import { Link } from "react-router-dom";
import type { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { request } from "../../../api/client";
import * as S from "../../../api/schemas";
import { Button, Modal, useFeedback } from "../../../components/ui";
import { duracion, ventanaTexto, type Borrador } from "../util";

type Revision = z.infer<typeof S.revisionSecuenciaSchema>;
type Contacto = z.infer<typeof S.contactoElegibleSchema>;

const mensaje = (e: unknown, defecto: string) =>
  e instanceof Error ? e.message : defecto;

/** Aprobar (o «Aprobar cambios»): resumen, aviso de que no se envía nada y, si la
 * campaña está activa, la opción de aprobar y reanudar. */
export function DialogoAprobar({
  secuenciaId,
  campanaId,
  campanaActiva,
  versionBorrador,
  cambios,
  contenido,
  rev,
  onClose,
}: {
  secuenciaId: string;
  campanaId?: string;
  campanaActiva: boolean;
  versionBorrador: number;
  cambios: boolean;
  contenido: Borrador;
  rev: Revision;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const { notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const aprobar = async (reanudar: boolean) => {
    setBusy(true);
    setError("");
    try {
      await request(
        `/secuencias/${secuenciaId}/${reanudar ? "aprobar-y-reanudar" : "aprobar"}`,
        S.okSchema,
        "POST",
        {},
      );
      await cache.invalidateQueries();
      onClose();
      notify(
        reanudar
          ? "Cambios aprobados y campaña reanudada."
          : "Secuencia aprobada. No se envió ningún correo.",
      );
    } catch (e) {
      // Si reanudar falla, la aprobación ya quedó guardada.
      await cache.invalidateQueries();
      setError(
        reanudar
          ? `Se aprobó la versión, pero no se pudo reanudar: ${mensaje(e, "error")}`
          : mensaje(e, "No se pudo aprobar"),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={cambios ? "Aprobar cambios" : "Aprobar secuencia"}
      onClose={() => !busy && onClose()}
    >
      <ul>
        <li>Versión {versionBorrador}</li>
        <li>{contenido.pasos.length} correos</li>
        <li>
          Duración: {rev.duracionDiasHabiles ?? duracion(contenido.pasos)} días
          hábiles
        </li>
        <li>Ventana: {ventanaTexto(contenido.ventanaEnvio)}</li>
        <li>
          {rev.elegibles}{" "}
          {rev.elegibles === 1 ? "contacto elegible" : "contactos elegibles"}
        </li>
        <li>Tope diario: {rev.topeDiario ?? "sin dato"} correos nuevos</li>
      </ul>
      <p className="notice">
        Aprobar no envía ningún correo. Los envíos empiezan cuando actives la
        campaña
        {campanaId && (
          <>
            {" "}
            (
            <Link to={`/campanas/${campanaId}`} onClick={onClose}>
              ver campaña
            </Link>
            )
          </>
        )}
        .
      </p>
      {campanaActiva && (
        <p className="notice warning">
          La campaña está activa: al aprobar se pausan sus envíos hasta que la
          reanudes. Con «Aprobar y reanudar» sigue enviando, ya con la versión
          nueva.
        </p>
      )}
      {rev.advertencias.length > 0 && (
        <p className="muted">
          Hay {rev.advertencias.length}{" "}
          {rev.advertencias.length === 1 ? "advertencia" : "advertencias"} en la
          lista de verificación; no impiden aprobar.
        </p>
      )}
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      <footer>
        <Button disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        {campanaActiva && (
          <Button disabled={busy} onClick={() => void aprobar(true)}>
            Aprobar y reanudar
          </Button>
        )}
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => void aprobar(false)}
        >
          {busy ? "Aprobando…" : cambios ? "Aprobar cambios" : "Aprobar"}
        </Button>
      </footer>
    </Modal>
  );
}

/** Envío de prueba: solo al correo del administrador, con el contenido en pantalla. */
export function DialogoPrueba({
  secuenciaId,
  contenido,
  contactos,
  ordenActual,
  onClose,
}: {
  secuenciaId: string;
  contenido: Borrador;
  contactos?: Contacto[];
  ordenActual: number;
  onClose: () => void;
}) {
  const { notify } = useFeedback();
  const [contacto, setContacto] = useState(contactos?.[0]?.id ?? "");
  const [orden, setOrden] = useState(String(ordenActual));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState("");
  return (
    <Modal title="Enviar prueba" onClose={() => !busy && onClose()}>
      <p className="muted">
        Llega solo a tu correo, con el asunto «[Prueba] …» y sin enlaces de
        seguimiento. Usa los cambios en pantalla aunque no estén guardados.
      </p>
      <label>
        Contacto (para personalizar)
        <select value={contacto} onChange={(e) => setContacto(e.target.value)}>
          {(contactos ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} · {c.empresa}
            </option>
          ))}
        </select>
      </label>
      <label>
        Correo
        <select value={orden} onChange={(e) => setOrden(e.target.value)}>
          {contenido.pasos.map((p, i) => (
            <option key={p.id} value={String(i + 1)}>
              Correo {i + 1}
            </option>
          ))}
          <option value="todos">Todos los correos</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      {enviado && (
        <p role="status" className="notice">
          {enviado}
        </p>
      )}
      <footer>
        <Button disabled={busy} onClick={onClose}>
          {enviado ? "Cerrar" : "Cancelar"}
        </Button>
        <Button
          variant="primary"
          disabled={busy || !contacto}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await request(
                `/secuencias/${secuenciaId}/prueba`,
                S.pruebaEnviadaSchema,
                "POST",
                {
                  contactoId: contacto,
                  ...(orden === "todos" ? {} : { orden: Number(orden) }),
                  secuencia: contenido,
                },
              );
              const texto = `Enviamos ${r.enviados} ${r.enviados === 1 ? "correo" : "correos"} de prueba a ${r.destinatario}.`;
              setEnviado(texto);
              notify(texto);
            } catch (e) {
              setError(mensaje(e, "No se pudo enviar la prueba"));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Enviando…" : "Enviar prueba"}
        </Button>
      </footer>
    </Modal>
  );
}

/** «Pedir otra versión a la IA» con un comentario. */
export function DialogoOtraVersion({
  secuenciaId,
  sucio,
  onClose,
}: {
  secuenciaId: string;
  sucio: boolean;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const { notify } = useFeedback();
  const [comentario, setComentario] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valido = comentario.trim().length >= 3;
  return (
    <Modal
      title="Pedir otra versión a la IA"
      onClose={() => !busy && onClose()}
    >
      <p className="muted">
        El borrador actual queda rechazado con tu comentario y la IA escribe una
        versión nueva. Aparecerá en el historial en unos minutos.
      </p>
      {sucio && (
        <p className="notice warning">
          Tienes cambios sin guardar: la IA parte del último borrador guardado.
        </p>
      )}
      <label>
        Comentario para la IA (mínimo 3 caracteres)
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      <footer>
        <Button disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          disabled={busy || !valido}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await request(
                `/secuencias/${secuenciaId}/otra-version-ia`,
                S.okSchema,
                "POST",
                { comentario: comentario.trim() },
              );
              await cache.invalidateQueries();
              onClose();
              notify(
                "La IA está escribiendo otra versión. Aparecerá en el historial en unos minutos.",
              );
            } catch (e) {
              setError(mensaje(e, "No se pudo pedir la versión"));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Enviando…" : "Pedir a la IA"}
        </Button>
      </footer>
    </Modal>
  );
}

/** Confirmación al salir con cambios sin guardar. */
export function DialogoSalir({
  onSalir,
  onQuedarse,
}: {
  onSalir: () => void;
  onQuedarse: () => void;
}) {
  return (
    <Modal title="Tienes cambios sin guardar" onClose={onQuedarse}>
      <p>
        Si sales ahora, los cambios quedan solo en la copia local de este
        navegador. ¿Quieres salir sin guardar?
      </p>
      <footer>
        <Button variant="primary" onClick={onQuedarse}>
          Seguir editando
        </Button>
        <Button variant="danger" onClick={onSalir}>
          Salir sin guardar
        </Button>
      </footer>
    </Modal>
  );
}
