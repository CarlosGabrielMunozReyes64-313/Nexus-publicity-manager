import { http, HttpResponse, delay } from "msw";
import { z } from "zod";
import { crearDatos, dia, iso } from "./data";
import * as S from "../api/schemas";
import type * as T from "../types";
import {
  puedeInscribir,
  coincide,
  huella,
  trasEditarCampana,
  ventanasCompatibles,
} from "../lib/reglas";
import * as SQ from "./secuencias";
import { ErrorDemo, type SolicitudMock } from "./secuencias";
export let db = crearDatos();
/** Pedidos a los agentes en el modo demostración (se resuelven al instante). */
let pedidos: z.infer<typeof S.solicitudAgenteSchema>[] = [];
/** Solicitudes a la IA de secuencias: el agente simulado tarda unos segundos. */
let solicitudes: SolicitudMock[] = SQ.solicitudesIniciales(db);
export const reset = () => {
  db = crearDatos();
  pedidos = [];
  solicitudes = SQ.solicitudesIniciales(db);
};
const uid = () => crypto.randomUUID();
function fail(message: string, status = 400) {
  return HttpResponse.json({ message }, { status });
}
function log(
  accion: string,
  entidad: string,
  entidadId: string,
  antes: unknown,
  despues: unknown,
) {
  db.auditoria.unshift({
    id: uid(),
    fecha: iso(),
    actor: "admin",
    accion,
    entidad,
    entidadId,
    antes,
    despues,
  });
}
function stop(c: T.Contacto, motivo: T.Inscripcion["motivoSalida"]) {
  db.inscripciones
    .filter((i) => i.contactoId === c.id)
    .forEach((i) => {
      i.estado = motivo === "respondio" ? "pausada" : "finalizada";
      i.motivoSalida = motivo;
      i.proximoEnvio = undefined;
    });
}
function suppress(c: T.Contacto, motivo: string) {
  c.excluido = true;
  c.etapa = "excluido";
  c.motivoExclusion = motivo;
  if (!db.supresiones.some((s) => s.correo === c.correo))
    db.supresiones.push({ id: uid(), correo: c.correo, motivo, fecha: iso() });
  stop(c, "baja");
}
/**
 * La campaña perdió su aprobación (cambió la marca o el segmento). Igual que
 * revisar_pendientes del backend: nunca se crean versiones desde la secuencia en uso;
 * si la última versión ya estaba decidida, se crea una copia para aprobarla de nuevo.
 */
