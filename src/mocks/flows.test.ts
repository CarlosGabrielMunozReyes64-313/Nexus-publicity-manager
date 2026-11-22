import { beforeEach, describe, it, expect } from "vitest";
import { route, reset, db } from "./handlers";
import { demoRutas } from "./rutas";
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
    // La base legal de formulario solo llega por el webhook firmado; aquí se usa
    // una registrada «aprobada» para comprobar que importar nunca la aprueba.
    const baseLegal = {
      ...db.contactos[0].baseLegal,
      tipo: "autorizacion_registrada" as const,
      aprobadaPorAdmin: true,
    };
    const c = {
      ...db.contactos[0],
      id: "nuevo",
      nombre: "Importación ejemplo",
      correo: "importada@demo.example",
      baseLegal,
    };
    const r = await call("/contactos/importar", "POST", {
      contactos: [c, c, { ...db.contactos[0], baseLegal }],
    });
    expect(r.ok).toBe(true);
    expect(await r.json()).toEqual({
      ok: true,
      creados: 1,
      omitidos: 2,
      rechazados: 0,
    });
    expect(db.contactos).toHaveLength(61);
    expect(db.contactos.at(-1)?.baseLegal.aprobadaPorAdmin).toBe(false);
    const formulario = await call("/contactos/importar", "POST", {
      contactos: [{ ...c, correo: "otra@demo.example" }],
    });
    expect(formulario.ok).toBe(true);
    expect(
      (
        await call("/contactos/importar", "POST", {
          contactos: [db.contactos[0]],
        })
      ).status,
    ).toBe(400);
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
  it("escenario completo de una ruta de correos (9 pasos, sin envíos)", async () => {
    demoRutas.esperaMs = 0;
    try {
      const json = async (path: string, method = "GET", body?: unknown) => {
        const r = await call(path, method, body);
        expect(r.status, path).toBe(200);
        return r.json();
      };
      const inscripciones = db.inscripciones.length;
      // 1. Pedir una ruta de 3 correos.
      await json("/propuestas/rutas-correo", "POST", {
        segmentoId: "seg1",
        objetivo: "Que completen el diagnóstico RSE Express",
        numeroCorreos: 3,
      });
      // 2. Verla lista.
      const [sol] = S.solicitudRutaSchema
        .array()
        .parse(await json("/propuestas/solicitudes"));
      expect(sol).toMatchObject({ estado: "lista", tipo: "proponer_campana" });
      const id = sol.propuestaId!;
      let p = S.propuestaSchema.parse(await json(`/propuestas/${id}`));
      expect(p.versiones[0].autor).toBe("agente");
      const v1 = S.rutaCorreoSchema.parse(p.versiones[0].contenido);
      expect(v1.pasos).toHaveLength(3);
      expect(v1.notasAgente?.general).toBeTruthy();
      // 3. Previsualizarla con un contacto real.
      const [contacto] = S.contactoElegibleSchema
        .array()
        .parse(await json(`/propuestas/${id}/elegibles`));
      const previa = S.vistaPreviaSchema.parse(
        await json(`/propuestas/${id}/previsualizar`, "POST", {
          contactoId: contacto.id,
        }),
      );
      expect(previa.pasos[0].cuerpo).not.toMatch(/\{\{/);
      // 4. Editar el correo 2.
      const editado = structuredClone(v1);
      editado.pasos[1].cuerpo =
        "Hola, {{nombre}}: versión del administrador para el segundo correo.\n{{firma}}\n{{baja}}";
      expect(
        (await json(`/propuestas/${id}`, "PUT", { contenido: editado }))
          .version,
      ).toBe(2);
      // 5. Comparar la versión 1 con la 2: solo cambia el correo 2.
      p = S.propuestaSchema.parse(await json(`/propuestas/${id}`));
      const v2 = S.rutaCorreoSchema.parse(p.versiones[1].contenido);
      expect(p.versiones[1].autor).toBe("admin");
      expect(v2.pasos.map((x, i) => x.cuerpo === v1.pasos[i].cuerpo)).toEqual([
        true,
        false,
        true,
      ]);
      expect(v2.notasAgente?.pasos[1].editadoPorAdmin).toBe(true);
      // 6. Rechazar con comentario (pidiendo versión nueva).
      await json(`/propuestas/${id}/rechazar`, "POST", {
        comentario: "Más corto el primer correo",
      });
      // 7. Recibir la versión 3 del agente.
      const sols = S.solicitudRutaSchema
        .array()
        .parse(await json("/propuestas/solicitudes"));
      expect(sols[0]).toMatchObject({
        tipo: "revisar_campana",
        estado: "lista",
      });
      p = S.propuestaSchema.parse(await json(`/propuestas/${id}`));
      expect(p.version).toBe(3);
      expect(p.versiones[2].autor).toBe("agente");
      expect(p.versiones[1].decision).toBe("rechazada");
      // 8. Aprobar (la revisión lo permite).
      expect(
        S.revisionRutaSchema.parse(await json(`/propuestas/${id}/revision`))
          .puedeAprobar,
      ).toBe(true);
      await json(`/propuestas/${id}/aprobar`, "POST", {});
      // 9. La campaña queda aprobada y no se envió nada.
      const cam = db.campanas.find((c) => c.id === p.objetivoId)!;
      expect(cam.estado).toBe("aprobada");
      expect(cam.metricas.enviados).toBe(0);
      expect(db.inscripciones).toHaveLength(inscripciones);
      const s = db.secuencias.find((x) => x.id === cam.secuenciaId)!;
      const v3 = S.rutaCorreoSchema.parse(p.versiones[2].contenido);
      expect(s.pasos.map((x) => x.cuerpo)).toEqual(
        v3.pasos.map((x) => x.cuerpo),
      );
    } finally {
      demoRutas.esperaMs = 6000;
    }
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
