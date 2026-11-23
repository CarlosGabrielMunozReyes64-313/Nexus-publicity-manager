import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { z } from "zod";
import { request } from "../../api/client";
import * as S from "../../api/schemas";
import { Badge, Button, Card } from "../../components/ui";
import { Intro } from "../shared";
import st from "./Terminal.module.css";

type Vista = z.infer<typeof S.terminalSchema>;
type Linea = Vista["eventos"][number];

/** Cada cuánto se pregunta al servidor por líneas nuevas. */
export const INTERVALO_MS = 3000;
const MAX_LINEAS = 1000;
const SIMBOLO: Record<Linea["nivel"], string> = {
  info: "›",
  exito: "✓",
  aviso: "!",
  error: "✗",
};
const ZONA = "America/Bogota";
const formatoHora = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const formatoDia = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
});
const dia = (d: Date) => formatoDia.format(d);
function cuando(fecha: string) {
  const d = new Date(fecha);
  const hora = formatoHora.format(d);
  return dia(d) === dia(new Date()) ? hora : `${dia(d)} ${hora}`;
}
function hace(fecha: string) {
  const s = Math.max(
    0,
    Math.round((Date.now() - new Date(fecha).getTime()) / 1000),
  );
  return s < 60
    ? `hace ${s} s`
    : s < 3600
      ? `hace ${Math.round(s / 60)} min`
      : `desde las ${cuando(fecha)}`;
}
const ESTADOS: Record<Vista["ahoraMismo"][number]["estado"], string> = {
  en_proceso: "En curso",
  en_cola: "En cola",
  esperando: "Esperando reintento",
};

export default function Page() {
  const [vista, setVista] = useState<Omit<Vista, "eventos"> | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pausada, setPausada] = useState(false);
  const [soloAvisos, setSoloAvisos] = useState(false);
  const ultimo = useRef(0);
  const pantalla = useRef<HTMLDivElement>(null);
  const alFinal = useRef(true);

  const leer = useCallback(async () => {
    try {
      const desde = ultimo.current;
      const r = await request(
        desde ? `/terminal?desde=${desde}` : "/terminal",
        S.terminalSchema,
      );
      const { eventos, ...resto } = r;
      setVista(resto);
      setError(null);
      if (eventos.length) {
        ultimo.current = eventos[eventos.length - 1].id;
        setLineas((prev) => [...prev, ...eventos].slice(-MAX_LINEAS));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la terminal");
    }
  }, []);

  useEffect(() => {
    if (pausada) return;
    void leer();
    const timer = setInterval(() => void leer(), INTERVALO_MS);
    return () => clearInterval(timer);
  }, [pausada, leer]);

  const visibles = soloAvisos
    ? lineas.filter((l) => l.nivel === "aviso" || l.nivel === "error")
    : lineas;

  // Sigue la última línea, salvo que el administrador haya subido a leer.
  useLayoutEffect(() => {
    const el = pantalla.current;
    if (el && alFinal.current) el.scrollTop = el.scrollHeight;
  }, [visibles.length]);

  const copiar = () =>
    void navigator.clipboard?.writeText(
      visibles
        .map((l) => `${cuando(l.fecha)} ${SIMBOLO[l.nivel]} ${l.mensaje}`)
        .join("\n"),
    );

  return (
    <>
      <Intro
        title="Terminal"
        description="Lo que el sistema hace en segundo plano, en vivo: búsquedas, verificaciones, envíos y reintentos. Sin datos personales."
      />
      <Card title="Estado">
        {vista ? (
          <div className="stack">
            <div className={st.estado}>
              <span className={st.trabajador}>
                <span
                  className={st.punto}
                  data-activo={vista.trabajador.activo}
                  aria-hidden
                />
                {vista.trabajador.activo
                  ? "Trabajador activo"
                  : "Sin señal del trabajador"}
                {vista.trabajador.vistoEn && (
                  <small className={st.cifra}>
                    {" "}
                    · última señal {hace(vista.trabajador.vistoEn)}
                  </small>
                )}
              </span>
              <span className={st.cifra}>
                En curso <strong>{vista.cola.enProceso}</strong>
              </span>
              <span className={st.cifra}>
                En cola <strong>{vista.cola.enCola}</strong>
              </span>
              <span className={st.cifra}>
                Esperando reintento <strong>{vista.cola.esperando}</strong>
              </span>
              <span className={st.cifra}>
                Fallidas (24 h) <strong>{vista.cola.fallidas24h}</strong>
              </span>
            </div>
            {!vista.trabajador.activo && (
              <p className="notice warning" role="alert">
                El trabajador no da señales. Sin él no se buscan empresas ni se
                envían correos. Revise en Railway que el proceso «trabajador»
                esté en marcha.
              </p>
            )}
            {vista.ahoraMismo.length > 0 ? (
              <ul className={st.ahora} aria-label="Ahora mismo">
                {vista.ahoraMismo.map((t) => (
                  <li key={t.tareaId}>
                    <Badge
                      tono={
                        t.estado === "en_proceso"
                          ? "success"
                          : t.estado === "esperando"
                            ? "warning"
                            : "info"
                      }
                    >
                      {ESTADOS[t.estado]}
                    </Badge>
                    <span>{t.descripcion}</span>
                    <small>
                      {t.estado === "en_proceso"
                        ? `desde las ${cuando(t.desde)}`
                        : `a las ${cuando(t.desde)}`}
                      {t.intento > 1 &&
                        ` · intento ${t.intento} de ${t.maxIntentos}`}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <small className={st.cifra}>Nada en curso ni en cola.</small>
            )}
          </div>
        ) : error ? null : (
          <small>Conectando…</small>
        )}
        {error && (
          <p className="notice danger" role="alert">
            No se pudo leer la terminal: {error}. Se vuelve a intentar sola.
          </p>
        )}
      </Card>
      <div style={{ marginTop: 20 }}>
        <Card title="Bitácora">
          <div className={st.barra}>
            <Button onClick={() => setPausada((p) => !p)}>
              {pausada ? "Reanudar" : "Pausar"}
            </Button>
            <label>
              <input
                type="checkbox"
                checked={soloAvisos}
                onChange={(e) => setSoloAvisos(e.target.checked)}
              />
              Solo avisos y errores
            </label>
            <Button onClick={copiar} disabled={!visibles.length}>
              Copiar
            </Button>
            <Button onClick={() => setLineas([])} disabled={!lineas.length}>
              Limpiar pantalla
            </Button>
            <small className={st.cifra}>
              {pausada
                ? "En pausa: no se leen líneas nuevas."
                : `Se actualiza cada ${INTERVALO_MS / 1000} s. Guarda los últimos 3 días.`}
            </small>
          </div>
          <div
            ref={pantalla}
            className={st.pantalla}
            role="log"
            aria-label="Bitácora del trabajador"
            tabIndex={0}
            onScroll={(e) => {
              const el = e.currentTarget;
              alFinal.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }}
          >
            {visibles.length === 0 && (
              <div className={st.vacia}>
                {soloAvisos
                  ? "Sin avisos ni errores."
                  : "Todavía no hay líneas."}
              </div>
            )}
            {visibles.map((l) => (
              <div key={l.id} className={st.linea} data-nivel={l.nivel}>
                <span className={st.hora}>{cuando(l.fecha)}</span>
                <span aria-hidden>{SIMBOLO[l.nivel]}</span>
                <span>
                  <span className="srOnly">{l.nivel}: </span>
                  {l.mensaje}
                </span>
              </div>
            ))}
            {!pausada && <div className={st.cursor} aria-hidden />}
          </div>
        </Card>
      </div>
    </>
  );
}
