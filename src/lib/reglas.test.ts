import { describe, it, expect } from "vitest";
import { crearDatos } from "../mocks/data";
import {
  puedeInscribir,
  motivoInscripcion,
  trasEditarCampana,
  datoMetrico,
  parseCSV,
  coincide,
  validarSecuencia,
} from "./reglas";
import { fecha, moneda, porcentaje } from "./formato";
describe("Reglas de elegibilidad", () => {
  it("exige base legal aprobada y no pendiente", () => {
    const c = crearDatos().contactos[1];
    expect(puedeInscribir(c)).toBe(true);
    expect(
      puedeInscribir({
        ...c,
        baseLegal: { tipo: "pendiente", aprobadaPorAdmin: true },
      }),
    ).toBe(false);
    expect(
      puedeInscribir({
        ...c,
        baseLegal: { ...c.baseLegal, aprobadaPorAdmin: false },
      }),
    ).toBe(false);
  });
  it("bloquea correos riesgosos, inválidos, catch-all y desconocidos", () => {
    const c = crearDatos().contactos[1];
    for (const estadoCorreo of [
      "riesgoso",
      "invalido",
      "desconocido",
      "catch_all",
    ] as const)
      expect(puedeInscribir({ ...c, estadoCorreo })).toBe(false);
  });
  it("bloquea exclusiones y supresiones de correo o dominio sin distinguir mayúsculas", () => {
    const c = crearDatos().contactos[1];
    expect(puedeInscribir({ ...c, excluido: true })).toBe(false);
    expect(
      motivoInscripcion(c, [
        { id: "s", correo: c.correo!.toUpperCase(), motivo: "baja", fecha: "" },
      ]),
    ).toBe("Correo o dominio suprimido");
    expect(
      puedeInscribir(c, [
        { id: "s", dominio: "EMPRESA1.EXAMPLE", motivo: "baja", fecha: "" },
      ]),
    ).toBe(false);
  });
  it("edición invalida la aprobación y su huella", () => {
    const c = { ...crearDatos().campanas[0], huellaAprobada: "old" };
    const next = trasEditarCampana(c);
    expect(next.estado).toBe("en_revision");
    expect(next.versionAprobada).toBeUndefined();
    expect(next.huellaAprobada).toBeUndefined();
    expect(c.estado).toBe("activa");
  });
  it("distingue cero real de ausencia de datos", () => {
    expect(datoMetrico(0)).toBe("0");
    expect(datoMetrico(null)).toBe("Sin datos");
    expect(datoMetrico()).toBe("Sin datos");
    expect(porcentaje(0, 0)).toBe("Sin datos");
    expect(porcentaje(0, 10)).toBe("0.0 %");
  });
  it("evalúa segmentos combinando criterios y selección exacta", () => {
    const d = crearDatos();
    expect(
      coincide(d.contactos[0], d.empresas, [
        { campo: "municipio", operador: "es", valor: "Palmira" },
      ]),
    ).toBe(true);
    expect(
      coincide(d.contactos[0], d.empresas, [
        { campo: "contactoIds", operador: "es", valor: "c2,c3" },
      ]),
    ).toBe(false);
  });
  it("valida firma y baja en todos los pasos", () => {
    const s = crearDatos().secuencias[0];
    expect(validarSecuencia(s)).toEqual([]);
    s.pasos[1].cuerpo = "Mensaje de prueba sin firma ni baja";
    expect(validarSecuencia(s)).toHaveLength(2);
  });
});
describe("Formateo Colombia y CSV", () => {
  it("usa Bogotá al cambiar de día UTC", () => {
    expect(fecha("2026-11-13T02:00:00Z")).toBe("12/11/2026");
    expect(moneda(1500000)).toContain("1.500.000");
    expect(moneda(undefined)).toBe("Sin datos");
  });
  it("lee comas escapadas, CRLF y saltos dentro de comillas", () => {
    expect(
      parseCSV(
        'nombre,correo\r\n"Pérez, Ana",ana@demo.example\r\n"Dos\nlíneas",b@demo.example',
      ),
    ).toEqual([
      ["nombre", "correo"],
      ["Pérez, Ana", "ana@demo.example"],
      ["Dos\nlíneas", "b@demo.example"],
    ]);
    expect(() => parseCSV('"abierto')).toThrow();
  });
});
