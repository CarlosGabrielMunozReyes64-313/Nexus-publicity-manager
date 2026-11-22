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
import * as S from "../../api/schemas";
import { db, reset, route } from "../../mocks/handlers";
import { demoRutas } from "../../mocks/rutas";
import Propuestas from "./Page";
import Secuencias from "../secuencias/Page";
import { intervaloSolicitudes } from "./Solicitudes";
import { cuerpoSolicitud, formularioRutaSchema } from "./PedirRuta";
import { diferencia, diasDeEnvio, tituloCorreo } from "./ruta";

type Llamada = { metodo: string; ruta: string; cuerpo?: unknown };
let llamadas: Llamada[] = [];
function montar(children: ReactNode, path = "/propuestas") {
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
const api = async (ruta: string, method = "GET", body?: unknown) =>
  route(
    new Request("http://localhost/api" + ruta, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    }),
  );
beforeEach(() => {
  reset();
  demoRutas.esperaMs = 0;
  llamadas = [];
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const r = new Request(new URL(String(input), location.href), init);
      const cuerpo =
        init?.body && typeof init.body === "string"
          ? JSON.parse(init.body)
          : undefined;
      llamadas.push({
        metodo: r.method,
        ruta: new URL(r.url).pathname.replace(/^\/api/, ""),
        cuerpo,
      });
      return route(r);
    },
  );
});
afterEach(() => {
  demoRutas.esperaMs = 6000;
  vi.unstubAllGlobals();
});

describe("Pedir una ruta de correos", () => {
  it("el esquema del formulario valida objetivo, número de correos y notas", () => {
    const base = {
      segmentoId: "seg1",
      objetivo: "rse",
      numeroCorreos: 3,
      notas: "",
    };
    expect(formularioRutaSchema.safeParse(base).success).toBe(true);
    expect(
      formularioRutaSchema.safeParse({ ...base, numeroCorreos: 6 }).success,
    ).toBe(false);
    expect(
      formularioRutaSchema.safeParse({ ...base, notas: "x".repeat(501) })
        .success,
    ).toBe(false);
    expect(
      formularioRutaSchema.safeParse({ ...base, objetivo: "otro" }).success,
    ).toBe(false);
    expect(
      cuerpoSolicitud(
        formularioRutaSchema.parse({
          ...base,
          objetivo: "otro",
          objetivoOtro: "  Invitar al taller de proveedores ",
          notas: " Mencionar Palmira ",
        }),
      ),
    ).toEqual({
      segmentoId: "seg1",
      objetivo: "Invitar al taller de proveedores",
      numeroCorreos: 3,
      notas: "Mencionar Palmira",
    });
  });

  it("valida en pantalla, envía y cierra con el mensaje", async () => {
    montar(<Propuestas />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Pedir una ruta de correos/ }),
    );
    const dialogo = await screen.findByRole("dialog");
    const segmento = within(dialogo).getByLabelText("Segmento");
    await waitFor(() => expect(segmento).toHaveValue("seg3"));
    // Solo segmentos aprobados, con su número de elegibles.
    expect(
      within(dialogo).getByRole("option", {
        name: /Proveedores del Valle · \d+ elegibles/,
      }),
    ).toBeInTheDocument();
    expect(
      within(dialogo).queryByRole("option", { name: /Industria de Palmira/ }),
    ).toBeNull();
    expect(
      within(dialogo).getByLabelText(
        "Que completen el diagnóstico RSE Express",
      ),
    ).toBeChecked();
    expect(within(dialogo).getByLabelText("Número de correos")).toHaveValue(3);

    fireEvent.click(within(dialogo).getByLabelText("Otro"));
    fireEvent.change(within(dialogo).getByLabelText("Número de correos"), {
      target: { value: "7" },
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Pedir la ruta" }),
    );
    expect(
      await within(dialogo).findByText(
        "Describa el objetivo en 5 a 200 caracteres",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByText("Entre 2 y 5 correos"),
    ).toBeInTheDocument();
    expect(llamadas.some((l) => l.ruta === "/propuestas/rutas-correo")).toBe(
      false,
    );

    fireEvent.click(
      within(dialogo).getByLabelText("Agendar una llamada de 20 minutos"),
    );
    fireEvent.change(within(dialogo).getByLabelText("Número de correos"), {
      target: { value: "4" },
    });
    fireEvent.change(within(dialogo).getByLabelText(/Notas para el agente/), {
      target: { value: "Mencionar los ingenios" },
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Pedir la ruta" }),
    );
    expect(
      await screen.findByText(
        "El agente está preparando la ruta. Aparecerá aquí en unos minutos",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const envio = llamadas.find((l) => l.ruta === "/propuestas/rutas-correo");
    expect(envio?.cuerpo).toEqual({
      segmentoId: "seg3",
      objetivo: "Agendar una llamada de 20 minutos",
      numeroCorreos: 4,
      notas: "Mencionar los ingenios",
    });
  });

  it("muestra en el diálogo el error del servidor", async () => {
    await api("/propuestas/rutas-correo", "POST", {
      segmentoId: "seg3",
      objetivo: "Que completen el diagnóstico RSE Express",
    });
    demoRutas.esperaMs = 60000; // la primera sigue en preparación
    await api("/propuestas/rutas-correo", "POST", {
      segmentoId: "seg1",
      objetivo: "Que completen el diagnóstico RSE Express",
    });
    montar(<Propuestas />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Pedir una ruta de correos/ }),
    );
    const dialogo = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(dialogo).getByLabelText("Segmento")).toHaveValue("seg3"),
    );
    fireEvent.change(within(dialogo).getByLabelText("Segmento"), {
      target: { value: "seg1" },
    });
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Pedir la ruta" }),
    );
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "Ya hay una ruta en preparación para este segmento",
    );
  });
});

