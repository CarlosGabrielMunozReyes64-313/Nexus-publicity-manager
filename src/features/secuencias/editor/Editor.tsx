import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MoreHorizontal, Save, Send } from "lucide-react";
import type { z } from "zod";
import { request } from "../../../api/client";
import { useResource } from "../../../api/hooks";
import * as S from "../../../api/schemas";
import {
  Badge,
  Button,
  Card,
  QueryState,
  Tabs,
  useFeedback,
} from "../../../components/ui";
import { fechaHora } from "../../../lib/formato";
import { erroresDeCorreos } from "../../../lib/reglas";
import type { Secuencia } from "../../../types";
import { useCommand } from "../../shared";
import {
  AUTOR,
  ESTADO_EDITOR,
  avisosDeCorreo,
  normalizarOrden,
  paraEditor,
  type Borrador,
  type CorreoEditor as Correo,
} from "../util";
import Configuracion from "./Configuracion";
import CorreoEditor, { respaldosVacios } from "./CorreoEditor";
import {
  DialogoAprobar,
  DialogoOtraVersion,
  DialogoPrueba,
  DialogoSalir,
} from "./Dialogos";
import Historial from "./Historial";
import ListaCorreos, { type EstadoCorreo } from "./ListaCorreos";
import MejorarConIA from "./MejorarConIA";
import { copiaLocal, useAvisoSalida, type CopiaLocal } from "./salida";
import Verificacion from "./Verificacion";
import { Hilo, VistaPreviaVivo } from "./VistaPrevia";
import styles from "./Editor.module.css";

type BorradorServidor = z.infer<typeof S.borradorSchema>;
const PESTANAS = ["Correos", "Configuración", "Vista previa", "Historial"];
/** Bloqueo del servidor cuando lo aprobado ya es lo último (no es un error). */
const SIN_CAMBIOS =
  "No hay cambios para aprobar: la versión aprobada ya está vigente";

/** Firma comparable de un borrador (sin ids de correo ni notas). */
export const firma = (b: Borrador) =>
  JSON.stringify({
    nombre: b.nombre,
    objetivo: b.objetivo,
    llamadaAccion: b.llamadaAccion,
    metricasExito: b.metricasExito,
    ventanaEnvio: b.ventanaEnvio,
    pasos: normalizarOrden(b).pasos.map((p) => ({
      asunto: p.asunto ?? "",
      cuerpo: p.cuerpo,
      espera: p.esperaDiasHabiles,
      hilo: p.mismoHilo,
      variables: p.variables,
      formato: p.formato ?? "texto",
      html: p.formato === "html" ? (p.cuerpoHtml ?? "") : "",
    })),
  });

/** Lo que se envía al servidor: sin notas (el servidor las conserva) y con orden 1..n. */
const paraGuardar = (b: Borrador) => {
  const { notasAgente, ...resto } = normalizarOrden(b);
  void notasAgente;
  return resto;
};

/** Editor de una secuencia (`/secuencias/:id`), al estilo de Listmonk. */
export default function Editor({ id }: { id: string }) {
  const sec = useResource(`/secuencias/${id}`, S.secuenciaSchema);
  const borrador = useResource(`/secuencias/${id}/borrador`, S.borradorSchema);
  return (
    <QueryState
      loading={sec.isPending || borrador.isPending}
      error={sec.error ?? borrador.error}
      retry={() => {
        void sec.refetch();
        void borrador.refetch();
      }}
    >
      {sec.data && borrador.data && (
        <EditorCargado key={id} secuencia={sec.data} servidor={borrador.data} />
      )}
    </QueryState>
  );
}

