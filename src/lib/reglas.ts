import type {
  Contacto,
  Supresion,
  Campana,
  Secuencia,
  Segmento,
  Empresa,
  ReglaSegmento,
} from "../types";
export function motivoInscripcion(
  c: Contacto,
  supresiones: Supresion[] = [],
): string | null {
  if (c.excluido || c.etapa === "excluido") return "Contacto excluido";
  if (
    supresiones.some(
      (s) =>
        (s.correo && s.correo.toLowerCase() === c.correo?.toLowerCase()) ||
        (s.dominio &&
          c.correo?.toLowerCase().split("@")[1] === s.dominio.toLowerCase()),
    )
  )
    return "Correo o dominio suprimido";
  if (!c.baseLegal.aprobadaPorAdmin || c.baseLegal.tipo === "pendiente")
    return "Base legal sin aprobar";
  if (!c.correo || c.estadoCorreo !== "valido")
    return "Se requiere un correo válido";
  if (c.etapa === "cliente" || c.etapa === "postventa")
    return "La empresa ya es cliente";
  return null;
}
export const puedeInscribir = (c: Contacto, s: Supresion[] = []) =>
  motivoInscripcion(c, s) === null;
export function trasEditarCampana(c: Campana): Campana {
  return {
    ...c,
    estado: "en_revision",
    versionAprobada: undefined,
    huellaAprobada: undefined,
  };
}
export const datoMetrico = (n?: number | null) =>
  n == null ? "Sin datos" : String(n);
export function huella(s: Secuencia, segmento: Segmento): string {
  return JSON.stringify({
    s,
    reglas: segmento.reglas,
    version: segmento.version,
  });
}
export function coincide(
  c: Contacto,
  empresas: Empresa[],
  reglas: ReglaSegmento[],
): boolean {
  const e = empresas.find((x) => x.id === c.empresaId);
  return reglas.every((r) => {
    if (r.campo === "contactoIds") return r.valor.split(",").includes(c.id);
    const campos: Record<string, string> = {
      etapa: c.etapa,
      origen: c.origen,
      municipio: e?.municipio ?? "",
      sector: e?.sector ?? "",
      tamano: e?.tamano ?? "",
      puntaje: String(e?.puntaje?.total ?? 0),
      baseLegal: c.baseLegal.aprobadaPorAdmin ? "aprobada" : "pendiente",
    };
    const valor = campos[r.campo] ?? "";
    switch (r.operador) {
      case "es":
        return valor === r.valor;
      case "no_es":
        return valor !== r.valor;
      case "contiene":
        return valor.toLowerCase().includes(r.valor.toLowerCase());
      case "mayor_que":
        return Number(valor) > Number(r.valor);
      case "menor_que":
        return Number(valor) < Number(r.valor);
    }
  });
}
export function validarSecuencia(
  s: Secuencia,
  prohibidas: string[] = [],
): string[] {
  const ventanaErrors: string[] = [];
  if (
    !s.ventanaEnvio.dias.length ||
    s.ventanaEnvio.desde >= s.ventanaEnvio.hasta
  )
    ventanaErrors.push("Ventana de envío inválida");
  if (!s.pasos.length) ventanaErrors.push("Se requiere al menos un paso");
  return [
    ...ventanaErrors,
    ...s.pasos.flatMap((p, i) => {
      const errores = [];
      if (i === 0 && !p.asunto?.trim()) errores.push("Paso 1: falta asunto");
      if (!p.cuerpo.includes("{{baja}}"))
        errores.push(`Paso ${i + 1}: falta {{baja}}`);
      if (!p.cuerpo.includes("{{firma}}"))
        errores.push(`Paso ${i + 1}: falta {{firma}}`);
      if (p.cuerpo.length > 3000 || p.cuerpo.length < 30)
        errores.push(`Paso ${i + 1}: longitud entre 30 y 3000 caracteres`);
      if (p.esperaDiasHabiles < 0)
        errores.push("La espera no puede ser negativa");
      for (const palabra of prohibidas)
        if (palabra && p.cuerpo.toLowerCase().includes(palabra.toLowerCase()))
          errores.push(`Palabra prohibida: ${palabra}`);
      return errores;
    }),
  ];
}
export function parseCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (comillas && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else comillas = !comillas;
    } else if (c === "," && !comillas) {
      fila.push(celda);
      celda = "";
    } else if ((c === "\n" || c === "\r") && !comillas) {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda);
      if (fila.some(Boolean)) filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (comillas) throw new Error("CSV inválido: comillas sin cerrar");
  fila.push(celda);
  if (fila.some(Boolean)) filas.push(fila);
  return filas;
}
