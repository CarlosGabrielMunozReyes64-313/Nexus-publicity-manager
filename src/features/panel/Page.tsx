import type { z } from "zod";
import { MODO_DEMO } from "../../lib/modo";
import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, Inbox, Copy, ShieldCheck } from "lucide-react";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import {
  Card,
  KpiTile,
  FunnelChart,
  Badge,
  QueryState,
} from "../../components/ui";
import { Intro, Resource } from "../shared";
import { fechaHora } from "../../lib/formato";
import { useSesion } from "../../api/sesion";
export default function Page() {
  const { sesion } = useSesion();
  return sesion?.cuenta.rol === "usuario" ? <PanelUsuario /> : <PanelAdmin />;
}
function Indicadores({ data }: { data: z.infer<typeof S.resumenSchema> }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
        gap: 16,
        marginBottom: 24,
      }}
    >
      <KpiTile
        label="Contactos contactables"
        value={data.contactables}
        hint="Con base legal y correo válido"
      />
      <KpiTile
        label="Campañas activas"
        value={data.activas}
        hint="Aprobadas por un administrador"
      />
      <KpiTile
        label="Respuestas por atender"
        value={data.pendientes}
        hint="Conversaciones abiertas"
      />
      <KpiTile
        label="Diagnósticos del mes"
        value={data.diagnosticos}
        hint="RSE Express"
      />
      <KpiTile
        label="Reuniones del mes"
        value={data.reuniones}
        hint="El siguiente paso"
      />
    </div>
  );
}
/** Rol «Usuario»: solo indicadores agregados y el embudo; sin acciones ni datos personales. */
function PanelUsuario() {
  const q = useResource("/panel/resumen", S.resumenSchema);
  return (
    <>
      <Intro
        title="Cada conexión cuenta."
        description="Consulta cómo avanza la gestión de relaciones de NEXUS. Las acciones las realiza un administrador."
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {q.data && <Indicadores data={q.data} />}
      </QueryState>
      <Card title="El recorrido de los contactos">
        <Resource path="/embudo" schema={S.embudoSchema}>
          {(items) => <FunnelChart items={items} />}
        </Resource>
      </Card>
    </>
  );
}
function PanelAdmin() {
  const q = useResource("/panel/resumen", S.resumenSchema);
  const secuencias = useResource("/secuencias", S.secuenciaSchema.array());
  const dup = useResource("/duplicados", S.duplicadoSchema.array());
  return (
    <>
      <Intro
        title="Cada conexión cuenta."
        description="Tu espacio para construir relaciones que impulsan un Valle más sostenible."
        action={
          <Link to="/descubrimiento" className="row">
            Descubrir empresas <ArrowUpRight size={18} />
          </Link>
        }
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {q.data && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <KpiTile
              label="Contactos contactables"
              value={q.data.contactables}
              hint="Con base legal y correo válido"
            />
            <KpiTile
              label="Campañas activas"
              value={q.data.activas}
              hint="Aprobadas por ti"
            />
            <KpiTile
              label="Respuestas por atender"
              value={q.data.pendientes}
              hint="Conversaciones abiertas"
            />
            <KpiTile
              label="Diagnósticos del mes"
              value={q.data.diagnosticos}
              hint="RSE Express"
            />
            <KpiTile
              label="Reuniones del mes"
              value={q.data.reuniones}
              hint="El siguiente paso"
            />
          </div>
        )}
      </QueryState>
      <div className="grid">
        <Card title="Tu atención hace la diferencia">
          <p className="muted">Tareas de hoy</p>
          {[
            {
              icon: Mail,
              title: "Secuencias por aprobar",
              count: secuencias.data?.filter(
                (s) =>
                  s.estadoEditor === "borrador" ||
                  s.estadoEditor === "cambios_sin_aprobar",
              ).length,
              path: "/secuencias",
              desc: "Borradores y cambios que esperan tu aprobación.",
            },
            {
              icon: Inbox,
              title: "Conversaciones por continuar",
              count: q.data?.pendientes,
              path: "/respuestas",
              desc: "Una respuesta oportuna abre puertas.",
            },
            {
              icon: Copy,
              title: "Duplicados por revisar",
              count: dup.data?.length,
              path: "/empresas",
              desc: "Mantén una base de datos confiable.",
            },
          ].map(({ icon: Icon, ...t }) => (
            <Link
              key={t.path}
              to={t.path}
              style={{
                display: "flex",
                gap: 16,
                padding: "19px 0",
                borderBottom: "1px solid #e3ebe6",
                alignItems: "center",
              }}
            >
              <Icon size={23} />
              <span style={{ flex: 1 }}>
                <strong>{t.title}</strong>
                <br />
                <small>{t.desc}</small>
              </span>
              <Badge>{t.count ?? "…"}</Badge>
              <ArrowUpRight size={16} />
            </Link>
          ))}
          <Resource path="/integraciones" schema={S.integracionSchema.array()}>
            {(items) =>
              items.find((i) => i.id === "gmail")?.estado !== "conectada" ? (
                <p className="notice warning">
                  Gmail desconectado.{" "}
                  <Link to="/configuracion">Revisar integración</Link>
                </p>
              ) : (
                <p className="row muted" style={{ marginTop: 22 }}>
                  <ShieldCheck size={17} />
                  {MODO_DEMO
                    ? "Gmail listo · entorno de demostración"
                    : "Gmail conectado · los envíos salen solo de campañas activas y aprobadas"}
                </p>
              )
            }
          </Resource>
          <Resource path="/campanas" schema={S.campanaSchema.array()}>
            {(items) => (
              <>
                {items
                  .filter(
                    (c) =>
                      c.estado === "pausada" ||
                      (c.metricas.enviados > 0 &&
                        c.metricas.rebotes / c.metricas.enviados > 0.05),
                  )
                  .map((c) => (
                    <p className="notice warning" key={c.id}>
                      Revisar campaña:{" "}
                      <Link to={`/campanas/${c.id}`}>{c.nombre}</Link>
                      {c.motivoPausa && (
                        <>
                          <br />
                          <small>{c.motivoPausa}</small>
                        </>
                      )}
                    </p>
                  ))}
              </>
            )}
          </Resource>
        </Card>
        <Card title="El recorrido de tus contactos">
          <div className="row">
            <Badge>Marketing</Badge>
            <Badge>Comercial</Badge>
          </div>
          <Resource path="/embudo" schema={S.embudoSchema}>
            {(items) => <FunnelChart items={items} />}
          </Resource>
        </Card>
        <Card title="Actividad reciente de los agentes">
          <Resource
            path="/auditoria/pagina?actor=agente&tamano=5"
            schema={S.paginaAuditoriaSchema}
          >
            {({ items }) => (
              <div className="timeline">
                {items
                  .filter((a) => a.actor.startsWith("agente"))
                  .map((a) => (
                    <article key={a.id}>
                      <strong>{a.actor.replace("agente:", "")}</strong>
                      <p>{a.accion.replaceAll("_", " ")}</p>
                      <small>
                        {fechaHora(a.fecha)} · {a.entidad} {a.entidadId}
                      </small>
                    </article>
                  ))}
              </div>
            )}
          </Resource>
          <Link to="/auditoria">Ver registro completo →</Link>
        </Card>
        <Card title="Una campaña con propósito">
          <div className="eyebrow">RSE Express / Puerta de entrada</div>
          <h2>Ayudar a las MiPymes a dar su siguiente paso.</h2>
          <p className="muted">
            Un diagnóstico gratuito para identificar prácticas laborales,
            ambientales y éticas, y construir evidencia útil.
          </p>
          <Resource path="/campanas" schema={S.campanaSchema.array()}>
            {(items) => (
              <>
                {items.slice(0, 2).map((c) => (
                  <div
                    key={c.id}
                    style={{
                      borderTop: "1px solid #e3ebe6",
                      padding: "16px 0",
                    }}
                  >
                    <Badge>{c.estado}</Badge>
                    <p>
                      <Link to={`/campanas/${c.id}`}>{c.nombre}</Link>
                    </p>
                    <small>
                      {c.metricas.respuestas} respuestas ·{" "}
                      {c.metricas.diagnosticos} diagnósticos
                    </small>
                  </div>
                ))}
              </>
            )}
          </Resource>
        </Card>
      </div>
    </>
  );
}
