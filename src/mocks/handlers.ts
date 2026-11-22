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
  validarSecuencia,
} from "../lib/reglas";
import {
  avanzar,
  conRuta,
  elegiblesDe,
  huellaRuta,
  leerRuta,
  notasEditadas,
  nuevaSolicitud,
  OBJETIVO_POR_DEFECTO,
  publica,
  renderMock,
  revisionMock,
  SIN_ELEGIBLES,
  solicitudesIniciales,
  validarPedido,
  type SolicitudMock,
} from "./rutas";
export let db = crearDatos();
/** Pedidos a los agentes en el modo demostración (se resuelven al instante). */
let pedidos: z.infer<typeof S.solicitudAgenteSchema>[] = [];
/** Solicitudes de rutas de correo: el agente simulado tarda unos segundos. */
let solicitudesRuta: SolicitudMock[] = solicitudesIniciales(db);
export const reset = () => {
  db = crearDatos();
  pedidos = [];
  solicitudesRuta = solicitudesIniciales(db);
};
/** Pide una ruta al agente simulado con las mismas validaciones que el backend. */
function pedirRuta(body: unknown) {
  const datos = validarPedido(body);
  const seg = db.segmentos.find((s) => s.id === datos.segmentoId);
  if (!seg) return fail("Registro no encontrado", 404);
  if (seg.estado !== "aprobado")
    return fail("El segmento requiere aprobación", 409);
  if (!elegiblesDe(db, seg.id).length) return fail(SIN_ELEGIBLES, 409);
  if (
    solicitudesRuta.some(
      (s) =>
        s.tipo === "proponer_campana" &&
        s.segmentoId === seg.id &&
        (s.estado === "en_cola" || s.estado === "trabajando"),
    )
  )
    return fail("Ya hay una ruta en preparación para este segmento", 409);
  const s = nuevaSolicitud({
    tipo: "proponer_campana",
    segmentoId: seg.id,
    segmento: seg.nombre,
    objetivo: datos.objetivo,
    numeroCorreos: datos.numeroCorreos,
    ...(datos.notas ? { notas: datos.notas } : {}),
  });
  solicitudesRuta.unshift(s);
  log("pedir_ruta_correo", "segmentos", seg.id, null, publica(s));
  return HttpResponse.json({ ok: true, tareaId: s.id });
}
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
 * La campaña vuelve a revisión. Igual que revisar_pendientes del backend: una
 * propuesta pendiente solo recibe versión nueva si cambió la secuencia en uso
 * (la versión del administrador nunca se pisa con contenido más antiguo).
 */
