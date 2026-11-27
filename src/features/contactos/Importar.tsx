import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { request } from "../../api/client";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import { Badge, Button, Modal, Table, useFeedback } from "../../components/ui";
import { etiqueta } from "../../lib/formato";
import type { Empresa } from "../../types";
import { Select } from "../shared";

type Analisis = z.infer<typeof S.analisisImportacionSchema>;
type Previa = z.infer<typeof S.previaImportacionSchema>;
type Campo = z.infer<typeof S.campoImportacionSchema>;
type FilaInforme = { fila: number; resultado: string; motivo: string };

// La autorización de formulario solo llega desde el webhook firmado del sitio.
const BASES = [
  "pendiente",
  "autorizacion_registrada",
  "corporativo_generico",
] as const;
const ORIGENES = [
  "manual",
  "registro",
  "referencia",
  "descubrimiento",
  "directo_desconocido",
] as const;
const MAX_BYTES = 4_000_000;
export const CAMPOS: [Campo, string, boolean][] = [
  ["nombre", "Nombre", true],
  ["correo", "Correo", true],
  ["cargo", "Cargo", false],
  ["telefono", "Teléfono", false],
  ["empresa", "Empresa (razón social)", false],
  ["nit", "NIT", false],
  ["municipio", "Municipio", false],
  ["sector", "Sector", false],
  ["sitioWeb", "Sitio web", false],
];
const ACCION: Record<
  string,
  [string, "success" | "warning" | "error" | "info"]
> = {
  crear: ["Crear", "success"],
  actualizar: ["Actualizar", "info"],
  omitir: ["Omitir", "warning"],
  error: ["Error", "error"],
  creado: ["Creado", "success"],
  actualizado: ["Actualizado", "info"],
};

