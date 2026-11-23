import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FeedbackProvider } from "../../components/ui";
import { db, reset, route } from "../../mocks/handlers";
import Terminal, { INTERVALO_MS } from "./Page";

const llamadas: string[] = [];
let alterar: ((cuerpo: Record<string, unknown>) => void) | null = null;

beforeEach(() => {
  reset();
  llamadas.length = 0;
  alterar = null;
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const r = new Request(new URL(String(input), location.href), init);
      const url = new URL(r.url);
      llamadas.push(url.pathname.replace(/^\/api/, "") + url.search);
      const respuesta = await route(r);
      if (!alterar) return respuesta;
      const cuerpo = (await respuesta.json()) as Record<string, unknown>;
      alterar(cuerpo);
      return new Response(JSON.stringify(cuerpo), {
        headers: { "Content-Type": "application/json" },
      });
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const abrir = () =>
  render(
    <MemoryRouter>
      <FeedbackProvider>
        <Terminal />
      </FeedbackProvider>
    </MemoryRouter>,
  );

describe("Terminal", () => {
  it("muestra el trabajador, la cola, lo que está en curso y la bitácora", async () => {
    abrir();
    expect(await screen.findByText("Trabajador activo")).toBeInTheDocument();
    const log = screen.getByRole("log", { name: "Bitácora del trabajador" });
    await within(log).findByText(/Calcular puntajes: listo en 2 s\./);
    expect(
      within(log)
        .getByText(/Gemini está saturado/)
        .closest("[data-nivel]"),
    ).toHaveAttribute("data-nivel", "aviso");
    const ahora = screen.getByRole("list", { name: "Ahora mismo" });
    expect(
      within(ahora).getByText(
        "Búsqueda de empresas: «Proveedores agroindustriales» en Candelaria",
      ),
    ).toBeInTheDocument();
    expect(within(ahora).getByText("En curso")).toBeInTheDocument();
    expect(screen.getByText(/Fallidas \(24 h\)/).textContent).toBe(
      "Fallidas (24 h) 0",
    );
  });

  it("pide solo las líneas nuevas y las agrega al final", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    abrir();
    const log = await screen.findByRole("log");
    await within(log).findByText(/Calcular puntajes: listo/);
    const ultimo = db.terminal.at(-1)!.id;
    db.terminal.push({
      id: ultimo + 1,
      fecha: new Date().toISOString(),
      nivel: "error",
      mensaje: "Enviar un correo programado: falló. Gmail requiere renovar.",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_MS + 100);
    });
    expect(
      await within(log).findByText(/Enviar un correo programado: falló/),
    ).toBeInTheDocument();
    expect(llamadas).toContain(`/terminal?desde=${ultimo}`);
    // Sin duplicados: cada línea una sola vez.
    expect(within(log).getAllByText(/Calcular puntajes: listo/)).toHaveLength(
      1,
    );

    // «Solo avisos y errores» oculta lo demás.
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Solo avisos y errores" }),
    );
    expect(within(log).queryByText(/Calcular puntajes: listo/)).toBeNull();
    expect(within(log).getByText(/Gmail requiere renovar/)).toBeInTheDocument();

    // En pausa no vuelve a preguntar.
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    const antes = llamadas.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_MS * 3);
    });
    expect(llamadas.length).toBe(antes);
    expect(
      screen.getByRole("button", { name: "Reanudar" }),
    ).toBeInTheDocument();
  });

  it("avisa cuando el trabajador no da señales", async () => {
    alterar = (cuerpo) => {
      cuerpo.trabajador = { activo: false };
    };
    abrir();
    expect(
      await screen.findByText("Sin señal del trabajador"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toContain(
      "proceso «trabajador»",
    );
  });

  it("si el servidor falla, lo dice y sigue intentando", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ message: "Servicio no disponible" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
    );
    abrir();
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "No se pudo leer la terminal",
      ),
    );
  });
});
