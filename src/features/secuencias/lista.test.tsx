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
import { FeedbackProvider } from "../../components/ui";
import { db, reset, route } from "../../mocks/handlers";
import { demoIA } from "../../mocks/secuencias";
import Secuencias from "./Page";
import { intervaloSolicitudes } from "./Solicitudes";
import { cuerpoSolicitud, formularioIASchema } from "./NuevaConIA";

type Llamada = { metodo: string; ruta: string; cuerpo?: unknown };
let llamadas: Llamada[] = [];
function Donde() {
  return <p data-testid="ruta">{useLocation().pathname}</p>;
}
function montar(children: ReactNode, path = "/secuencias") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <FeedbackProvider>
          <Routes>
            <Route path="/secuencias/*" element={children} />
          </Routes>
          <Donde />
        </FeedbackProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  reset();
  demoIA.esperaMs = 0;
  llamadas = [];
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const r = new Request(new URL(String(input), location.href), init);
      llamadas.push({
        metodo: r.method,
        ruta: new URL(r.url).pathname.replace(/^\/api/, ""),
        cuerpo:
          typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      return route(r);
    },
  );
});
afterEach(() => {
  demoIA.esperaMs = 6000;
  vi.unstubAllGlobals();
});

describe("Lista de secuencias", () => {
  it("muestra cada secuencia con segmento, correos, estado y métricas; busca y filtra", async () => {
    montar(<Secuencias />);
    expect(
      await screen.findByRole("heading", { name: "Secuencias de correo" }),
    ).toBeInTheDocument();
    const fila1 = (
      await screen.findByRole("link", { name: "RSE Express · Proveedores" })
    ).closest("tr")!;
    expect(within(fila1).getByText("Activa")).toBeInTheDocument();
    expect(within(fila1).getByText("3")).toBeInTheDocument();
    const fila2 = screen
      .getByRole("link", {
        name: "RSE Express · Proveedores de ingenios · Palmira",
      })
      .closest("tr")!;
    expect(within(fila2).getByText("Borrador")).toBeInTheDocument();
    expect(
      within(fila2).getByText("Proveedores de ingenios · Palmira"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar"), {
      target: { value: "ingenios" },
    });
    expect(
      screen.queryByRole("link", { name: "RSE Express · Proveedores" }),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "activa" },
    });
    expect(
      screen.getByRole("link", { name: "RSE Express · Proveedores" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", {
        name: "RSE Express · Proveedores de ingenios · Palmira",
      }),
    ).toBeNull();
  });

  it("archivar oculta la secuencia y «Ver archivadas» la muestra", async () => {
    montar(<Secuencias />);
    const fila = (
      await screen.findByRole("link", {
        name: "RSE Express · Proveedores de ingenios · Palmira",
      })
    ).closest("tr")!;
    // La campaña activa no se puede archivar.
    const activa = screen
      .getByRole("link", { name: "RSE Express · Proveedores" })
      .closest("tr")!;
    expect(
      within(activa).getByRole("button", { name: /Archivar/ }),
    ).toBeDisabled();
    fireEvent.click(within(fila).getByRole("button", { name: /Archivar/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("link", {
          name: "RSE Express · Proveedores de ingenios · Palmira",
        }),
      ).toBeNull(),
    );
    fireEvent.click(screen.getByRole("switch", { name: "Ver archivadas" }));
    const archivada = (
      await screen.findByRole("link", {
        name: "RSE Express · Proveedores de ingenios · Palmira",
      })
    ).closest("tr")!;
    expect(within(archivada).getByText("Archivada")).toBeInTheDocument();
  });

  it("duplicar crea «Copia de …»", async () => {
    montar(<Secuencias />);
    const fila = (
      await screen.findByRole("link", { name: "RSE Express · Proveedores" })
    ).closest("tr")!;
    fireEvent.click(within(fila).getByRole("button", { name: /Duplicar/ }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    expect(
      await screen.findByRole("link", {
        name: "Copia de RSE Express · Proveedores",
      }),
    ).toBeInTheDocument();
  });

  it("sin secuencias invita a pedir la primera a la IA", async () => {
    db.secuencias.splice(0);
    montar(<Secuencias />);
    expect(
      await screen.findByText(
        "Aún no tienes secuencias. Pídele a la IA la primera",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Nueva con IA/ }),
    ).toHaveLength(2);
  });
});

describe("Solicitudes a la IA", () => {
  it("muestra la que está en curso, la fallida con su motivo y permite reintentar", async () => {
    montar(<Secuencias />);
    const panel = (await screen.findByText("Solicitudes a la IA")).closest(
      "section",
    )!;
    expect(
      within(panel).getByText(
        /La IA está escribiendo una secuencia para Proveedores de ingenios · Palmira…/,
      ),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText(/La secuencia propuesta no cumple/),
    ).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Reintentar" }));
    await waitFor(() =>
      expect(
        llamadas.some(
          (l) =>
            l.metodo === "POST" &&
            l.ruta === "/secuencias/solicitudes/sol-fallida/reintentar",
        ),
      ).toBe(true),
    );
    // El agente simulado ya respondió (espera 0): aparece «Abrir».
    expect(
      await within(panel).findByRole("link", { name: "Abrir" }),
    ).toBeInTheDocument();
  });

  it("consulta cada 15 s solo mientras hay solicitudes en curso", () => {
    const s = (estado: "en_cola" | "trabajando" | "lista" | "fallida") => ({
      id: "x",
      tipo: "proponer_campana" as const,
      estado,
      creadaEn: new Date().toISOString(),
    });
    expect(intervaloSolicitudes([s("en_cola")])).toBe(15000);
    expect(intervaloSolicitudes([s("lista"), s("trabajando")])).toBe(15000);
    expect(intervaloSolicitudes([s("lista"), s("fallida")])).toBe(false);
    expect(intervaloSolicitudes(undefined)).toBe(false);
  });
});