async function bytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(r.result as ArrayBuffer);
    r.onerror = () => mal(r.error);
    r.readAsArrayBuffer(file);
  });
}
async function aBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await bytes(file));
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Importación de contactos .csv o .xlsx: el servidor lee, valida y aplica por lotes. */
export default function Importar({
  empresas,
  onClose,
}: {
  empresas: Empresa[];
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const { confirm } = useFeedback();
  const listas = useResource("/listas", S.listaSchema.array());
  const [archivo, setArchivo] = useState("");
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [mapeo, setMapeo] = useState<Partial<Record<Campo, string>>>({});
  const [existentes, setExistentes] = useState<"omitir" | "actualizar">(
    "omitir",
  );
  const [vacios, setVacios] = useState<"conservar" | "borrar">("conservar");
  const [empresaId, setEmpresaId] = useState("");
  const [crearEmpresas, setCrearEmpresas] = useState(true);
  const [listaId, setListaId] = useState("");
  const [origen, setOrigen] = useState<string>("manual");
  const [tipo, setTipo] = useState<string>("pendiente");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [informe, setInforme] = useState<{
    creados: number;
    actualizados: number;
    omitidos: number;
    fallidos: number;
    filas: FilaInforme[];
  } | null>(null);
  const [progreso, setProgreso] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const carga = useRef(0);

  const opciones = {
    existentes,
    vacios,
    empresaId: empresaId || undefined,
    crearEmpresas,
    listaId: listaId || undefined,
    origen,
    baseLegal: { tipo },
  };
  const filas = useMemo(
    () =>
      (analisis?.filas ?? []).map((f) => ({
        fila: f.fila,
        datos: Object.fromEntries(
          CAMPOS.map(([c]) => [
            c,
            mapeo[c] === undefined || mapeo[c] === ""
              ? ""
              : (f.valores[Number(mapeo[c])] ?? ""),
          ]),
        ),
      })),
    [analisis, mapeo],
  );
  // Cualquier cambio de mapeo u opciones invalida la vista previa revisada.
  const invalidar = () => {
    setPrevia(null);
    setInforme(null);
  };
  const faltan = CAMPOS.filter(([c, , req]) => req && !mapeo[c]).map(
    ([, n]) => n,
  );
  const sinEmpresa = !mapeo.empresa && !empresaId;

  const cargar = async (file: File | undefined) => {
    const token = ++carga.current;
    setAnalisis(null);
    setPrevia(null);
    setInforme(null);
    setError("");
    setArchivo("");
    if (!file) return;
    if (!/\.(csv|xlsx|txt)$/i.test(file.name)) {
      setError(
        `«${file.name}» no es .csv ni .xlsx (los .xls antiguos deben guardarse como .xlsx).`,
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`«${file.name}» supera 4 MB: divídalo en partes más pequeñas.`);
      return;
    }
    setOcupado(true);
    try {
      const a = await request(
        "/contactos/importacion/analizar",
        S.analisisImportacionSchema,
        "POST",
        {
          nombreArchivo: file.name,
          contenido: await aBase64(file),
        },
      );
      if (token !== carga.current) return;
      setArchivo(file.name);
      setAnalisis(a);
      setMapeo(
        Object.fromEntries(
          Object.entries(a.mapeoSugerido).map(([k, v]) => [k, String(v)]),
        ),
      );
    } catch (e) {
      if (token === carga.current)
        setError(
          `«${file.name}»: ${e instanceof Error ? e.message : "no se pudo leer"}`,
        );
    } finally {
      if (token === carga.current) setOcupado(false);
    }
  };

  const previsualizar = async () => {
    setOcupado(true);
    setError("");
    try {
      setPrevia(
        await request(
          "/contactos/importacion/previsualizar",
          S.previaImportacionSchema,
          "POST",
          { filas, opciones },
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo previsualizar");
    } finally {
      setOcupado(false);
    }
  };

  const importar = async () => {
    if (!previa || !analisis) return;
    const aplicar = new Set(
      previa.filas
        .filter((f) => f.accion === "crear" || f.accion === "actualizar")
        .map((f) => f.fila),
    );
    const lote = analisis.limites.lote;
    const enviar = filas.filter((f) => aplicar.has(f.fila));
    const total = {
      creados: 0,
      actualizados: 0,
      omitidos: 0,
      fallidos: 0,
      filas: [] as FilaInforme[],
    };
    // Lo que la vista previa ya marcó como omitido o con error entra en el informe.
    for (const f of previa.filas)
      if (f.accion === "omitir" || f.accion === "error") {
        total[f.accion === "omitir" ? "omitidos" : "fallidos"] += 1;
        total.filas.push({
          fila: f.fila,
          resultado: f.accion,
          motivo: f.motivo,
        });
      }
    try {
      for (let i = 0; i < enviar.length; i += lote) {
        setProgreso(
          `Importando filas ${i + 1}–${Math.min(i + lote, enviar.length)} de ${enviar.length}…`,
        );
        const r = await request(
          "/contactos/importacion/confirmar",
          S.resultadoImportacionSchema,
          "POST",
          {
            filas: enviar.slice(i, i + lote),
            opciones,
          },
        );
        total.creados += r.creados;
        total.actualizados += r.actualizados;
        total.omitidos += r.omitidos;
        total.fallidos += r.fallidos;
        total.filas.push(
          ...r.filas.filter(
            (x) => x.resultado === "omitir" || x.resultado === "error",
          ),
        );
      }
    } catch (e) {
      // Los lotes ya aplicados quedan guardados; se informa dónde se detuvo.
      setError(
        `La importación se detuvo: ${e instanceof Error ? e.message : "error"}. Los lotes anteriores quedaron guardados.`,
      );
    } finally {
      setProgreso("");
      total.filas.sort((a, b) => a.fila - b.fila);
      setInforme(total);
      await cache.invalidateQueries();
    }
  };

  const empresaNombre = empresas.find((e) => e.id === empresaId)?.razonSocial;
  const listaNombre = listas.data?.find((l) => l.id === listaId)?.nombre;
  return (
    <Modal title="Importar contactos" onClose={() => !progreso && onClose()}>
      <div className="stack">
        <label>
          Archivo (.csv o .xlsx, hasta 4 MB y 20.000 filas)
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => void cargar(e.target.files?.[0])}
          />
        </label>
        {ocupado && !analisis && <p className="muted">Leyendo el archivo…</p>}
        {error && (
          <p role="alert" className="danger">
            {error}
          </p>
        )}
        {analisis && !informe && (
          <>
            <p className="muted">
              «{archivo}»{analisis.hoja ? ` · hoja «${analisis.hoja}»` : ""}:{" "}
              {analisis.totalFilas} filas con datos
              {analisis.filasVacias
                ? ` · ${analisis.filasVacias} vacías ignoradas`
                : ""}
              .
            </p>
            <fieldset>
              <legend>Columnas</legend>
              <div className="grid">
                {CAMPOS.map(([c, nombre, req]) => (
                  <Select
                    key={c}
                    all={false}
                    label={`${nombre}${req ? " (obligatorio)" : ""}`}
                    value={mapeo[c] ?? ""}
                    onChange={(v) => {
                      setMapeo({ ...mapeo, [c]: v });
                      invalidar();
                    }}
                    options={[
                      { value: "", label: "— No importar —" },
                      ...analisis.columnas.map((h, i) => ({
                        value: String(i),
                        label: h,
                      })),
                    ]}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Opciones</legend>
              <label>
                Si el correo ya existe
                <select
                  value={existentes}
                  onChange={(e) => {
                    setExistentes(e.target.value as "omitir" | "actualizar");
                    invalidar();
                  }}
                >
                  <option value="omitir">
                    Omitir la fila (no tocar el contacto)
                  </option>
                  <option value="actualizar">
                    Actualizar el contacto existente
                  </option>
                </select>
              </label>
              {existentes === "actualizar" && (
                <label>
                  Celdas vacías al actualizar
                  <select
                    value={vacios}
                    onChange={(e) => {
                      setVacios(e.target.value as "conservar" | "borrar");
                      invalidar();
                    }}
                  >
                    <option value="conservar">
                      Conservar el dato existente
                    </option>
                    <option value="borrar">
                      Borrar el dato existente (cargo y teléfono)
                    </option>
                  </select>
                </label>
              )}
              <Select
                all={false}
                label={
                  mapeo.empresa
                    ? "Empresa si la celda está vacía"
                    : "Empresa de estos contactos"
                }
                value={empresaId}
                onChange={(v) => {
                  setEmpresaId(v);
                  invalidar();
                }}
                options={[
                  {
                    value: "",
                    label: mapeo.empresa
                      ? "Ninguna (marcar error)"
                      : "Elija una empresa",
                  },
                  ...empresas.map((e) => ({
                    value: e.id,
                    label: e.razonSocial,
                  })),
                ]}
              />
              {mapeo.empresa && (
                <label className="row">
                  <input
                    type="checkbox"
                    checked={crearEmpresas}
                    onChange={(e) => {
                      setCrearEmpresas(e.target.checked);
                      invalidar();
                    }}
                  />
                  Crear las empresas que no existan (se buscan por NIT, dominio
                  y nombre)
                </label>
              )}
              <Select
                all={false}
                label="Asignar a la lista"
                value={listaId}
                onChange={(v) => {
                  setListaId(v);
                  invalidar();
                }}
                options={[
                  { value: "", label: "Ninguna" },
                  ...(listas.data ?? [])
                    .filter((l) => l.tipo === "estatica")
                    .map((l) => ({ value: l.id, label: l.nombre })),
                ]}
              />
              <label>
                Origen
                <select
                  value={origen}
                  onChange={(e) => {
                    setOrigen(e.target.value);
                    invalidar();
                  }}
                >
                  {ORIGENES.map((o) => (
                    <option key={o} value={o}>
                      {etiqueta(o)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Base legal de los contactos nuevos
                <select
                  value={tipo}
                  onChange={(e) => {
                    setTipo(e.target.value);
                    invalidar();
                  }}
                >
                  {BASES.map((o) => (
                    <option key={o} value={o}>
                      {etiqueta(o)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                Importar nunca verifica un correo ni aprueba una base legal. Un
                correo dado de baja nunca se importa ni se reactiva.
              </p>
            </fieldset>
            {faltan.length > 0 && (
              <p className="notice warning">
                Elija la columna de: {faltan.join(", ")}.
              </p>
            )}
            {sinEmpresa && (
              <p className="notice warning">
                Mapee la columna de empresa o elija una empresa para estos
                contactos.
              </p>
            )}
            <Button
              disabled={ocupado || faltan.length > 0 || sinEmpresa}
              onClick={() => void previsualizar()}
            >
              {ocupado ? "Validando…" : "Previsualizar importación"}
            </Button>
          </>
        )}
        {previa && !informe && (
          <>
            <p>
              <strong>
                {previa.resumen.crear} por crear · {previa.resumen.actualizar}{" "}
                por actualizar · {previa.resumen.omitir} omitidas ·{" "}
                {previa.resumen.error} con error
              </strong>
            </p>
            <Table
              data={previa.filas.slice(0, 500)}
              columns={[
                { accessorKey: "fila", header: "Fila" },
                { accessorKey: "nombre", header: "Nombre" },
                { accessorKey: "correo", header: "Correo" },
                {
                  id: "accion",
                  header: "Qué pasará",
                  cell: ({ row }) => (
                    <>
                      <Badge tono={ACCION[row.original.accion][1]}>
                        {ACCION[row.original.accion][0]}
                      </Badge>{" "}
                      <small>{row.original.motivo}</small>
                    </>
                  ),
                },
              ]}
            />
            <Button
              variant="primary"
              disabled={
                previa.resumen.crear + previa.resumen.actualizar === 0 ||
                Boolean(progreso)
              }
              onClick={() =>
                confirm({
                  title: "Confirmar importación",
                  summary: (
                    <ul>
                      <li>Archivo: {archivo}</li>
                      <li>
                        {previa.resumen.crear} contactos nuevos y{" "}
                        {previa.resumen.actualizar} actualizados
                        {existentes === "actualizar"
                          ? ` (celdas vacías: ${vacios === "conservar" ? "se conservan" : "se borran"})`
                          : ""}
                      </li>
                      {empresaNombre && (
                        <li>Empresa por defecto: {empresaNombre}</li>
                      )}
                      {listaNombre && <li>Lista: {listaNombre}</li>}
                      <li>Origen: {origen}</li>
                      <li>Base legal: {tipo}</li>
                    </ul>
                  ),
                  run: importar,
                })
              }
            >
              Importar filas válidas
            </Button>
          </>
        )}
        {progreso && <p role="status">{progreso}</p>}
        {informe && (
          <>
            <p role="status">
              <strong>
                Importación terminada: {informe.creados} creadas ·{" "}
                {informe.actualizados} actualizadas · {informe.omitidos}{" "}
                omitidas · {informe.fallidos} con error.
              </strong>
            </p>
            {informe.filas.length > 0 && (
              <Table
                data={informe.filas}
                columns={[
                  { accessorKey: "fila", header: "Fila" },
                  {
                    id: "resultado",
                    header: "Resultado",
                    cell: ({ row }) => (
                      <Badge tono={ACCION[row.original.resultado]?.[1]}>
                        {ACCION[row.original.resultado]?.[0] ??
                          row.original.resultado}
                      </Badge>
                    ),
                  },
                  { accessorKey: "motivo", header: "Motivo" },
                ]}
              />
            )}
            <Button onClick={onClose}>Cerrar</Button>
          </>
        )}
      </div>
    </Modal>
  );
}
