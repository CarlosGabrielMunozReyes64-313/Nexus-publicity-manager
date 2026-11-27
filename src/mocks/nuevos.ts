/**
 * Modo demostración: listas, plantillas, importación, contacto con empresa y estado de
 * envíos. Todo en memoria; nunca se envía un correo ni se llama a la API real.
 */
import { HttpResponse } from "msw";
import { iso } from "./data";
import type * as T from "../types";
import { coincide, motivoInscripcion, parseCSV } from "../lib/reglas";

type Db = {
  contactos: T.Contacto[];
  empresas: T.Empresa[];
  segmentos: T.Segmento[];
  supresiones: T.Supresion[];
  secuencias: T.Secuencia[];
  campanas: T.Campana[];
};
interface ListaMock {
  id: string;
  nombre: string;
  tipo: "estatica" | "vinculada";
  segmentoId?: string;
  archivada: boolean;
  miembros: string[];
  retirados: { id: string; motivo: "manual" | "baja"; fecha: string }[];
  creadoEn: string;
}
interface PlantillaMock {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  formato: "texto" | "html";
  cuerpoHtml?: string;
  version: number;
  archivada: boolean;
  actualizadoEn: string;
  predeterminada?: boolean;
  categoria?: string;
  descripcion?: string;
}
let listas: ListaMock[] = [];
let plantillas: PlantillaMock[] = [
  {
    id: "pl-demo",
    nombre: "Primer contacto (demo)",
    asunto: "Una pregunta para {{empresa}}",
    cuerpo:
      "Buenos días, {{nombre}}:\n\n¿Le sirve un diagnóstico RSE Express? {{enlace}}\n\n{{firma}}\n{{baja}}",
    formato: "texto",
    version: 1,
    archivada: false,
    actualizadoEn: iso(),
    predeterminada: true,
    categoria: "Primer contacto",
    descripcion:
      "Sin imágenes ni diseño: lo que mejor llega en un primer correo.",
  },
];
export function resetNuevos() {
  listas = [];
  plantillas = plantillas.filter((p) => p.id === "pl-demo");
}
const uid = () => crypto.randomUUID();
const ADMITIDAS = [
  "nombre",
  "cargo",
  "empresa",
  "municipio",
  "senal",
  "firma",
  "baja",
  "enlace",
];
const ok = (x: object = {}) => HttpResponse.json({ ok: true, ...x });
const fail = (message: string, status = 400) =>
  HttpResponse.json({ message }, { status });
const variables = (...t: (string | undefined)[]) => [
  ...new Set(
    t.flatMap((x) =>
      [...(x ?? "").matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]),
    ),
  ),
];
const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function idsLista(db: Db, l: ListaMock) {
  if (l.tipo === "vinculada") {
    const s = db.segmentos.find((x) => x.id === l.segmentoId);
    return s
      ? db.contactos
          .filter((c) => coincide(c, db.empresas, s.reglas))
          .map((c) => c.id)
      : [];
  }
  return l.miembros;
}
const elegible = (db: Db, id: string) => {
  const c = db.contactos.find((x) => x.id === id);
  return c ? motivoInscripcion(c, db.supresiones) : "Contacto no encontrado";
};
function vistaLista(db: Db, l: ListaMock) {
  const ids = idsLista(db, l);
  return {
    ...l,
    miembros: ids.length,
    elegibles: ids.filter((i) => !elegible(db, i)).length,
    retirados: l.retirados.length,
    campanas: [],
  };
}
function vistaPlantilla(p: PlantillaMock) {
  return {
    ...p,
    variables: variables(p.asunto, p.cuerpo, p.cuerpoHtml),
    sinBaja: !p.cuerpo.includes("{{baja}}"),
  };
}
function render(texto: string) {
  const datos: Record<string, string> = {
    nombre: "Laura Gómez",
    cargo: "Gerente de compras",
    empresa: "Agroindustrias del Valle S.A.S.",
    municipio: "Palmira",
    senal: "provee a ingenios azucareros de la región",
    firma: "Equipo NEXUS",
    baja: "Si no desea recibir mensajes, responda BAJA.\nRechazar / Darme de baja: [enlace al enviar]",
    enlace: "https://nexusinnovacion.com/diagnostico",
  };
  const conPie = texto.includes("{{baja}}") ? texto : `${texto}\n\n{{baja}}`;
  return conPie.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (_, v: string) => datos[v] ?? "",
  );
}

