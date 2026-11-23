import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeedbackProvider } from "../../components/ui";
import { db, reset, route } from "../../mocks/handlers";
import { evidencia } from "../../mocks/data";
import Configuracion from "./Page";

const llamadas: string[] = [];
function abrir() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/configuracion"]}>
        <FeedbackProvider>
          <Configuracion />
        </FeedbackProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Cumplimiento" }));
}

beforeEach(() => {
  reset();
  llamadas.length = 0;
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const r = new Request(new URL(String(input), location.href), init);
      llamadas.push(
        `${r.method} ${new URL(r.url).pathname.replace(/^\/api/, "")}`,
      );
      return route(r);
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

/** Deja dos contactos pendientes: uno con correo publicado y verificado, otro sin página. */
function pendientes() {
  const [conPrueba, sinPrueba] = db.contactos.filter(
    (c) => !c.excluido && c.correo,
  );
  for (const c of [conPrueba, sinPrueba])
    c.baseLegal = { tipo: "pendiente", aprobadaPorAdmin: false };
  conPrueba.evidencias = [evidencia("correo", conPrueba.correo!)];
  sinPrueba.evidencias = [];
  const empresa = db.empresas.find((e) => e.id === sinPrueba.empresaId)!;
  empresa.evidencias = empresa.evidencias.filter(
    (e) => !["correo", "correoCorporativo"].includes(e.campo),
  );
  return { conPrueba, sinPrueba };
}

describe("Aprobación automática de la base legal", () => {
  it("está apagada por defecto y al encenderla aprueba solo los que tienen prueba publicada", async () => {
    const { conPrueba, sinPrueba } = pendientes();
    abrir();
    expect(await screen.findByText("Manual")).toBeInTheDocument();
    const casilla = screen.getByRole("checkbox", {
      name: /Aprobar automáticamente la base legal/,
    });
    expect(casilla).not.toBeChecked();
    fireEvent.click(casilla);
    const dialogo = await screen.findByRole("dialog", {
      name: "Encender la aprobación automática",
    });
    expect(dialogo.textContent).toContain("siguen esperando tu revisión");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText(
        /Aprobación automática encendida\. Se aprobaron \d+ contactos pendientes\./,
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Automática")).toBeInTheDocument();
    expect(llamadas).toContain("PUT /configuracion/cumplimiento");

    expect(conPrueba.baseLegal.aprobadaPorAdmin).toBe(true);
    expect(conPrueba.baseLegal.tipo).toBe("corporativo_generico");
    expect(conPrueba.baseLegal.texto).toContain("aprobada automáticamente");
    expect(conPrueba.baseLegal.prueba).toMatch(
      /^https:\/\/saman\.example\/acerca — «/,
    );
    expect(sinPrueba.baseLegal.aprobadaPorAdmin).toBe(false);
  });

  it("se puede apagar: lo aprobado se conserva y los nuevos esperan al administrador", async () => {
    const { conPrueba } = pendientes();
    conPrueba.baseLegal = {
      tipo: "corporativo_generico",
      texto: "Base aprobada automáticamente por la política de cumplimiento",
      prueba: "https://saman.example/acerca",
      aprobadaPorAdmin: true,
    };
    db.cumplimiento = { aprobacionLegalAutomatica: true };
    abrir();
    expect(await screen.findByText("Automática")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Aprobar automáticamente la base legal/,
      }),
    );
    fireEvent.click(
      within(
        await screen.findByRole("dialog", {
          name: "Apagar la aprobación automática",
        }),
      ).getByRole("button", { name: "Confirmar" }),
    );
    expect(
      await screen.findByText("Aprobación automática apagada."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Manual")).toBeInTheDocument();
    expect(db.cumplimiento.aprobacionLegalAutomatica).toBe(false);
    expect(conPrueba.baseLegal.aprobadaPorAdmin).toBe(true);
  });

  it("al verificar un correo publicado con la política encendida, la base queda aprobada", async () => {
    const { conPrueba } = pendientes();
    conPrueba.estadoCorreo = "desconocido";
    db.cumplimiento = { aprobacionLegalAutomatica: true };
    const r = await route(
      new Request(
        new URL(
          `/api/contactos/${conPrueba.id}/verificar-correo`,
          location.href,
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      ),
    );
    expect(r.status).toBe(200);
    expect(conPrueba.estadoCorreo).toBe("valido");
    expect(conPrueba.baseLegal.aprobadaPorAdmin).toBe(true);
    const mal = await route(
      new Request(new URL("/api/configuracion/cumplimiento", location.href), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aprobacionLegalAutomatica: "sí" }),
      }),
    );
    expect(mal.status).toBe(400);
  });
});
