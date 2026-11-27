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
import { FeedbackProvider } from "../../components/ui";
import { db, reset, route } from "../../mocks/handlers";
import { BotonEliminar } from "./Eliminar";

function montar(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FeedbackProvider>{children}</FeedbackProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const llamadas: string[] = [];
beforeEach(() => {
  reset();
  llamadas.length = 0;
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), location.href);
      llamadas.push(
        `${init?.method ?? "GET"} ${url.pathname.replace(/^.*\/api/, "")}`,
      );
      return route(new Request(url, init));
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("Eliminar con vista previa del impacto", () => {
  it("muestra qué contacto se elimina y lo borra al confirmar", async () => {
    const c = db.contactos[0];
    const onDone = vi.fn();
    montar(<BotonEliminar recurso="contactos" ids={[c.id]} onDone={onDone} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: /Eliminar contacto de la aplicación/,
      }),
    );
    const dialogo = await screen.findByRole("dialog");
    expect(
      await within(dialogo).findByText(new RegExp(c.nombre)),
    ).toBeInTheDocument();
    expect(dialogo).toHaveTextContent(/datos personales/);
    expect(dialogo).toHaveTextContent(/no se puede deshacer/);
    expect(llamadas).toContain("POST /eliminacion/previa");
    expect(llamadas).not.toContain("POST /eliminacion");
    const boton = within(dialogo)
      .getAllByRole("button", { name: /Eliminar contacto de la aplicación/ })
      .at(-1)!;
    await waitFor(() => expect(boton).toBeEnabled());
    fireEvent.click(boton);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(llamadas).toContain("POST /eliminacion");
    expect(db.contactos.some((x) => x.id === c.id)).toBe(false);
  });

  it("bloquea eliminar un segmento que usa una secuencia y lo explica", async () => {
    const cam = db.campanas.find((c) => c.segmentoId)!;
    montar(<BotonEliminar recurso="segmentos" ids={[cam.segmentoId]} />);
    fireEvent.click(screen.getByRole("button", { name: /Eliminar/ }));
    const dialogo = await screen.findByRole("dialog");
    expect(
      await within(dialogo).findByText(/No se puede eliminar/),
    ).toHaveTextContent(cam.nombre);
    expect(
      within(dialogo).getByRole("button", { name: "Eliminar segmento" }),
    ).toBeDisabled();
    expect(db.segmentos.some((s) => s.id === cam.segmentoId)).toBe(true);
  });
});
