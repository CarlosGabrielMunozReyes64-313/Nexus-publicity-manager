import { z } from "zod";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  Compass,
  Layers,
  Mail,
  Send,
  Inbox,
  GitBranch,
  BarChart3,
  Settings,
  History,
  SquareTerminal,
  Search,
  LogOut,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useResource } from "../api/hooks";
import * as S from "../api/schemas";
import { API_URL, esSesionVencida, request } from "../api/client";
import { SesionContext, useSesion } from "../api/sesion";
import { useSolicitudesAcceso } from "../api/accesos";
import { CampanaNotificaciones } from "./Notificaciones";
import { Button, Card, Skeleton, FeedbackProvider } from "../components/ui";
import { MODO_DEMO } from "../lib/modo";
import styles from "./Layout.module.css";
const pages = {
  panel: lazy(() => import("../features/panel/Page")),
  contactos: lazy(() => import("../features/contactos/Page")),
  empresas: lazy(() => import("../features/empresas/Page")),
  descubrimiento: lazy(() => import("../features/descubrimiento/Page")),
  segmentos: lazy(() => import("../features/segmentos/Page")),
  secuencias: lazy(() => import("../features/secuencias/Page")),
  campanas: lazy(() => import("../features/campanas/Page")),
  respuestas: lazy(() => import("../features/respuestas/Page")),
  embudo: lazy(() => import("../features/embudo/Page")),
  informes: lazy(() => import("../features/informes/Page")),
  configuracion: lazy(() => import("../features/configuracion/Page")),
  auditoria: lazy(() => import("../features/auditoria/Page")),
  terminal: lazy(() => import("../features/terminal/Page")),
  "solicitudes-acceso": lazy(
    () => import("../features/solicitudes-acceso/Page"),
  ),
};
const nav: {
  group: string;
  items: [string, string, typeof LayoutDashboard][];
}[] = [
  { group: "Inicio", items: [["", "Panel general", LayoutDashboard]] },
  {
    group: "Captación",
    items: [
      ["contactos", "Contactos", Users],
      ["empresas", "Empresas", Building2],
      ["descubrimiento", "Descubrimiento", Compass],
      ["segmentos", "Segmentos", Layers],
    ],
  },
  {
    group: "Campañas",
    items: [
      ["secuencias", "Secuencias de correo", Mail],
      ["campanas", "Campañas activas", Send],
    ],
  },
  {
    group: "Seguimiento",
    items: [
      ["respuestas", "Respuestas", Inbox],
      ["embudo", "Embudo comercial", GitBranch],
      ["informes", "Informes", BarChart3],
    ],
  },
  {
    group: "Sistema",
    items: [
      ["configuracion", "Configuración", Settings],
      ["auditoria", "Registro de acciones", History],
      ["terminal", "Terminal", SquareTerminal],
      ["solicitudes-acceso", "Solicitudes de acceso", UserCheck],
    ],
  },
];
const mock = MODO_DEMO;
const AVISOS_LOGIN: Record<string, { texto: string; tono: string }> = {
  "solicitud=enviada": {
    texto:
      "Tu solicitud fue enviada. Podrás entrar cuando un administrador la apruebe.",
    tono: "success",
  },
  "solicitud=pendiente": {
    texto:
      "Tu solicitud sigue pendiente. Podrás entrar cuando un administrador la apruebe.",
    tono: "warning",
  },
  "solicitud=rechazada": {
    texto: "Tu solicitud de acceso fue rechazada.",
    tono: "danger",
  },
  "error=acceso_denegado": {
    texto:
      "No se pudo iniciar sesión con esa cuenta: Google no la verificó o la cuenta está desactivada.",
    tono: "danger",
  },
  "error=cancelado": {
    texto: "Cancelaste el inicio de sesión con Google.",
    tono: "warning",
  },
  "sesion=vencida": {
    texto:
      "Tu sesión venció. Vuelve a identificarte con Google para continuar.",
    tono: "warning",
  },
};
const RESULTADO_DEMO = z.object({
  resultado: z.enum([
    "sesion",
    "enviada",
    "pendiente",
    "rechazada",
    "acceso_denegado",
  ]),
});
/** Modo demostración: simula el selector de cuentas de Google. */
function CuentasDemo({ onListo }: { onListo: (destino: string) => void }) {
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const entrar = async (c: string, n: string) => {
    setError("");
    try {
      const { resultado } = await request(
        "/auth/demo/identificar",
        RESULTADO_DEMO,
        "POST",
        { correo: c, nombre: n },
      );
      onListo(
        resultado === "sesion"
          ? "/"
          : resultado === "acceso_denegado"
            ? "/login?error=acceso_denegado"
            : `/login?solicitud=${resultado}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo continuar");
    }
  };
  return (
    <div
      className={styles.demoCuentas}
      aria-label="Cuentas de Google (simuladas)"
    >
      <small className="muted">Elija una cuenta de Google (simulada):</small>
      <Button onClick={() => void entrar("admin@nexus.example", "")}>
        Administrador NEXUS · admin@nexus.example
      </Button>
      <form
        className={styles.demoCuentas}
        onSubmit={(e) => {
          e.preventDefault();
          void entrar(correo, nombre);
        }}
      >
        <label>
          Otra cuenta de Google · correo verificado
          <input
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="persona@gmail.com"
          />
        </label>
        <label>
          Nombre en Google (opcional)
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <Button type="submit">Continuar con esta cuenta</Button>
      </form>
      {error && (
        <p role="alert" className="notice danger">
          {error}
        </p>
      )}
    </div>
  );
}
function Login() {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [elegir, setElegir] = useState(false);
  const params = new URLSearchParams(useLocation().search);
  const aviso = (
    [
      ["solicitud", params.get("solicitud")],
      ["error", params.get("error")],
      ["sesion", params.get("sesion")],
    ] as const
  )
    .filter(([, v]) => v)
    .map(([k, v]) => AVISOS_LOGIN[`${k}=${v}`] ?? null)[0];
  const error = params.get("error");
  return (
    <div className={styles.login}>
      <div className={styles.loginBox}>
        <div className="eyebrow">NEXUS Innovación</div>
        <h1>Las buenas relaciones empiezan aquí.</h1>
        <p className="muted">
          Gestión de contactos, campañas y oportunidades para un desarrollo más
          sostenible.
        </p>
        <Button
          variant="primary"
          onClick={() => {
            if (mock) setElegir(true);
            else window.location.assign(`${API_URL}/auth/google`);
          }}
        >
          Continuar con Google
        </Button>
        {mock && elegir && (
          <CuentasDemo
            onListo={(destino) => {
              cache.clear();
              setElegir(false);
              navigate(destino);
            }}
          />
        )}
        {aviso ? (
          <p
            role={aviso.tono === "success" ? "status" : "alert"}
            className={`notice ${aviso.tono}`}
          >
            {aviso.texto}
          </p>
        ) : (
          error && (
            <p role="alert" className="notice danger">
              No se pudo iniciar sesión. Intente de nuevo.
            </p>
          )
        )}
        <p>
          <small>
            {mock
              ? "Modo demostración · Cuentas de Google simuladas · Sin envíos reales"
              : "Cualquier cuenta de Google con correo verificado puede solicitar acceso; un administrador la aprueba."}
          </small>
        </p>
      </div>
    </div>
  );
}
function iniciales(nombre: string) {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}
function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const { sesion, puede, veo } = useSesion();
  // Datos de gestión de la cabecera: administradores y usuarios aprobados.
  const esAdmin = puede("datos:ver");
  const [q, setQ] = useState("");
  // Solo el administrador carga los datos de gestión que usa la cabecera.
  const contactos = useResource(
    "/contactos",
    S.contactoSchema.array(),
    esAdmin,
  );
  const empresas = useResource("/empresas", S.empresaSchema.array(), esAdmin);
  const secuencias = useResource(
    "/secuencias",
    S.secuenciaSchema.array(),
    esAdmin,
  );
  const respuestas = useResource(
    "/respuestas",
    S.respuestaSchema.array(),
    esAdmin,
  );
  const integraciones = useResource(
    "/integraciones",
    S.integracionSchema.array(),
    esAdmin,
  );
  const resumen = useResource("/panel/resumen", S.resumenSchema, esAdmin);
  const limites = useResource(
    "/configuracion/limites",
    S.limitesSchema,
    esAdmin,
  );
  const solicitudes = useSolicitudesAcceso(veo("solicitudes-acceso"));
  const menu = nav
    .map((g) => ({ ...g, items: g.items.filter(([path]) => veo(path)) }))
    .filter((g) => g.items.length);
  const title =
    nav
      .flatMap((g) => g.items)
      .find((i) => i[0] === location.pathname.split("/")[1])?.[1] ??
    "Panel general";
  const cuenta = sesion!.cuenta;
  return (
    <div className={styles.shell}>
      <a href="#contenido" className="skip">
        Saltar al contenido
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          NEXUS<span style={{ color: "#55d99c" }}>.</span>
        </div>
        <div className={styles.sub}>Publicity manager</div>
        <nav>
          {menu.map((g) => (
            <div key={g.group}>
              <div className={styles.group}>{g.group}</div>
              {g.items.map(([path, label, Icon]) => (
                <NavLink
                  key={path}
                  to={`/${path}`}
                  end={path === ""}
                  className={({ isActive }) =>
                    `${styles.link} ${isActive ? styles.active : ""}`
                  }
                >
                  <Icon size={16} />
                  {label}
                  {path === "secuencias" && (
                    <span
                      className={styles.count}
                      title="Secuencias por aprobar"
                    >
                      {secuencias.data?.filter(
                        (s) =>
                          s.estadoEditor === "borrador" ||
                          s.estadoEditor === "cambios_sin_aprobar",
                      ).length ?? "—"}
                    </span>
                  )}
                  {path === "respuestas" && (
                    <span className={styles.count}>
                      {respuestas.data?.filter((p) => p.estado === "pendiente")
                        .length ?? "—"}
                    </span>
                  )}
                  {path === "solicitudes-acceso" && (
                    <span
                      className={styles.count}
                      title="Solicitudes pendientes"
                    >
                      {solicitudes.data?.filter((s) => s.estado === "pendiente")
                        .length ?? "—"}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className={styles.bottom}>
          <ShieldCheck size={20} />
          <p>
            La IA propone.
            <br />
            Tú decides.
          </p>
          <small style={{ color: "#a5cabc" }}>
            Candelaria · Valle del Cauca
          </small>
        </div>
      </aside>
      <div>
        <header className={styles.topbar}>
          {esAdmin ? (
            <div className={styles.search}>
              <Search size={15} />
              <input
                aria-label="Búsqueda global"
                placeholder="Buscar contactos o empresas…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <div className={styles.results}>
                  {[
                    ...(contactos.data ?? [])
                      .filter((c) =>
                        c.nombre.toLowerCase().includes(q.toLowerCase()),
                      )
                      .map((c) => ({
                        id: c.id,
                        name: c.nombre,
                        path: "/contactos/",
                      })),
                    ...(empresas.data ?? [])
                      .filter((e) =>
                        e.razonSocial.toLowerCase().includes(q.toLowerCase()),
                      )
                      .map((e) => ({
                        id: e.id,
                        name: e.razonSocial,
                        path: "/empresas/",
                      })),
                  ]
                    .slice(0, 10)
                    .map((x) => (
                      <Link
                        key={x.id}
                        to={x.path + x.id}
                        onClick={() => setQ("")}
                      >
                        {x.name}
                      </Link>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div />
          )}
          <div className={styles.admin}>
            {esAdmin && (
              <>
                <span>
                  Cupo del día{" "}
                  <strong>
                    {resumen.data?.enviadosHoy ?? "—"} de{" "}
                    {limites.data?.topeDiarioNuevos ?? "—"}
                  </strong>
                </span>
                <span>
                  ● Gmail{" "}
                  {integraciones.data?.find((i) => i.id === "gmail")?.estado ??
                    "…"}
                </span>
              </>
            )}
            <CampanaNotificaciones />
            <span className={styles.avatar} aria-hidden>
              {iniciales(cuenta.nombre)}
            </span>
            <span>
              <strong>{cuenta.nombre}</strong>
              <br />
              <span className={styles.rol} title={cuenta.correo}>
                {cuenta.rolEtiqueta}
              </span>
            </span>
            <Button
              aria-label="Cerrar sesión"
              onClick={() => {
                sessionStorage.removeItem("nexus-session");
                cache.clear();
                if (!mock) window.location.assign(`${API_URL}/auth/logout`);
                else navigate("/login");
              }}
            >
              <LogOut size={14} />
            </Button>
          </div>
        </header>
        <div className={styles.banner}>
          <span>
            ✓ Cada envío requiere aprobación · Evidencia en cada dato · Bajas
            inmediatas
          </span>
          <strong>{mock ? "ENTORNO SIMULADO" : "API REAL"}</strong>
        </div>
        <main className={styles.main} id="contenido">
          <div className={styles.breadcrumb}>
            ESPACIO DE TRABAJO / {title.toUpperCase()}
          </div>
          <Suspense fallback={<Skeleton />}>
            <Outlet />
          </Suspense>
          <footer className={styles.footer}>
            <span>NEXUS Innovación · Sostenibilidad con propósito</span>
            <span>
              America/Bogota · {mock ? "Datos ficticios" : "Conectado a API"}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
/** Sesión válida sin permiso para esta pantalla (distinto de una sesión vencida). */
function SinPermiso() {
  return (
    <Card title="Sin permiso para esta sección">
      <p role="alert">
        Tu cuenta no tiene permiso para ver esta pantalla. Si lo necesitas,
        pídeselo a un administrador.
      </p>
      <Link to="/">Volver al panel general</Link>
    </Card>
  );
}
function Permitido({ ruta, children }: { ruta: string; children: ReactNode }) {
  const { veo } = useSesion();
  return veo(ruta) ? <>{children}</> : <SinPermiso />;
}
function SinConexion({
  error,
  retry,
  busy,
}: {
  error: Error | null;
  retry: () => void;
  busy: boolean;
}) {
  return (
    <div className={styles.login}>
      <div className={styles.loginBox}>
        <Card title="No pudimos comprobar su sesión">
          <p role="alert">
            {error?.message ??
              "El servidor no respondió. Su sesión puede seguir activa."}
          </p>
          <p className="muted">
            Esto no significa que la sesión haya vencido: puede ser un problema
            de red o del servidor. Reintente en unos momentos.
          </p>
          <Button variant="primary" onClick={retry} disabled={busy}>
            {busy ? "Reintentando…" : "Reintentar"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
function Protected() {
  // También en la demostración: la sesión la responde el simulador (MSW).
  const session = useResource("/auth/session", S.sesionSchema);
  if (session.isPending) return <Skeleton />;
  // Solo un error de autenticación lleva al inicio de sesión. Si había una sesión
  // válida en esta pestaña, se avisa que venció.
  if (esSesionVencida(session.error))
    return (
      <Navigate
        to={session.data ? "/login?sesion=vencida" : "/login"}
        replace
      />
    );
  if (session.data)
    return (
      <SesionContext.Provider value={session.data}>
        <Layout />
      </SesionContext.Provider>
    );
  return (
    <SinConexion
      error={session.error}
      busy={session.isFetching}
      retry={() => void session.refetch()}
    />
  );
}
/** /propuestas/:id → el editor de su secuencia (si era de una campaña) o la lista. */
export function RedirigirPropuesta() {
  const id = useLocation().pathname.split("/")[2];
  const propuesta = useResource(
    `/propuestas/${id ?? ""}`,
    S.propuestaSchema,
    Boolean(id),
  );
  const campanas = useResource(
    "/campanas",
    S.campanaSchema.array(),
    propuesta.data?.tipo === "campana",
  );
  if (!id || propuesta.error) return <Navigate to="/secuencias" replace />;
  if (!propuesta.data) return <Skeleton />;
  if (propuesta.data.tipo !== "campana")
    return <Navigate to="/secuencias" replace />;
  if (campanas.error) return <Navigate to="/secuencias" replace />;
  if (!campanas.data) return <Skeleton />;
  const cam = campanas.data.find((c) => c.id === propuesta.data.objetivoId);
  return (
    <Navigate
      to={cam ? `/secuencias/${cam.secuenciaId}` : "/secuencias"}
      replace
    />
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<Protected />}>
            {Object.entries(pages).map(([key, Page]) => (
              <Route
                key={key}
                path={key === "panel" ? "/" : `${key}/*`}
                element={
                  <Permitido ruta={key === "panel" ? "/" : `/${key}`}>
                    <Page />
                  </Permitido>
                }
              />
            ))}
            {/* Propuestas ya no existe: sus enlaces llevan a Secuencias de correo. */}
            <Route
              path="propuestas"
              element={
                <Permitido ruta="/secuencias">
                  <RedirigirPropuesta />
                </Permitido>
              }
            />
            <Route
              path="propuestas/:id"
              element={
                <Permitido ruta="/secuencias">
                  <RedirigirPropuesta />
                </Permitido>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </FeedbackProvider>
    </BrowserRouter>
  );
}
