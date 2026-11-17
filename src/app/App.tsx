import { lazy, Suspense, useState } from "react";
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
  Sparkles,
  Mail,
  Send,
  Inbox,
  GitBranch,
  BarChart3,
  Settings,
  History,
  Search,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useResource } from "../api/hooks";
import * as S from "../api/schemas";
import { API_URL } from "../api/client";
import { Button, Skeleton, FeedbackProvider } from "../components/ui";
import styles from "./Layout.module.css";
const pages = {
  panel: lazy(() => import("../features/panel/Page")),
  contactos: lazy(() => import("../features/contactos/Page")),
  empresas: lazy(() => import("../features/empresas/Page")),
  descubrimiento: lazy(() => import("../features/descubrimiento/Page")),
  segmentos: lazy(() => import("../features/segmentos/Page")),
  propuestas: lazy(() => import("../features/propuestas/Page")),
  secuencias: lazy(() => import("../features/secuencias/Page")),
  campanas: lazy(() => import("../features/campanas/Page")),
  respuestas: lazy(() => import("../features/respuestas/Page")),
  embudo: lazy(() => import("../features/embudo/Page")),
  informes: lazy(() => import("../features/informes/Page")),
  configuracion: lazy(() => import("../features/configuracion/Page")),
  auditoria: lazy(() => import("../features/auditoria/Page")),
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
      ["propuestas", "Propuestas", Sparkles],
      ["secuencias", "Secuencias", Mail],
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
    ],
  },
];
const mock = import.meta.env.VITE_USE_MOCKS === "true";
function Login() {
  const navigate = useNavigate();
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
            if (mock) {
              sessionStorage.setItem("nexus-session", "demo");
              navigate("/");
            } else window.location.assign(`${API_URL}/auth/google`);
          }}
        >
          Iniciar sesión con Google
        </Button>
        <p>
          <small>
            {mock
              ? "Modo demostración · Un único administrador · Sin envíos reales"
              : "Acceso reservado al administrador autorizado"}
          </small>
        </p>
      </div>
    </div>
  );
}
function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const contactos = useResource("/contactos", S.contactoSchema.array());
  const empresas = useResource("/empresas", S.empresaSchema.array());
  const propuestas = useResource("/propuestas", S.propuestaSchema.array());
  const respuestas = useResource("/respuestas", S.respuestaSchema.array());
  const integraciones = useResource(
    "/integraciones",
    S.integracionSchema.array(),
  );
  const resumen = useResource("/panel/resumen", S.resumenSchema);
  const limites = useResource("/configuracion/limites", S.limitesSchema);
  const title =
    nav
      .flatMap((g) => g.items)
      .find((i) => i[0] === location.pathname.split("/")[1])?.[1] ??
    "Panel general";
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
          {nav.map((g) => (
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
                  {path === "propuestas" && (
                    <span className={styles.count}>
                      {propuestas.data?.filter((p) => p.estado === "pendiente")
                        .length ?? "—"}
                    </span>
                  )}
                  {path === "respuestas" && (
                    <span className={styles.count}>
                      {respuestas.data?.filter((p) => p.estado === "pendiente")
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
          <div className={styles.admin}>
            <span>
              Cupo del día{" "}
              <strong>
                {resumen.data?.enviadosHoy ?? "—"} de{" "}
                {limites.data?.topeDiarioNuevos ?? "—"}
              </strong>
            </span>
            <span>
              ● Gmail{" "}
              {integraciones.data?.find((i) => i.id === "gmail")?.estado ?? "…"}
            </span>
            <span className={styles.avatar}>AD</span>
            <span>Administrador</span>
            <Button
              aria-label="Cerrar sesión"
              onClick={() => {
                sessionStorage.removeItem("nexus-session");
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
function Protected() {
  const session = useResource("/auth/session", S.okSchema, !mock);
  if (mock)
    return sessionStorage.getItem("nexus-session") ? (
      <Layout />
    ) : (
      <Navigate to="/login" replace />
    );
  if (session.isPending) return <Skeleton />;
  return session.data ? <Layout /> : <Navigate to="/login" replace />;
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
                element={<Page />}
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </FeedbackProvider>
    </BrowserRouter>
  );
}