describe("Lista de propuestas", () => {
  it("filtra por rutas de correo por defecto y muestra los datos de cada ruta", async () => {
    montar(<Propuestas />);
    const tarjeta = (
      await screen.findByText("RSE Express · Industria local")
    ).closest("section")!;
    expect(within(tarjeta).getByText("Espera tu revisión")).toBeInTheDocument();
    expect(
      within(tarjeta).getByText("Segmento: Proveedores de ingenios · Palmira"),
    ).toBeInTheDocument();
    expect(within(tarjeta).getByText("3 correos")).toBeInTheDocument();
    expect(within(tarjeta).getByText("9 días hábiles")).toBeInTheDocument();
    expect(
      await within(tarjeta).findByText(/\d+ elegibles?$/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Revisar tamaño de Empaques Samán")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Rutas de correo" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Otras propuestas" }));
    expect(
      await screen.findByText("Revisar tamaño de Empaques Samán"),
    ).toBeInTheDocument();
    expect(screen.queryByText("RSE Express · Industria local")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    expect(
      screen.getByText("RSE Express · Industria local"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Revisar tamaño de Empaques Samán"),
    ).toBeInTheDocument();
  });

  it("muestra las solicitudes con el motivo del fallo y permite reintentar", async () => {
    montar(<Propuestas />);
    const panel = (await screen.findByText("Solicitudes en curso")).closest(
      "section",
    )!;
    expect(
      within(panel).getByText(
        "La ruta propuesta no cumple: Se pidieron 3 correos y la ruta tiene 2",
      ),
    ).toBeInTheDocument();
    expect(within(panel).getByText("No se pudo completar")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Reintentar" }));
    await waitFor(() =>
      expect(
        llamadas.some(
          (l) =>
            l.metodo === "POST" &&
            l.ruta === "/propuestas/solicitudes/sol-fallida/reintentar",
        ),
      ).toBe(true),
    );
    // La solicitud nueva aparece junto a la fallida (el agente simulado ya terminó).
    await waitFor(() =>
      expect(
        within(panel).getAllByText("Ruta para «Proveedores del Valle»"),
      ).toHaveLength(2),
    );
    expect(await within(panel).findByText("Ver la ruta →")).toBeInTheDocument();
  });

  it("consulta cada 15 s solo mientras hay solicitudes en cola o en proceso", () => {
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

describe("Detalle de una ruta", () => {
  it("muestra notas, línea de tiempo, verificación y vista previa con un contacto real", async () => {
    montar(<Propuestas />, "/propuestas/pr3");
    expect(await screen.findByText("Por qué esta ruta")).toBeInTheDocument();
    expect(
      screen.getByText(/reúne 8 contactos elegibles de empresas que venden/),
    ).toBeInTheDocument();
    expect(screen.getByText("Correo 1 · día 0")).toBeInTheDocument();
    expect(
      screen.getByText("Correo 2 · día 4 hábil · mismo hilo"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Correo 3 · día 9 hábil · mismo hilo"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Editado por el administrador"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Presentar el problema y el diagnóstico gratuito"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/\d+ palabras/)).toHaveLength(3);
    // Variables resaltadas como etiquetas.
    expect(screen.getAllByText("{{nombre}}").length).toBeGreaterThan(2);
    expect(
      screen.getByText(/Versión 2 · Administrador/, { selector: "small" }),
    ).toBeInTheDocument();

    const verificacion = (
      await screen.findByText("Lista de verificación")
    ).closest("section")!;
    expect(
      await within(verificacion).findByText("Lista para aprobar"),
    ).toBeInTheDocument();
    expect(
      within(verificacion).getByText("Segmento aprobado"),
    ).toBeInTheDocument();

    const previa = screen
      .getByText("Ver con un contacto real")
      .closest("section")!;
    const selector = await within(previa).findByLabelText("Contacto elegible");
    const primero = (selector as HTMLSelectElement).options[0].value;
    expect(selector).toHaveValue(primero);
    expect(await within(previa).findByText("Correo 1")).toBeInTheDocument();
    expect(within(previa).queryByText(/\{\{nombre\}\}/)).toBeNull();
    const pedido = llamadas.find(
      (l) => l.ruta === "/propuestas/pr3/previsualizar",
    );
    expect(pedido?.cuerpo).toEqual({ contactoId: primero, version: 2 });
  });

  it("deshabilita Aprobar con su motivo y lo coincide con el servidor", async () => {
    db.segmentos.find((s) => s.id === "seg3")!.estado = "propuesto";
    montar(<Propuestas />, "/propuestas/pr3");
    expect(
      await screen.findByText(
        "No se puede aprobar: El segmento requiere aprobación",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprobar ruta" })).toBeDisabled();
    const r = await api("/propuestas/pr3/aprobar", "POST", {});
    expect(r.status).toBe(400);
    expect((await r.json()).message).toBe("El segmento requiere aprobación");
  });

  it("aprobar resume la ruta, avisa que no envía y deja la campaña aprobada", async () => {
    const inscripciones = db.inscripciones.length;
    montar(<Propuestas />, "/propuestas/pr3");
    const boton = await screen.findByRole("button", { name: "Aprobar ruta" });
    await waitFor(() => expect(boton).toBeEnabled());
    fireEvent.click(boton);
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveTextContent("Versión 2");
    expect(dialogo).toHaveTextContent("3 correos");
    expect(dialogo).toHaveTextContent("Duración: 9 días hábiles");
    expect(dialogo).toHaveTextContent("Mar, Mié, Jue · 08:00–10:30");
    expect(dialogo).toHaveTextContent("Tope diario: 15");
    expect(dialogo).toHaveTextContent(
      "Aprobar no envía ningún correo. Los envíos empiezan cuando actives la campaña en Campañas",
    );
    expect(
      within(dialogo).getByRole("link", { name: "Ir a la campaña" }),
    ).toHaveAttribute("href", "/campanas/cam2");
    expect(dialogo).not.toHaveTextContent("demostración");
    fireEvent.click(
      within(dialogo).getByRole("button", { name: "Aprobar ruta" }),
    );
    await waitFor(() =>
      expect(db.campanas.find((c) => c.id === "cam2")!.estado).toBe("aprobada"),
    );
    expect(db.inscripciones).toHaveLength(inscripciones);
    // La secuencia queda igual a la versión aprobada (la del administrador).
    const s2 = db.secuencias.find((s) => s.id === "s2")!;
    expect(s2.pasos[1].cuerpo).toMatch(/ingenios/);
  });

  it("compara dos versiones correo por correo y restaura una", async () => {
    montar(<Propuestas />, "/propuestas/pr3");
    const historial = (
      await screen.findByText("Historial de versiones")
    ).closest("section")!;
    expect(within(historial).getByLabelText("Versión anterior")).toHaveValue(
      "1",
    );
    expect(within(historial).getByLabelText("Versión nueva")).toHaveValue("2");
    expect(
      within(historial).getByRole("heading", {
        name: "Correo 1 · sin cambios",
      }),
    ).toBeInTheDocument();
    const correo2 = within(historial).getByRole("region", {
      name: "Comparación del correo 2",
    });
    expect(
      within(correo2).getByRole("heading", { name: "Correo 2 · con cambios" }),
    ).toBeInTheDocument();
    expect(correo2.querySelectorAll("ins").length).toBeGreaterThan(0);
    expect(correo2.querySelectorAll("del").length).toBeGreaterThan(0);
    expect(
      within(correo2).getByText(/ingenios/, { selector: "ins" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(historial).getByRole("button", {
        name: "Restaurar esta versión (1)",
      }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    expect(
      await screen.findByText(
        "Se creó la versión 3 con el contenido de la versión 1.",
      ),
    ).toBeInTheDocument();
    const p = db.propuestas.find((x) => x.id === "pr3")!;
    expect(p.version).toBe(3);
    expect(p.versiones.at(-1)).toMatchObject({ autor: "admin" });
    expect(p.versiones.at(-1)!.contenido).toEqual(p.versiones[0].contenido);
  });

  it("rechazar exige comentario y pide una versión nueva solo si se deja marcado", async () => {
    montar(<Propuestas />, "/propuestas/pr3");
    fireEvent.click(await screen.findByRole("button", { name: "Rechazar" }));
    const dialogo = screen.getByRole("dialog");
    const confirmar = within(dialogo).getByRole("button", { name: "Rechazar" });
    expect(confirmar).toBeDisabled();
    const casilla = within(dialogo).getByLabelText(
      "Pedir al agente una versión nueva con este comentario",
    );
    expect(casilla).toBeChecked();
    fireEvent.change(within(dialogo).getByLabelText(/Comentario/), {
      target: { value: "Más corto el primero" },
    });
    fireEvent.click(confirmar);
    await waitFor(() =>
      expect(
        db.propuestas.find((x) => x.id === "pr3")!.versiones[1],
      ).toMatchObject({
        decision: "rechazada",
        comentario: "Más corto el primero",
      }),
    );
    const envio = llamadas.find((l) => l.ruta === "/propuestas/pr3/rechazar");
    expect(envio?.cuerpo).toEqual({
      comentario: "Más corto el primero",
      pedirNuevaVersion: true,
    });
    const solicitudes = S.solicitudRutaSchema
      .array()
      .parse(await (await api("/propuestas/solicitudes")).json());
    expect(solicitudes[0]).toMatchObject({
      tipo: "revisar_campana",
      estado: "lista",
      propuestaId: "pr3",
    });
    // El agente simulado ya respondió con la versión 3, escrita por él.
    const nueva = db.propuestas.find((x) => x.id === "pr3")!;
    expect(nueva).toMatchObject({ version: 3, estado: "pendiente" });
    expect(nueva.versiones.at(-1)).toMatchObject({ autor: "agente" });
  });

  it("rechazar sin pedir versión nueva no crea solicitud", async () => {
    montar(<Propuestas />, "/propuestas/pr3");
    fireEvent.click(await screen.findByRole("button", { name: "Rechazar" }));
    const dialogo = screen.getByRole("dialog");
    fireEvent.click(
      within(dialogo).getByLabelText(
        "Pedir al agente una versión nueva con este comentario",
      ),
    );
    fireEvent.change(within(dialogo).getByLabelText(/Comentario/), {
      target: { value: "No es el momento" },
    });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Rechazar" }));
    await waitFor(() =>
      expect(db.propuestas.find((x) => x.id === "pr3")!.estado).toBe(
        "rechazada",
      ),
    );
    const solicitudes = await (await api("/propuestas/solicitudes")).json();
    expect(
      solicitudes.some((s: { tipo: string }) => s.tipo === "revisar_campana"),
    ).toBe(false);
  });

  it("editar usa el editor compartido, valida mientras se escribe y crea una versión", async () => {
    montar(<Propuestas />, "/propuestas/pr3");
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    const cuerpos = await screen.findAllByLabelText("Cuerpo");
    expect(cuerpos).toHaveLength(3);
    fireEvent.change(cuerpos[1], {
      target: {
        value: "Hola {{nombre}}, texto nuevo del administrador sin pie.",
      },
    });
    expect(screen.getByText("Paso 2: falta {{baja}}")).toBeInTheDocument();
    const guardar = screen.getByRole("button", {
      name: "Guardar versión nueva",
    });
    expect(guardar).toBeDisabled();
    fireEvent.change(cuerpos[1], {
      target: {
        value:
          "Hola {{nombre}}, texto nuevo del administrador.\n{{firma}}\n{{baja}}",
      },
    });
    await waitFor(() => expect(guardar).toBeEnabled());
    fireEvent.click(guardar);
    expect(
      await screen.findByText(
        "Se creó la versión 3. La campaña queda en revisión hasta que la apruebes",
      ),
    ).toBeInTheDocument();
    const envio = llamadas.find(
      (l) => l.metodo === "PUT" && l.ruta === "/propuestas/pr3",
    );
    expect(
      (envio?.cuerpo as { contenido: { pasos: { cuerpo: string }[] } })
        .contenido.pasos[1].cuerpo,
    ).toMatch(/texto nuevo del administrador/);
    const p = db.propuestas.find((x) => x.id === "pr3")!;
    expect(p.versiones.at(-1)).toMatchObject({ version: 3, autor: "admin" });
    const notas = (
      p.versiones.at(-1)!.contenido as {
        notasAgente: { pasos: { editadoPorAdmin?: boolean }[] };
      }
    ).notasAgente;
    expect(notas.pasos[1].editadoPorAdmin).toBe(true);
    expect(notas.pasos[0].editadoPorAdmin).toBeUndefined();
  });

  it("si el contenido no es una ruta, lo muestra tal cual", async () => {
    db.propuestas.find((x) => x.id === "pr3")!.versiones[1].contenido =
      "Texto libre sin estructura";
    montar(<Propuestas />, "/propuestas/pr3");
    expect(
      await screen.findByText(/no tiene el formato de una ruta de correos/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('"Texto libre sin estructura"').length,
    ).toBeGreaterThan(0);
  });
});

describe("Editor compartido en Secuencias", () => {
  it("funciona igual: valida, vista previa con el primer contacto y guarda con confirmación", async () => {
    montar(<Secuencias />, "/secuencias/s1/editar");
    const asunto = await screen.findByLabelText("Asunto");
    expect(
      screen.getByText(
        "Este cambio devuelve la campaña a revisión y pausa los envíos pendientes.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(asunto, { target: { value: "" } });
    expect(screen.getByText("Paso 1: falta asunto")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar y enviar a revisión" }),
    ).toBeDisabled();
    fireEvent.change(asunto, { target: { value: "Asunto nuevo" } });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Guardar y enviar a revisión" }),
      ).toBeEnabled(),
    );
    const contacto = await screen.findByLabelText("Contacto");
    await waitFor(() => expect(contacto).toHaveValue(db.contactos[0].id));
    fireEvent.click(
      screen.getByRole("button", { name: "Generar vista previa" }),
    );
    // «Paso 1» aparece en el editor y en la vista previa.
    await waitFor(() => expect(screen.getAllByText("Paso 1")).toHaveLength(2));
    expect(
      llamadas.find((l) => l.ruta === "/secuencias/s1/previsualizar")?.cuerpo,
    ).toEqual({ contactoId: db.contactos[0].id });
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar y enviar a revisión" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Confirmar",
      }),
    );
    await waitFor(() =>
      expect(db.secuencias[0].pasos[0].asunto).toBe("Asunto nuevo"),
    );
  });
});

describe("Contrato de las rutas nuevas (Zod)", () => {
  it("las respuestas del modo demostración cumplen los esquemas", async () => {
    const json = async (ruta: string, method = "GET", body?: unknown) =>
      (await api(ruta, method, body)).json();
    S.solicitudRutaSchema.array().parse(await json("/propuestas/solicitudes"));
    S.segmentoRutaSchema
      .array()
      .parse(await json("/propuestas/rutas-correo/segmentos"));
    S.revisionRutaSchema.parse(await json("/propuestas/pr3/revision"));
    const elegibles = S.contactoElegibleSchema
      .array()
      .parse(await json("/propuestas/pr3/elegibles"));
    S.vistaPreviaSchema.parse(
      await json("/propuestas/pr3/previsualizar", "POST", {
        contactoId: elegibles[0].id,
      }),
    );
    const p = S.propuestaSchema.parse(await json("/propuestas/pr3"));
    expect(p.ruta?.segmentoNombre).toBe("Proveedores de ingenios · Palmira");
    for (const v of p.versiones)
      expect(S.rutaCorreoSchema.safeParse(v.contenido).success).toBe(true);
    S.okSchema.parse(
      await json("/propuestas/rutas-correo", "POST", {
        segmentoId: "seg1",
        objetivo: "Que completen el diagnóstico RSE Express",
      }),
    );
    S.versionCreadaSchema.parse(
      await json("/propuestas/pr3/restaurar", "POST", { version: 1 }),
    );
  });
});

describe("Utilidades de la ruta", () => {
  it("calcula los días de envío y los títulos de cada correo", () => {
    const dias = diasDeEnvio([
      { esperaDiasHabiles: 0 },
      { esperaDiasHabiles: 4 },
      { esperaDiasHabiles: 5 },
    ]);
    expect(dias).toEqual([0, 4, 9]);
    expect(tituloCorreo(0, 0, false)).toBe("Correo 1 · día 0");
    expect(tituloCorreo(1, 4, true)).toBe(
      "Correo 2 · día 4 hábil · mismo hilo",
    );
  });
  it("marca lo agregado y lo quitado palabra por palabra", () => {
    expect(
      diferencia("Hola equipo de ventas", "Hola equipo de compras"),
    ).toEqual([
      { tipo: "igual", texto: "Hola equipo de " },
      { tipo: "quitado", texto: "ventas" },
      { tipo: "agregado", texto: "compras" },
    ]);
  });
});
