import { beforeEach, describe, it, expect } from "vitest";
import { route, reset, db } from "./handlers";
import * as S from "../api/schemas";
async function call(path: string, method = "GET", body?: unknown) {
  return route(
    new Request("http://localhost/api" + path, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    }),
  );
}
beforeEach(reset);
describe("Flujos del contrato mock", () => {
  it("aprobar propuesta cambia campaña, versión y auditoría", async () => {
    const result = await call("/propuestas/pr3/aprobar", "POST", {});
    expect(result.ok).toBe(true);
    expect(db.campanas[1].estado).toBe("aprobada");
    expect(db.campanas[1].versionAprobada).toBe(2);
    expect(db.auditoria).toHaveLength(51);
  });
  it("editar secuencia pausa inscripciones y revoca aprobación", async () => {
    const result = await call("/secuencias/s1", "PUT", {
      ...db.secuencias[0],
      nombre: "Nueva versión",
    });
    expect(result.ok).toBe(true);
    expect(db.campanas[0].estado).toBe("en_revision");
    expect(db.campanas[0].versionAprobada).toBeUndefined();
    expect(db.inscripciones.every((i) => i.estado === "pausada")).toBe(true);
  });
  it("rechazo sin motivo no muta estado", async () => {
    const r = await call("/propuestas/pr1/rechazar", "POST", {
      comentario: "",
    });
    expect(r.status).toBe(400);
    expect(db.propuestas[0].estado).toBe("pendiente");
    expect(db.auditoria).toHaveLength(50);
  });
  it("importa CSV mapeado sin duplicados ni aprobación implícita", async () => {
    const c = {
      ...db.contactos[0],
      id: "nuevo",
      nombre: "Importación ejemplo",
      correo: "importada@demo.example",
    };
    const r = await call("/contactos/importar", "POST", {
      contactos: [c, c, db.contactos[0]],
    });
    expect(r.ok).toBe(true);
    expect(db.contactos).toHaveLength(61);
    expect(db.contactos.at(-1)?.baseLegal.aprobadaPorAdmin).toBe(false);
  });
  it("aceptar descubrimiento crea empresa y contacto no elegible", async () => {
    const r = await call("/descubrimiento/resultados/d1/aceptar", "POST", {});
    expect(r.ok).toBe(true);
    expect(db.empresas).toHaveLength(26);
    expect(db.contactos).toHaveLength(61);
    expect(db.contactos.at(-1)?.baseLegal.aprobadaPorAdmin).toBe(false);
    expect(db.contactos.at(-1)?.estadoCorreo).toBe("desconocido");
    expect(
      (await call("/descubrimiento/resultados/d1/aceptar", "POST", {})).status,
    ).toBe(400);
  });
  it("bloquea posible duplicado sin fusión previa", async () => {
    expect(
      (await call("/descubrimiento/resultados/d2/aceptar", "POST", {})).status,
    ).toBe(400);
    expect(db.empresas).toHaveLength(25);
  });
  it("baja suprime y bloquea respuestas posteriores", async () => {
    expect(
      (await call("/respuestas/r1", "PATCH", { clasificacion: "baja" })).ok,
    ).toBe(true);
    expect(db.contactos[0].excluido).toBe(true);
    expect(db.respuestas[0].estado).toBe("atendida");
    expect(
      db.inscripciones
        .filter((i) => i.contactoId === "c1")
        .every((i) => i.estado === "finalizada"),
    ).toBe(true);
    expect(
      (
        await call("/respuestas/r1/enviar-respuesta", "POST", {
          texto: "Hola de nuevo",
        })
      ).status,
    ).toBe(400);
  });
  it("empresa cliente retira todos sus contactos", async () => {
    await call("/oportunidades/o1", "PATCH", { etapa: "cliente" });
    expect(db.empresas[0].estadoCuenta).toBe("cliente");
    expect(
      db.inscripciones
        .filter((i) => ["c1", "c2", "c3"].includes(i.contactoId))
        .every((i) => i.motivoSalida === "cliente"),
    ).toBe(true);
  });
  it("inscribir exige elegibilidad y campaña aprobada", async () => {
    expect(
      (await call("/campanas/cam2/inscribir", "POST", ["c2"])).status,
    ).toBe(400);
    expect(
      (await call("/campanas/cam1/inscribir", "POST", ["c3"])).status,
    ).toBe(400);
    expect((await call("/campanas/cam1/inscribir", "POST", ["c2"])).ok).toBe(
      true,
    );
  });
  it("una edición de propuesta crea versión nueva", async () => {
    await call("/propuestas/pr3/aprobar", "POST", {});
    await call("/propuestas/pr3", "PUT", {
      resumen: "Nueva propuesta de campaña territorial",
    });
    expect(db.propuestas[2].version).toBe(3);
    expect(db.propuestas[2].versiones).toHaveLength(3);
    expect(db.campanas[1].estado).toBe("en_revision");
  });
  it("todos los datos de ejemplo cumplen sus esquemas", () => {
    S.empresaSchema.array().parse(db.empresas);
    S.contactoSchema.array().parse(db.contactos);
    S.campanaSchema.array().parse(db.campanas);
    S.propuestaSchema.array().parse(db.propuestas);
    S.secuenciaSchema.array().parse(db.secuencias);
    S.respuestaSchema.array().parse(db.respuestas);
    S.busquedaSchema.array().parse(db.busquedas);
    S.oportunidadSchema.array().parse(db.oportunidades);
    S.auditoriaSchema.array().parse(db.auditoria);
    expect(db.metricas).toHaveLength(90);
  });
});
