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
import ImportCSV from "./contactos/ImportCSV";
import Auditoria from "./auditoria/Page";
import Propuestas from "./propuestas/Page";
import Segmentos from "./segmentos/Page";
import { agruparPorDia, indicadoresDeCosto } from "./informes/Page";
import { claveDia, fecha, fechaHora, sumarDias } from "../lib/formato";
import type { MetricaDiaria } from "../types";
vi.mock("react-chartjs-2", () => ({
  Line: () => <div aria-label="Gráfico de línea" />,
  Bar: () => <div aria-label="Gráfico de barras" />,
}));
const llamadas: string[] = [];
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
function archivo(nombre: string, texto: string, size?: number) {
  const file = new File([texto], nombre, { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => texto });
  if (size) Object.defineProperty(file, "size", { value: size });
  return file;
}
async function cargar(file: File) {
  fireEvent.change(screen.getByLabelText(/Archivo CSV/), {
    target: { files: [file] },
  });
}
function elegir(empresa: string, origen = "manual", base = "pendiente") {
  fireEvent.change(screen.getByLabelText("Empresa de estos contactos"), {
    target: { value: empresa },
  });
  fireEvent.change(screen.getByLabelText("Origen obligatorio"), {
    target: { value: origen },
  });
  fireEvent.change(screen.getByLabelText("Base legal obligatoria"), {
    target: { value: base },
  });
}
beforeEach(() => {
  reset();
  llamadas.length = 0;
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      llamadas.push(String(input));
      return route(new Request(new URL(String(input), location.href), init));
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("Importación CSV (01, 02, 22)", () => {
  it("cambiar la empresa tras previsualizar invalida la vista previa", async () => {
    montar(
      <ImportCSV
        contactos={db.contactos}
        empresas={db.empresas}
        onClose={() => {}}
      />,
    );
    await cargar(archivo("a.csv", "nombre,correo\nAna,ana@nuevo.example"));
    await screen.findByText("Previsualizar importación");
    elegir("e1");
    fireEvent.click(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    );
    await screen.findByRole("button", { name: "Importar filas válidas" });
    fireEvent.change(screen.getByLabelText("Empresa de estos contactos"), {
      target: { value: "e2" },
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Importar filas válidas" }),
      ).not.toBeInTheDocument(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Importar filas válidas" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Confirmar importación",
    });
    const e2 = db.empresas.find((e) => e.id === "e2")!.razonSocial;
    expect(dialog).toHaveTextContent(e2);
    expect(dialog).toHaveTextContent("Origen: manual");
    expect(dialog).toHaveTextContent("Base legal: pendiente");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(db.contactos.at(-1)?.correo).toBe("ana@nuevo.example"),
    );
    expect(db.contactos.at(-1)?.empresaId).toBe("e2");
  });
  it("un archivo posterior inválido limpia filas, selección y vista previa", async () => {
    montar(
      <ImportCSV
        contactos={db.contactos}
        empresas={db.empresas}
        onClose={() => {}}
      />,
    );
    await cargar(archivo("bueno.csv", "nombre,correo\nAna,ana@nuevo.example"));
    await screen.findByText("Previsualizar importación");
    elegir("e1");
    fireEvent.click(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    );
    await screen.findByRole("button", { name: "Importar filas válidas" });
    await cargar(archivo("grande.csv", "nombre,correo\nX,x@x.example", 3e6));
    expect(await screen.findByRole("alert")).toHaveTextContent("grande.csv");
    expect(
      screen.queryByRole("button", { name: "Importar filas válidas" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Previsualizar importación" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    await cargar(archivo("roto.csv", 'nombre,correo\n"Ana,ana@x.example'));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "comillas sin cerrar",
    );
    expect(screen.queryByText("bueno.csv")).not.toBeInTheDocument();
  });
  it("detecta duplicados en una pasada y resume creadas, omitidas y rechazadas", async () => {
    const existente = db.contactos[0].correo!;
    montar(
      <ImportCSV
        contactos={db.contactos}
        empresas={db.empresas}
        onClose={() => {}}
      />,
    );
    await cargar(
      archivo(
        "mixto.csv",
        `correo,nombre\n${existente},Ya existe\nnueva@x.example,Nueva\nNUEVA@x.example,Repetida\nsin-arroba,Inválida`,
      ),
    );
    await screen.findByText("Previsualizar importación");
    elegir("e1");
    fireEvent.click(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    );
    expect(
      await screen.findByText(/1 listas · 2 duplicadas · 1 inválidas/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Importar filas válidas" }),
    );
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Confirmar importación" }),
      ).getByRole("button", { name: "Confirmar" }),
    );
    const resumen = await screen.findByText(/Importación terminada/, {
      selector: "p",
    });
    expect(resumen).toHaveTextContent("1 filas creadas");
    expect(resumen).toHaveTextContent("2 omitidas");
    expect(resumen).toHaveTextContent("1 rechazadas");
  });
});
describe("Fechas (10)", () => {
  it("una fecha de calendario no se corre un día en Bogotá", () => {
    expect(fecha("2026-11-21")).toBe("21/11/2026");
    expect(claveDia("2026-11-21")).toBe("2026-11-21");
    expect(sumarDias("2026-11-30", 1)).toBe("2026-12-01");
  });
  it("un instante sí se convierte a la hora de Bogotá", () => {
    expect(fecha("2026-11-21T03:00:00Z")).toBe("20/11/2026");
    expect(fechaHora("2026-11-21T15:30:00Z")).toContain("10:30");
  });
});
describe("Informes (06 y 11)", () => {
  const fila = (m: Partial<MetricaDiaria>): MetricaDiaria => ({
    fecha: "2026-11-02",
    enviados: 0,
    respuestas: 0,
    visitas: 0,
    leads: 0,
    clientes: 0,
    fuente: "correo",
    costoUSD: null,
    ...m,
  });
  it("agrupa por fecha y calcula costo por lead con todas las campañas del día", () => {
    const dias = agruparPorDia([
      fila({ fecha: "2026-11-03", enviados: 4 }),
      fila({ campanaId: "a", enviados: 10, leads: 1, costoUSD: 10 }),
      fila({ campanaId: "b", enviados: 5, leads: 1, clientes: 1 }),
    ]);
    expect(dias.map((d) => d.fecha)).toEqual(["2026-11-02", "2026-11-03"]);
    expect(dias[0]).toMatchObject({ enviados: 15, leads: 2, costo: 10 });
    const k = indicadoresDeCosto(dias);
    expect(k.costoPorLead).toBe(5);
    expect(k.costoAdquisicion).toBe(10);
    expect([k.diasConCosto, k.diasConActividad]).toEqual([1, 2]);
  });
});
describe("Auditoría (09)", () => {
  it("envía los filtros al servidor y exporta todas las coincidencias", async () => {
    const crear = vi.fn(() => "blob:auditoria");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: crear }));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    montar(<Auditoria />, "/auditoria?entidadId=e2");
    await waitFor(() =>
      expect(llamadas.some((u) => u.includes("entidadId=e2"))).toBe(true),
    );
    fireEvent.change(screen.getByLabelText("Acción"), {
      target: { value: "propuesta" },
    });
    await waitFor(() =>
      expect(
        llamadas.some(
          (u) =>
            u.includes("/auditoria/pagina?") && u.includes("accion=propuesta"),
        ),
      ).toBe(true),
    );
    const exportar = await screen.findByRole("button", {
      name: /Exportar CSV/,
    });
    await waitFor(() => expect(exportar).not.toBeDisabled());
    fireEvent.click(exportar);
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(
      llamadas.some(
        (u) =>
          u.includes("/auditoria/exportar?") && u.includes("accion=propuesta"),
      ),
    ).toBe(true);
  });
});
describe("Propuestas (extra)", () => {
  it("muestra el contenido de la versión vigente, que es el que se aprobará", async () => {
    const p = db.propuestas.find((x) => x.id === "pr3")!;
    const v = p.versiones.at(-1)!;
    const contenido = structuredClone(v.contenido) as {
      pasos: { asunto?: string }[];
    };
    contenido.pasos[0].asunto = "Asunto propuesto por el agente";
    v.contenido = contenido;
    montar(<Propuestas />, "/propuestas/pr3");
    expect(
      await screen.findByText("Asunto propuesto por el agente"),
    ).toBeInTheDocument();
  });
});
describe("Segmentos (extra)", () => {
  it("no permite aprobar reglas sin guardar y lo vuelve a permitir al guardar", async () => {
    montar(<Segmentos />, "/segmentos/seg2");
    const aprobar = await screen.findByRole("button", { name: "Aprobar" });
    expect(aprobar).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "Candelaria" },
    });
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
    expect(screen.getByText(/Hay cambios sin guardar/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar para revisión" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Aprobar" })).toBeEnabled(),
    );
    expect(screen.queryByText(/Hay cambios sin guardar/)).toBeNull();
    expect(db.segmentos.find((x) => x.id === "seg2")!.reglas[0].valor).toBe(
      "Candelaria",
    );
  });
});
describe("Pedidos de propuestas a los agentes (extra)", () => {
  it("pide segmentos al agente y el pedido aparece en Propuestas", async () => {
    montar(<Segmentos />, "/segmentos");
    fireEvent.click(
      await screen.findByRole("button", { name: "Pedir propuestas al agente" }),
    );
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/presupuesto de IA/)).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText("Pedido enviado. Siga su avance en Propuestas."),
    ).toBeInTheDocument();
    expect(llamadas.some((u) => u.endsWith("/segmentos/proponer"))).toBe(true);
    expect(
      db.segmentos.some(
        (s) => s.propuestoPor === "agente" && s.estado === "propuesto",
      ),
    ).toBe(true);
  });

  it("solo ofrece pedir campaña en un segmento aprobado y muestra el motivo si no se puede", async () => {
    const { unmount } = montar(<Segmentos />, "/segmentos/seg2");
    await screen.findByRole("button", { name: "Aprobar" });
    expect(
      screen.queryByRole("button", { name: "Pedir campaña al agente" }),
    ).toBeNull();
    unmount();
    montar(<Segmentos />, "/segmentos/seg1");
    fireEvent.click(
      await screen.findByRole("button", { name: "Pedir campaña al agente" }),
    );
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText(
        "Pedido enviado. La ruta aparecerá en Propuestas cuando esté lista.",
      ),
    ).toBeInTheDocument();
    const solicitudes = await (
      await route(new Request("http://localhost/api/propuestas/solicitudes"))
    ).json();
    expect(solicitudes[0]).toMatchObject({
      tipo: "proponer_campana",
      segmentoId: "seg1",
      objetivo: "Que completen el diagnóstico RSE Express",
      numeroCorreos: 3,
    });
  });

  it("lista los pedidos con su estado y el motivo de un fallo", async () => {
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/agentes/solicitudes"))
          return Response.json([
            {
              id: "t1",
              tipo: "proponer_campana",
              estado: "fallida",
              intentos: 1,
              maxIntentos: 4,
              error: "No hay contactos elegibles con base legal aprobada",
              creadaEn: "2026-11-22T07:00:00Z",
              terminadaEn: "2026-11-22T07:01:00Z",
              segmentoId: "seg1",
              segmento: "Industria de Palmira",
            },
            {
              id: "t2",
              tipo: "proponer_segmentos",
              estado: "en_proceso",
              intentos: 1,
              maxIntentos: 4,
              creadaEn: "2026-11-22T07:02:00Z",
            },
          ]);
        return route(new Request(new URL(String(input), location.href), init));
      },
    );
    montar(<Propuestas />, "/propuestas");
    // Los pedidos de segmentos se ven en «Otras propuestas»; las rutas tienen su panel.
    fireEvent.click(
      await screen.findByRole("button", { name: "Otras propuestas" }),
    );
    expect(
      await screen.findByText("Pedidos de segmentos al agente"),
    ).toBeInTheDocument();
    expect(screen.getByText("El agente está trabajando")).toBeInTheDocument();
    expect(
      screen.queryByText("No hay contactos elegibles con base legal aprobada"),
    ).toBeNull();
  });
});
