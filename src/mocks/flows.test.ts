import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { route, reset, db } from "./handlers";
import { ADMIN_CORREO, demoIA } from "./secuencias";
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
  it("editar una secuencia activa guarda un borrador y no toca los envíos", async () => {
    const activas = db.inscripciones.filter(
      (i) => i.estado === "activa",
    ).length;
    const result = await call("/secuencias/s1", "PUT", {
      ...db.secuencias[0],
      nombre: "Nueva versión",
    });
    expect(result.ok).toBe(true);
    expect(db.campanas[0].estado).toBe("activa");
    expect(db.campanas[0].versionAprobada).toBe(1);
    expect(db.secuencias[0].nombre).not.toBe("Nueva versión");
    expect(db.inscripciones.filter((i) => i.estado === "activa")).toHaveLength(
      activas,
    );
    const s = S.secuenciaSchema.parse(
      await (await call("/secuencias/s1")).json(),
    );
    expect(s.estadoEditor).toBe("cambios_sin_aprobar");
    expect(s.versionBorrador).toBe(2);
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
    // Editar crea un borrador: lo aprobado sigue vigente hasta aprobar de nuevo.
    expect(db.campanas[1].estado).toBe("aprobada");
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

  it("la meta diaria y la terminal de la demo cumplen sus esquemas", async () => {
    const leer = async (path: string) => (await call(path)).json();
    S.metaDescubrimientoSchema.parse(await leer("/descubrimiento/meta"));
    const t = S.terminalSchema.parse(await leer("/terminal"));
    expect(t.eventos.length).toBeGreaterThan(0);
    const ultimo = t.eventos[t.eventos.length - 1].id;
    expect(
      S.terminalSchema.parse(await leer(`/terminal?desde=${ultimo}`)).eventos,
    ).toEqual([]);
    await call("/descubrimiento/busquedas", "POST", {
      consulta: "Busca empresas en Colombia: Hoteles",
      municipios: ["Palmira"],
      sectores: [],
    });
    const nuevas = S.terminalSchema.parse(
      await leer(`/terminal?desde=${ultimo}`),
    ).eventos;
    expect(nuevas.map((e) => e.mensaje)).toEqual([
      "Búsqueda de empresas: «Hoteles» en Palmira: empieza.",
    ]);
  });
});

