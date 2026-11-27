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
import Importar from "./contactos/Importar";
import Auditoria from "./auditoria/Page";
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
  if (size) Object.defineProperty(file, "size", { value: size });
  return file;
}
async function cargar(file: File) {
  fireEvent.change(screen.getByLabelText(/Archivo \(\.csv o \.xlsx/), {
    target: { files: [file] },
  });
}
function elegir(empresa: string) {
  fireEvent.change(screen.getByLabelText("Empresa de estos contactos"), {
    target: { value: empresa },
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
describe("Importación CSV o Excel (01, 02, 22)", () => {
  it("cambiar la empresa tras previsualizar invalida la vista previa", async () => {
    montar(<Importar empresas={db.empresas} onClose={() => {}} />);
    await cargar(archivo("a.csv", "nombre,correo\nAna,ana@nuevo.example"));
    await screen.findByText("Previsualizar importación");
    elegir("e1");
    fireEvent.click(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    );
    await screen.findByRole("button", { name: "Importar filas válidas" });
    elegir("e2");
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
    montar(<Importar empresas={db.empresas} onClose={() => {}} />);
    await cargar(archivo("bueno.csv", "nombre,correo\nAna,ana@nuevo.example"));
    await screen.findByText("Previsualizar importación");
    elegir("e1");
    fireEvent.click(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    );
    await screen.findByRole("button", { name: "Importar filas válidas" });
    await cargar(archivo("grande.csv", "nombre,correo\nX,x@x.example", 5e6));
    expect(await screen.findByRole("alert")).toHaveTextContent("grande.csv");
    expect(
      screen.queryByRole("button", { name: "Importar filas válidas" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Previsualizar importación" }),
    ).not.toBeInTheDocument();
    await cargar(archivo("roto.csv", 'nombre,correo\n"Ana,ana@x.example'));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "comillas sin cerrar",
    );
    expect(screen.queryByText(/bueno\.csv/)).not.toBeInTheDocument();
  });
  it("detecta duplicados, dice el motivo por fila y resume el resultado", async () => {
    const existente = db.contactos[0].correo!;
    montar(<Importar empresas={db.empresas} onClose={() => {}} />);
    await cargar(
      archivo(
        "mixto.csv",
        `correo,nombre\n${existente},Ya existe\n  NUEVA@x.example ,Nueva\nnueva@x.example,Repetida\nsin-arroba,Inválida\n,`,
      ),
    );
    expect(await screen.findByText(/4 filas con datos/)).toBeInTheDocument();
    elegir("e1");
    fireEvent.click(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    );
    expect(
      await screen.findByText(
        /1 por crear · 0 por actualizar · 2 omitidas · 1 con error/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/ya está en la fila 3/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Importar filas válidas" }),
    );
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Confirmar importación" }),
      ).getByRole("button", { name: "Confirmar" }),
    );
    const resumen = await screen.findByText(/Importación terminada/, {
      selector: "strong",
    });
    expect(resumen).toHaveTextContent("1 creadas");
    expect(resumen).toHaveTextContent("2 omitidas");
    expect(resumen).toHaveTextContent("1 con error");
    expect(db.contactos.at(-1)?.correo).toBe("nueva@x.example");
  });
  it("con «actualizar», un correo existente se actualiza en lugar de omitirse", async () => {
    const c = db.contactos[0];
    montar(<Importar empresas={db.empresas} onClose={() => {}} />);
    await cargar(
      archivo(
        "act.csv",
        `nombre,correo,cargo\nNombre Nuevo,${c.correo!.toUpperCase()},Gerente`,
      ),
    );
    await screen.findByText("Previsualizar importación");
    elegir("e1");
    fireEvent.change(screen.getByLabelText("Si el correo ya existe"), {
      target: { value: "actualizar" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Previsualizar importación" }),
    );
    expect(
      await screen.findByText(/0 por crear · 1 por actualizar/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Importar filas válidas" }),
    );
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Confirmar importación" }),
      ).getByRole("button", { name: "Confirmar" }),
    );
    await screen.findByText(/Importación terminada/, { selector: "strong" });
    expect(db.contactos[0].nombre).toBe("Nombre Nuevo");
    expect(db.contactos[0].cargo).toBe("Gerente");
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
    expect(
      (
        db.segmentos.find((x) => x.id === "seg2")!.reglas[0] as {
          valor: string;
        }
      ).valor,
    ).toBe("Candelaria");
  });
});
describe("Pedidos de propuestas a los agentes (extra)", () => {
  it("pide segmentos al agente y el pedido aparece en Segmentos", async () => {
    montar(<Segmentos />, "/segmentos");
    fireEvent.click(
      await screen.findByRole("button", { name: "Pedir propuestas al agente" }),
    );
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/presupuesto de IA/)).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText("Pedido enviado. Siga su avance aquí."),
    ).toBeInTheDocument();
    expect(llamadas.some((u) => u.endsWith("/segmentos/proponer"))).toBe(true);
    expect(
      db.segmentos.some(
        (s) => s.propuestoPor === "agente" && s.estado === "propuesto",
      ),
    ).toBe(true);
  });

  it("solo ofrece pedir secuencia en un segmento aprobado", async () => {
    const { unmount } = montar(<Segmentos />, "/segmentos/seg2");
    await screen.findByRole("button", { name: "Aprobar" });
    expect(
      screen.queryByRole("button", { name: "Pedir secuencia a la IA" }),
    ).toBeNull();
    unmount();
    montar(<Segmentos />, "/segmentos/seg1");
    fireEvent.click(
      await screen.findByRole("button", { name: "Pedir secuencia a la IA" }),
    );
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText(
        "Pedido enviado. La secuencia aparecerá en Secuencias de correo cuando esté lista.",
      ),
    ).toBeInTheDocument();
    const solicitudes = await (
      await route(new Request("http://localhost/api/secuencias/solicitudes"))
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
    montar(<Segmentos />, "/segmentos");
    // Los pedidos de segmentos se ven en Segmentos; los de secuencias, en Secuencias.
    expect(
      await screen.findByText("Pedidos de segmentos al agente"),
    ).toBeInTheDocument();
    expect(screen.getByText("El agente está trabajando")).toBeInTheDocument();
    expect(
      screen.queryByText("No hay contactos elegibles con base legal aprobada"),
    ).toBeNull();
  });
});
