import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeedbackProvider } from "../../components/ui";
import { db, reset, route } from "../../mocks/handlers";
import Contactos from "./Page";

const llamadas: string[] = [];
function abrir(id: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/contactos/${id}`]}>
        <FeedbackProvider>
          <Routes>
            <Route path="/contactos/*" element={<Contactos />} />
          </Routes>
        </FeedbackProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
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

describe("Verificar correo desde la ficha del contacto", () => {
  it("vuelve a verificar un correo sin verificar y actualiza su estado", async () => {
    const c = db.contactos.find(
      (x) => x.estadoCorreo === "desconocido" && !x.excluido && x.correo,
    )!;
    abrir(c.id);
    fireEvent.click(
      await screen.findByRole("button", { name: "Verificar correo" }),
    );
    const dialogo = await screen.findByRole("dialog", {
      name: "Verificar correo",
    });
    expect(dialogo.textContent).toContain("Consume una verificación de Hunter");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("valido")).toBeInTheDocument();
    expect(llamadas).toContain(`POST /contactos/${c.id}/verificar-correo`);
    expect(
      screen.queryByRole("button", { name: "Verificar correo" }),
    ).toBeNull();
  });

  it("no ofrece verificar un correo que ya es válido", async () => {
    const c = db.contactos.find(
      (x) => x.estadoCorreo === "valido" && !x.excluido,
    )!;
    abrir(c.id);
    await screen.findByText(c.correo!);
    expect(
      screen.queryByRole("button", { name: "Verificar correo" }),
    ).toBeNull();
  });
});
