import { beforeEach, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeedbackProvider } from "../components/ui";
import { route, reset } from "../mocks/handlers";
import Panel from "./panel/Page";
import Contactos from "./contactos/Page";
import Empresas from "./empresas/Page";
import Segmentos from "./segmentos/Page";
import Secuencias from "./secuencias/Page";
import Campanas from "./campanas/Page";
import Respuestas from "./respuestas/Page";
import Embudo from "./embudo/Page";
import Informes from "./informes/Page";
import Configuracion from "./configuracion/Page";
import Auditoria from "./auditoria/Page";
vi.mock("react-chartjs-2", () => ({
  Line: () => <div aria-label="Gráfico de línea" />,
  Bar: () => <div aria-label="Gráfico de barras" />,
}));
beforeEach(() => {
  reset();
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) =>
    route(new Request(String(input), init)),
  );
});
it.each([
  ["/", Panel, "Cada conexión cuenta."],
  ["/contactos", Contactos, "Contactos"],
  ["/contactos/c1", Contactos, "Andrés Felipe Cárdenas"],
  ["/empresas", Empresas, "Empresas"],
  ["/empresas/e1", Empresas, "Empaques Samán S.A.S."],
  ["/segmentos", Segmentos, "Segmentos"],
  ["/segmentos/seg1", Segmentos, "Segmentos"],
  ["/secuencias", Secuencias, "Secuencias"],
  ["/secuencias/s1/editar", Secuencias, "Secuencias"],
  ["/campanas", Campanas, "Campañas"],
  [
    "/campanas/cam1",
    Campanas,
    "Proveedores agroindustriales · Palmira y Candelaria",
  ],
  ["/respuestas", Respuestas, "Respuestas"],
  ["/embudo", Embudo, "Embudo comercial"],
  ["/informes", Informes, "Informes"],
  ["/configuracion", Configuracion, "Configuración"],
  ["/auditoria", Auditoria, "Registro de acciones"],
])("renderiza %s con datos validados", async (path, Page, title) => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[path]}>
        <FeedbackProvider>
          <Page />
        </FeedbackProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { name: title, level: 1 });
  await waitFor(() => expect(cache.isFetching()).toBe(0));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