function EditorCargado({
  secuencia,
  servidor,
}: {
  secuencia: Secuencia;
  servidor: BorradorServidor;
}) {
  const id = secuencia.id;
  const cache = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const cmd = useCommand();
  const rev = useResource(
    `/secuencias/${id}/revision`,
    S.revisionSecuenciaSchema,
  );
  const elegibles = useResource(
    `/secuencias/${id}/elegibles`,
    S.contactoElegibleSchema.array(),
  );
  const segmentos = useResource("/segmentos", S.segmentoSchema.array());
  const marca = useResource("/configuracion/marca", S.marcaSchema);
  const [base, setBase] = useState(() => paraEditor(servidor.contenido));
  const [version, setVersion] = useState(servidor.version);
  const [draft, setDraft] = useState<Borrador>(base);
  const [actual, setActual] = useState(base.pasos[0]?.id ?? "");
  const [pestana, setPestana] = useState("Correos");
  const [dialogo, setDialogo] = useState<"aprobar" | "prueba" | "otra" | null>(
    null,
  );
  const [menu, setMenu] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");
  const [nuevaEnServidor, setNuevaEnServidor] =
    useState<BorradorServidor | null>(null);
  const [copia, setCopia] = useState<CopiaLocal | null>(() => {
    const c = copiaLocal.leer(id);
    // Solo si es más reciente que el borrador del servidor y distinta.
    return c &&
      c.guardadaEn > servidor.fecha &&
      firma(paraEditor(c.contenido)) !== firma(paraEditor(servidor.contenido))
      ? c
      : null;
  });
  const [salida, setSalida] = useState<((ok: boolean) => void) | null>(null);
  const sucio = firma(draft) !== firma(base);

  // Cambios guardados por otros (la IA, restaurar, una mejora): si no hay cambios
  // locales se cargan; si los hay, se avisa.
  useEffect(() => {
    if (servidor.version === version) return;
    if (!sucio) {
      const nuevo = paraEditor(servidor.contenido);
      setBase(nuevo);
      setDraft(nuevo);
      setVersion(servidor.version);
      setActual((a) =>
        nuevo.pasos.some((p) => p.id === a) ? a : (nuevo.pasos[0]?.id ?? ""),
      );
    } else setNuevaEnServidor(servidor);
  }, [servidor.version]);

  // Copia local mientras haya cambios sin guardar.
  useEffect(() => {
    if (sucio)
      copiaLocal.guardar(id, {
        guardadaEn: new Date().toISOString(),
        version,
        contenido: draft,
      });
    else if (!copia) copiaLocal.borrar(id);
  }, [draft, sucio, id, version, copia]);

  const confirmarSalida = useCallback(
    () => new Promise<boolean>((resolve) => setSalida(() => resolve)),
    [],
  );
  useAvisoSalida(sucio, confirmarSalida);

  const guardar = useCallback(async () => {
    if (!sucio || guardando) return;
    setGuardando(true);
    setErrorGuardar("");
    try {
      const r = await request(
        `/secuencias/${id}/borrador`,
        S.guardadoSchema,
        "PUT",
        {
          secuencia: paraGuardar(draft),
        },
      );
      const v = r.version ?? version + 1;
      setBase(draft);
      setVersion(v);
      setNuevaEnServidor(null);
      copiaLocal.borrar(id);
      setCopia(null);
      await cache.invalidateQueries();
      notify(`Borrador guardado (versión ${v}).`);
    } catch (e) {
      setErrorGuardar(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }, [sucio, guardando, id, draft, version, cache, notify]);

  // Ctrl o Cmd + S guarda.
  const guardarRef = useRef(guardar);
  guardarRef.current = guardar;
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void guardarRef.current();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  // La IA escribiendo otra versión de esta secuencia: se consulta hasta que termine.
  const solicitudes = useQuery({
    queryKey: ["/secuencias/solicitudes"],
    queryFn: () =>
      request("/secuencias/solicitudes", S.solicitudSecuenciaSchema.array()),
    refetchInterval: (q) =>
      q.state.data?.some(
        (s) =>
          s.secuenciaId === id &&
          s.tipo === "revisar_campana" &&
          (s.estado === "en_cola" || s.estado === "trabajando"),
      )
        ? 15000
        : false,
  });
  const iaEscribiendo = (solicitudes.data ?? []).some(
    (s) =>
      s.secuenciaId === id &&
      s.tipo === "revisar_campana" &&
      (s.estado === "en_cola" || s.estado === "trabajando"),
  );
  const listasIA = (solicitudes.data ?? []).filter(
    (s) =>
      s.secuenciaId === id &&
      s.tipo === "revisar_campana" &&
      s.estado === "lista",
  ).length;
  useEffect(() => {
    if (listasIA)
      void cache.invalidateQueries({
        queryKey: [`/secuencias/${id}/borrador`],
      });
  }, [listasIA, cache, id]);

  const comoSecuencia = useMemo(
    () => ({ ...draft, id, pasos: draft.pasos }),
    [draft, id],
  ) as unknown as Secuencia;
  const erroresLocales = useMemo(
    () => erroresDeCorreos(comoSecuencia, marca.data?.prohibidas ?? []),
    [comoSecuencia, marca.data],
  );
  const advertencias = rev.data?.advertencias ?? [];
  const estados: Record<string, EstadoCorreo> = {};
  draft.pasos.forEach((p, i) => {
    estados[p.id] = {
      errores: erroresLocales.filter((e) => e.startsWith(`Correo ${i + 1}:`))
        .length,
      avisos:
        avisosDeCorreo(advertencias, i).length + respaldosVacios(p).length,
    };
  });
  const iActual = Math.max(
    0,
    draft.pasos.findIndex((p) => p.id === actual),
  );
  const correo = draft.pasos[iActual];
  const notas = servidor.contenido.notasAgente ?? draft.notasAgente;
  const nota = notas?.pasos.find((n) => n.orden === iActual + 1);
  const correoBase = base.pasos.find((p) => p.id === correo?.id);
  const editadoPorTi =
    Boolean(nota?.editadoPorAdmin) ||
    !correoBase ||
    JSON.stringify(correoBase) !== JSON.stringify(correo);

  const cambiarCorreos = (pasos: Correo[], elegido?: string) => {
    setDraft((d) => ({
      ...d,
      pasos: pasos.map((p, i) => ({ ...p, orden: i + 1 })),
    }));
    if (elegido) setActual(elegido);
  };
  const cambiarCorreo = (c: Correo) =>
    setDraft((d) => ({
      ...d,
      pasos: d.pasos.map((p) => (p.id === c.id ? c : p)),
    }));

  const tieneAprobada = secuencia.versionAprobada !== undefined;
  const estado = secuencia.estadoEditor ?? "borrador";
  const segmento = segmentos.data?.find((s) => s.id === secuencia.segmentoId);
  const motivoNoAprobar = sucio
    ? "Guarda los cambios antes de aprobar"
    : rev.data && !rev.data.puedeAprobar
      ? [...rev.data.bloqueos, ...rev.data.errores][0]
      : undefined;

  return (
    <>
      <div className={styles.barra}>
        <Link to="/secuencias" aria-label="Volver a la lista">
          <ArrowLeft size={18} aria-hidden /> Secuencias
        </Link>
        <input
          className={styles.nombre}
          aria-label="Nombre de la secuencia"
          value={draft.nombre}
          onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
        />
        <div className={styles.meta}>
          <Badge tono={ESTADO_EDITOR[estado][1]}>
            {ESTADO_EDITOR[estado][0]}
          </Badge>
          {segmento && (
            <span>
              Segmento:{" "}
              <Link to={`/segmentos/${segmento.id}`}>{segmento.nombre}</Link>
            </span>
          )}
          <span>
            Borrador v{version}
            {tieneAprobada
              ? ` · aprobada v${secuencia.versionAprobada}`
              : " · sin aprobar"}
          </span>
          {sucio && <Badge tono="warning">Cambios sin guardar</Badge>}
        </div>
        <div className={styles.acciones}>
          <Button
            onClick={() => void guardar()}
            disabled={!sucio || guardando}
            title="Ctrl o Cmd + S"
          >
            <Save size={14} aria-hidden />{" "}
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
          <Button
            onClick={() => setDialogo("prueba")}
            disabled={!elegibles.data?.length}
          >
            <Send size={14} aria-hidden /> Enviar prueba
          </Button>
          <Button
            variant="primary"
            disabled={Boolean(motivoNoAprobar) || !rev.data}
            title={motivoNoAprobar}
            onClick={() => setDialogo("aprobar")}
          >
            {tieneAprobada ? "Aprobar cambios" : "Aprobar"}
          </Button>
          <div className={styles.menu}>
            <Button
              aria-label="Más acciones"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal size={16} />
            </Button>
            {menu && (
              <div role="menu" onClick={() => setMenu(false)}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    try {
                      const r = await request(
                        `/secuencias/${id}/duplicar`,
                        S.creadaSchema,
                        "POST",
                        {},
                      );
                      await cache.invalidateQueries({
                        queryKey: ["/secuencias"],
                      });
                      notify("Copia creada.");
                      navigate(`/secuencias/${r.id}`);
                    } catch (e) {
                      notify(
                        e instanceof Error ? e.message : "No se pudo duplicar",
                      );
                    }
                  }}
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={
                    secuencia.campanaEstado === "activa" || secuencia.archivada
                  }
                  title={
                    secuencia.campanaEstado === "activa"
                      ? "Pause la campaña antes de archivar"
                      : undefined
                  }
                  onClick={() =>
                    cmd.ask(
                      "Archivar secuencia",
                      "Deja de aparecer en la lista. No se borra nada.",
                      `/secuencias/${id}/archivar`,
                    )
                  }
                >
                  Archivar
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={iaEscribiendo}
                  onClick={() => setDialogo("otra")}
                >
                  Pedir otra versión a la IA
                </button>
                {secuencia.campanaId && (
                  <Link role="menuitem" to={`/campanas/${secuencia.campanaId}`}>
                    Ver campaña
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
        {motivoNoAprobar &&
          !sucio &&
          (motivoNoAprobar === SIN_CAMBIOS ? (
            <small className="muted" style={{ flexBasis: "100%" }}>
              La versión aprobada está vigente: no hay cambios por aprobar.
            </small>
          ) : (
            <small className={styles.error} style={{ flexBasis: "100%" }}>
              No se puede aprobar: {motivoNoAprobar}
            </small>
          ))}
      </div>

      {copia && (
        <p className="notice warning" role="status">
          Hay cambios sin guardar en este navegador del{" "}
          {fechaHora(copia.guardadaEn)}, más recientes que el borrador guardado.{" "}
          <Button
            onClick={() => {
              setDraft(paraEditor(copia.contenido));
              setCopia(null);
            }}
          >
            Recuperar
          </Button>{" "}
          <Button
            onClick={() => {
              copiaLocal.borrar(id);
              setCopia(null);
            }}
          >
            Descartar
          </Button>
        </p>
      )}
      {sucio && tieneAprobada && (
        <p className="notice warning">
          Lo que estás editando es un borrador. Se sigue enviando la versión
          aprobada hasta que apruebes los cambios.
        </p>
      )}
      {iaEscribiendo && (
        <p className="notice" role="status">
          La IA está escribiendo otra versión de esta secuencia. Aparecerá en el
          historial cuando esté lista.
        </p>
      )}
      {nuevaEnServidor && (
        <p className="notice warning">
          Hay una versión más nueva guardada (v{nuevaEnServidor.version}, de{" "}
          {AUTOR[nuevaEnServidor.autor]}).{" "}
          <Button
            onClick={() => {
              const nuevo = paraEditor(nuevaEnServidor.contenido);
              setBase(nuevo);
              setDraft(nuevo);
              setVersion(nuevaEnServidor.version);
              setActual(nuevo.pasos[0]?.id ?? "");
              setNuevaEnServidor(null);
            }}
          >
            Cargarla y descartar mis cambios
          </Button>
        </p>
      )}
      {errorGuardar && (
        <p role="alert" className="notice warning danger">
          {errorGuardar}
        </p>
      )}

      <Tabs items={PESTANAS} value={pestana} onChange={setPestana} />

      {pestana === "Correos" && (
        <>
          {notas?.general && (
            <details className={styles.notas} style={{ marginBottom: 14 }}>
              <summary>Por qué la IA propuso esta secuencia</summary>
              <p>{notas.general}</p>
            </details>
          )}
          <div className={styles.tres}>
            <ListaCorreos
              correos={draft.pasos}
              actual={correo?.id ?? ""}
              estados={estados}
              onElegir={setActual}
              onCambiar={cambiarCorreos}
            />
            {correo ? (
              <CorreoEditor
                key={correo.id}
                correo={correo}
                i={iActual}
                nota={nota}
                editadoPorTi={editadoPorTi}
                errores={erroresLocales
                  .filter((e) => e.startsWith(`Correo ${iActual + 1}:`))
                  .map((e) => e.slice(`Correo ${iActual + 1}:`.length).trim())}
                avisos={[
                  ...avisosDeCorreo(advertencias, iActual),
                  ...respaldosVacios(correo),
                ]}
                onCambiar={cambiarCorreo}
                extra={
                  secuencia.archivada ? undefined : (
                    <MejorarConIA
                      secuenciaId={id}
                      orden={iActual + 1}
                      correo={correo}
                      contenido={draft}
                      onUsar={cambiarCorreo}
                    />
                  )
                }
              />
            ) : (
              <Card>Agrega un correo para empezar.</Card>
            )}
            <VistaPreviaVivo
              secuenciaId={id}
              contenido={draft}
              orden={iActual + 1}
              contactos={elegibles.data}
              cargandoContactos={elegibles.isPending}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <Verificacion
              rev={rev.data}
              sucio={sucio}
              erroresLocales={erroresLocales}
            />
          </div>
        </>
      )}
      {pestana === "Configuración" && (
        <Configuracion
          contenido={draft}
          onCambiar={setDraft}
          segmento={segmento}
        />
      )}
      {pestana === "Vista previa" && (
        <Hilo secuenciaId={id} contenido={draft} contactos={elegibles.data} />
      )}
      {pestana === "Historial" && (
        <Historial
          secuenciaId={id}
          versionBorrador={version}
          onRestaurar={(n) =>
            cmd.confirm({
              title: `Restaurar la versión ${n} como borrador`,
              summary: sucio
                ? `Se creará la versión ${version + 1} con el contenido de la versión ${n}. Perderás los cambios sin guardar.`
                : `Se creará la versión ${version + 1} con el contenido de la versión ${n}. Lo aprobado no cambia.`,
              run: async () => {
                await request(
                  `/secuencias/${id}/versiones/${n}/restaurar`,
                  S.guardadoSchema,
                  "POST",
                  {},
                );
                setDraft(base); // el borrador nuevo llega del servidor
                await cache.invalidateQueries();
                return `Se restauró la versión ${n} como borrador.`;
              },
            })
          }
        />
      )}

      {dialogo === "aprobar" && rev.data && (
        <DialogoAprobar
          secuenciaId={id}
          campanaId={secuencia.campanaId}
          campanaActiva={secuencia.campanaEstado === "activa"}
          versionBorrador={version}
          cambios={tieneAprobada}
          contenido={draft}
          rev={rev.data}
          onClose={() => setDialogo(null)}
        />
      )}
      {dialogo === "prueba" && (
        <DialogoPrueba
          secuenciaId={id}
          contenido={draft}
          contactos={elegibles.data}
          ordenActual={iActual + 1}
          onClose={() => setDialogo(null)}
        />
      )}
      {dialogo === "otra" && (
        <DialogoOtraVersion
          secuenciaId={id}
          sucio={sucio}
          onClose={() => setDialogo(null)}
        />
      )}
      {salida && (
        <DialogoSalir
          onQuedarse={() => {
            salida(false);
            setSalida(null);
          }}
          onSalir={() => {
            salida(true);
            setSalida(null);
          }}
        />
      )}
    </>
  );
}
