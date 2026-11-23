import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FeedbackProvider } from "../components/ui";
import { db, reset, route } from "../mocks/handlers";
import App, { RedirigirPropuesta } from "../app/App";
import Panel from "./panel/Page";
import Empresas from "./empresas/Page";
import Informes from "./informes/Page";

vi.mock("../lib/modo", () => ({ MODO_DEMO: false }));
vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="grafica" />,
  Bar: () => <div data-testid="grafica" />,
}));
const cliente = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
function montar(children: ReactNode, path = "/") {
  return render(
    <QueryClientProvider client={cliente()}>
      <MemoryRouter initialEntries={[path]}>
        <FeedbackProvider>{children}</FeedbackProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
let llamadas: { ruta: string; cuerpo?: unknown }[] = [];
beforeEach(() => {
  reset();
  llamadas = [];
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/auth/session"))
        return Response.json({ ok: true });
      const r = new Request(new URL(String(input), location.href), init);
      llamadas.push({
        ruta: new URL(r.url).pathname.replace(/^\/api/, ""),
        cuerpo:
          typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      return route(r);
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

function Donde() {
  return <p data-testid="ruta">{useLocation().pathname}</p>;
}
function montarRedireccion(path: string) {
  return montar(
    <Routes>
      <Route path="/propuestas" element={<RedirigirPropuesta />} />
      <Route path="/propuestas/:id" element={<RedirigirPropuesta />} />
      <Route path="*" element={<Donde />} />
    </Routes>,
    path,
  );
}

describe("Sin el apartado Propuestas", () => {
  it("el menú no muestra Propuestas y el contador pasa a Secuencias", async () => {
    render(
      <QueryClientProvider client={cliente()}>
        <App />
      </QueryClientProvider>,
    );
    const menu = await screen.findByRole("navigation");
    expect(within(menu).queryByText("Propuestas")).toBeNull();
    const enlace = within(menu).getByRole("link", {
      name: /Secuencias de correo/,
    });
    // cam2 es un borrador (nunca aprobado); cam1 está aprobada sin cambios.
    await waitFor(() =>
      expect(enlace).toHaveTextContent(/Secuencias de correo1/),
    );
    expect(
      within(enlace).getByTitle("Secuencias por aprobar"),
    ).toHaveTextContent("1");
  });

  it("las rutas viejas de Propuestas redirigen a Secuencias", async () => {
    const { unmount } = montarRedireccion("/propuestas");
    expect(await screen.findByTestId("ruta")).toHaveTextContent(
      /^\/secuencias$/,
    );
    unmount();
    // Una propuesta de campaña abre el editor de su secuencia.
    const r2 = montarRedireccion("/propuestas/pr3");
    expect(await screen.findByTestId("ruta")).toHaveTextContent(
      /^\/secuencias\/s2$/,
    );
    r2.unmount();
    // Otro tipo de propuesta va a la lista.
    montarRedireccion("/propuestas/pr1");
    expect(await screen.findByTestId("ruta")).toHaveTextContent(
      /^\/secuencias$/,
    );
  });

  it("el Panel muestra «Secuencias por aprobar» con enlace a Secuencias", async () => {
    montar(<Panel />);
    const enlace = await screen.findByRole("link", {
      name: /Secuencias por aprobar/,
    });
    expect(enlace).toHaveAttribute("href", "/secuencias");
    await waitFor(() => expect(enlace).toHaveTextContent("1"));
    expect(screen.queryByText("Propuestas para revisar")).toBeNull();
  });
});

describe("Sugerencias de la IA donde corresponden", () => {
  it("Empresas muestra los datos sugeridos con su fuente; descartar usa el comentario por defecto", async () => {
    montar(<Empresas />, "/empresas/e1");
    const bloque = (
      await screen.findByText("Datos sugeridos por la IA")
    ).closest("section")!;
    expect(within(bloque).getByText(/Tamaño:/)).toBeInTheDocument();
    expect(within(bloque).getByText(/11-50/)).toBeInTheDocument();
    expect(
      within(bloque).getByText(/un equipo de 38 personas/),
    ).toBeInTheDocument();
    // El correo deducido solo se puede descartar.
    expect(
      within(bloque).getByText("Correo deducido: verifícalo antes de usarlo"),
    ).toBeInTheDocument();
    expect(
      within(bloque).getAllByRole("button", { name: "Aceptar" }),
    ).toHaveLength(1);
    const descartar = within(bloque).getAllByRole("button", {
      name: "Descartar",
    });
    expect(descartar).toHaveLength(2);
    fireEvent.click(descartar[1]);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    await waitFor(() =>
      expect(db.propuestas.find((p) => p.id === "pr5")!.estado).toBe(
        "rechazada",
      ),
    );
    expect(
      llamadas.find((l) => l.ruta === "/propuestas/pr5/rechazar")?.cuerpo,
    ).toEqual({
      comentario: "Descartado por el administrador",
      pedirNuevaVersion: false,
    });
  });

  it("Informes muestra la mejora sugerida y aplicarla no toca lo aprobado de una secuencia", async () => {
    // Una mejora dirigida a una secuencia crea un borrador.
    const mejora = db.propuestas.find((p) => p.id === "pr4")!;
    mejora.versiones[0].contenido = {
      objetivo: "secuencia",
      id: "s1",
      cambios: { nombre: "RSE Express · Proveedores (mejorada)" },
    };
    montar(<Informes />, "/informes");
    const bloque = (
      await screen.findByText("Mejoras sugeridas por la IA")
    ).closest("section")!;
    fireEvent.click(within(bloque).getByRole("button", { name: "Aplicar" }));
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveTextContent("Se creará un borrador en la secuencia");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mejora.estado).toBe("aprobada"));
    expect(db.secuencias[0].nombre).toBe("RSE Express · Proveedores");
    expect(db.campanas[0].estado).toBe("activa");
    const borrador = await (
      await route(new Request("http://localhost/api/secuencias/s1/borrador"))
    ).json();
    expect(borrador.contenido.nombre).toBe(
      "RSE Express · Proveedores (mejorada)",
    );
  });
});
