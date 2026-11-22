import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Modal, Table, Badge } from "../../components/ui";
import { Select, useCommand } from "../shared";
import { parseCSV } from "../../lib/reglas";
import { etiqueta } from "../../lib/formato";
import { importacionSchema } from "../../api/schemas";
import type { Contacto, Empresa } from "../../types";

// La autorización de formulario solo llega desde el webhook firmado del sitio.
const BASES = [
  "autorizacion_registrada",
  "corporativo_generico",
  "pendiente",
] as const;
const ORIGENES = [
  "manual",
  "registro",
  "referencia",
  "descubrimiento",
  "directo_desconocido",
] as const;
const MAX_BYTES = 2_000_000;
const seleccionSchema = z.object({
  origen: z.enum(ORIGENES),
  tipo: z.enum(BASES),
  empresaId: z.string().min(1),
});
type Seleccion = z.infer<typeof seleccionSchema>;
type Estado = "Listo" | "Duplicado" | "Inválido";
interface Resultado {
  creados: number;
  omitidos: number;
  rechazados: number;
}
const normalizar = (correo: string) => correo.replace(/\s+/g, "").toLowerCase();
const correoValido = (correo: string) =>
  z.string().email().safeParse(correo).success;
/** Propone columnas a partir del encabezado (nombre / correo o email). */
function detectarColumnas(encabezado: string[]) {
  const buscar = (patron: RegExp, defecto: number) => {
    const i = encabezado.findIndex((h) => patron.test(h.trim().toLowerCase()));
    return String(i >= 0 ? i : Math.min(defecto, encabezado.length - 1));
  };
  return {
    nombre: buscar(/^(nombre|name|contacto)/, 0),
    correo: buscar(/(correo|e-?mail|mail)/, 1),
  };
}
export default function ImportCSV({
  contactos,
  empresas,
  onClose,
}: {
  contactos: Contacto[];
  empresas: Empresa[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<string[][]>([]);
  const [archivo, setArchivo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mapping, setMapping] = useState({ nombre: "0", correo: "1" });
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState<Seleccion | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState("");
  const carga = useRef(0);
  const { register, handleSubmit, watch, reset } = useForm<{
    origen: string;
    tipo: string;
    empresaId: string;
  }>({ defaultValues: { origen: "", tipo: "", empresaId: "" } });
  const cmd = useCommand();
  const [empresaId, origen, tipo] = watch(["empresaId", "origen", "tipo"]);
  // Cambiar empresa, origen o base legal invalida la vista previa: el botón de
  // importar nunca usa una selección distinta de la que se revisó.
  useEffect(() => {
    setPreview(false);
    setSelected(null);
  }, [empresaId, origen, tipo]);
  const existentes = useMemo(
    () =>
      new Set(
        contactos
          .map((c) => (c.correo ? normalizar(c.correo) : ""))
          .filter(Boolean),
      ),
    [contactos],
  );
  // Un conjunto de correos existentes y otro de vistos: cada fila se comprueba una vez.
  const parsed = useMemo(() => {
    const vistos = new Set<string>();
    return rows.slice(1).map((r) => {
      const nombre = (r[Number(mapping.nombre)] ?? "").trim();
      const correo = normalizar(r[Number(mapping.correo)] ?? "");
      let status: Estado = "Listo";
      if (!nombre || !correoValido(correo)) status = "Inválido";
      else if (existentes.has(correo) || vistos.has(correo))
        status = "Duplicado";
      else vistos.add(correo);
      return { nombre, correo, status };
    });
  }, [rows, mapping, existentes]);
  const cuenta = (s: Estado) => parsed.filter((r) => r.status === s).length;
  const listos = cuenta("Listo");
  const limpiar = () => {
    setRows([]);
    setArchivo("");
    setPreview(false);
    setSelected(null);
    setResultado(null);
    setError("");
  };
  const cargar = async (file: File | undefined) => {
    // Cada carga empieza desde cero; una lectura anterior que termine tarde se ignora.
    const token = ++carga.current;
    limpiar();
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(
        `«${file.name}» supera 2 MB. Divida el archivo en partes más pequeñas.`,
      );
      return;
    }
    setCargando(true);
    try {
      const texto = await file.text();
      if (token !== carga.current) return;
      const filas = parseCSV(texto);
      if (filas.length < 2)
        throw new Error(
          "El archivo no tiene filas de datos bajo el encabezado.",
        );
      setRows(filas);
      setArchivo(file.name);
      setMapping(detectarColumnas(filas[0]));
    } catch (e) {
      if (token === carga.current)
        setError(
          `«${file.name}» no se puede usar: ${
            e instanceof Error ? e.message : "archivo inválido"
          }`,
        );
    } finally {
      if (token === carga.current) setCargando(false);
    }
  };
  const nombreEmpresa = (id: string) =>
    empresas.find((e) => e.id === id)?.razonSocial ?? "Empresa no encontrada";
  return (
    <Modal title="Importar contactos CSV" onClose={onClose}>
      <p>1. Subir → 2. Mapear → 3. Revisar → 4. Confirmar</p>
      {resultado ? (
        <div className="stack">
          <p className="notice" role="status">
            Importación terminada: <strong>{resultado.creados}</strong> filas
            creadas, <strong>{resultado.omitidos}</strong> omitidas por
            duplicadas y <strong>{resultado.rechazados}</strong> rechazadas por
            datos inválidos.
          </p>
          <p className="muted">
            Las bases legales quedan pendientes de aprobación y los correos sin
            verificar.
          </p>
          <div className="row">
            <Button
              onClick={() => {
                carga.current++;
                limpiar();
                reset();
              }}
            >
              Importar otro archivo
            </Button>
            <Button variant="primary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <label>
            Archivo CSV (con encabezado; máximo 2 MB)
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const input = e.currentTarget;
                void cargar(input.files?.[0]).finally(() => {
                  // Permite volver a elegir el mismo archivo después de corregirlo.
                  input.value = "";
                });
              }}
            />
          </label>
          {cargando && <p role="status">Validando archivo…</p>}
          {archivo && !cargando && (
            <p>
              <small>
                Archivo actual: <strong>{archivo}</strong> · {parsed.length}{" "}
                filas
              </small>
            </p>
          )}
          {rows.length > 0 && !cargando && (
            <form
              className="stack"
              onSubmit={handleSubmit((v) => {
                const result = seleccionSchema.safeParse(v);
                if (!result.success) {
                  setError("Seleccione empresa, origen y base legal");
                  return;
                }
                setSelected(result.data);
                setPreview(true);
                setError("");
              })}
            >
              <div className="grid">
                <Select
                  all={false}
                  label="Columna de nombre"
                  value={mapping.nombre}
                  onChange={(v) => {
                    setMapping({ ...mapping, nombre: v });
                    setPreview(false);
                  }}
                  options={rows[0].map((s, i) => ({
                    value: String(i),
                    label: s || `Columna ${i + 1}`,
                  }))}
                />
                <Select
                  all={false}
                  label="Columna de correo"
                  value={mapping.correo}
                  onChange={(v) => {
                    setMapping({ ...mapping, correo: v });
                    setPreview(false);
                  }}
                  options={rows[0].map((s, i) => ({
                    value: String(i),
                    label: s || `Columna ${i + 1}`,
                  }))}
                />
              </div>
              <label>
                Empresa de estos contactos
                <select {...register("empresaId")}>
                  <option value="">Seleccionar empresa</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.razonSocial}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid">
                <label>
                  Origen obligatorio
                  <select {...register("origen")}>
                    <option value="">Seleccionar</option>
                    {ORIGENES.map((o) => (
                      <option key={o} value={o}>
                        {etiqueta(o)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Base legal obligatoria
                  <select {...register("tipo")}>
                    <option value="">Seleccionar</option>
                    {BASES.map((o) => (
                      <option key={o} value={o}>
                        {etiqueta(o)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Button type="submit">Previsualizar importación</Button>
            </form>
          )}
          {error && (
            <p role="alert" className="danger">
              {error}
            </p>
          )}
          {preview && selected && rows.length > 0 && !cargando && (
            <>
              <Table
                data={parsed}
                columns={[
                  { accessorKey: "nombre", header: "Nombre" },
                  { accessorKey: "correo", header: "Correo" },
                  {
                    accessorKey: "status",
                    header: "Estado",
                    cell: (c) => <Badge>{c.row.original.status}</Badge>,
                  },
                ]}
              />
              <p className="notice">
                {listos} listas · {cuenta("Duplicado")} duplicadas ·{" "}
                {cuenta("Inválido")} inválidas. Se omiten duplicados y filas
                inválidas. Las bases legales quedan pendientes de aprobación;
                los correos quedan sin verificar.
              </p>
              <Button
                variant="primary"
                disabled={!listos || cmd.pending}
                onClick={() => {
                  const seleccion = selected;
                  const filas = parsed.filter((r) => r.status === "Listo");
                  const omitidas = cuenta("Duplicado");
                  const invalidas = cuenta("Inválido");
                  cmd.confirm({
                    title: "Confirmar importación",
                    summary: (
                      <div className="stack">
                        <p>
                          Se importarán <strong>{filas.length}</strong>{" "}
                          contactos de «{archivo}» con base legal sin aprobar.
                        </p>
                        <ul>
                          <li>
                            Empresa:{" "}
                            <strong>
                              {nombreEmpresa(seleccion.empresaId)}
                            </strong>
                          </li>
                          <li>
                            Origen:{" "}
                            <strong>{etiqueta(seleccion.origen)}</strong>
                          </li>
                          <li>
                            Base legal:{" "}
                            <strong>{etiqueta(seleccion.tipo)}</strong>
                          </li>
                        </ul>
                      </div>
                    ),
                    run: async () => {
                      const r = importacionSchema.parse(
                        await cmd.run("/contactos/importar", {
                          contactos: filas.map((r) => ({
                            id: "nuevo",
                            empresaId: seleccion.empresaId,
                            nombre: r.nombre,
                            correo: r.correo,
                            estadoCorreo: "desconocido",
                            etapa: "identificado",
                            baseLegal: {
                              tipo: seleccion.tipo,
                              aprobadaPorAdmin: false,
                            },
                            excluido: false,
                            origen: seleccion.origen,
                            evidencias: [],
                            creadoEn: new Date().toISOString(),
                            actualizadoEn: new Date().toISOString(),
                          })),
                        }),
                      );
                      const total = {
                        creados: r.creados,
                        omitidos: r.omitidos + omitidas,
                        rechazados: r.rechazados + invalidas,
                      };
                      setResultado(total);
                      return `Importación terminada: ${total.creados} creadas, ${total.omitidos} omitidas, ${total.rechazados} rechazadas.`;
                    },
                  });
                }}
              >
                Importar filas válidas
              </Button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
