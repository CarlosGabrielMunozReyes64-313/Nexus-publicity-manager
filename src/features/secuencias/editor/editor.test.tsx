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
import { FeedbackProvider } from "../../../components/ui";
import { db, reset, route } from "../../../mocks/handlers";
import { demoIA } from "../../../mocks/secuencias";
import Secuencias from "../Page";
import { copiaLocal } from "./salida";

type Llamada = { metodo: string; ruta: string; cuerpo?: unknown };
let llamadas: Llamada[] = [];
const de = (metodo: string, ruta: string) =>
  llamadas.filter((l) => l.metodo === metodo && l.ruta === ruta);

function Donde() {
  return <p data-testid="ruta">{useLocation().pathname}</p>;
}
function abrir(id = "s2") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/secuencias/${id}`]}>
        <FeedbackProvider>
          <Routes>
            <Route path="/secuencias/*" element={<Secuencias />} />
            <Route path="*" element={<p>Otra pantalla</p>} />
          </Routes>
          <Donde />
        </FeedbackProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const lista = () =>
  screen.getByRole("list", { name: "Correos de la secuencia" });
const titulos = () =>
  within(lista())
    .getAllByRole("listitem")
    .map((li) => li.querySelector("strong")!.textContent);
const cuerpo = () => screen.getByLabelText("Cuerpo") as HTMLTextAreaElement;
const asunto = () => screen.getByLabelText("Asunto") as HTMLInputElement;
const boton = (name: string | RegExp) => screen.getByRole("button", { name });
async function listo(id = "s2") {
  abrir(id);
  await screen.findByRole("list", { name: "Correos de la secuencia" });
  // Revisión y contactos elegibles cargados.
  await screen.findByText(/contactos? elegibles?$/);
}

beforeEach(() => {
  reset();
  demoIA.esperaMs = 0;
  llamadas = [];
  window.localStorage.clear();
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

describe("Editor de secuencias", () => {
  it("abre el borrador con su estado, versión y correos; Guardar empieza desactivado", async () => {
    await listo();
    expect(
      screen.getByRole("textbox", { name: "Nombre de la secuencia" }),
    ).toHaveValue("RSE Express · Proveedores de ingenios · Palmira");
    expect(screen.getByText("Borrador v2 · sin aprobar")).toBeInTheDocument();
    expect(titulos()).toEqual([
      "Correo 1 · día 0",
      "Correo 2 · +4 días hábiles · mismo hilo",
      "Correo 3 · +5 días hábiles · mismo hilo",
    ]);
    expect(boton("Guardar")).toBeDisabled();
    expect(boton("Aprobar")).toBeEnabled();
    expect(
      screen.getByRole("tab", { name: "Correos", selected: true }),
    ).toBeInTheDocument();
  });

  it("agrega, duplica, reordena y elimina correos sin guardar nada", async () => {
    await listo();
    fireEvent.click(boton("Agregar"));
    expect(titulos()).toHaveLength(4);
    expect(
      screen.getByRole("heading", { name: "Correo 4" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument();
    expect(boton("Guardar")).toBeEnabled();

    fireEvent.click(boton("Duplicar"));
    expect(titulos()).toHaveLength(5);

    // Subir el correo 3 lo deja en segundo lugar.
    const asunto3 = within(lista())
      .getAllByRole("listitem")[2]
      .querySelector("small")!.textContent;
    fireEvent.click(boton("Subir el correo 3"));
    expect(
      within(lista()).getAllByRole("listitem")[1].querySelector("small")!
        .textContent,
    ).toBe(asunto3);
    expect(boton("Subir el correo 1")).toBeDisabled();
    expect(boton("Bajar el correo 5")).toBeDisabled();

    fireEvent.click(boton("Eliminar"));
    fireEvent.click(boton("Eliminar"));
    expect(titulos()).toHaveLength(3);
    expect(de("PUT", "/secuencias/s2/borrador")).toHaveLength(0);
  });

  it("inserta una variable donde está el cursor", async () => {
    await listo();
    const area = cuerpo();
    area.focus();
    area.setSelectionRange(0, 0);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Insertar variable" }),
      {
        target: { value: "cargo" },
      },
    );
    expect(cuerpo().value.startsWith("{{cargo}}")).toBe(true);
  });

  it("guarda el borrador con el botón y con Ctrl+S; la versión sube y no se aprueba nada", async () => {
    await listo();
    fireEvent.change(asunto(), {
      target: { value: "Asunto nuevo para {{empresa}}" },
    });
    fireEvent.click(boton("Guardar"));
    expect(
      await screen.findByText("Borrador v3 · sin aprobar"),
    ).toBeInTheDocument();
    const [put] = de("PUT", "/secuencias/s2/borrador");
    const enviado = (
      put.cuerpo as { secuencia: { pasos: { asunto?: string }[] } }
    ).secuencia;
    expect(enviado.pasos[0].asunto).toBe("Asunto nuevo para {{empresa}}");
    expect(enviado).not.toHaveProperty("notasAgente");
    expect(boton("Guardar")).toBeDisabled();

    fireEvent.change(asunto(), {
      target: { value: "Otro asunto para {{empresa}}" },
    });
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(
      await screen.findByText("Borrador v4 · sin aprobar"),
    ).toBeInTheDocument();
    expect(de("POST", "/secuencias/s2/aprobar")).toHaveLength(0);
  });

  it("marca el correo con error y explica por qué no se puede aprobar", async () => {
    await listo();
    fireEvent.change(cuerpo(), {
      target: { value: cuerpo().value.replace("{{baja}}", "") },
    });
    const correo1 = within(lista()).getAllByRole("listitem")[0];
    expect(within(correo1).getByLabelText("1 errores")).toBeInTheDocument();
    expect(screen.getAllByText(/falta \{\{baja\}\}/i).length).toBeGreaterThan(
      0,
    );
    expect(boton("Aprobar")).toBeDisabled();
    expect(boton("Aprobar")).toHaveAttribute(
      "title",
      "Guarda los cambios antes de aprobar",
    );
  });

  it("con la versión aprobada vigente, Aprobar está bloqueado con su motivo", async () => {
    await listo("s1");
    expect(boton("Aprobar cambios")).toBeDisabled();
    expect(boton("Aprobar cambios")).toHaveAttribute(
      "title",
      "No hay cambios para aprobar: la versión aprobada ya está vigente",
    );
    expect(
      screen.getByText(
        "La versión aprobada está vigente: no hay cambios por aprobar.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No se puede aprobar/)).toBeNull();
  });

  it("avisa al editar algo aprobado que se sigue enviando la versión aprobada", async () => {
    await listo("s1");
    expect(
      screen.queryByText(/Lo que estás editando es un borrador/),
    ).toBeNull();
    fireEvent.change(asunto(), { target: { value: "Cambio" } });
    expect(
      screen.getByText(
        "Lo que estás editando es un borrador. Se sigue enviando la versión aprobada hasta que apruebes los cambios.",
      ),
    ).toBeInTheDocument();
  });

  it("pide confirmar antes de salir con cambios sin guardar", async () => {
    await listo();
    fireEvent.change(asunto(), { target: { value: "Cambio sin guardar" } });
    fireEvent.click(screen.getByRole("link", { name: "Volver a la lista" }));
    const dialogo = await screen.findByRole("dialog", {
      name: "Tienes cambios sin guardar",
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Seguir editando" }),
    );
    expect(screen.getByTestId("ruta")).toHaveTextContent("/secuencias/s2");
    expect(asunto()).toHaveValue("Cambio sin guardar");

    fireEvent.click(screen.getByRole("link", { name: "Volver a la lista" }));
    fireEvent.click(
      within(
        await screen.findByRole("dialog", {
          name: "Tienes cambios sin guardar",
        }),
      ).getByRole("button", { name: "Salir sin guardar" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("ruta")).toHaveTextContent(/^\/secuencias$/),
    );
  });

  it("guarda una copia local y la ofrece al volver a abrir", async () => {
    const primera = abrir();
    await screen.findByRole("list", { name: "Correos de la secuencia" });
    fireEvent.change(asunto(), { target: { value: "Recuperado de la copia" } });
    await waitFor(() =>
      expect(copiaLocal.leer("s2")?.contenido.pasos[0].asunto).toBe(
        "Recuperado de la copia",
      ),
    );
    primera.unmount();

    abrir();
    expect(
      await screen.findByText(/Hay cambios sin guardar en este navegador/),
    ).toBeInTheDocument();
    expect(asunto()).not.toHaveValue("Recuperado de la copia");
    fireEvent.click(boton("Recuperar"));
    expect(asunto()).toHaveValue("Recuperado de la copia");
    expect(boton("Guardar")).toBeEnabled();
  });

  it("la vista previa usa un contacto real y los cambios sin guardar", async () => {
    await listo();
    const contacto = screen.getByRole("combobox", { name: "Contacto" });
    const nombre = (
      contacto as HTMLSelectElement
    ).selectedOptions[0].text.split(" · ")[0];
    const previa = () =>
      screen.getByRole("heading", { name: "Vista previa" }).closest("section")!;
    await waitFor(() =>
      expect(
        within(previa()).getByText(new RegExp(`Buenos días, ${nombre}`)),
      ).toBeInTheDocument(),
    );
    fireEvent.change(cuerpo(), {
      target: { value: cuerpo().value.replace("Buenos días", "Hola de nuevo") },
    });
    await waitFor(
      () =>
        expect(
          within(previa()).getByText(new RegExp(`Hola de nuevo, ${nombre}`)),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
    const ultima = de("POST", "/secuencias/s2/previsualizar").at(-1)!;
    expect(ultima.cuerpo).toMatchObject({
      contactoId: contacto.getAttribute("value") ?? expect.any(String),
    });
    expect(de("PUT", "/secuencias/s2/borrador")).toHaveLength(0);
    expect(within(previa()).getByText(/texto de respaldo/)).toBeInTheDocument();
  });

  it("la lista de verificación muestra lo que está bien y lo que conviene revisar", async () => {
    await listo();
    const lista = screen
      .getByRole("heading", { name: "Lista de verificación" })
      .closest("section")!;
    expect(within(lista).getByText("Segmento aprobado")).toBeInTheDocument();
    expect(within(lista).getByText("Gmail conectado")).toBeInTheDocument();
    expect(within(lista).getByText("Lista para aprobar")).toBeInTheDocument();
    expect(within(lista).getAllByLabelText("Revisar").length).toBeGreaterThan(
      0,
    );
  });

  it("el historial compara versiones y restaura una como borrador", async () => {
    await listo();
    fireEvent.click(screen.getByRole("tab", { name: "Historial" }));
    expect(await screen.findByText("2 (borrador)")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "IA" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Tú" })).toBeInTheDocument();
    const comparacion = screen
      .getByRole("heading", { name: "Comparar versiones" })
      .closest("section")!;
    expect(comparacion.querySelectorAll("ins, del").length).toBeGreaterThan(0);

    fireEvent.click(boton("Restaurar como borrador la versión 1"));
    const dialogo = await screen.findByRole("dialog", {
      name: "Restaurar la versión 1 como borrador",
    });
    expect(
      within(dialogo).getByText(/Lo aprobado no cambia/),
    ).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText("Borrador v3 · sin aprobar"),
    ).toBeInTheDocument();
    expect(de("POST", "/secuencias/s2/versiones/1/restaurar")).toHaveLength(1);
  });

  it("el diálogo de aprobar resume la secuencia y deja claro que no envía nada", async () => {
    await listo();
    fireEvent.click(boton("Aprobar"));
    const dialogo = await screen.findByRole("dialog", {
      name: "Aprobar secuencia",
    });
    expect(within(dialogo).getByText("3 correos")).toBeInTheDocument();
    expect(
      within(dialogo).getByText(/contactos elegibles/),
    ).toBeInTheDocument();
    expect(dialogo.textContent).toContain(
      "Aprobar no envía ningún correo. Los envíos empiezan cuando actives la campaña",
    );
    expect(
      within(dialogo).queryByRole("button", { name: "Aprobar y reanudar" }),
    ).toBeNull();
    const antes = [db.interacciones.length, db.pruebas.length];
    fireEvent.click(within(dialogo).getByRole("button", { name: "Aprobar" }));
    await waitFor(() =>
      expect(de("POST", "/secuencias/s2/aprobar")).toHaveLength(1),
    );
    expect(
      await screen.findByText("Borrador v2 · aprobada v2"),
    ).toBeInTheDocument();
    // Aprobar no envía ningún correo.
    expect([db.interacciones.length, db.pruebas.length]).toEqual(antes);
  });

  it("en una campaña activa el diálogo ofrece «Aprobar y reanudar»", async () => {
    await listo("s1");
    fireEvent.change(asunto(), {
      target: { value: "Nuevo asunto para {{empresa}}" },
    });
    fireEvent.click(boton("Guardar"));
    await screen.findByText(/Borrador v\d+ · aprobada v1/);
    await waitFor(() => expect(boton("Aprobar cambios")).toBeEnabled());
    fireEvent.click(boton("Aprobar cambios"));
    const dialogo = await screen.findByRole("dialog", {
      name: "Aprobar cambios",
    });
    expect(
      within(dialogo).getByText(/se pausan sus envíos/),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Aprobar y reanudar" }),
    );
    await waitFor(() =>
      expect(de("POST", "/secuencias/s1/aprobar-y-reanudar")).toHaveLength(1),
    );
    await waitFor(() =>
      expect(db.campanas.find((c) => c.id === "cam1")?.estado).toBe("activa"),
    );
  });

  it("envía una prueba solo al administrador con lo que hay en pantalla", async () => {
    await listo();
    fireEvent.change(asunto(), { target: { value: "Asunto sin guardar" } });
    fireEvent.click(boton("Enviar prueba"));
    const dialogo = await screen.findByRole("dialog", {
      name: "Enviar prueba",
    });
    expect(
      within(dialogo).getByText(/Llega solo a tu correo/),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Enviar prueba" }),
    );
    expect(
      await within(dialogo).findByText(
        "Enviamos 1 correo de prueba a admin@nexus.example.",
      ),
    ).toBeInTheDocument();
    const [p] = de("POST", "/secuencias/s2/prueba");
    expect(p.cuerpo).toMatchObject({
      orden: 1,
      secuencia: {
        pasos: expect.arrayContaining([
          expect.objectContaining({ asunto: "Asunto sin guardar" }),
        ]),
      },
    });
    expect(db.pruebas.at(-1)?.asunto).toBe("[Prueba] Asunto sin guardar");
    expect(de("PUT", "/secuencias/s2/borrador")).toHaveLength(0);
  });

  it("muestra el aviso y desactiva la prueba si Gmail no está conectada", async () => {
    db.integraciones.find((i) => i.id === "gmail")!.estado = "desconectada";
    await listo();
    fireEvent.click(boton("Enviar prueba"));
    const dialogo = await screen.findByRole("dialog", {
      name: "Enviar prueba",
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Enviar prueba" }),
    );
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "Conecte Gmail en Configuración para enviar pruebas",
    );
  });

  it("pedir otra versión a la IA exige un comentario y no toca lo aprobado", async () => {
    await listo();
    fireEvent.click(boton("Más acciones"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Pedir otra versión a la IA" }),
    );
    const dialogo = await screen.findByRole("dialog", {
      name: "Pedir otra versión a la IA",
    });
    const pedir = within(dialogo).getByRole("button", {
      name: "Pedir a la IA",
    });
    expect(pedir).toBeDisabled();
    fireEvent.change(within(dialogo).getByRole("textbox"), {
      target: { value: "Más corto y directo" },
    });
    fireEvent.click(pedir);
    await waitFor(() =>
      expect(de("POST", "/secuencias/s2/otra-version-ia")[0]?.cuerpo).toEqual({
        comentario: "Más corto y directo",
      }),
    );
  });
});

describe("Texto con formato", () => {
  it("convierte variables en fichas y vuelve a {{x}} con la lista blanca", async () => {
    const { aEditor, deEditor } = await import("./CuerpoConFormato");
    const entrada =
      '<p>Hola {{nombre}}, <a href="{{enlace}}">diagnóstico</a></p><script>x()</script><p>{{firma}}<br>{{baja}}</p>';
    const editor = aEditor(entrada);
    expect(editor).toContain('<span data-variable="nombre">{{nombre}}</span>');
    expect(editor).toContain('href="{{enlace}}"');
    expect(editor).not.toContain("script");
    expect(deEditor(editor)).toBe(
      '<p>Hola {{nombre}}, <a href="{{enlace}}">diagnóstico</a></p><p>{{firma}}<br>{{baja}}</p>',
    );
    expect(deEditor('<p><a href="javascript:alert(1)">x</a></p>')).toBe(
      "<p>x</p>",
    );
  });

  it("cambia de formato, muestra el texto simple derivado y previsualiza en un iframe aislado", async () => {
    await listo();
    fireEvent.change(screen.getByRole("combobox", { name: "Formato" }), {
      target: { value: "html" },
    });
    const prosa = await screen.findByRole("textbox", {
      name: "Cuerpo con formato",
    });
    await waitFor(() =>
      expect(prosa.querySelector('[data-variable="nombre"]')).not.toBeNull(),
    );
    expect(prosa.querySelectorAll("p").length).toBeGreaterThan(2);

    fireEvent.click(boton("Ver versión en texto simple"));
    expect(
      screen.getByLabelText("Versión en texto simple").textContent,
    ).toMatch(/^Buenos días, \{\{nombre\}\}:\n\n/);

    fireEvent.change(
      screen.getByRole("combobox", { name: "Insertar variable" }),
      {
        target: { value: "cargo" },
      },
    );
    await waitFor(() =>
      expect(prosa.querySelector('[data-variable="cargo"]')).not.toBeNull(),
    );

    const previa = screen
      .getByRole("heading", { name: "Vista previa" })
      .closest("section")!;
    const iframe = await within(previa).findByTitle(
      "Vista previa del correo 1",
      {},
      { timeout: 3000 },
    );
    expect(iframe.getAttribute("sandbox")).toBe("");
    const srcdoc = iframe.getAttribute("srcdoc")!;
    expect(srcdoc.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(srcdoc).toMatch(/<p>\w*Buenos días, Andrés Felipe Cárdenas:<\/p>/);
    expect(srcdoc).toContain(
      '<a href="https://nexus.example/rse-express">https://nexus.example/rse-express</a>',
    );
    expect(srcdoc).not.toContain("{{");

    fireEvent.click(boton("Guardar"));
    await screen.findByText("Borrador v3 · sin aprobar");
    const [put] = de("PUT", "/secuencias/s2/borrador");
    const p1 = (
      put.cuerpo as {
        secuencia: {
          pasos: { formato?: string; cuerpoHtml?: string; cuerpo: string }[];
        };
      }
    ).secuencia.pasos[0];
    expect(p1.formato).toBe("html");
    expect(p1.cuerpoHtml).toContain("{{cargo}}");
    expect(p1.cuerpoHtml).not.toContain("data-variable");
    expect(p1.cuerpo).toContain("{{cargo}}");

    fireEvent.change(screen.getByRole("combobox", { name: "Formato" }), {
      target: { value: "texto" },
    });
    expect(cuerpo().value).toContain("{{cargo}}");
  });
});

describe("Mejorar con IA", () => {
  it("pide una sugerencia con lo que hay en pantalla, la compara y la usa sin guardar", async () => {
    await listo();
    fireEvent.change(asunto(), { target: { value: "Asunto en pantalla" } });
    const zona = screen.getByRole("region", { name: "Mejorar con IA" });
    fireEvent.click(
      within(zona).getByRole("button", { name: "Mejorar con IA" }),
    );
    const pedir = within(zona).getByRole("button", {
      name: "Pedir sugerencia",
    });
    expect(pedir).toBeDisabled();
    fireEvent.click(within(zona).getByRole("button", { name: "Más corto" }));
    fireEvent.click(pedir);
    await waitFor(() =>
      expect(de("POST", "/secuencias/s2/correos/1/mejorar")).toHaveLength(1),
    );
    const [p] = de("POST", "/secuencias/s2/correos/1/mejorar");
    expect(Object.keys(p.cuerpo as object).sort()).toEqual([
      "instruccion",
      "secuencia",
    ]);
    expect(p.cuerpo).toMatchObject({
      instruccion: "Más corto",
      secuencia: {
        pasos: expect.arrayContaining([
          expect.objectContaining({ asunto: "Asunto en pantalla" }),
        ]),
      },
    });

    const tarjeta = (await within(zona).findByText("Sugerencia lista")).closest(
      "article",
    )!;
    expect(tarjeta.querySelectorAll("ins, del").length).toBeGreaterThan(0);
    expect(within(tarjeta).getByText(/Por qué:/)).toBeInTheDocument();
    const antes = cuerpo().value;
    fireEvent.click(
      within(tarjeta).getByRole("button", { name: "Usar sugerencia" }),
    );
    await waitFor(() => expect(cuerpo().value).not.toBe(antes));
    expect(cuerpo().value).toContain("{{baja}}");
    await waitFor(() =>
      expect(within(zona).queryByText("Sugerencia lista")).toBeNull(),
    );
    expect(llamadas.some((l) => l.metodo === "DELETE")).toBe(true);
    expect(boton("Guardar")).toBeEnabled();
    expect(de("PUT", "/secuencias/s2/borrador")).toHaveLength(0);
  });

  it("descarta una sugerencia y valida la instrucción", async () => {
    await listo();
    const zona = screen.getByRole("region", { name: "Mejorar con IA" });
    fireEvent.click(
      within(zona).getByRole("button", { name: "Mejorar con IA" }),
    );
    fireEvent.change(within(zona).getByRole("textbox"), {
      target: { value: "Más cercano, menos formal" },
    });
    fireEvent.click(
      within(zona).getByRole("button", { name: "Pedir sugerencia" }),
    );
    const tarjeta = (await within(zona).findByText("Sugerencia lista")).closest(
      "article",
    )!;
    const antes = cuerpo().value;
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Descartar" }));
    await waitFor(() =>
      expect(within(zona).queryByText("Sugerencia lista")).toBeNull(),
    );
    expect(cuerpo().value).toBe(antes);
    expect(boton("Guardar")).toBeDisabled();
  });
});
