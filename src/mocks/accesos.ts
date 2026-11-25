/**
 * Modo demostración: identidad, solicitudes de acceso, roles y notificaciones.
 * Reproduce las reglas del backend (app/seguridad/auth.py, accesos.py, permisos.py y
 * app/notificaciones.py) en memoria. Google se simula con un selector de cuentas.
 *
 * La sesión de la demostración es el id de la cuenta guardado en sessionStorage
 * («nexus-session»). El valor antiguo «demo» equivale al administrador.
 */
import { HttpResponse, type JsonBodyType } from "msw";
import { z } from "zod";
import type * as S from "../api/schemas";
import { iso } from "./data";
import { ADMIN_CORREO } from "./secuencias";

type Rol = z.infer<typeof S.rolSchema>;
type Cuenta = {
  id: string;
  correo: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
};
type Solicitud = z.infer<typeof S.solicitudAccesoSchema> & {
  cuentaId?: string;
};
type Aviso = z.infer<typeof S.notificacionSchema> & {
  destinatarioId: string;
  clave: string;
};

export const ADMIN_DEMO_ID = "adm-demo";
export const CLAVE_SESION = "nexus-session";
const HUECO_INCIDENTE_MS = 6 * 3600 * 1000;
const SIN_PERMISO = "Su cuenta no tiene permiso para esta acción";
const PANTALLAS: Record<Rol, string[]> = {
  administrador: [
    "panel",
    "contactos",
    "empresas",
    "descubrimiento",
    "segmentos",
    "secuencias",
    "campanas",
    "respuestas",
    "embudo",
    "informes",
    "configuracion",
    "auditoria",
    "terminal",
    "solicitudes-acceso",
  ],
  usuario: [],
};
PANTALLAS.usuario = PANTALLAS.administrador.filter(
  (p) => p !== "solicitudes-acceso",
);
const CAPACIDADES: Record<Rol, string[]> = {
  administrador: [
    "panel:ver",
    "datos:ver",
    "datos:modificar",
    "campanas:modificar",
    "envios:gestionar",
    "integraciones:gestionar",
    "configuracion:gestionar",
    "accesos:gestionar",
    "auditoria:ver",
  ],
  usuario: [],
};
// Usuario aprobado: todo lo del administrador salvo gestionar accesos.
CAPACIDADES.usuario = CAPACIDADES.administrador.filter(
  (c) => c !== "accesos:gestionar",
);

let cuentas: Cuenta[] = [];
let solicitudes: Solicitud[] = [];
let avisos: Aviso[] = [];
const uid = () => crypto.randomUUID();

export function resetAccesos() {
  cuentas = [
    {
      id: ADMIN_DEMO_ID,
      correo: ADMIN_CORREO,
      nombre: "Administrador NEXUS",
      rol: "administrador",
      activo: true,
    },
  ];
  solicitudes = [];
  avisos = [];
  // Una solicitud de ejemplo para que la bandeja y la pantalla no empiecen vacías.
  registrarSolicitud("laura.gomez@ejemplo.com", "Laura Gómez", iso(1));
}

function sesionId(): string | null {
  try {
    const v = sessionStorage.getItem(CLAVE_SESION);
    return v === "demo" ? ADMIN_DEMO_ID : v;
  } catch {
    return null;
  }
}
function guardarSesion(id: string | null) {
  try {
    if (id) sessionStorage.setItem(CLAVE_SESION, id);
    else sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    /* Sin almacenamiento: la sesión dura lo que la página. */
  }
}
/** Cuenta con sesión válida en la demostración. */
export function cuentaActual(): Cuenta | null {
  const id = sesionId();
  return cuentas.find((c) => c.id === id && c.activo) ?? null;
}

function notificar(
  destinatarioId: string,
  a: Pick<Aviso, "tipo" | "titulo" | "descripcion" | "enlace" | "clave">,
  ahora = iso(),
) {
  const previo = avisos.find(
    (x) => x.destinatarioId === destinatarioId && x.clave === a.clave,
  );
  if (!previo) {
    avisos.unshift({
      ...a,
      id: uid(),
      destinatarioId,
      repeticiones: 1,
      creadaEn: ahora,
      ultimaVez: ahora,
      leida: false,
    });
    return;
  }
  const nuevoIncidente =
    Date.parse(ahora) - Date.parse(previo.ultimaVez) > HUECO_INCIDENTE_MS;
  Object.assign(previo, a, {
    repeticiones: nuevoIncidente ? 1 : previo.repeticiones + 1,
    creadaEn: nuevoIncidente ? ahora : previo.creadaEn,
    leida: nuevoIncidente ? false : previo.leida,
    leidaEn: nuevoIncidente ? undefined : previo.leidaEn,
    ultimaVez: ahora,
  });
}
/** Un aviso para cada administrador activo. */
export function notificarAdministradores(
  a: Pick<Aviso, "tipo" | "titulo" | "descripcion" | "enlace" | "clave">,
) {
  cuentas
    .filter((c) => c.activo && c.rol === "administrador")
    .forEach((c) => notificar(c.id, a));
}