export function rutaNuevos(
  db: Db,
  path: string,
  method: string,
  body: unknown,
  params: URLSearchParams,
): Response | null {
  const parts = path.split("/").filter(Boolean);
  const [recurso, id, accion] = parts;
  const b = (body ?? {}) as Record<string, unknown>;
  // ------------------------------------------------------------ listas
  if (recurso === "listas") {
    if (method === "GET") {
      if (!id)
        return HttpResponse.json(
          listas
            .filter((l) => params.get("archivadas") === "true" || !l.archivada)
            .map((l) => vistaLista(db, l)),
        );
      const l = listas.find((x) => x.id === id);
      if (!l) return fail("Registro no encontrado", 404);
      if (accion === "miembros") {
        const ids = idsLista(db, l);
        return HttpResponse.json({
          total: ids.length,
          miembros: ids.map((i) => {
            const c = db.contactos.find((x) => x.id === i)!;
            const motivo = elegible(db, i);
            return {
              id: i,
              nombre: c.nombre,
              correo: c.correo,
              empresa:
                db.empresas.find((e) => e.id === c.empresaId)?.razonSocial ??
                "",
              elegible: !motivo,
              ...(motivo ? { motivo } : {}),
            };
          }),
          retirados: l.retirados.map((r) => ({
            id: r.id,
            nombre: db.contactos.find((c) => c.id === r.id)?.nombre ?? "",
            retiradoEn: r.fecha,
            motivoRetiro: r.motivo,
          })),
        });
      }
      return HttpResponse.json(vistaLista(db, l));
    }
    if (!id) {
      const nombre = String(b.nombre ?? "").trim();
      if (!nombre)
        return fail("El nombre de la lista requiere entre 1 y 120 caracteres");
      if (
        listas.some(
          (l) =>
            !l.archivada && l.nombre.toLowerCase() === nombre.toLowerCase(),
        )
      )
        return fail("Ya existe una lista activa con ese nombre", 409);
      const seg = db.segmentos.find((s) => s.id === b.segmentoId);
      const tipo = b.modo === "vinculada" ? "vinculada" : "estatica";
      const l: ListaMock = {
        id: uid(),
        nombre,
        tipo,
        segmentoId: tipo === "vinculada" ? seg?.id : undefined,
        archivada: false,
        miembros:
          seg && tipo === "estatica"
            ? db.contactos
                .filter((c) => coincide(c, db.empresas, seg.reglas))
                .map((c) => c.id)
            : ((b.contactoIds as string[]) ?? []),
        retirados: [],
        creadoEn: iso(),
      };
      listas.push(l);
      return ok({ id: l.id, miembros: l.miembros.length });
    }
    const l = listas.find((x) => x.id === id);
    if (!l) return fail("Registro no encontrado", 404);
    if (method === "PATCH") {
      if (typeof b.nombre === "string") l.nombre = b.nombre.trim();
      return ok();
    }
    if (accion === "archivar") l.archivada = true;
    else if (accion === "restaurar") l.archivada = false;
    else if (accion === "agregar") {
      if (l.tipo === "vinculada")
        return fail(
          "Esta lista sigue al segmento: sus miembros cambian con sus reglas.",
          409,
        );
      const nuevos = ((b.contactoIds as string[]) ?? []).filter(
        (x) => !l.miembros.includes(x),
      );
      l.miembros.push(...nuevos);
      return ok({ agregados: nuevos.length });
    } else if (accion === "quitar") {
      const ids = (b.contactoIds as string[]) ?? [];
      l.miembros = l.miembros.filter((x) => !ids.includes(x));
      l.retirados.push(
        ...ids.map((x) => ({ id: x, motivo: "manual" as const, fecha: iso() })),
      );
    } else return fail("Ruta no disponible", 404);
    return ok();
  }
  // ------------------------------------------------------------ plantillas
  if (recurso === "plantillas") {
    if (method === "GET") {
      if (!id)
        return HttpResponse.json(
          plantillas
            .filter((p) => params.get("archivadas") === "true" || !p.archivada)
            .map(vistaPlantilla),
        );
      const p = plantillas.find((x) => x.id === id);
      if (!p) return fail("Registro no encontrado", 404);
      if (accion === "para-paso") {
        let cuerpo = p.cuerpo;
        if (!cuerpo.includes("{{firma}}")) cuerpo += "\n\n{{firma}}";
        if (!cuerpo.includes("{{baja}}")) cuerpo += "\n\n{{baja}}";
        return HttpResponse.json({
          plantillaId: p.id,
          plantillaVersion: p.version,
          asunto: p.asunto,
          cuerpo,
          formato: p.formato,
          cuerpoHtml: p.cuerpoHtml,
        });
      }
      return HttpResponse.json(vistaPlantilla(p));
    }
    const datos = () => {
      const malas = variables(
        String(b.asunto ?? ""),
        String(b.cuerpo ?? ""),
      ).filter((v) => !ADMITIDAS.includes(v));
      if (malas.length)
        throw new Error(`La variable {{${malas[0]}}} no existe en NEXUS`);
      if (!String(b.nombre ?? "").trim() || !String(b.cuerpo ?? "").trim())
        throw new Error("Nombre y cuerpo son obligatorios");
      return {
        nombre: String(b.nombre),
        asunto: String(b.asunto ?? ""),
        cuerpo: String(b.cuerpo),
        formato: (b.formato === "html" ? "html" : "texto") as "texto" | "html",
        cuerpoHtml:
          b.formato === "html" ? String(b.cuerpoHtml ?? "") : undefined,
      };
    };
    try {
      if (id === "previsualizar" || accion === "previsualizar") {
        const p =
          id === "previsualizar"
            ? datos()
            : plantillas.find((x) => x.id === id)!;
        return HttpResponse.json({
          asunto: render(p.asunto).replace(/\n.*/s, ""),
          texto: render(p.cuerpo),
          respaldo: [],
          pieAgregado: !p.cuerpo.includes("{{baja}}"),
          variables: variables(p.asunto, p.cuerpo),
          admitidas: ADMITIDAS,
        });
      }
      if (!id) {
        const p = {
          id: uid(),
          ...datos(),
          version: 1,
          archivada: false,
          actualizadoEn: iso(),
        };
        plantillas.push(p);
        return ok({ id: p.id });
      }
      const p = plantillas.find((x) => x.id === id);
      if (!p) return fail("Registro no encontrado", 404);
      if (method === "PUT")
        Object.assign(p, datos(), {
          version: p.version + 1,
          actualizadoEn: iso(),
        });
      else if (accion === "duplicar") {
        const n = {
          ...p,
          id: uid(),
          nombre: `Copia de ${p.nombre}`,
          version: 1,
        };
        plantillas.push(n);
        return ok({ id: n.id });
      } else if (accion === "archivar") p.archivada = true;
      else if (accion === "restaurar") p.archivada = false;
      return ok();
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Datos no válidos");
    }
  }
  // ------------------------------------------------------------ importación
  if (path === "/contactos/importacion/analizar") {
    const nombre = String(b.nombreArchivo ?? "");
    if (!/\.csv$/i.test(nombre))
      return fail(
        "En la demostración solo se leen archivos .csv; el modo real admite también .xlsx",
      );
    let texto: string;
    try {
      const bin = atob(String(b.contenido ?? ""));
      texto = new TextDecoder().decode(
        Uint8Array.from(bin, (ch) => ch.charCodeAt(0)),
      );
    } catch {
      return fail("El archivo no llegó completo; vuelva a elegirlo");
    }
    let filas: string[][];
    try {
      filas = parseCSV(texto.replace(/^﻿/, ""));
    } catch (e) {
      return fail(e instanceof Error ? e.message : "CSV no válido");
    }
    const [enc = [], ...resto] = filas;
    const datos = resto
      .map((v, i) => ({ fila: i + 2, valores: v }))
      .filter((f) => f.valores.some((x) => x.trim()));
    const sugerido: Record<string, number> = {};
    enc.forEach((h, i) => {
      const k = normal(h);
      for (const [campo, nombres] of Object.entries({
        nombre: ["nombre", "name"],
        correo: ["correo", "email", "correoelectronico", "mail"],
        cargo: ["cargo"],
        telefono: ["telefono", "celular"],
        empresa: ["empresa", "razonsocial"],
        municipio: ["municipio", "ciudad"],
      }))
        if (!(campo in sugerido) && nombres.includes(k)) sugerido[campo] = i;
    });
    return HttpResponse.json({
      columnas: enc,
      filas: datos,
      totalFilas: datos.length,
      filasVacias: resto.length - datos.length,
      mapeoSugerido: sugerido,
      hojas: [],
      limites: { bytes: 4_000_000, filas: 20_000, lote: 500 },
    });
  }
  if (
    path === "/contactos/importacion/previsualizar" ||
    path === "/contactos/importacion/confirmar"
  ) {
    const confirmar = path.endsWith("confirmar");
    const op = (b.opciones ?? {}) as Record<string, unknown>;
    const filas = (b.filas ?? []) as {
      fila: number;
      datos: Record<string, string>;
    }[];
    const vistos = new Map<string, number>();
    const plan = filas.map((f) => {
      const d = f.datos;
      const correo = (d.correo ?? "").replace(/\s+/g, "").toLowerCase();
      const nombre = (d.nombre ?? "").trim();
      const base = { fila: f.fila, nombre, correo, empresa: d.empresa ?? "" };
      if (!nombre)
        return { ...base, accion: "error", motivo: "Falta el nombre" };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo))
        return {
          ...base,
          accion: "error",
          motivo: "Correo con formato no válido",
        };
      if (vistos.has(correo))
        return {
          ...base,
          accion: "omitir",
          motivo: `Correo repetido en el archivo (ya está en la fila ${vistos.get(correo)})`,
        };
      vistos.set(correo, f.fila);
      if (db.supresiones.some((s) => s.correo?.toLowerCase() === correo))
        return {
          ...base,
          accion: "omitir",
          motivo: "Correo dado de baja: no se importa ni se reactiva",
        };
      const existe = db.contactos.find(
        (c) => c.correo?.toLowerCase() === correo,
      );
      if (existe)
        return op.existentes === "actualizar"
          ? {
              ...base,
              accion: "actualizar",
              motivo: "Se actualizan los campos con valor",
              id: existe.id,
              d,
            }
          : {
              ...base,
              accion: "omitir",
              motivo: "Ya existe un contacto con ese correo",
            };
      const e =
        db.empresas.find(
          (x) => normal(x.razonSocial) === normal(d.empresa ?? ""),
        ) ?? db.empresas.find((x) => x.id === op.empresaId);
      if (!e)
        return {
          ...base,
          accion: "error",
          motivo:
            "Sin empresa: mapee la columna de empresa o elija una por defecto",
        };
      return {
        ...base,
        accion: "crear",
        motivo: `Empresa: ${e.razonSocial}`,
        empresaId: e.id,
        d,
      };
    });
    if (!confirmar) {
      const resumen = { crear: 0, actualizar: 0, omitir: 0, error: 0 };
      plan.forEach((p) => resumen[p.accion as keyof typeof resumen]++);
      return HttpResponse.json({
        resumen,
        filas: plan.map(
          ({ fila, accion, motivo, nombre, correo, empresa }) => ({
            fila,
            accion,
            motivo,
            nombre,
            correo,
            empresa,
          }),
        ),
      });
    }
    const res = {
      creados: 0,
      actualizados: 0,
      omitidos: 0,
      fallidos: 0,
      filas: [] as object[],
    };
    for (const p of plan) {
      if (p.accion === "crear" && "empresaId" in p) {
        const nuevo = {
          id: uid(),
          empresaId: p.empresaId,
          nombre: p.nombre,
          correo: p.correo,
          cargo: p.d.cargo || undefined,
          telefono: p.d.telefono || undefined,
          estadoCorreo: "desconocido",
          etapa: "identificado",
          origen: (op.origen as T.Contacto["origen"]) ?? "manual",
          baseLegal: {
            tipo: ((op.baseLegal as { tipo?: string })?.tipo ??
              "pendiente") as T.BaseLegal["tipo"],
            aprobadaPorAdmin: false,
          },
          excluido: false,
          evidencias: [],
          creadoEn: iso(),
          actualizadoEn: iso(),
        } as T.Contacto;
        db.contactos.push(nuevo);
        const l = listas.find((x) => x.id === op.listaId);
        if (l) l.miembros.push(nuevo.id);
        res.creados++;
        res.filas.push({ fila: p.fila, resultado: "creado", motivo: "" });
      } else if (p.accion === "actualizar" && "id" in p) {
        const c = db.contactos.find((x) => x.id === p.id)!;
        c.nombre = p.nombre;
        if (p.d.cargo) c.cargo = p.d.cargo;
        if (p.d.telefono) c.telefono = p.d.telefono;
        res.actualizados++;
        res.filas.push({ fila: p.fila, resultado: "actualizado", motivo: "" });
      } else {
        res[p.accion === "omitir" ? "omitidos" : "fallidos"]++;
        res.filas.push({ fila: p.fila, resultado: p.accion, motivo: p.motivo });
      }
    }
    return HttpResponse.json({ ok: true, ...res });
  }
  // ------------------------------------------------------------ contacto + empresa
  if (path === "/empresas/coincidencias") {
    const n = normal(String(b.razonSocial ?? ""));
    return HttpResponse.json(
      db.empresas
        .filter((e) => n && normal(e.razonSocial) === n)
        .map((e) => ({
          id: e.id,
          razonSocial: e.razonSocial,
          municipio: e.municipio,
          motivo: "Mismo nombre",
          exacta: false,
        })),
    );
  }
  if (path === "/contactos/con-empresa") {
    const ct = (b.contacto ?? {}) as Record<string, string>;
    const correo = (ct.correo ?? "").replace(/\s+/g, "").toLowerCase();
    if (correo && db.contactos.some((c) => c.correo?.toLowerCase() === correo))
      return fail("Ya existe un contacto con ese correo", 409);
    let empresaId = String(b.empresaId ?? "");
    let creada = false;
    if (b.empresaNueva) {
      const e = b.empresaNueva as Record<string, string>;
      const nueva = {
        id: uid(),
        razonSocial: e.razonSocial,
        municipio: e.municipio ?? "",
        sector: e.sector || "Otro",
        tamano: "desconocido",
        sitioWeb: e.sitioWeb,
        estadoCuenta: "prospecto",
        senales: [],
        evidencias: [],
      } as unknown as T.Empresa;
      db.empresas.push(nueva);
      empresaId = nueva.id;
      creada = true;
    }
    const nuevo = {
      id: uid(),
      empresaId,
      nombre: ct.nombre,
      correo: correo || undefined,
      cargo: ct.cargo,
      telefono: ct.telefono,
      estadoCorreo: "desconocido",
      etapa: "identificado",
      origen: "manual",
      baseLegal: { tipo: "pendiente", aprobadaPorAdmin: false },
      excluido: false,
      evidencias: [],
      creadoEn: iso(),
      actualizadoEn: iso(),
    } as T.Contacto;
    db.contactos.push(nuevo);
    return ok({ id: nuevo.id, empresaId, empresaCreada: creada });
  }
  // ------------------------------------------------------------ envíos (demostración)
  if (recurso === "secuencias" && accion === "envios" && method === "GET") {
    const s = db.secuencias.find((x) => x.id === id);
    const cam = db.campanas.find((c) => c.secuenciaId === id);
    return HttpResponse.json({
      aprobada: Boolean(s?.versionAprobada ?? cam?.versionAprobada),
      campanaId: cam?.id,
      campanaEstado: cam?.estado ?? "borrador",
      diagnostico: [
        {
          nivel: "info",
          texto:
            "Modo demostración: no se programan ni se envían correos. En la API real esta pestaña muestra cada destinatario.",
          accion: "",
        },
      ],
      destinatarios: [],
    });
  }
  if (
    recurso === "secuencias" &&
    (accion === "programar" || accion === "audiencia")
  )
    return ok({
      programacion: {
        activada: false,
        inscritos: 0,
        reanudadas: 0,
        elegibles: 0,
        motivo: "Modo demostración: no se programan envíos",
      },
    });
  if (path === "/imagenes")
    return method === "GET"
      ? HttpResponse.json([])
      : fail("En la demostración no se suben imágenes; use la API real");
  if (path === "/bajas/sincronizacion")
    return HttpResponse.json({
      configurada: false,
      pendientes: 0,
      sincronizadas: 0,
    });
  if (path === "/contactos/exportar")
    return fail(
      "En la demostración no se generan archivos de Excel; use la API real",
      400,
    );
  return null;
}
