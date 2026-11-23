import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FeedbackProvider } from "../components/ui";
import { route, reset, db } from "../mocks/handlers";
import Empresas from "./empresas/Page";
import Descubrimiento from "./descubrimiento/Page";
import ImportCSV from "./contactos/ImportCSV";
function wrapper(children: ReactNode, path = "/") {
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
beforeEach(() => {
  reset();
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) =>
    route(new Request(new URL(String(input), location.href), init)),
  );
});
describe("Pantallas críticas", () => {
  it("aceptar un dato sugerido por la IA pide confirmación antes de mutar", async () => {
    wrapper(<Empresas />, "/empresas/e1");
    const bloque = (
      await screen.findByText("Datos sugeridos por la IA")
    ).closest("section")!;
    fireEvent.click(within(bloque).getByRole("button", { name: "Aceptar" }));
    expect(db.propuestas[0].estado).toBe("pendiente");
    const dialogo = screen.getByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(db.propuestas[0].estado).toBe("aprobada"));
    expect(db.empresas.find((e) => e.id === "e1")!.tamano).toBe("11-50");
  });
  it("aceptar resultado pide confirmar y actualiza su estado", async () => {
    wrapper(<Descubrimiento />, "/descubrimiento");
    const buttons = await screen.findAllByRole("button", { name: "Aceptar" });
    fireEvent.click(buttons[0]);
    expect(db.empresas).toHaveLength(25);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(db.empresas).toHaveLength(26));
  });
  it("importación mapea, previsualiza y confirma una fila", async () => {
    wrapper(
      <ImportCSV
        contactos={db.contactos}
        empresas={db.empresas}
        onClose={() => {}}
      />,
    );
    const file = new File(
      ["nombre,correo\nImportado,importado@demo.example"],
      "demo.csv",
      { type: "text/csv" },
    );
    Object.defineProperty(file, "text", {
      value: async () => "nombre,correo\nImportado,importado@demo.example",
    });
    fireEvent.change(screen.getByLabelText(/Archivo CSV/), {
      target: { files: [file] },
    });
    await screen.findByText("Previsualizar importación");
    fireEvent.change(screen.getByLabelText("Empresa de estos contactos"), {
      target: { value: "e1" },
    });
    fireEvent.change(screen.getByLabelText("Origen obligatorio"), {
      target: { value: "manual" },
    });
    fireEvent.change(screen.getByLabelText("Base legal obligatoria"), {
      target: { value: "pendiente" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    );
    await screen.findByText("Importado");
    fireEvent.click(
      screen.getByRole("button", { name: "Importar filas válidas" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Confirmar importación",
    });
    expect(db.contactos).toHaveLength(60);
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(db.contactos).toHaveLength(61));
  });
});
