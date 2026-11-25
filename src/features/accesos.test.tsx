import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { reset, route } from "../mocks/handlers";
import { ADMIN_DEMO_ID, CLAVE_SESION } from "../mocks/accesos";
import App from "../app/App";

// Modo demostración: la API la responde el simulador (sesión, solicitudes y avisos).
vi.mock("../lib/modo", () => ({ MODO_DEMO: true }));
vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="grafica" />,
  Bar: () => <div data-testid="grafica" />,
}));

const EXTERNA = "ana.externa@gmail.com";
async function api(path: string, method = "GET", body?: unknown) {
  const r = await route(
    new Request("http://localhost/api" + path, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    }),
  );
  return { status: r.status, data: await r.json() };
}
function montarApp(ruta = "/login") {
  window.history.pushState({}, "", ruta);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}
async function conGoogle(correo: string, nombre = "") {
  fireEvent.click(
    await screen.findByRole("button", { name: "Continuar con Google" }),
  );
  if (correo === "admin") {
    fireEvent.click(
      screen.getByRole("button", { name: /Administrador NEXUS · / }),
    );
    return;
  }
  fireEvent.change(screen.getByLabelText(/Otra cuenta de Google/), {
    target: { value: correo },
  });
  fireEvent.change(screen.getByLabelText(/Nombre en Google/), {
    target: { value: nombre },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Continuar con esta cuenta" }),
  );
}
async function salir() {
  fireEvent.click(await screen.findByRole("button", { name: "Cerrar sesión" }));
  await screen.findByRole("button", { name: "Continuar con Google" });
}
beforeEach(() => {
  sessionStorage.clear();
  reset();
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) =>
    route(new Request(new URL(String(input), location.href), init)),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  window.history.pushState({}, "", "/");
});

describe("Solicitar acceso con Google (demostración)", () => {
  it("solicitud, aviso único al administrador, aprobación e ingreso como Usuario", async () => {
    montarApp();
    await conGoogle(EXTERNA, "Ana Externa");
    expect(
      await screen.findByText(
        "Tu solicitud fue enviada. Podrás entrar cuando un administrador la apruebe.",
      ),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(CLAVE_SESION)).toBeNull();
    // Intento repetido: muestra el estado actual sin crear otra solicitud ni otro aviso.
    await conGoogle(EXTERNA, "Ana Externa");
    expect(
      await screen.findByText(/Tu solicitud sigue pendiente/),
    ).toBeInTheDocument();

    await conGoogle("admin");
    const menu = await screen.findByRole("navigation");
    const enlace = within(menu).getByRole("link", {
      name: /Solicitudes de acceso/,
    });
    // La de ejemplo + la de Ana.
    await waitFor(() => expect(enlace).toHaveTextContent(/acceso2$/));
    const campana = await screen.findByRole("button", {
      name: "Notificaciones (2 sin leer)",
    });
    fireEvent.click(campana);
    const bandeja = screen.getByRole("dialog", { name: "Notificaciones" });
    const avisosAna = within(bandeja).getAllByText(/ana\.externa@gmail\.com/);
    expect(avisosAna).toHaveLength(1);
    const item = avisosAna[0].closest("li")!;
    fireEvent.click(within(item).getByRole("button", { name: "Ver" }));
    expect(
      await screen.findByRole("heading", { name: "Solicitudes de acceso" }),
    ).toBeInTheDocument();
    const pendientes = await screen.findByRole("table", {
      name: "Solicitudes pendientes",
    });
    const fila = within(pendientes).getByText(EXTERNA).closest("tr")!;
    expect(fila).toHaveAttribute("aria-current", "true");
    expect(fila).toHaveTextContent("Intentó entrar 2 veces");
    fireEvent.click(
      within(fila).getByRole("button", { name: `Aprobar a ${EXTERNA}` }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    expect(
      await screen.findByText(
        `Solicitud aprobada: ${EXTERNA} ya puede entrar como Usuario.`,
      ),
    ).toBeInTheDocument();
    const historial = await screen.findByRole("table", {
      name: "Historial de decisiones",
    });
    expect(
      within(historial).getByText(EXTERNA).closest("tr"),
    ).toHaveTextContent(/AprobadaAdministrador NEXUS/);
    await salir();

    await conGoogle(EXTERNA, "Ana Externa");
    expect(await screen.findByText("Ana Externa")).toBeInTheDocument();
    expect(screen.getByText("Usuario")).toBeInTheDocument();
    // Todo el menú del administrador, salvo «Solicitudes de acceso».
    const nav = screen.getByRole("navigation");
    expect(
      within(nav).getByRole("link", { name: /Contactos/ }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("link", { name: /Configuración/ }),
    ).toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: /Solicitudes de acceso/ }),
    ).toBeNull();
    expect(screen.getByLabelText("Búsqueda global")).toBeInTheDocument();
    expect(
      await screen.findByText("Tu atención hace la diferencia"),
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Notificaciones (1 sin leer)",
      }),
    );
    expect(screen.getByText("Tu acceso fue aprobado")).toBeInTheDocument();
  });

  it("rechazo: la persona ve el estado al volver a identificarse", async () => {
    montarApp();
    await conGoogle(EXTERNA);
    await screen.findByText(/Tu solicitud fue enviada/);
    sessionStorage.setItem(CLAVE_SESION, ADMIN_DEMO_ID);
    const lista = await api("/solicitudes-acceso");
    const id = lista.data.find((s: { correo: string }) => s.correo === EXTERNA)
      .id as string;
    expect(
      (await api(`/solicitudes-acceso/${id}/rechazar`, "POST", {})).status,
    ).toBe(200);
    sessionStorage.clear();
    await conGoogle(EXTERNA);
    expect(
      await screen.findByText("Tu solicitud de acceso fue rechazada."),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem(CLAVE_SESION)).toBeNull();
  });

  it("dos decisiones simultáneas: se conserva la primera y el segundo ve el estado final", async () => {
    sessionStorage.setItem(CLAVE_SESION, ADMIN_DEMO_ID);
    montarApp("/solicitudes-acceso");
    const pendientes = await screen.findByRole("table", {
      name: "Solicitudes pendientes",
    });
    const fila = within(pendientes)
      .getByText("laura.gomez@ejemplo.com")
      .closest("tr")!;
    // Otro administrador la rechaza mientras esta pantalla sigue abierta.
    const lista = await api("/solicitudes-acceso");
    const id = lista.data[0].id as string;
    expect(
      (await api(`/solicitudes-acceso/${id}/rechazar`, "POST", {})).status,
    ).toBe(200);
    fireEvent.click(
      within(fila).getByRole("button", { name: /Aprobar a laura/ }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    expect(
      await screen.findByText(/ya fue rechazada por Administrador NEXUS/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No hay solicitudes pendientes."),
    ).toBeInTheDocument();
    const final = await api("/solicitudes-acceso");
    expect(final.data[0].estado).toBe("rechazada");
  });

  it("la lectura de avisos se conserva al cerrar sesión", async () => {
    sessionStorage.setItem(CLAVE_SESION, ADMIN_DEMO_ID);
    montarApp("/");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Notificaciones (1 sin leer)",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Marcar como leída: Nueva solicitud de acceso",
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Notificaciones" }),
    ).toBeInTheDocument();
    await salir();
    await conGoogle("admin");
    expect(
      await screen.findByRole("button", { name: "Notificaciones" }),
    ).toBeInTheDocument();
    expect((await api("/notificaciones")).data.sinLeer).toBe(0);
  });
});