function registrarSolicitud(correo: string, nombre: string, ahora = iso()) {
  const previa = solicitudes.find((s) => s.correo === correo);
  if (previa) {
    previa.ultimaIdentificacionEn = ahora;
    previa.identificaciones += 1;
    previa.nombre ??= nombre || undefined;
    return { estado: previa.estado, nueva: false };
  }
  const s: Solicitud = {
    id: uid(),
    correo,
    nombre: nombre || undefined,
    estado: "pendiente",
    creadaEn: ahora,
    ultimaIdentificacionEn: ahora,
    identificaciones: 1,
  };
  solicitudes.push(s);
  notificarAdministradores({
    tipo: "solicitud_acceso",
    titulo: "Nueva solicitud de acceso",
    descripcion: `${nombre ? `${nombre} (${correo})` : correo} pidió acceso a NEXUS con Google. Revísela para aprobarla o rechazarla.`,
    enlace: `/solicitudes-acceso?id=${s.id}`,
    clave: `solicitud:${s.id}`,
  });
  return { estado: s.estado, nueva: true };
}

/** Igual que resolver_identidad del backend, con una identidad de Google ya verificada. */
export function identificar(correoBruto: string, nombre: string) {
  const correo = correoBruto.trim().toLowerCase();
  const cuenta = cuentas.find((c) => c.correo === correo);
  if (cuenta) {
    if (!cuenta.activo) return { resultado: "acceso_denegado" as const };
    guardarSesion(cuenta.id);
    return { resultado: "sesion" as const };
  }
  guardarSesion(null);
  const { estado, nueva } = registrarSolicitud(correo, nombre.trim());
  if (estado === "rechazada") return { resultado: "rechazada" as const };
  return { resultado: nueva ? ("enviada" as const) : ("pendiente" as const) };
}

function publicaSolicitud(s: Solicitud) {
  const decidio = cuentas.find((c) => c.id === s.decididaPor?.id);
  const { cuentaId: _, ...resto } = s;
  void _;
  return {
    ...resto,
    ...(decidio
      ? {
          decididaPor: {
            id: decidio.id,
            nombre: decidio.nombre,
            correo: decidio.correo,
          },
        }
      : {}),
  };
}
function puedeVer(rol: Rol, enlace?: string) {
  if (!enlace) return false;
  const p = enlace.split("?")[0].replace(/^\/+/, "").split("/")[0] || "panel";
  return PANTALLAS[rol].includes(p);
}
function bandeja(cuenta: Cuenta) {
  const propias = avisos
    .filter((a) => a.destinatarioId === cuenta.id)
    .sort((a, b) => b.ultimaVez.localeCompare(a.ultimaVez));
  return {
    sinLeer: propias.filter((a) => !a.leida).length,
    items: propias.slice(0, 30).map((a) => {
      const { destinatarioId: _d, clave: _c, enlace, ...resto } = a;
      void _d;
      void _c;
      return { ...resto, ...(puedeVer(cuenta.rol, enlace) ? { enlace } : {}) };
    }),
  };
}

const json = (v: JsonBodyType, status = 200) =>
  HttpResponse.json(v, { status });
const falla = (message: string, status: number) =>
  HttpResponse.json({ message }, { status });

/**
 * Atiende /auth, /solicitudes-acceso y /notificaciones, y aplica los permisos del rol a
 * las demás rutas. Devuelve null si la petición debe seguir al resto de la demostración.
 */
