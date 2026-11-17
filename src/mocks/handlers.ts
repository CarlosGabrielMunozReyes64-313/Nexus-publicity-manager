import { http, HttpResponse, delay } from "msw";
import { z } from "zod";
import { crearDatos, iso } from "./data";
import * as S from "../api/schemas";
import type * as T from "../types";
import {
  puedeInscribir,
  coincide,
  huella,
  trasEditarCampana,
  validarSecuencia,
} from "../lib/reglas";
export let db = crearDatos();
export const reset = () => {
  db = crearDatos();
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
function reviseCampaign(c: T.Campana) {
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
    p.estado = "pendiente";
    p.version++;
    p.versiones.push({ version: p.version, contenido, fecha: iso() });
  }
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
    if (resource === "contactos") {
      if (id === "importar") {
        const data = z
          .object({ contactos: z.array(S.contactoSchema) })
          .parse(body);
        for (const c of data.contactos) {
          if (
            db.contactos.some(
              (x) => x.correo?.toLowerCase() === c.correo?.toLowerCase(),
            )
          )
            continue;
          if (!db.empresas.some((e) => e.id === c.empresaId))
            throw Error("Empresa no válida");
          db.contactos.push({
            ...c,
            id: uid(),
            baseLegal: { ...c.baseLegal, aprobadaPorAdmin: false },
          });
        }
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
            .forEach(reviseCampaign);
        }
      }
    } else if (resource === "propuestas") {
      const p = db.propuestas.find((x) => x.id === id);
      if (!p) throw Error("Propuesta no encontrada");
      if (action === "rechazar") {
        const b = z
          .object({ comentario: z.string().trim().min(3) })
          .parse(body);
        p.estado = "rechazada";
        p.decision = { fecha: iso(), comentario: b.comentario };
      } else if (action === "aprobar") {
        if (p.estado === "aprobada") throw Error("Propuesta ya aprobada");
        if (p.tipo === "correo_inferido")
          throw Error(
            "Un correo inferido requiere verificación; no se aprueba para envíos",
          );
        p.estado = "aprobada";
        p.decision = { fecha: iso() };
        if (p.tipo === "campana") {
          const c = db.campanas.find((c) => c.id === p.objetivoId);
          if (!c) throw Error("Campaña asociada no encontrada");
          const s = db.secuencias.find((s) => s.id === c.secuenciaId)!;
          const seg = db.segmentos.find((s) => s.id === c.segmentoId)!;
          const errors = validarSecuencia(s, db.marca.prohibidas);
          if (errors.length) throw Error(errors.join(". "));
          c.estado = "aprobada";
          c.versionAprobada = p.version;
          c.huellaAprobada = huella(s, seg);
        }
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
        const b = z.object({ resumen: z.string().min(5) }).parse(body);
        p.resumen = b.resumen;
        p.version++;
        p.estado = "pendiente";
        p.versiones.push({
          version: p.version,
          contenido: b.resumen,
          fecha: iso(),
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
      }
    } else if (resource === "secuencias") {
      const s = db.secuencias.find((x) => x.id === id);
      if (!s) throw Error("Secuencia no encontrada");
      if (action === "previsualizar") {
        const { contactoId } = z.object({ contactoId: z.string() }).parse(body);
        const c = db.contactos.find((c) => c.id === contactoId);
        if (!c) throw Error("Contacto no encontrado");
        const e = db.empresas.find((e) => e.id === c.empresaId);
        const values: Record<string, string> = {
          nombre: c.nombre,
          empresa: e?.razonSocial ?? "su empresa",
          senal: e?.senales[0]?.descripcion ?? "",
          firma: db.marca.firma,
          baja: db.marca.baja,
        };
        const respaldo: string[] = [];
        const pasos = s.pasos.map((p) => ({
          ...p,
          cuerpo: p.cuerpo.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
            if (["firma", "baja"].includes(key)) return values[key];
            const verified = [...c.evidencias, ...(e?.evidencias ?? [])].some(
              (ev) =>
                (ev.campo === key ||
                  (key === "empresa" && ev.campo === "razonSocial")) &&
                ev.estado === "verificado",
            );
            if (verified && values[key]) return values[key];
            respaldo.push(key);
            return (
              p.variables.find((v) => v.nombre === key)?.respaldo ??
              (key === "nombre"
                ? "equipo"
                : key === "empresa"
                  ? "su empresa"
                  : "trabaja con empresas grandes de la región")
            );
          }),
        }));
        return HttpResponse.json({ pasos, respaldo });
      }
      const next = S.secuenciaSchema.parse(body);
      const errors = validarSecuencia(next, db.marca.prohibidas);
      if (errors.length) throw Error(errors.join(". "));
      Object.assign(s, next);
      db.campanas.filter((c) => c.secuenciaId === id).forEach(reviseCampaign);
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
          .forEach(reviseCampaign);
      } else if (id === "limites") {
        const l = S.limitesSchema.parse(body);
        if (
          l.ventana.desde >= l.ventana.hasta ||
          l.separacionSegundos[0] > l.separacionSegundos[1]
        )
          throw Error("Revise el orden de horas y separación");
        db.limites = l;
      } else db.clienteIdeal = S.clienteIdealSchema.parse(body);
    } else if (resource === "integraciones") {
      const i = db.integraciones.find((x) => x.id === id);
      if (!i) throw Error("Integración no encontrada");
      i.estado = action === "conectar" ? "conectada" : "desconectada";
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
      const b = z.object({ costoUSD: z.number().nonnegative() }).parse(body);
      db.metricas[db.metricas.length - 1].costoUSD = b.costoUSD;
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
