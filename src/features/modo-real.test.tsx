import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FeedbackProvider } from "../components/ui";
import { db, reset, route } from "../mocks/handlers";
import App from "../app/App";
import Configuracion from "./configuracion/Page";
import Campanas from "./campanas/Page";
// Estas pruebas simulan la API real: los textos deben describir efectos reales.
vi.mock("../lib/modo", () => ({ MODO_DEMO: false }));
function montar(children: ReactNode, path = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <FeedbackProvider>{children}</FeedbackProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function conSesion(respuesta: () => Response) {
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).endsWith("/auth/session")
        ? respuesta()
        : route(new Request(new URL(String(input), location.href), init)),
  );
}
beforeEach(() => {
  reset();
  conSesion(() => Response.json({ ok: true }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});
function montarApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>,
  );
}
describe("Sesión (19)", () => {
  it("una caída del servidor muestra el error y permite reintentar", async () => {
    conSesion(() =>
      Response.json(
        { message: "La base de datos no está disponible" },
        {
          status: 503,
        },
      ),
    );
    montarApp();
    expect(
      await screen.findByText("No pudimos comprobar su sesión"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "La base de datos no está disponible",
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Iniciar sesión con Google" }),
    ).not.toBeInTheDocument();
    conSesion(() => Response.json({ ok: true }));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Publicity manager")).toBeInTheDocument();
  });
  it("solo una sesión no autorizada lleva al inicio de sesión", async () => {
    conSesion(() =>
      Response.json(
        { message: "Inicie sesión para continuar" },
        { status: 401 },
      ),
    );
    montarApp();
    expect(
      await screen.findByRole("button", { name: "Iniciar sesión con Google" }),
    ).toBeInTheDocument();
  });
});
describe("Integraciones con API real (03 y 14)", () => {
  it("explica el efecto real y muestra la dirección correcta del webhook", async () => {
    montar(<Configuracion />, "/configuracion");
    fireEvent.click(await screen.findByRole("tab", { name: "Integraciones" }));
    const gmail = (await screen.findByText("Gmail Workspace")).closest(
      "section",
    )!;
    expect(gmail).toHaveTextContent("Se revocará la autorización de Gmail");
    expect(gmail).not.toHaveTextContent("simulado");
    const formulario = screen
      .getByText("Formulario del sitio")
      .closest("section")!;
    expect(
      within(formulario).getByDisplayValue(
        `${location.origin}/api/webhooks/formulario`,
      ),
    ).toBeInTheDocument();
    expect(formulario).not.toHaveTextContent("no-es-un-secreto-real");
    expect(
      within(formulario).getByRole("button", { name: "Copiar dirección" }),
    ).toBeInTheDocument();
    fireEvent.click(within(gmail).getByRole("button", { name: "Desconectar" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("se pausarán todas las campañas activas");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    // El aviso muestra el resultado real devuelto por la API, no un texto genérico.
    await waitFor(() =>
      expect(
        screen.getAllByText(/desconectada por el administrador/i).length,
      ).toBeGreaterThanOrEqual(2),
    );
  });
  it("activar una campaña advierte que habrá envíos reales", async () => {
    db.campanas[0].estado = "pausada";
    montar(<Campanas />, "/campanas");
    const activar = await screen.findAllByRole("button", {
      name: "Activar / reanudar",
    });
    const habilitado = activar.find((b) => !b.hasAttribute("disabled"))!;
    fireEvent.click(habilitado);
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Se enviarán correos reales por Gmail",
    );
  });
});