export function rutaAccesos(
  path: string,
  method: string,
  body: unknown,
): Response | null {
  if (path === "/auth/demo/identificar" && method === "POST") {
    const b = z
      .object({ correo: z.string().email(), nombre: z.string().max(200) })
      .safeParse(body);
    if (!b.success) return falla("Escriba un correo válido", 400);
    return json(identificar(b.data.correo, b.data.nombre));
  }
  if (path === "/auth/demo/salir" && method === "POST") {
    guardarSesion(null);
    return json({ ok: true });
  }
  const cuenta = cuentaActual();
  if (path === "/auth/session") {
    if (!cuenta)
      return falla(
        "Su sesión venció o no es válida. Inicie sesión de nuevo",
        401,
      );
    return json({
      ok: true,
      cuenta: {
        id: cuenta.id,
        correo: cuenta.correo,
        nombre: cuenta.nombre,
        rol: cuenta.rol,
        rolEtiqueta:
          cuenta.rol === "administrador" ? "Administrador" : "Usuario",
      },
      permisos: {
        pantallas: PANTALLAS[cuenta.rol],
        capacidades: CAPACIDADES[cuenta.rol],
      },
    });
  }
  if (path.startsWith("/notificaciones")) {
    if (!cuenta) return falla("Inicie sesión para continuar", 401);
    if (path === "/notificaciones" && method === "GET")
      return json(bandeja(cuenta));
    if (path === "/notificaciones/leer-todas" && method === "POST") {
      let marcadas = 0;
      avisos
        .filter((a) => a.destinatarioId === cuenta.id && !a.leida)
        .forEach((a) => {
          a.leida = true;
          a.leidaEn = iso();
          marcadas += 1;
        });
      return json({ ok: true, marcadas });
    }
    const m = /^\/notificaciones\/([^/]+)\/leer$/.exec(path);
    if (m && method === "POST") {
      const a = avisos.find(
        (x) => x.id === m[1] && x.destinatarioId === cuenta.id,
      );
      if (!a) return falla("Aviso no encontrado", 404);
      if (!a.leida) Object.assign(a, { leida: true, leidaEn: iso() });
      return json({ ok: true });
    }
    return falla("Ruta no encontrada", 404);
  }
  if (path.startsWith("/solicitudes-acceso")) {
    if (!cuenta) return falla("Inicie sesión para continuar", 401);
    if (cuenta.rol !== "administrador") return falla(SIN_PERMISO, 403);
    if (path === "/solicitudes-acceso" && method === "GET")
      return json(
        [...solicitudes]
          .sort((a, b) =>
            a.estado === "pendiente" && b.estado === "pendiente"
              ? a.creadaEn.localeCompare(b.creadaEn)
              : a.estado === "pendiente"
                ? -1
                : b.estado === "pendiente"
                  ? 1
                  : (b.decididaEn ?? "").localeCompare(a.decididaEn ?? ""),
          )
          .map(publicaSolicitud),
      );
    const m = /^\/solicitudes-acceso\/([^/]+)\/(aprobar|rechazar)$/.exec(path);
    if (m && method === "POST") {
      const s = solicitudes.find((x) => x.id === m[1]);
      if (!s) return falla("Solicitud no encontrada", 404);
      if (s.estado !== "pendiente") {
        const quien =
          cuentas.find((c) => c.id === s.decididaPor?.id)?.nombre ??
          "otro administrador";
        return json(
          {
            message: `Esta solicitud ya fue ${s.estado} por ${quien}. Se conserva esa decisión.`,
            solicitud: publicaSolicitud(s),
          },
          409,
        );
      }
      s.estado = m[2] === "aprobar" ? "aprobada" : "rechazada";
      s.decididaEn = iso();
      s.decididaPor = {
        id: cuenta.id,
        nombre: cuenta.nombre,
        correo: cuenta.correo,
      };
      if (s.estado === "aprobada") {
        let destino = cuentas.find((c) => c.correo === s.correo);
        if (!destino) {
          destino = {
            id: uid(),
            correo: s.correo,
            nombre: s.nombre ?? s.correo.split("@")[0],
            rol: "usuario",
            activo: true,
          };
          cuentas.push(destino);
          notificar(destino.id, {
            tipo: "acceso_aprobado",
            titulo: "Tu acceso fue aprobado",
            descripcion:
              "Un administrador aprobó tu solicitud. Tienes acceso completo a NEXUS, salvo aprobar o rechazar solicitudes de acceso.",
            enlace: "/",
            clave: `acceso_aprobado:${s.id}`,
          });
        }
        s.cuentaId = destino.id;
      }
      return json({ ok: true, solicitud: publicaSolicitud(s) });
    }
    return falla("Ruta no encontrada", 404);
  }
  // Resto de la API: administradores y usuarios aprobados operan igual.
  return null;
}

/** Solo pruebas: crea una cuenta administrativa adicional o desactivada. */
export function agregarCuenta(c: Omit<Cuenta, "id">): string {
  const id = uid();
  cuentas.push({ ...c, id });
  return id;
}
resetAccesos();