describe("Nueva con IA y Nueva en blanco", () => {
  it("el esquema valida objetivo, correos y notas", () => {
    const base = {
      segmentoId: "seg1",
      objetivo: "rse",
      numeroCorreos: 3,
      notas: "",
    };
    expect(formularioIASchema.safeParse(base).success).toBe(true);
    expect(
      formularioIASchema.safeParse({ ...base, numeroCorreos: 6 }).success,
    ).toBe(false);
    expect(
      formularioIASchema.safeParse({ ...base, notas: "x".repeat(501) }).success,
    ).toBe(false);
    expect(
      formularioIASchema.safeParse({ ...base, objetivo: "otro" }).success,
    ).toBe(false);
    expect(
      cuerpoSolicitud(
        formularioIASchema.parse({
          ...base,
          objetivo: "otro",
          objetivoOtro: "  Invitar al taller ",
          notas: " Palmira ",
        }),
      ),
    ).toEqual({
      segmentoId: "seg1",
      objetivo: "Invitar al taller",
      numeroCorreos: 3,
      notas: "Palmira",
    });
  });

  it("pide la secuencia con los datos del formulario y avisa que la IA está escribiendo", async () => {
    montar(<Secuencias />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Nueva con IA/ }),
    );
    const dialogo = await screen.findByRole("dialog");
    const segmento = within(dialogo).getByLabelText("Segmento");
    await waitFor(() => expect(segmento).not.toHaveValue(""));
    expect(
      within(dialogo).queryByRole("option", { name: /Industria de Palmira/ }),
    ).toBeNull(); // solo segmentos aprobados
    fireEvent.change(segmento, { target: { value: "seg1" } });
    fireEvent.click(within(dialogo).getByLabelText("Otro"));
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Pedir a la IA" }),
    );
    expect(
      await within(dialogo).findByText(
        "Describa el objetivo en 5 a 200 caracteres",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialogo).getByLabelText("Agendar una llamada de 20 minutos"),
    );
    fireEvent.change(within(dialogo).getByLabelText(/Notas para la IA/), {
      target: { value: "Mencionar los ingenios" },
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Pedir a la IA" }),
    );
    expect(
      await screen.findByText(
        "La IA está escribiendo tu secuencia. Aparecerá aquí en unos minutos",
      ),
    ).toBeInTheDocument();
    expect(llamadas.find((l) => l.ruta === "/secuencias/ia")?.cuerpo).toEqual({
      segmentoId: "seg1",
      objetivo: "Agendar una llamada de 20 minutos",
      numeroCorreos: 3,
      notas: "Mencionar los ingenios",
    });
  });

  it("muestra en el diálogo el error del servidor", async () => {
    demoIA.esperaMs = 60000;
    await route(
      new Request("http://localhost/api/secuencias/ia", {
        method: "POST",
        body: JSON.stringify({
          segmentoId: "seg1",
          objetivo: "Que completen el diagnóstico",
        }),
      }),
    );
    montar(<Secuencias />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Nueva con IA/ }),
    );
    const dialogo = await screen.findByRole("dialog");
    const segmento = within(dialogo).getByLabelText("Segmento");
    await waitFor(() => expect(segmento).not.toHaveValue(""));
    fireEvent.change(segmento, { target: { value: "seg1" } });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Pedir a la IA" }),
    );
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "Ya hay una secuencia en preparación para este segmento",
    );
  });

  it("«Nueva en blanco» crea la secuencia y abre el editor", async () => {
    montar(<Secuencias />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Nueva en blanco/ }),
    );
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Crear y abrir el editor" }),
    );
    expect(
      await within(dialogo).findByText(
        "El nombre requiere entre 3 y 120 caracteres",
      ),
    ).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText("Nombre"), {
      target: { value: "Invitación al taller" },
    });
    const segmento = within(dialogo).getByLabelText("Segmento");
    await waitFor(() =>
      expect(within(segmento).getAllByRole("option").length).toBeGreaterThan(1),
    );
    fireEvent.change(segmento, { target: { value: "seg1" } });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Crear y abrir el editor" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("ruta").textContent).toMatch(
        /^\/secuencias\/.+/,
      ),
    );
    const id = screen.getByTestId("ruta").textContent!.split("/")[2];
    const s = db.secuencias.find((x) => x.id === id)!;
    expect(s.nombre).toBe("Invitación al taller");
    expect(db.campanas.find((c) => c.secuenciaId === id)?.estado).toBe(
      "borrador",
    );
  });
});
