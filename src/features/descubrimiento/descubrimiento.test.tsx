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
import { FeedbackProvider } from "../../components/ui";
import { db, reset, route } from "../../mocks/handlers";
import Descubrimiento from "./Page";

const llamadas: string[] = [];
function abrir() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/descubrimiento"]}>
        <FeedbackProvider>
          <Descubrimiento />
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

const abrirFiltro = (nombre: RegExp) =>
  fireEvent.click(screen.getByRole("button", { name: nombre }));

describe("Descubrimiento", () => {
  it("muestra los resultados en lista, una fila por empresa y sin campos vacíos", async () => {
    const r = db.busquedas[0].resultados[2];
    r.contactoCorporativo = { correo: r.contactoCorporativo.correo };
    abrir();
    const lista = await screen.findByRole("list", {
      name: "Resultados de Fabricantes de empaques",
    });
    const filas = within(lista).getAllByRole("listitem");
    expect(filas).toHaveLength(3);
    expect(lista.closest(".grid")).toBeNull();
    const ultima = filas[2];
    expect(within(ultima).getByText("Cartones del Valle")).toBeInTheDocument();
    expect(ultima.textContent).not.toContain("Tel.");
    expect(ultima.textContent).not.toContain("Formulario");
    expect(
      within(ultima).getByRole("link", { name: "descubierta2.example" }),
    ).toHaveAttribute("href", "https://descubierta2.example");
    expect(
      within(filas[0]).getByRole("button", { name: "Aceptar" }),
    ).toBeEnabled();
    // El posible duplicado se señala en su fila y no se puede aceptar.
    expect(within(filas[1]).getByText("Posible duplicado")).toBeInTheDocument();
    expect(
      within(filas[1]).getByRole("button", { name: "Aceptar" }),
    ).toBeDisabled();
  });

  it("«Marcar todas las casillas» marca y desmarca lo visible en cada filtro", async () => {
    abrir();
    await screen.findByText("Meta de contactos diarios");
    abrirFiltro(/^Sectores:/);
    const todas = screen.getByRole("checkbox", {
      name: "Marcar todas las casillas",
    });
    expect(todas).not.toBeChecked();
    fireEvent.click(todas);
    const total = screen
      .getByRole("listbox")
      .querySelectorAll('input[type="checkbox"]').length;
    expect(
      screen.getByRole("button", { name: /^Sectores:/ }).textContent,
    ).toMatch(new RegExp(`\\+${total - 2}`));
    expect(todas).toBeChecked();
    fireEvent.click(todas);
    expect(
      screen.getByRole("button", { name: /^Sectores:/ }),
    ).toHaveAccessibleName("Sectores: ninguno");

    // Con texto en el buscador, solo marca lo filtrado; luego queda «a medias».
    abrirFiltro(/^Sectores:/); // cierra el de sectores
    abrirFiltro(/^Municipios:/);
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Filtrar Municipios" }),
      {
        target: { value: "pal" },
      },
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Marcar todas las casillas/ }),
    );
    expect(
      screen.getByRole("button", { name: /^Municipios:/ }),
    ).toHaveAccessibleName("Municipios: Palmira");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Filtrar Municipios" }),
      {
        target: { value: "" },
      },
    );
    expect(
      screen.getByRole("checkbox", { name: /Marcar todas las casillas/ }),
    ).toHaveAttribute("aria-checked", "mixed");
  });

  it("avisa cuando una sola búsqueda abarca demasiados tipos y municipios", async () => {
    abrir();
    await screen.findByText("Meta de contactos diarios");
    abrirFiltro(/^¿Qué empresas buscas\?:/);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Marcar todas las casillas" }),
    );
    expect(
      screen.getAllByText(/Una búsqueda lee como máximo 8\s+páginas/)[0],
    ).toBeInTheDocument();
  });

  it("guarda la meta diaria con los filtros de arriba y muestra el avance", async () => {
    abrir();
    expect(await screen.findByText("Apagada")).toBeInTheDocument();
    expect(screen.getByText(/Hoy: \d+ de 20 contactos/)).toBeInTheDocument();
    const encender = screen.getByRole("checkbox", {
      name: "Buscar sola cada día",
    });
    fireEvent.click(encender);
    // Sin tipos elegidos no se puede encender.
    expect(screen.getByRole("alert").textContent).toContain(
      "al menos un tipo de empresa",
    );
    expect(screen.getByRole("button", { name: "Guardar meta" })).toBeDisabled();

    abrirFiltro(/^¿Qué empresas buscas\?:/);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Fabricantes de empaques/ }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Hoteles/ }));
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Meta de contactos diarios" }),
      { target: { value: "12" } },
    );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Tope de búsquedas por día" }),
      { target: { value: "30" } },
    );
    // Palmira y Candelaria vienen elegidos: 2 tipos × 2 municipios.
    expect(
      screen.getByText(
        "Con los filtros de arriba: 4 combinaciones de tipo y municipio.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar meta" }));
    const dialogo = await screen.findByRole("dialog", {
      name: "Encender la meta diaria",
    });
    expect(dialogo.textContent).toContain("(4 combinaciones");
    expect(dialogo.textContent).toContain("hasta 120 créditos al día");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText(/Meta encendida\. La primera búsqueda empieza/),
    ).toBeInTheDocument();
    expect(llamadas).toContain("PUT /descubrimiento/meta");
    expect(db.metaDescubrimiento).toEqual({
      activa: true,
      metaDiaria: 12,
      maxBusquedas: 30,
      tipos: ["Fabricantes de empaques", "Hoteles"],
      municipios: ["Palmira", "Candelaria"],
      sectores: [],
      tamano: "",
    });
    expect(await screen.findByText("Encendida")).toBeInTheDocument();
    expect(screen.getByText(/Hoy: \d+ de 12 contactos/)).toBeInTheDocument();
    expect(
      screen.getByText(/Filtros guardados: Fabricantes de empaques, Hoteles/),
    ).toBeInTheDocument();
  });

  it("al abrir, pone arriba los filtros guardados de la meta y puede volver a ellos", async () => {
    db.metaDescubrimiento = {
      ...db.metaDescubrimiento,
      activa: true,
      tipos: ["Hoteles"],
      municipios: ["Cali"],
    };
    abrir();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /^Municipios:/ }),
      ).toHaveAccessibleName("Municipios: Cali"),
    );
    expect(
      screen.getByRole("button", { name: /^¿Qué empresas buscas\?:/ }),
    ).toHaveAccessibleName("¿Qué empresas buscas?: Hoteles");
    // Con la meta encendida y sus filtros arriba, no hay avisos falsos.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Poner los filtros guardados arriba",
      }),
    ).toBeNull();
    // Si cambia los filtros, puede volver a los guardados.
    abrirFiltro(/^Municipios:/);
    fireEvent.click(screen.getByRole("checkbox", { name: /Palmira/ }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Poner los filtros guardados arriba",
      }),
    );
    expect(
      screen.getByRole("button", { name: /^Municipios:/ }),
    ).toHaveAccessibleName("Municipios: Cali");
  });

  it("las búsquedas de la meta llevan su etiqueta y las filas ya decididas no muestran botones", async () => {
    db.busquedas[0].meta = true;
    db.busquedas[0].resultados[0].estado = "aceptado";
    abrir();
    const lista = await screen.findByRole("list", {
      name: "Resultados de Fabricantes de empaques",
    });
    expect(screen.getByText("Meta diaria")).toBeInTheDocument();
    const [aceptada, pendiente] = within(lista).getAllByRole("listitem");
    expect(
      within(aceptada).queryByRole("button", { name: "Aceptar" }),
    ).toBeNull();
    expect(
      within(aceptada).queryByRole("button", { name: "Descartar" }),
    ).toBeNull();
    expect(
      within(pendiente).getByRole("button", { name: "Descartar" }),
    ).toBeEnabled();
  });
});
