import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import { Monitor, Smartphone } from "lucide-react";
import { request } from "../../../api/client";
import * as S from "../../../api/schemas";
import { Button, Card, QueryState } from "../../../components/ui";
import { conPlantilla } from "../../../lib/html";
import { fecha } from "../../../lib/formato";
import { fechasEstimadas, type Borrador } from "../util";
import styles from "./Editor.module.css";

type Contacto = z.infer<typeof S.contactoElegibleSchema>;
type PasoPrevio = z.infer<typeof S.vistaPreviaSchema>["pasos"][number];

/** Vista previa con los cambios sin guardar, medio segundo después de dejar de escribir. */
export function usePrevisualizar(
  secuenciaId: string,
  contenido: Borrador,
  contactoId: string,
) {
  const texto = JSON.stringify(contenido);
  const [estable, setEstable] = useState(texto);
  useEffect(() => {
    const t = setTimeout(() => setEstable(texto), 500);
    return () => clearTimeout(t);
  }, [texto]);
  return useQuery({
    enabled: Boolean(contactoId),
    queryKey: ["previsualizar", secuenciaId, contactoId, estable],
    queryFn: () =>
      request(
        `/secuencias/${secuenciaId}/previsualizar`,
        S.vistaPreviaSchema,
        "POST",
        {
          contactoId,
          secuencia: JSON.parse(estable),
        },
      ),
    placeholderData: keepPreviousData,
  });
}

export function SelectorContacto({
  contactos,
  valor,
  onCambiar,
}: {
  contactos?: Contacto[];
  valor: string;
  onCambiar: (id: string) => void;
}) {
  return (
    <label>
      Contacto
      <select
        value={valor}
        style={{ width: "100%" }}
        onChange={(e) => onCambiar(e.target.value)}
      >
        {(contactos ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre} · {c.empresa}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Un correo renderizado: el HTML va en un iframe aislado, nunca dentro de la página. */
export function CorreoRenderizado({
  paso,
  asunto,
  fechaEstimada,
}: {
  paso: PasoPrevio;
  asunto?: string;
  fechaEstimada?: Date;
}) {
  return (
    <article className={styles.previa}>
      <div className={styles.previaCabecera}>
        <strong>{asunto ?? paso.asunto ?? "(sin asunto)"}</strong>
        {fechaEstimada && (
          <div className="muted">
            Fecha estimada: {fecha(fechaEstimada.toISOString())}
          </div>
        )}
      </div>
      {paso.formato === "html" && paso.cuerpoHtml ? (
        <iframe
          className={styles.iframe}
          title={`Vista previa del correo ${paso.orden}`}
          sandbox=""
          srcDoc={conPlantilla(paso.cuerpoHtml)}
        />
      ) : (
        <div className={styles.previaCuerpo}>{paso.cuerpo}</div>
      )}
    </article>
  );
}

const asuntoDelHilo = (pasos: PasoPrevio[], i: number) => {
  for (let n = i; n >= 0; n--)
    if (pasos[n]?.asunto)
      return n === i ? pasos[n].asunto : `Re: ${pasos[n].asunto}`;
  return undefined;
};

function AvisoRespaldo({ respaldo }: { respaldo: string[] }) {
  if (!respaldo.length) return null;
  return (
    <p className="notice warning">
      Se usó el texto de respaldo en:{" "}
      {[...new Set(respaldo)].map((x) => `{{${x}}}`).join(", ")}. Este contacto
      no tiene ese dato verificado.
    </p>
  );
}

/** Columna derecha del editor: el correo elegido, en vivo. */
export function VistaPreviaVivo({
  secuenciaId,
  contenido,
  orden,
  contactos,
  cargandoContactos,
}: {
  secuenciaId: string;
  contenido: Borrador;
  orden: number;
  contactos?: Contacto[];
  cargandoContactos: boolean;
}) {
  const [elegido, setElegido] = useState("");
  // Por defecto el primer contacto elegible (nunca un id fijo).
  const contacto = elegido || contactos?.[0]?.id || "";
  const [dispositivo, setDispositivo] = useState<"escritorio" | "celular">(
    "escritorio",
  );
  const q = usePrevisualizar(secuenciaId, contenido, contacto);
  const i = orden - 1;
  const paso = q.data?.pasos[i];
  return (
    <Card title="Vista previa">
      {cargandoContactos ? (
        <small>Cargando contactos…</small>
      ) : !contactos?.length ? (
        <p className="muted">
          El segmento no tiene contactos elegibles para la vista previa.
        </p>
      ) : (
        <div className="stack">
          <SelectorContacto
            contactos={contactos}
            valor={contacto}
            onCambiar={setElegido}
          />
          <div
            className="row"
            role="group"
            aria-label="Tamaño de la vista previa"
          >
            <Button
              aria-pressed={dispositivo === "escritorio"}
              onClick={() => setDispositivo("escritorio")}
            >
              <Monitor size={14} aria-hidden /> Escritorio
            </Button>
            <Button
              aria-pressed={dispositivo === "celular"}
              onClick={() => setDispositivo("celular")}
            >
              <Smartphone size={14} aria-hidden /> Celular
            </Button>
          </div>
          <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
            {q.data && paso && (
              <div
                data-dispositivo={dispositivo}
                className={styles.dispositivo}
              >
                <AvisoRespaldo respaldo={q.data.respaldo} />
                <CorreoRenderizado
                  paso={paso}
                  asunto={asuntoDelHilo(q.data.pasos, i)}
                />
              </div>
            )}
          </QueryState>
          <small className="muted">
            Con los cambios sin guardar. No se guarda ni se envía nada.
          </small>
        </div>
      )}
    </Card>
  );
}

/** Pestaña «Vista previa»: todos los correos como un hilo, con su fecha estimada. */
export function Hilo({
  secuenciaId,
  contenido,
  contactos,
}: {
  secuenciaId: string;
  contenido: Borrador;
  contactos?: Contacto[];
}) {
  const [elegido, setElegido] = useState("");
  const contacto = elegido || contactos?.[0]?.id || "";
  const q = usePrevisualizar(secuenciaId, contenido, contacto);
  const fechas = fechasEstimadas(contenido.pasos, contenido.ventanaEnvio.dias);
  return (
    <Card title="Así lo recibiría el contacto">
      {!contactos?.length ? (
        <p className="muted">
          El segmento no tiene contactos elegibles para la vista previa.
        </p>
      ) : (
        <div className="stack">
          <SelectorContacto
            contactos={contactos}
            valor={contacto}
            onCambiar={setElegido}
          />
          <small className="muted">
            Fechas estimadas si se inscribiera hoy, contando solo los días de la
            ventana de envío.
          </small>
          <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
            {q.data && (
              <div className={styles.hilo}>
                <AvisoRespaldo respaldo={q.data.respaldo} />
                {q.data.pasos.map((p, i) => (
                  <CorreoRenderizado
                    key={p.id ?? i}
                    paso={p}
                    asunto={asuntoDelHilo(q.data.pasos, i)}
                    fechaEstimada={fechas[i]}
                  />
                ))}
              </div>
            )}
          </QueryState>
        </div>
      )}
    </Card>
  );
}