describe("Escenario de la demo: secuencia de correo de punta a punta", () => {
  beforeEach(() => {
    demoIA.esperaMs = 0;
  });
  afterEach(() => {
    demoIA.esperaMs = 6000;
  });
  async function json<T>(
    schema: { parse: (v: unknown) => T },
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const r = await call(path, method, body);
    const datos: unknown = await r.json();
    if (!r.ok) throw new Error(`${method} ${path}: ${JSON.stringify(datos)}`);
    return schema.parse(datos);
  }
  const conCuerpo2 = (
    c: Awaited<ReturnType<typeof S.borradorSchema.parse>>["contenido"],
    cuerpo: string,
  ) => {
    const { notasAgente, ...secuencia } = S.contenidoSecuenciaSchema.parse(c);
    void notasAgente;
    return {
      secuencia: {
        ...secuencia,
        pasos: secuencia.pasos.map((x, i) => (i === 1 ? { ...x, cuerpo } : x)),
      },
    };
  };

  it("pedir a la IA, editar, previsualizar, probar, aprobar, activar y aprobar y reanudar", async () => {
    const enviadosAntes = db.interacciones.length;
    // 1. Pedir la secuencia a la IA (solo con datos agregados del segmento).
    await json(S.okSchema, "/secuencias/ia", "POST", {
      segmentoId: "seg1",
      objetivo: "Invitar al diagnóstico RSE Express",
      numeroCorreos: 3,
    });
    const solicitudes = await json(
      S.solicitudSecuenciaSchema.array(),
      "/secuencias/solicitudes",
    );
    const lista = solicitudes.find(
      (x) => x.segmentoId === "seg1" && x.tipo === "proponer_campana",
    );
    expect(lista?.estado).toBe("lista");
    const id = lista!.secuenciaId!;

    // 2. Abrirla: es un borrador de la IA, versión 1, sin aprobar.
    const sec = await json(S.secuenciaSchema, `/secuencias/${id}`);
    expect(sec.estadoEditor).toBe("borrador");
    expect(sec.versionAprobada).toBeUndefined();
    const v1 = await json(S.borradorSchema, `/secuencias/${id}/borrador`);
    expect([v1.version, v1.autor]).toEqual([1, "agente"]);
    expect(v1.contenido.pasos).toHaveLength(3);

    // 3. Editar el correo 2 y guardar: versión 2 del administrador.
    const texto2 =
      "Hola, {{nombre}}:\n\nVuelvo sobre el diagnóstico para {{empresa}}: {{enlace}}\n\n{{firma}}\n{{baja}}";
    const g = await json(
      S.guardadoSchema,
      `/secuencias/${id}/borrador`,
      "PUT",
      conCuerpo2(v1.contenido, texto2),
    );
    expect(g.version).toBe(2);
    const versiones = await json(
      S.versionSecuenciaSchema.array(),
      `/secuencias/${id}/versiones`,
    );
    expect(versiones.map((v) => v.autor)).toEqual(["agente", "admin"]);

    // 4. Vista previa con un contacto real del segmento.
    const [contacto] = await json(
      S.contactoElegibleSchema.array(),
      `/secuencias/${id}/elegibles`,
    );
    const previa = await json(
      S.vistaPreviaSchema,
      `/secuencias/${id}/previsualizar`,
      "POST",
      { contactoId: contacto.id },
    );
    expect(previa.pasos[1].cuerpo).toContain(
      `Hola, ${db.contactos.find((c) => c.id === contacto.id)!.nombre}:`,
    );
    expect(previa.pasos[1].cuerpo).not.toContain("{{");

    // 5. Enviar una prueba del correo 2: solo al administrador.
    const prueba = await json(
      S.pruebaEnviadaSchema,
      `/secuencias/${id}/prueba`,
      "POST",
      { contactoId: contacto.id, orden: 2 },
    );
    expect(prueba).toEqual({
      ok: true,
      destinatario: ADMIN_CORREO,
      enviados: 1,
    });
    expect(db.pruebas.at(-1)?.asunto.startsWith("[Prueba] ")).toBe(true);

    // 6. Aprobar sin programar: no envía nada; la campaña queda aprobada.
    const rev = await json(
      S.revisionSecuenciaSchema,
      `/secuencias/${id}/revision`,
    );
    expect(rev.puedeAprobar).toBe(true);
    await json(S.okSchema, `/secuencias/${id}/aprobar`, "POST", {
      programar: false,
    });
    const aprobada = await json(S.secuenciaSchema, `/secuencias/${id}`);
    expect(aprobada.versionAprobada).toBe(2);
    expect(aprobada.pasos[1].cuerpo).toBe(texto2);
    const camId = aprobada.campanaId!;
    expect(db.campanas.find((c) => c.id === camId)?.estado).toBe("aprobada");
    expect(db.interacciones.length).toBe(enviadosAntes);

    // 7. Activar la campaña con los contactos elegibles.
    await json(S.okSchema, `/campanas/${camId}/inscribir`, "POST", [
      contacto.id,
    ]);
    await json(S.okSchema, `/campanas/${camId}/reanudar`, "POST", {});
    expect(db.campanas.find((c) => c.id === camId)?.estado).toBe("activa");
    const activas = () =>
      db.inscripciones.filter(
        (i) => i.campanaId === camId && i.estado === "activa",
      );
    expect(activas()).toHaveLength(1);

    // 8. Editar otra vez: se guarda un borrador y se sigue enviando lo aprobado.
    const v2 = await json(S.borradorSchema, `/secuencias/${id}/borrador`);
    const texto3 = texto2.replace("Vuelvo sobre", "Le recuerdo");
    await json(
      S.guardadoSchema,
      `/secuencias/${id}/borrador`,
      "PUT",
      conCuerpo2(v2.contenido, texto3),
    );
    const enEdicion = await json(S.secuenciaSchema, `/secuencias/${id}`);
    expect(enEdicion.estadoEditor).toBe("cambios_sin_aprobar");
    expect(enEdicion.pasos[1].cuerpo).toBe(texto2);
    expect(db.campanas.find((c) => c.id === camId)?.estado).toBe("activa");
    expect(activas()).toHaveLength(1);

    // 9. Aprobar y reanudar: la versión nueva se envía sin dejar la campaña pausada.
    await json(S.okSchema, `/secuencias/${id}/aprobar-y-reanudar`, "POST", {});
    const final = await json(S.secuenciaSchema, `/secuencias/${id}`);
    expect(final.pasos[1].cuerpo).toBe(texto3);
    expect(final.versionAprobada).toBe(3);
    expect(final.estadoEditor).toBe("activa");
    expect(db.campanas.find((c) => c.id === camId)?.estado).toBe("activa");
    expect(activas()).toHaveLength(1);
  });

  it("todas las respuestas nuevas de la demo cumplen sus esquemas", async () => {
    const lista = await json(S.secuenciaSchema.array(), "/secuencias");
    for (const s of lista) {
      await json(S.secuenciaSchema, `/secuencias/${s.id}`);
      await json(S.borradorSchema, `/secuencias/${s.id}/borrador`);
      await json(
        S.versionSecuenciaSchema.array(),
        `/secuencias/${s.id}/versiones`,
      );
      await json(S.revisionSecuenciaSchema, `/secuencias/${s.id}/revision`);
      await json(
        S.contactoElegibleSchema.array(),
        `/secuencias/${s.id}/elegibles`,
      );
    }
    await json(S.secuenciaSchema.array(), "/secuencias?archivadas=true");
    await json(S.solicitudSecuenciaSchema.array(), "/secuencias/solicitudes");
    const nueva = await json(S.creadaSchema, "/secuencias", "POST", {
      segmentoId: "seg1",
      nombre: "Secuencia en blanco",
      objetivo: "Invitar al diagnóstico RSE Express",
      llamadaAccion: "Agendar el diagnóstico",
    });
    await json(S.creadaSchema, `/secuencias/${nueva.id}/duplicar`, "POST", {});
    await json(S.okSchema, `/secuencias/${nueva.id}/archivar`, "POST", {});
    const r = await call("/secuencias/s1/archivar", "POST", {});
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({
      message: "Pause la campaña antes de archivar la secuencia",
    });
  });
});