function reviseCampaign(c: T.Campana, secuenciaCambio = false) {
  Object.assign(c, trasEditarCampana(c));
  db.inscripciones
    .filter((i) => i.campanaId === c.id && i.estado !== "finalizada")
    .forEach((i) => {
      i.estado = "pausada";
      i.proximoEnvio = undefined;
    });
  let p = db.propuestas.find(
    (p) => p.tipo === "campana" && p.objetivoId === c.id,
  );
  const contenido = structuredClone(
    db.secuencias.find((s) => s.id === c.secuenciaId),
  );
  if (!p) {
    p = {
      id: uid(),
      objetivoId: c.id,
      agente: "estratega_redactor",
      tipo: "campana",
      estado: "pendiente",
      resumen: `Revisar campaña: ${c.nombre}`,
      version: 1,
      versiones: [{ version: 1, contenido, fecha: iso() }],
      fuentes: [],
      creadaEn: iso(),
    };
    db.propuestas.unshift(p);
  } else {
    const ultima = leerRuta(p.versiones.at(-1)?.contenido);
    const viva = contenido ? leerRuta(contenido) : null;
    if (p.estado !== "aprobada") {
      if (!secuenciaCambio || !viva) return;
      if (ultima && huellaRuta(ultima) === huellaRuta(viva)) return;
    }
    const notas = viva ? notasEditadas(ultima, viva) : undefined;
    p.estado = "pendiente";
    p.decision = undefined;
    p.version++;
    p.versiones.push({
      version: p.version,
      contenido: notas ? { ...contenido, notasAgente: notas } : contenido,
      fecha: iso(),
      autor: "admin",
    });
  }
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
function ventanasCompatibles(
  a: T.Secuencia["ventanaEnvio"],
  b: T.LimitesEnvio["ventana"],
) {
  return (
    a.dias.some((d) => b.dias.includes(d)) &&
    (a.desde > b.desde ? a.desde : b.desde) <
      (a.hasta < b.hasta ? a.hasta : b.hasta)
  );
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
export async function route(request: Request): Promise<Response> {
  const u = new URL(request.url);
  const path = u.pathname.replace(/^.*\/api/, "");
  const parts = path.split("/").filter(Boolean);
  const [resource, id, action] = parts;
  const method = request.method;
  const body: unknown =
    method === "GET" ? undefined : await request.json().catch(() => ({}));
  avanzar(db, solicitudesRuta);
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
    if (path === "/propuestas/solicitudes")
      return HttpResponse.json(
        solicitudesRuta
          .filter(
            (s) => Date.now() - new Date(s.creadaEn).getTime() < 30 * 86400000,
          )
          .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
          .map(publica),
      );
    if (path === "/propuestas/rutas-correo/segmentos")
      return HttpResponse.json(
        db.segmentos
          .filter((s) => s.estado === "aprobado")
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
          .map((s) => ({
            id: s.id,
            nombre: s.nombre,
            version: s.version,
            elegibles: elegiblesDe(db, s.id).length,
          })),
      );
    if (resource === "propuestas") {
      const p = db.propuestas.find((x) => x.id === id);
      if (id && !p) return fail("Registro no encontrado", 404);
      if (p && action === "revision")
        return HttpResponse.json(revisionMock(db, p));
      if (p && action === "elegibles") {
        if (p.tipo !== "campana")
          return fail("Solo las rutas de correo tienen contactos elegibles");
        const cam = db.campanas.find((c) => c.id === p.objetivoId);
        return HttpResponse.json(
          elegiblesDe(db, cam?.segmentoId)
            .slice(0, 50)
            .map((c) => ({
              id: c.id,
              nombre: c.nombre,
              empresa:
                db.empresas.find((e) => e.id === c.empresaId)?.razonSocial ??
                "Sin empresa",
            })),
        );
      }
      if (p) return HttpResponse.json(conRuta(db, p));
      return HttpResponse.json(db.propuestas.map((x) => conRuta(db, x)));
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
      const r = pedirRuta(body);
      return r.status === 200 ? HttpResponse.json({ ok: true }) : r;
    }
    if (
      resource === "propuestas" &&
      id === "solicitudes" &&
      parts[3] === "reintentar"
    ) {
      const s = solicitudesRuta.find((x) => x.id === action);
      if (!s) return fail("Solicitud no encontrada", 404);
      if (s.estado !== "fallida")
        return fail("Solo se puede reintentar una solicitud fallida", 409);
      if (s.tipo === "proponer_campana") {
        const r = pedirRuta({
          segmentoId: s.segmentoId,
          objetivo: s.objetivo ?? OBJETIVO_POR_DEFECTO,
          numeroCorreos: s.numeroCorreos ?? 3,
          notas: s.notas,
        });
        return r.status === 200 ? HttpResponse.json({ ok: true }) : r;
      }
      solicitudesRuta.unshift(
        nuevaSolicitud({
          tipo: "revisar_campana",
          segmentoId: s.segmentoId,
          segmento: s.segmento,
          propuestaId: s.propuestaId,
        }),
      );
      log("reintentar_solicitud_ruta", "tareas", s.id, null, null);
      return HttpResponse.json({ ok: true });
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
        // Ruta anterior: pide una ruta de 3 correos con el objetivo por defecto.
        return pedirRuta({
          segmentoId: id,
          objetivo: OBJETIVO_POR_DEFECTO,
          numeroCorreos: 3,
        });
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
      if (action === "previsualizar") {
        if (p.tipo !== "campana")
          throw Error("Solo las rutas de correo tienen vista previa");
        const b = z
          .object({
            contactoId: z.string().min(1),
            version: z.number().optional(),
          })
          .parse(body);
        const v = p.versiones.find(
          (x) => x.version === (b.version ?? p.version),
        );
        if (!v) return fail("Versión no encontrada", 404);
        const ruta = leerRuta(v.contenido);
        if (!ruta) throw Error("La versión no es una ruta de correos válida");
        const c = db.contactos.find((x) => x.id === b.contactoId);
        if (!c) return fail("Registro no encontrado", 404);
        return HttpResponse.json(
          renderMock(
            db,
            ruta.pasos.map((x, i) => ({ ...x, id: `paso-${i + 1}` })),
            c,
          ),
        );
      } else if (action === "restaurar") {
        const { version } = z.object({ version: z.number().int() }).parse(body);
        if (version === p.version)
          throw Error("No se puede restaurar la versión actual");
        const v = p.versiones.find((x) => x.version === version);
        if (!v) return fail("Versión no encontrada", 404);
        p.version++;
        p.estado = "pendiente";
        p.decision = undefined;
        p.versiones.push({
          version: p.version,
          contenido: structuredClone(v.contenido),
          fecha: iso(),
          autor: "admin",
        });
        const c = db.campanas.find((c) => c.id === p.objetivoId);
        if (c && p.tipo === "campana") Object.assign(c, trasEditarCampana(c));
        log("restaurar", resource, p.id, null, { version });
        return HttpResponse.json({ ok: true, version: p.version });
      } else if (action === "rechazar") {
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
        p.estado = "rechazada";
        p.decision = { fecha: iso(), comentario: b.comentario };
        if (actual)
          Object.assign(actual, {
            decision: "rechazada",
            comentario: b.comentario,
            decididaEn: iso(),
          });
        if (
          b.pedirNuevaVersion !== false &&
          p.agente === "estratega_redactor" &&
          p.tipo === "campana"
        ) {
          const cam = db.campanas.find((c) => c.id === p.objetivoId);
          const seg = db.segmentos.find((s) => s.id === cam?.segmentoId);
          solicitudesRuta.unshift(
            nuevaSolicitud({
              tipo: "revisar_campana",
              propuestaId: p.id,
              segmentoId: seg?.id,
              segmento: seg?.nombre,
            }),
          );
        }
      } else if (action === "aprobar") {
        if (p.estado === "aprobada") throw Error("Propuesta ya aprobada");
        if (p.tipo === "correo_inferido")
          throw Error(
            "Un correo inferido requiere verificación; no se aprueba para envíos",
          );
        if (actual?.decision)
          throw Error("Esta versión ya fue decidida; cree una versión nueva");
        if (p.tipo === "campana") {
          // La misma lista de verificación que ve el administrador decide.
          const rev = revisionMock(db, p);
          if (!rev.puedeAprobar)
            throw Error([...rev.bloqueos, ...rev.errores].join(". "));
          const c = db.campanas.find((c) => c.id === p.objetivoId);
          if (!c) throw Error("Campaña asociada no encontrada");
          const s = db.secuencias.find((s) => s.id === c.secuenciaId)!;
          const seg = db.segmentos.find((s) => s.id === c.segmentoId)!;
          const ruta = leerRuta(actual?.contenido);
          if (ruta) {
            // Se aplica tal cual el contenido de la versión aprobada.
            const { notasAgente, ...secuencia } = ruta;
            void notasAgente;
            Object.assign(s, {
              ...secuencia,
              id: s.id,
              pasos: secuencia.pasos.map((x, i) => ({
                ...x,
                id: x.id && x.id !== "nuevo" ? x.id : `${s.id}-p${i + 1}`,
              })),
            });
          }
          const errors = validarSecuencia(s, db.marca.prohibidas);
          if (errors.length) throw Error(errors.join(". "));
          c.estado = "aprobada";
          c.versionAprobada = p.version;
          c.huellaAprobada = huella(s, seg);
        }
        p.estado = "aprobada";
        p.decision = { fecha: iso() };
        if (actual)
          Object.assign(actual, { decision: "aprobada", decididaEn: iso() });
        if (p.tipo === "segmento") {
          const seg = db.segmentos.find((s) => s.id === p.objetivoId);
          if (seg) seg.estado = "aprobado";
        }
        if (p.tipo === "mejora" && p.objetivoId) {
          const cam = db.campanas.find((c) => c.id === p.objetivoId);
          if (cam) {
            cam.topeDiario = 15;
            reviseCampaign(cam);
          }
        }
        if (p.tipo === "enriquecimiento") {
          const e = db.empresas.find((e) => e.id === p.objetivoId);
          if (e) {
            e.tamano = "11-50";
            e.evidencias.push({
              campo: "tamano",
              valor: "11-50",
              fuente: "agente",
              obtenidoEn: iso(),
              estado: "inferido",
              cita: p.resumen,
            });
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
        let contenido = structuredClone(actual?.contenido);
        if (b.contenido !== undefined) {
          if (p.tipo !== "campana")
            throw Error("Solo las rutas de correo admiten editar el contenido");
          const nueva = leerRuta(b.contenido);
          if (!nueva) throw Error("La ruta no tiene el formato esperado");
          const errores = validarSecuencia(
            nueva as T.Secuencia,
            db.marca.prohibidas,
          );
          if (errores.length) throw Error(errores.join(". "));
          const { notasAgente, ...secuencia } = nueva;
          void notasAgente;
          const notas = notasEditadas(leerRuta(actual?.contenido), nueva);
          contenido = notas ? { ...secuencia, notasAgente: notas } : secuencia;
        }
        if (b.resumen !== undefined) p.resumen = b.resumen.trim();
        p.version++;
        p.estado = "pendiente";
        p.decision = undefined;
        p.versiones.push({
          version: p.version,
          contenido,
          fecha: iso(),
          autor: "admin",
        });
        if (p.tipo === "campana") {
          const c = db.campanas.find((c) => c.id === p.objetivoId);
          if (!c) throw Error("Campaña asociada no encontrada");
          Object.assign(c, trasEditarCampana(c));
          db.inscripciones
            .filter((i) => i.campanaId === c.id)
            .forEach((i) => {
              i.estado = "pausada";
              i.proximoEnvio = undefined;
            });
        }
        log("PUT", resource, p.id, null, { version: p.version });
        return HttpResponse.json({ ok: true, version: p.version });
      }
    } else if (resource === "secuencias") {
      const s = db.secuencias.find((x) => x.id === id);
      if (!s) throw Error("Secuencia no encontrada");
      if (action === "previsualizar") {
        const { contactoId } = z.object({ contactoId: z.string() }).parse(body);
        const c = db.contactos.find((c) => c.id === contactoId);
        if (!c) throw Error("Contacto no encontrado");
        return HttpResponse.json(renderMock(db, s.pasos, c));
      }
      const next = S.secuenciaSchema.parse(body);
      const errors = validarSecuencia(next, db.marca.prohibidas);
      if (errors.length) throw Error(errors.join(". "));
      Object.assign(s, next);
      db.campanas
        .filter((c) => c.secuenciaId === id)
        .forEach((c) => reviseCampaign(c, true));
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
    return fail(e instanceof Error ? e.message : "Datos no válidos");
  }
}
export const handlers = [
  http.all("*/api/*", async ({ request }) => {
    await delay(300 + Math.random() * 500);
    return route(request);
  }),
];