describe("Usuario aprobado: todo menos gestionar accesos (demostración)", () => {
  async function usuarioAprobado() {
    sessionStorage.clear();
    await api("/auth/demo/identificar", "POST", {
      correo: EXTERNA,
      nombre: "Ana",
    });
    sessionStorage.setItem(CLAVE_SESION, ADMIN_DEMO_ID);
    const avisoAdmin = (await api("/notificaciones")).data.items[0]
      .id as string;
    const id = (await api("/solicitudes-acceso")).data.find(
      (s: { correo: string }) => s.correo === EXTERNA,
    ).id as string;
    await api(`/solicitudes-acceso/${id}/aprobar`, "POST", {});
    sessionStorage.clear();
    await api("/auth/demo/identificar", "POST", {
      correo: EXTERNA,
      nombre: "",
    });
    return { avisoAdmin };
  }

  it("opera como administrador pero no aprueba solicitudes ni lee avisos ajenos", async () => {
    const { avisoAdmin } = await usuarioAprobado();
    expect((await api("/auth/session")).data.cuenta.rol).toBe("usuario");
    const otra = await api("/solicitudes-acceso");
    expect(otra.status).toBe(403);
    expect(otra.data.message).toBe(
      "Su cuenta no tiene permiso para esta acción",
    );
    expect((await api("/contactos")).status).toBe(200);
    expect((await api("/configuracion/marca")).status).toBe(200);
    expect((await api("/campanas/cam1/pausar", "POST", {})).status).not.toBe(
      403,
    );
    expect((await api("/panel/resumen")).status).toBe(200);
    expect(
      (await api(`/notificaciones/${avisoAdmin}/leer`, "POST", {})).status,
    ).toBe(404);
    sessionStorage.setItem(CLAVE_SESION, ADMIN_DEMO_ID);
    const propia = (await api("/notificaciones")).data.items.find(
      (a: { id: string }) => a.id === avisoAdmin,
    );
    expect(propia.leida).toBe(false);
  });

  it("Solicitudes de acceso muestra «Sin permiso», no el inicio de sesión", async () => {
    await usuarioAprobado();
    montarApp("/solicitudes-acceso");
    expect(
      await screen.findByText("Sin permiso para esta sección"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continuar con Google" }),
    ).toBeNull();
  });
});