function reviseCampaign(c: T.Campana) {
  Object.assign(c, trasEditarCampana(c));
  db.inscripciones
    .filter((i) => i.campanaId === c.id && i.estado !== "finalizada")
    .forEach((i) => {
      i.estado = "pausada";
      i.proximoEnvio = undefined;
    });
  SQ.trasRevocar(db, c);
}
function diaBogota(valor: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? valor
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(valor));
}
function filtrarAuditoria(u: URL) {
  const p = (k: string) => (u.searchParams.get(k) ?? "").trim();
  const contiene = (valor: string, filtro: string) =>
    !filtro || valor.toLowerCase().includes(filtro.toLowerCase());
  return db.auditoria
    .filter(
      (a) =>
        contiene(a.actor, p("actor")) &&
        contiene(a.accion, p("accion")) &&
        contiene(a.entidad, p("entidad")) &&
        (!p("entidadId") || a.entidadId === p("entidadId")) &&
        (!p("desde") || diaBogota(a.fecha) >= p("desde")) &&
        (!p("hasta") || diaBogota(a.fecha) <= p("hasta")),
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
function conflictosDeHorario(ventana: T.LimitesEnvio["ventana"]) {
  return db.campanas.filter((c) => {
    const s = db.secuencias.find((x) => x.id === c.secuenciaId);
    return (
      ["aprobada", "activa", "pausada"].includes(c.estado) &&
      s &&
      !ventanasCompatibles(s.ventanaEnvio, ventana)
    );
  });
}
function candidates(c: T.Campana) {
  const seg = db.segmentos.find((s) => s.id === c.segmentoId);
  return db.contactos.filter(
    (p) =>
      puedeInscribir(p, db.supresiones) &&
      db.empresas.find((e) => e.id === p.empresaId)?.estadoCuenta !==
        "cliente" &&
      coincide(p, db.empresas, seg?.reglas ?? []),
  );
}
/** Mutaciones del editor de secuencias (mismas rutas que el backend). */
function mutarSecuencias(
  method: string,
  parts: string[],
  body: unknown,
): Response | null {
  const [, id, action, n, sub] = parts;
  const ok = (r: object, accion: string, entidadId: string) => {
    log(accion, "secuencias", entidadId, null, null);
    return HttpResponse.json(r);
  };
  if (method === "POST" && !id)
    return ok(SQ.nueva(db, body), "crear_secuencia", "nueva");
  if (method === "POST" && id === "ia")
    return ok(SQ.pedirIA(db, solicitudes, body), "pedir_secuencia_ia", "ia");
  if (method === "POST" && id === "solicitudes" && n === "reintentar")
    return ok(
      SQ.reintentar(db, solicitudes, action),
      "reintentar_solicitud",
      action,
    );
  if (!id) return null;
  if (method === "PUT" && !action)
    // Compatibilidad con el editor anterior: ahora guarda un borrador.
    return ok(SQ.guardarBorrador(db, id, body), "guardar_borrador", id);
  if (method === "PUT" && action === "borrador")
    return ok(
      SQ.guardarBorrador(db, id, (body as { secuencia?: unknown })?.secuencia),
      "guardar_borrador",
      id,
    );
  if (method === "DELETE" && action === "sugerencias" && n)
    return HttpResponse.json(SQ.descartarSugerencia(solicitudes, id, n));
  if (method !== "POST") return null;
  if (action === "versiones" && sub === "restaurar")
    return ok(SQ.restaurar(db, id, Number(n)), "restaurar_version", id);
  if (action === "correos" && sub === "mejorar")
    return ok(
      SQ.mejorar(db, solicitudes, id, Number(n), body),
      "pedir_mejora_correo",
      id,
    );
  switch (action) {
    case "previsualizar":
      return HttpResponse.json(SQ.previsualizar(db, id, body));
    case "aprobar":
      return ok(SQ.aprobar(db, id), "aprobar_secuencia", id);
    case "aprobar-y-reanudar": {
      const cam = SQ.campanaDe(db, id);
      if (cam?.estado !== "activa")
        throw new ErrorDemo(
          "Aprobar y reanudar solo aplica a una campaña activa",
          409,
        );
      SQ.aprobar(db, id);
      log("aprobar_secuencia", "secuencias", id, null, null);
      // Si reanudar falla, la aprobación se conserva y se informa el motivo.
      if (
        db.integraciones.find((i) => i.id === "gmail")?.estado !== "conectada"
      )
        return fail("Gmail está desconectado");
      cam.estado = "activa";
      db.inscripciones
        .filter((i) => i.campanaId === cam.id && !i.motivoSalida)
        .forEach((i) => {
          i.estado = "activa";
          i.proximoEnvio = iso(-1);
        });
      return HttpResponse.json({ ok: true });
    }
    case "prueba":
      return ok(SQ.prueba(db, id, body), "envio_prueba", id);
    case "otra-version-ia":
      return ok(
        SQ.otraVersion(db, solicitudes, id, body),
        "pedir_otra_version",
        id,
      );
    case "duplicar":
      return ok(SQ.duplicar(db, id), "duplicar_secuencia", id);
    case "archivar":
      return ok(SQ.archivar(db, id), "archivar_secuencia", id);
  }
  return null;
}
export async function route(request: Request): Promise<Response> {
  const u = new URL(request.url);
  const path = u.pathname.replace(/^.*\/api/, "");
  const parts = path.split("/").filter(Boolean);
  const [resource, id, action] = parts;
  const method = request.method;
  const body: unknown =
    method === "GET" ? undefined : await request.json().catch(() => ({}));
  SQ.avanzar(db, solicitudes);
  const before = structuredClone(db);
  const collections = {
    empresas: db.empresas,
    contactos: db.contactos,
    segmentos: db.segmentos,
    propuestas: db.propuestas,
    secuencias: db.secuencias,
    campanas: db.campanas,
    respuestas: db.respuestas,
    oportunidades: db.oportunidades,
    auditoria: db.auditoria,
    integraciones: db.integraciones,
    supresiones: db.supresiones,
    duplicados: db.duplicados,
  };
  if (method === "GET") {
    if (path === "/agentes/solicitudes") return HttpResponse.json(pedidos);
    if (path === "/propuestas/rutas-correo/segmentos")
      return HttpResponse.json(
        db.segmentos
          .filter((s) => s.estado === "aprobado")
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
          .map((s) => ({
            id: s.id,
            nombre: s.nombre,
            version: s.version,
            elegibles: SQ.elegiblesDe(db, s.id).length,
          })),
      );
    if (resource === "secuencias") {
      try {
        if (!id)
          return HttpResponse.json(
            SQ.lista(db, u.searchParams.get("archivadas") === "true"),
          );
        if (id === "solicitudes")
          return HttpResponse.json(
            solicitudes
              .filter(
                (s) =>
                  Date.now() - new Date(s.creadaEn).getTime() < 30 * 86400000,
              )
              .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
              .map(SQ.publica),
          );
        const seq = db.secuencias.find((x) => x.id === id);
        if (!seq) return fail("Registro no encontrado", 404);
        if (!action) return HttpResponse.json(SQ.conExtras(db, seq));
        if (action === "borrador")
          return HttpResponse.json(SQ.borrador(db, id));
        if (action === "versiones")
          return HttpResponse.json(SQ.versiones(db, id));
        if (action === "revision")
          return HttpResponse.json(SQ.revision(db, id));
        if (action === "sugerencias")
          return HttpResponse.json(SQ.sugerencias(solicitudes, id));
        if (action === "elegibles")
          return HttpResponse.json(
            SQ.elegiblesDe(db, SQ.campanaDe(db, id)?.segmentoId)
              .slice(0, 50)
              .map((c) => ({
                id: c.id,
                nombre: c.nombre,
                empresa:
                  db.empresas.find((e) => e.id === c.empresaId)?.razonSocial ??
                  "Sin empresa",
              })),
          );
        return fail("Ruta no encontrada", 404);
      } catch (e) {
        return fail(
          e instanceof Error ? e.message : "Datos no válidos",
          e instanceof ErrorDemo ? e.status : 400,
        );
      }
    }
    if (resource === "propuestas") {
      const p = db.propuestas.find((x) => x.id === id);
      if (id && !p) return fail("Registro no encontrado", 404);
      if (p) return HttpResponse.json(p);
      return HttpResponse.json(db.propuestas);
    }
    if (path === "/panel/resumen")
      return HttpResponse.json({
        contactables: db.contactos.filter((c) =>
          puedeInscribir(c, db.supresiones),
        ).length,
        activas: db.campanas.filter((c) => c.estado === "activa").length,
        pendientes: db.respuestas.filter((r) => r.estado === "pendiente")
          .length,
        diagnosticos: 2,
        reuniones: 2,
        enviadosHoy: 12,
      });
    if (resource === "configuracion")
      return HttpResponse.json(
        id === "marca"
          ? db.marca
          : id === "limites"
            ? db.limites
            : db.clienteIdeal,
      );
    if (resource === "descubrimiento") {
      const b = db.busquedas.find((b) => b.id === action);
      return HttpResponse.json(action ? b : db.busquedas);
    }
    if (resource === "embudo") {
      const ids = new Set(
        db.inscripciones
          .filter(
            (i) =>
              !u.searchParams.get("campana") ||
              i.campanaId === u.searchParams.get("campana"),
          )
          .map((i) => i.contactoId),
      );
      const seg = db.segmentos.find(
        (s) => s.id === u.searchParams.get("segmento"),
      );
      const cs = db.contactos.filter(
        (c) =>
          (!u.searchParams.get("fuente") ||
            c.origen === u.searchParams.get("fuente")) &&
          (!u.searchParams.get("campana") || ids.has(c.id)) &&
          (!seg || coincide(c, db.empresas, seg.reglas)) &&
          (!u.searchParams.get("desde") ||
            c.creadoEn >= u.searchParams.get("desde")!) &&
          (!u.searchParams.get("hasta") ||
            c.creadoEn.slice(0, 10) <= u.searchParams.get("hasta")!),
      );
      return HttpResponse.json(
        [
          "identificado",
          "contactable",
          "contactado",
          "interesado",
          "lead",
          "calificado",
          "discovery",
          "propuesta",
          "cliente",
          "postventa",
        ].map((etapa) => ({
          etapa,
          conteo: cs.filter((c) => c.etapa === etapa).length,
        })),
      );
    }
    if (resource === "informes")
      return HttpResponse.json(
        id === "recomendaciones"
          ? db.recomendaciones
          : db.metricas.filter(
              (m) =>
                (!u.searchParams.get("desde") ||
                  m.fecha >= u.searchParams.get("desde")!) &&
                (!u.searchParams.get("hasta") ||
                  m.fecha.slice(0, 10) <= u.searchParams.get("hasta")!),
            ),
      );
    if (resource === "auditoria" && id === "pagina") {
      const filas = filtrarAuditoria(u);
      const tamano = Math.min(200, Number(u.searchParams.get("tamano") ?? 50));
      const pagina = Math.max(1, Number(u.searchParams.get("pagina") ?? 1));
      return HttpResponse.json({
        items: filas.slice((pagina - 1) * tamano, pagina * tamano),
        total: filas.length,
        pagina,
        tamano,
      });
    }
    if (resource === "auditoria" && id === "exportar") {
      const columnas = [
        "id",
        "fecha",
        "actor",
        "accion",
        "entidad",
        "entidadId",
      ] as const;
      const celda = (v: unknown) =>
        `"${String(v ?? "").replaceAll('"', '""')}"`;
      const texto = [
        columnas.join(","),
        ...filtrarAuditoria(u).map((a) =>
          columnas.map((k) => celda(a[k])).join(","),
        ),
      ].join("\r\n");
      return new HttpResponse("\ufeff" + texto, {
        headers: { "Content-Type": "text/csv; charset=utf-8" },
      });
    }
    if (resource === "campanas" && !id)
      return HttpResponse.json(
        db.campanas.map((c) => {
          const s = db.secuencias.find((x) => x.id === c.secuenciaId);
          return s &&
            ["aprobada", "activa", "pausada"].includes(c.estado) &&
            !ventanasCompatibles(s.ventanaEnvio, db.limites.ventana)
            ? {
                ...c,
                motivoPausa:
                  "El horario de la secuencia aprobada no coincide con el horario global de envío. Ajuste Configuración → Límites y horarios o la secuencia y vuelva a reanudar la campaña.",
              }
            : c;
        }),
      );
    if (resource === "contactos" && action === "interacciones")
      return HttpResponse.json(
        db.interacciones.filter((i) => i.contactoId === id),
      );
    if (resource === "campanas" && action === "inscripciones")
      return HttpResponse.json(
        db.inscripciones.filter((i) => i.campanaId === id),
      );
    const list = collections[resource as keyof typeof collections];
    if (list) {
      if (id) {
        const item = list.find((x) => x.id === id);
        return item
          ? HttpResponse.json(item)
          : fail("Registro no encontrado", 404);
      }
      return HttpResponse.json(
        list.filter((x) =>
          Array.from(u.searchParams.entries()).every(
            ([k, v]) =>
              !v ||
              String(
                (x as unknown as Record<string, unknown>)[k] ?? "",
              ).includes(v),
          ),
        ),
      );
    }
    return fail("Ruta no disponible", 404);
  }
  try {
    if (resource === "dev" && id === "reset") {
      reset();
      return HttpResponse.json({ ok: true });
    }
    if (path === "/propuestas/rutas-correo" && method === "POST") {
      SQ.pedirIA(db, solicitudes, body);
      return HttpResponse.json({ ok: true });
    }
    if (resource === "secuencias") {
      const r = mutarSecuencias(method, parts, body);
      if (r) return r;
    }
    if (resource === "contactos") {
      if (id === "importar") {
        const data = z
          .object({ contactos: z.array(S.contactoSchema) })
          .parse(body);
        if (
          data.contactos.some(
            (c) => c.baseLegal.tipo === "autorizacion_formulario",
          )
        )
          throw Error(
            "La autorización de formulario debe proceder del webhook firmado",
          );
        if (
          data.contactos.some(
            (c) => !db.empresas.some((e) => e.id === c.empresaId),
          )
        )
          return fail("Empresa no encontrada", 404);
        const existentes = new Set(
          db.contactos.map((x) => x.correo?.toLowerCase()).filter(Boolean),
        );
        const vistos = new Set<string>();
        const conteo = { creados: 0, omitidos: 0, rechazados: 0 };
        for (const c of data.contactos) {
          const correo = (c.correo ?? "").toLowerCase();
          if (!c.nombre.trim()) {
            conteo.rechazados++;
            continue;
          }
          if (correo && (existentes.has(correo) || vistos.has(correo))) {
            conteo.omitidos++;
            continue;
          }
          vistos.add(correo);
          db.contactos.push({
            ...c,
            id: uid(),
            correo: correo || undefined,
            baseLegal: { ...c.baseLegal, aprobadaPorAdmin: false },
            evidencias: c.correo
              ? [
                  {
                    campo: "correo",
                    valor: correo,
                    fuente: "manual",
                    obtenidoEn: iso(),
                    estado: "pendiente",
                  },
                ]
              : [],
          });
          conteo.creados++;
        }
        log("importar", resource, "nuevo", null, conteo);
        return HttpResponse.json({ ok: true, ...conteo });
      } else if (!id) {
        const c = S.contactoSchema.parse(body);
        db.contactos.push({
          ...c,
          id: uid(),
          baseLegal: { ...c.baseLegal, aprobadaPorAdmin: false },
        });
      } else {
        const c = db.contactos.find((x) => x.id === id);
        if (!c) throw Error("Contacto no encontrado");
        if (action === "excluir") {
          const b = z.object({ motivo: z.string().min(3) }).parse(body);
          suppress(c, b.motivo);
        } else if (action === "base-legal") {
          if (
            c.baseLegal.tipo === "pendiente" ||
            !c.baseLegal.texto ||
            !c.baseLegal.prueba
          )
            throw Error(
              "Registre tipo, texto y prueba de la base legal antes de aprobar",
            );
          c.baseLegal.aprobadaPorAdmin = true;
        } else if (method === "PATCH") {
          const patch = S.contactoSchema.partial().parse(body);
          Object.assign(c, patch, {
            baseLegal: patch.baseLegal
              ? { ...patch.baseLegal, aprobadaPorAdmin: false }
              : c.baseLegal,
          });
        }
        c.actualizadoEn = iso();
      }
    } else if (resource === "empresas") {
      if (!id) db.empresas.push({ ...S.empresaSchema.parse(body), id: uid() });
      else {
        const e = db.empresas.find((x) => x.id === id);
        if (!e) throw Error("Empresa no encontrada");
        Object.assign(e, S.empresaSchema.partial().parse(body));
      }
    } else if (resource === "duplicados" && action === "descartar") {
      if (!db.duplicados.some((d) => d.id === id))
        throw Error("Duplicado ya resuelto");
      db.duplicados = db.duplicados.filter((d) => d.id !== id);
    } else if (resource === "duplicados") {
      const du = db.duplicados.find((d) => d.id === id);
      if (!du) throw Error("Duplicado no encontrado");
      const a = db.empresas.find((e) => e.id === du.principalId)!;
      const b = db.empresas.find((e) => e.id === du.duplicadoId)!;
      const choices = z.record(z.enum(["principal", "duplicado"])).parse(body);
      const campos = [
        "razonSocial",
        "sector",
        "municipio",
        "tamano",
        "sitioWeb",
        "dominio",
      ] as const;
      for (const campo of campos)
        if (choices[campo] === "duplicado")
          Object.assign(a, { [campo]: b[campo] });
      a.evidencias.push(...b.evidencias);
      db.contactos.forEach((c) => {
        if (c.empresaId === b.id) c.empresaId = a.id;
      });
      db.oportunidades.forEach((o) => {
        if (o.empresaId === b.id) o.empresaId = a.id;
      });
      db.empresas = db.empresas.filter((e) => e.id !== b.id);
      db.duplicados = db.duplicados.filter((d) => d.id !== id);
    } else if (resource === "descubrimiento") {
      if (id === "busquedas") {
        const criterios = S.busquedaSchema.shape.criterios.parse(body);
        const b: T.BusquedaDescubrimiento = {
          id: uid(),
          criterios,
          estado: "ejecutando",
          progreso: 30,
          resultados: [],
          creadaEn: iso(),
        };
        db.busquedas.unshift(b);
        setTimeout(() => {
          b.estado = "terminada";
          b.progreso = 100;
          b.resultados = [
            {
              ...crearDatos().busquedas[0].resultados[0],
              id: uid(),
              empresa: {
                razonSocial: `Empresa demostración · ${criterios.consulta}`,
                municipio: criterios.municipios[0] ?? "Palmira",
                sector: criterios.sectores[0] ?? "servicios",
                sitioWeb: "https://demostracion.example",
              },
            },
          ];
        }, 3500);
      } else {
        const r = db.busquedas
          .flatMap((b) => b.resultados)
          .find((r) => r.id === action);
        if (!r || r.estado !== "pendiente")
          throw Error("Resultado no disponible");
        if (parts[3] === "descartar") r.estado = "descartado";
        else {
          if (r.posibleDuplicadoDe)
            throw Error(
              "Posible duplicado: revise la empresa existente antes de aceptar",
            );
          r.estado = "aceptado";
          const eid = uid();
          db.empresas.push({
            ...r.empresa,
            id: eid,
            tamano: "desconocido",
            senales: [],
            estadoCuenta: "prospecto",
            evidencias: r.evidencias,
          });
          db.contactos.push({
            id: uid(),
            empresaId: eid,
            nombre: "Contacto corporativo",
            correo: r.contactoCorporativo.correo,
            telefono: r.contactoCorporativo.telefono,
            estadoCorreo: "desconocido",
            etapa: "identificado",
            baseLegal: {
              tipo: "corporativo_generico",
              aprobadaPorAdmin: false,
            },
            excluido: false,
            origen: "descubrimiento",
            evidencias: r.evidencias,
            creadoEn: iso(),
            actualizadoEn: iso(),
          });
        }
      }
    } else if (resource === "segmentos") {
      if (id === "previsualizar") {
        const reglas = z.array(S.reglaSchema).parse(body);
        const muestra = db.contactos.filter((c) =>
          coincide(c, db.empresas, reglas),
        );
        return HttpResponse.json({
          conteo: muestra.length,
          muestra: muestra.slice(0, 8),
        });
      }
      if (id === "proponer") {
        // Demostración: el Segmentador «responde» al instante con un segmento.
        const segId = uid();
        const reglas = [
          {
            campo: "municipio" as const,
            operador: "es" as const,
            valor: "Candelaria",
          },
        ];
        db.segmentos.push({
          id: segId,
          nombre: "Industria de Candelaria (propuesto por el agente)",
          reglas,
          justificacion:
            "Empresas industriales de Candelaria que encajan con el cliente ideal.",
          tamano: db.contactos.filter((c) => coincide(c, db.empresas, reglas))
            .length,
          version: 1,
          estado: "propuesto",
          propuestoPor: "agente",
        });
        db.propuestas.unshift({
          id: uid(),
          objetivoId: segId,
          agente: "segmentador",
          tipo: "segmento",
          estado: "pendiente",
          resumen: "Aprobar segmento Industria de Candelaria",
          version: 1,
          versiones: [{ version: 1, contenido: { reglas }, fecha: iso() }],
          fuentes: [],
          creadaEn: iso(),
        });
        const tareaId = uid();
        pedidos.unshift({
          id: tareaId,
          tipo: "proponer_segmentos",
          estado: "completada",
          intentos: 1,
          maxIntentos: 4,
          creadaEn: iso(),
          terminadaEn: iso(),
        });
        log("pedir_propuestas_segmentos", "tareas", tareaId, null, null);
        return HttpResponse.json({ ok: true, tareaId });
      }
      if (action === "proponer-campana")
        // Ruta anterior: pide una secuencia de 3 correos con el objetivo por defecto.
        return HttpResponse.json(
          SQ.pedirIA(db, solicitudes, {
            segmentoId: id,
            objetivo: SQ.OBJETIVO_POR_DEFECTO,
            numeroCorreos: 3,
          }),
        );
      if (!id)
        db.segmentos.push({
          ...S.segmentoSchema.parse(body),
          id: uid(),
          estado: "propuesto",
        });
      else {
        const s = db.segmentos.find((x) => x.id === id);
        if (!s) throw Error("Segmento no encontrado");
        if (action === "aprobar") s.estado = "aprobado";
        else {
          Object.assign(s, S.segmentoSchema.partial().parse(body), {
            version: s.version + 1,
          });
          db.campanas
            .filter((c) => c.segmentoId === id)
            .forEach((c) => reviseCampaign(c));
        }
      }
    } else if (resource === "propuestas") {
      const p = db.propuestas.find((x) => x.id === id);
      if (!p) throw Error("Propuesta no encontrada");
      const actual = p.versiones.find((v) => v.version === p.version);
      const seqDe = () =>
        db.campanas.find((c) => c.id === p.objetivoId)?.secuenciaId;
      if (action === "rechazar") {
        const b = z
          .object({
            comentario: z
              .string()
              .trim()
              .min(3, "El comentario requiere al menos 3 caracteres"),
            pedirNuevaVersion: z.boolean().optional(),
          })
          .parse(body);
        if (actual?.decision)
          throw Error("Esta versión ya fue decidida; cree una versión nueva");
        if (
          p.tipo === "campana" &&
          b.pedirNuevaVersion !== false &&
          p.agente === "estratega_redactor" &&
          seqDe()
        ) {
          SQ.otraVersion(db, solicitudes, seqDe()!, {
            comentario: b.comentario,
          });
        } else {
          p.estado = "rechazada";
          p.decision = { fecha: iso(), comentario: b.comentario };
          if (actual)
            Object.assign(actual, {
              decision: "rechazada",
              comentario: b.comentario,
              decididaEn: iso(),
            });
        }
      } else if (action === "aprobar") {
        if (p.tipo === "campana") {
          // Igual que el backend: la ruta se aprueba desde su secuencia.
          if (p.estado === "aprobada") throw Error("Propuesta ya aprobada");
          SQ.aprobar(db, seqDe()!);
        } else {
          if (p.estado === "aprobada") throw Error("Propuesta ya aprobada");
          if (p.tipo === "correo_inferido")
            throw Error(
              "Un correo inferido requiere verificación; no se aprueba para envíos",
            );
          if (actual?.decision)
            throw Error("Esta versión ya fue decidida; cree una versión nueva");
          p.estado = "aprobada";
          p.decision = { fecha: iso() };
          if (actual)
            Object.assign(actual, { decision: "aprobada", decididaEn: iso() });
          const x = (actual?.contenido ?? {}) as Record<string, unknown>;
          if (p.tipo === "segmento") {
            const seg = db.segmentos.find((s) => s.id === p.objetivoId);
            if (seg) seg.estado = "aprobado";
          }
          if (p.tipo === "mejora") {
            const cambios = (x.cambios ?? {}) as Record<string, unknown>;
            if (x.objetivo === "secuencia" && typeof x.id === "string") {
              // Una mejora para una secuencia crea un borrador; lo aprobado no cambia.
              const b = SQ.borrador(db, x.id).contenido;
              SQ.guardarBorrador(db, x.id, { ...b, ...cambios });
            } else if (x.objetivo === "campana") {
              const cam = db.campanas.find((c) => c.id === x.id);
              if (cam && typeof cambios.topeDiario === "number") {
                cam.topeDiario = cambios.topeDiario;
                reviseCampaign(cam);
              }
            }
          }
          if (p.tipo === "enriquecimiento") {
            const campos = (x.campos ?? {}) as Record<string, string>;
            const e = db.empresas.find((e) => e.id === p.objetivoId);
            if (e)
              for (const [campo, valor] of Object.entries(campos)) {
                (e as unknown as Record<string, unknown>)[campo] = valor;
                e.evidencias.push({
                  campo,
                  valor,
                  fuente: "agente",
                  obtenidoEn: iso(),
                  estado: "verificado",
                  cita:
                    p.fuentes.find((f) => f.campo === campo)?.cita ?? p.resumen,
                });
              }
          }
        }
      } else if (method === "PUT") {
        const b = z
          .object({
            resumen: z.string().optional(),
            contenido: z.unknown().optional(),
          })
          .parse(body);
        if (b.resumen === undefined && b.contenido === undefined)
          throw Error("Indique el resumen o el contenido");
        if (b.resumen !== undefined && b.resumen.trim().length < 5)
          throw Error("El resumen requiere al menos 5 caracteres");
        if (b.resumen !== undefined) p.resumen = b.resumen.trim();
        if (p.tipo === "campana" && seqDe()) {
          // Guardar crea un borrador; lo aprobado sigue vigente.
          const r = SQ.guardarBorrador(
            db,
            seqDe()!,
            b.contenido ?? SQ.borrador(db, seqDe()!).contenido,
          );
          log("PUT", resource, p.id, null, { version: r.version });
          return HttpResponse.json(r);
        }
        p.version++;
        p.estado = "pendiente";
        p.versiones.push({
          version: p.version,
          contenido: structuredClone(actual?.contenido),
          fecha: iso(),
          autor: "admin",
        });
        log("PUT", resource, p.id, null, { version: p.version });
        return HttpResponse.json({ ok: true, version: p.version });
      } else throw Error("Acción no válida");
    } else if (resource === "campanas") {
      const c = db.campanas.find((x) => x.id === id);
      if (!c) throw Error("Campaña no encontrada");
      if (action === "inscribir") {
        if (!["aprobada", "activa", "pausada"].includes(c.estado))
          throw Error("La campaña requiere aprobación");
        const ids = z.array(z.string()).parse(body);
        for (const cid of ids) {
          const contact = candidates(c).find((x) => x.id === cid);
          if (!contact)
            throw Error("Contacto no elegible o fuera del segmento");
          if (
            !db.inscripciones.some(
              (i) => i.campanaId === c.id && i.contactoId === cid,
            )
          )
            db.inscripciones.push({
              id: uid(),
              campanaId: c.id,
              contactoId: cid,
              pasoActual: 1,
              estado: "pausada",
            });
        }
        c.metricas.inscritos = db.inscripciones.filter(
          (i) => i.campanaId === id,
        ).length;
      } else if (action === "reanudar") {
        if (!["pausada", "aprobada"].includes(c.estado) || !c.versionAprobada)
          throw Error("La campaña requiere aprobación vigente");
        const seq = db.secuencias.find((s) => s.id === c.secuenciaId)!;
        const seg = db.segmentos.find((s) => s.id === c.segmentoId)!;
        if (c.huellaAprobada && c.huellaAprobada !== huella(seq, seg))
          throw Error("El contenido cambió: necesita revisión");
        if (
          db.integraciones.find((i) => i.id === "gmail")?.estado !== "conectada"
        )
          throw Error("Gmail está desconectado");
        c.estado = "activa";
        db.inscripciones
          .filter((i) => i.campanaId === id && !i.motivoSalida)
          .forEach((i) => {
            if (candidates(c).some((ct) => ct.id === i.contactoId)) {
              i.estado = "activa";
              i.proximoEnvio = iso(-1);
            }
          });
      } else if (action === "pausar" || action === "detener") {
        c.estado = action === "pausar" ? "pausada" : "finalizada";
        db.inscripciones
          .filter((i) => i.campanaId === id)
          .forEach((i) => {
            i.estado = action === "pausar" ? "pausada" : "finalizada";
            i.proximoEnvio = undefined;
            if (action === "detener") i.motivoSalida = "manual";
          });
      } else throw Error("Acción no válida");
    } else if (resource === "respuestas") {
      const r = db.respuestas.find((x) => x.id === id);
      if (!r) throw Error("Respuesta no encontrada");
      const c = db.contactos.find((x) => x.id === r.contactoId)!;
      if (action === "enviar-respuesta") {
        if (
          c.excluido ||
          db.supresiones.some(
            (s) =>
              s.correo === c.correo || s.dominio === c.correo?.split("@")[1],
          )
        )
          throw Error("El contacto está suprimido");
        const { texto } = z
          .object({ texto: z.string().trim().min(3) })
          .parse(body);
        r.hilo.push({ de: "nexus", fecha: iso(), texto });
        r.estado = "atendida";
        db.interacciones.unshift({
          id: uid(),
          contactoId: c.id,
          tipo: "correo_enviado",
          fecha: iso(),
          resumen: "Respuesta simulada: " + texto,
        });
      } else if (action === "atender") r.estado = "atendida";
      else if (action === "reunion") {
        stop(c, "reunion");
        db.interacciones.unshift({
          id: uid(),
          contactoId: c.id,
          tipo: "reunion",
          fecha: iso(),
          resumen: "Reunión registrada",
        });
      } else {
        const b = S.respuestaSchema.pick({ clasificacion: true }).parse(body);
        r.clasificacion = b.clasificacion;
        if (b.clasificacion === "baja") {
          suppress(c, "Baja solicitada");
          r.estado = "atendida";
        } else stop(c, "respondio");
      }
    } else if (resource === "oportunidades") {
      if (!id)
        db.oportunidades.push({
          ...S.oportunidadSchema.parse(body),
          id: uid(),
        });
      else {
        const o = db.oportunidades.find((x) => x.id === id);
        if (!o) throw Error("Oportunidad no encontrada");
        Object.assign(o, S.oportunidadSchema.partial().parse(body));
        if (o.etapa === "cliente" || o.etapa === "perdido") o.cerradaEn = iso();
        if (o.etapa === "cliente") {
          const e = db.empresas.find((e) => e.id === o.empresaId)!;
          e.estadoCuenta = "cliente";
          db.contactos
            .filter((c) => c.empresaId === e.id)
            .forEach((c) => {
              if (!c.excluido) c.etapa = "cliente";
              stop(c, "cliente");
            });
        }
      }
    } else if (resource === "configuracion") {
      if (id === "marca") {
        db.marca = S.marcaSchema.parse(body);
        db.campanas
          .filter((c) => ["activa", "aprobada", "pausada"].includes(c.estado))
          .forEach((c) => reviseCampaign(c));
      } else if (id === "limites") {
        const l = S.limitesSchema.parse(body);
        if (
          l.ventana.desde >= l.ventana.hasta ||
          l.separacionSegundos[0] > l.separacionSegundos[1]
        )
          throw Error("Revise el orden de horas y separación");
        const conflictos = conflictosDeHorario(l.ventana);
        if (
          conflictos.length &&
          u.searchParams.get("pausarIncompatibles") !== "true"
        )
          return fail(
            `El nuevo horario no tiene días u horas en común con la ventana aprobada de: ${conflictos
              .map((c) => c.nombre)
              .join(
                ", ",
              )}. Ajuste esas secuencias o confirme que desea pausar las campañas afectadas.`,
            409,
          );
        db.limites = l;
        conflictos.forEach((c) => {
          if (c.estado === "activa") c.estado = "pausada";
          db.inscripciones
            .filter((i) => i.campanaId === c.id && i.estado === "activa")
            .forEach((i) => {
              i.estado = "pausada";
              i.proximoEnvio = undefined;
            });
        });
        log("PUT", resource, "limites", null, l);
        return HttpResponse.json({
          ok: true,
          pausadas: conflictos.map((c) => c.nombre),
        });
      } else db.clienteIdeal = S.clienteIdealSchema.parse(body);
    } else if (resource === "integraciones") {
      const i = db.integraciones.find((x) => x.id === id);
      if (!i) throw Error("Integración no encontrada");
      i.estado = action === "conectar" ? "conectada" : "desconectada";
      i.detalle =
        action === "conectar"
          ? "Simulación · conexión comprobada"
          : "Simulación · desconectada por el administrador";
      i.ultimaSincronizacion = iso();
      if (i.id === "gmail" && i.estado === "desconectada")
        db.campanas
          .filter((c) => c.estado === "activa")
          .forEach((c) => {
            c.estado = "pausada";
            db.inscripciones
              .filter(
                (ins) => ins.campanaId === c.id && ins.estado === "activa",
              )
              .forEach((ins) => {
                ins.estado = "pausada";
                ins.proximoEnvio = undefined;
              });
          });
      log(action ?? method, resource, id ?? "nuevo", null, i);
      return HttpResponse.json({
        ok: true,
        estado: i.estado,
        detalle: i.detalle,
      });
    } else if (resource === "supresiones") {
      const s = S.supresionSchema.parse(body);
      if (!s.correo && !s.dominio) throw Error("Indique un correo o dominio");
      db.supresiones.push({ ...s, id: uid() });
      db.contactos
        .filter(
          (c) => s.correo === c.correo || s.dominio === c.correo?.split("@")[1],
        )
        .forEach((c) => suppress(c, s.motivo));
    } else if (resource === "informes" && id === "recomendaciones") {
      const r = db.recomendaciones.find((r) => r.id === action);
      if (!r) throw Error("Recomendación no encontrada");
      r.estado = parts[3] === "aprobar" ? "aprobada" : "descartada";
      if (r.estado === "aprobada")
        db.propuestas.push({
          id: uid(),
          agente: "analista",
          tipo: "mejora",
          estado: "pendiente",
          resumen: r.texto,
          version: 1,
          versiones: [{ version: 1, contenido: r.texto, fecha: iso() }],
          fuentes: [],
          creadaEn: iso(),
        });
    } else if (resource === "informes" && id === "costos") {
      const b = z
        .object({
          costoUSD: z.number().nonnegative(),
          fecha: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .parse(body);
      const fecha = b.fecha ?? dia();
      if (fecha > dia()) throw Error("La fecha del gasto no puede ser futura");
      const fila = db.metricas.find((m) => diaBogota(m.fecha) === fecha);
      if (fila) fila.costoUSD = (fila.costoUSD ?? 0) + b.costoUSD;
      else
        db.metricas.push({
          fecha,
          fuente: "directo_desconocido",
          enviados: 0,
          respuestas: 0,
          visitas: 0,
          leads: 0,
          clientes: 0,
          costoUSD: b.costoUSD,
        });
      log("costos", resource, fecha, null, b);
      return HttpResponse.json({ ok: true, fecha });
    } else return fail("Ruta no disponible", 404);
    log(
      action ?? method,
      resource,
      id ?? "nuevo",
      before[resource as keyof typeof before],
      db[resource as keyof typeof db],
    );
    return HttpResponse.json({ ok: true });
  } catch (e) {
    db = before;
    return fail(
      e instanceof Error ? e.message : "Datos no válidos",
      e instanceof ErrorDemo ? e.status : 400,
    );
  }
}
export const handlers = [
  http.all("*/api/*", async ({ request }) => {
    await delay(300 + Math.random() * 500);
    return route(request);
  }),
];
