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
import { useState, type ReactNode } from "react";
import { FeedbackProvider } from "../components/ui";
import { db, reset, route } from "../mocks/handlers";
import NuevoContacto from "./contactos/NuevoContacto";
import { EditorReglas } from "./segmentos/Reglas";
import Envios from "./secuencias/editor/Envios";
import Plantillas from "./plantillas/Page";
import type { ReglaSegmento, Secuencia } from "../types";

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
const llamadas: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
beforeEach(() => {
  reset();
  llamadas.length = 0;
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), location.href);
      llamadas.push({
        metodo: init?.method ?? "GET",
        ruta: url.pathname.replace(/^.*\/api/, ""),
        cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return route(new Request(url, init));
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("Contacto y empresa en la misma pantalla", () => {
  it("crea la empresa nueva con el contacto en una sola operación", async () => {
    montar(<NuevoContacto empresas={db.empresas} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Nora Ficticia" },
    });
    fireEvent.change(screen.getByLabelText("Correo"), {
      target: { value: "nora@nueva.example" },
    });
    fireEvent.click(screen.getByLabelText("Crear empresa"));
    fireEvent.change(screen.getByLabelText("Razón social"), {
      target: { value: "Empresa Nueva Demo" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Crear contacto y empresa" }),
    );
    await waitFor(() =>
      expect(db.contactos.at(-1)?.nombre).toBe("Nora Ficticia"),
    );
    const empresa = db.empresas.find(
      (e) => e.razonSocial === "Empresa Nueva Demo",
    );
    expect(empresa).toBeDefined();
    expect(db.contactos.at(-1)?.empresaId).toBe(empresa!.id);
    const llamada = llamadas.find((l) => l.ruta === "/contactos/con-empresa")!;
    expect(llamada.cuerpo).toMatchObject({
      empresaNueva: { razonSocial: "Empresa Nueva Demo" },
    });
  });
  it("si falla, conserva lo escrito y no crea la empresa", async () => {
    const existente = db.contactos[0].correo!;
    const empresas = db.empresas.length;
    montar(<NuevoContacto empresas={db.empresas} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Repetida" },
    });
    fireEvent.change(screen.getByLabelText("Correo"), {
      target: { value: existente },
    });
    fireEvent.click(screen.getByLabelText("Crear empresa"));
    fireEvent.change(screen.getByLabelText("Razón social"), {
      target: { value: "Otra Empresa Demo" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Crear contacto y empresa" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ya existe un contacto con ese correo",
    );
    expect(screen.getByLabelText("Nombre")).toHaveValue("Repetida");
    expect(screen.getByLabelText("Razón social")).toHaveValue(
      "Otra Empresa Demo",
    );
    expect(db.empresas).toHaveLength(empresas);
  });
  it("busca y elige una empresa existente", async () => {
    const e = db.empresas[0];
    montar(<NuevoContacto empresas={db.empresas} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Con existente" },
    });
    fireEvent.change(screen.getByLabelText("Buscar empresa"), {
      target: { value: e.razonSocial.slice(0, 6) },
    });
    fireEvent.click(
      within(
        screen.getByRole("list", { name: "Empresas encontradas" }),
      ).getAllByRole("button")[0],
    );
    expect(screen.getByText(/Elegida:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear contacto" }));
    await waitFor(() =>
      expect(db.contactos.at(-1)?.nombre).toBe("Con existente"),
    );
  });
});

describe("Segmentos con Y/O", () => {
  it("añade un grupo O dentro de las reglas Y", () => {
    const cambios: ReglaSegmento[][] = [];
    function Prueba() {
      const [r, setR] = useState<ReglaSegmento[]>([
        { campo: "municipio", operador: "es", valor: "Palmira" },
      ]);
      return (
        <EditorReglas
          reglas={r}
          onChange={(x) => {
            cambios.push(x);
            setR(x);
          }}
        />
      );
    }
    montar(<Prueba />);
    fireEvent.click(screen.getByRole("button", { name: "Añadir grupo O" }));
    const ultimo = cambios.at(-1)!;
    expect(ultimo).toHaveLength(2);
    expect(ultimo[1]).toMatchObject({ grupo: "o" });
    // La raíz pasa a O: se guarda como un solo grupo.
    fireEvent.change(screen.getByLabelText("El contacto entra si cumple"), {
      target: { value: "o" },
    });
    expect(cambios.at(-1)).toEqual([
      { grupo: "o", reglas: ultimo, raiz: true },
    ]);
  });
});

describe("Pestaña Envíos (API real simulada)", () => {
  it("distingue programado, aceptado por Gmail y por conciliar, y explica qué falta", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const ruta = new URL(String(input), location.href).pathname;
      if (ruta.endsWith("/envios"))
        return Response.json({
          aprobada: true,
          campanaId: "c1",
          campanaEstado: "activa",
          audiencia: {
            tipo: "lista",
            id: "l1",
            nombre: "Clientes",
            incorporarNuevos: false,
            candidatos: 3,
            elegibles: 2,
            noElegibles: { "Base legal sin aprobar": 1 },
          },
          gmail: { estado: "conectada" },
          trabajador: { vivo: false, ultimoLatido: "2026-11-26T10:00:00Z" },
          cuota: {
            nuevosHoy: 2,
            topeGlobal: 20,
            campanaHoy: 2,
            topeCampana: 20,
          },
          diagnostico: [
            {
              nivel: "error",
              texto: "El trabajador no da señales desde 26/11 05:00",
              accion: "trabajador",
            },
          ],
          destinatarios: [
            {
              inscripcionId: "i1",
              contactoId: "a",
              nombre: "Ana",
              estado: "aceptado",
              texto: "Aceptado por Gmail (correo 1)",
              pasoActual: 2,
              enviadoEn: "2026-11-26T14:00:00Z",
            },
            {
              inscripcionId: "i2",
              contactoId: "b",
              nombre: "Beto",
              estado: "programado",
              texto: "Programado (correo 1)",
              pasoActual: 1,
              proximoEnvio: "2026-11-27T14:00:00Z",
            },
            {
              inscripcionId: "i3",
              contactoId: "c",
              nombre: "Caro",
              estado: "conciliar",
              texto: "Por conciliar",
              pasoActual: 1,
              mensajeId: "m3",
            },
          ],
        });
      if (ruta.endsWith("/conciliar")) return Response.json({ ok: true });
      return Response.json([]);
    });
    const secuencia = {
      id: "s1",
      nombre: "S",
      objetivo: "o",
      llamadaAccion: "l",
      pasos: [],
      metricasExito: [],
      ventanaEnvio: { dias: [1], desde: "08:00", hasta: "10:00" },
      listaId: "l1",
    } as Secuencia;
    montar(<Envios secuencia={secuencia} />);
    expect(
      await screen.findByText(/El trabajador no da señales/),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Aceptado por Gmail").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Programado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Por conciliar").length).toBeGreaterThan(0);
    expect(screen.getByText(/2 elegibles/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sí salió" }),
    ).toBeInTheDocument();
  });
});

describe("Plantillas", () => {
  it("avisa de una variable no admitida antes de guardar", async () => {
    montar(<Plantillas />, "/plantillas/nueva");
    fireEvent.change(await screen.findByLabelText("Nombre"), {
      target: { value: "Mala" },
    });
    fireEvent.change(screen.getByLabelText("Cuerpo"), {
      target: { value: "Hola {{apodo}} {{firma}} {{baja}}" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("{{apodo}}");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});

describe("Plantillas con diseño", () => {
  it("cambia imágenes, inserta filas antes del pie y deriva el texto", async () => {
    const {
      ESQUELETO,
      cambiarImagen,
      htmlATexto,
      imagenesDe,
      imagenHtml,
      insertarFila,
    } = await import("./plantillas/diseno");
    let h = insertarFila(
      ESQUELETO,
      imagenHtml("/img/11111111-0000-4000-8000-000000000002", "Portada"),
    );
    expect(h.indexOf("Portada")).toBeLessThan(h.indexOf("{{firma}}"));
    expect(imagenesDe(h)).toEqual([
      {
        src: "/img/11111111-0000-4000-8000-000000000002",
        alt: "Portada",
        indice: 0,
      },
    ]);
    h = cambiarImagen(h, 0, {
      src: "https://ejemplo.example/x.png",
      alt: 'Otra "imagen"',
    });
    expect(imagenesDe(h)[0]).toMatchObject({
      src: "https://ejemplo.example/x.png",
      alt: "Otra imagen",
    });
    const texto = htmlATexto(h);
    expect(texto).toContain("Hacer el diagnóstico ({{enlace}})");
    expect(texto).toMatch(/\{\{firma\}\}\s+\{\{baja\}\}$/);
  });
  it("una plantilla de la galería no se edita: se usa como base", async () => {
    montar(<Plantillas />, "/plantillas/pl-demo");
    expect(await screen.findByText(/no se modifica/)).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Usar como base" }));
    await waitFor(() =>
      expect(
        llamadas.some((l) => l.ruta === "/plantillas/pl-demo/duplicar"),
      ).toBe(true),
    );
  });
});
