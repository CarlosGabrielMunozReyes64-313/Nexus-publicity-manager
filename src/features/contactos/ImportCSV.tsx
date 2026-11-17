import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Modal, Table, Badge } from "../../components/ui";
import { Select, useCommand } from "../shared";
import { parseCSV } from "../../lib/reglas";
import type { Contacto, Empresa } from "../../types";
const options = [
  "autorizacion_formulario",
  "autorizacion_registrada",
  "corporativo_generico",
  "pendiente",
];
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
  const [mapping, setMapping] = useState({ nombre: "0", correo: "1" });
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit } = useForm<{
    origen: string;
    tipo: string;
    empresaId: string;
  }>();
  const cmd = useCommand();
  const [selected, setSelected] = useState<{
    origen: Contacto["origen"];
    tipo: Contacto["baseLegal"]["tipo"];
    empresaId: string;
  } | null>(null);
  const parsed = rows.slice(1).map((r, i) => {
    const nombre = r[Number(mapping.nombre)] ?? "";
    const correo = (r[Number(mapping.correo)] ?? "").trim().toLowerCase();
    return {
      nombre,
      correo,
      status:
        !z.string().email().safeParse(correo).success || !nombre
          ? "Inválido"
          : contactos.some((c) => c.correo?.toLowerCase() === correo) ||
              rows
                .slice(1, i + 1)
                .some(
                  (pr) =>
                    pr[Number(mapping.correo)]?.trim().toLowerCase() === correo,
                )
            ? "Duplicado"
            : "Listo",
    };
  });
  return (
    <Modal title="Importar contactos CSV" onClose={onClose}>
      <p>1. Subir → 2. Mapear → 3. Revisar → 4. Confirmar</p>
      <label>
        Archivo CSV (nombre,correo)
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            try {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2000000) throw Error("Máximo 2 MB");
              setRows(parseCSV(await file.text()));
              setPreview(false);
              setError("");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Archivo inválido");
            }
          }}
        />
      </label>
      {rows.length > 0 && (
        <form
          className="stack"
          onSubmit={handleSubmit((v) => {
            const schema = z.object({
              origen: z.enum([
                "manual",
                "registro",
                "organico_busqueda",
                "organico_redes",
                "pagado",
                "correo",
                "referencia",
                "directo_desconocido",
                "descubrimiento",
              ]),
              tipo: z.enum([
                "autorizacion_formulario",
                "autorizacion_registrada",
                "corporativo_generico",
                "pendiente",
              ]),
              empresaId: z.string().min(1),
            });
            const result = schema.safeParse(v);
            if (!result.success) {
              setError("Seleccione origen, base legal y empresa");
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
              options={rows[0].map((s, i) => ({ value: String(i), label: s }))}
            />
            <Select
              all={false}
              label="Columna de correo"
              value={mapping.correo}
              onChange={(v) => {
                setMapping({ ...mapping, correo: v });
                setPreview(false);
              }}
              options={rows[0].map((s, i) => ({ value: String(i), label: s }))}
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
                {[
                  "manual",
                  "registro",
                  "referencia",
                  "descubrimiento",
                  "directo_desconocido",
                ].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <label>
              Base legal obligatoria
              <select {...register("tipo")}>
                <option value="">Seleccionar</option>
                {options.map((o) => (
                  <option key={o}>{o}</option>
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
      {preview && selected && (
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
            Se omiten duplicados y filas inválidas. Las bases legales quedan
            pendientes de aprobación; los correos quedan sin verificar.
          </p>
          <Button
            variant="primary"
            disabled={!parsed.some((r) => r.status === "Listo")}
            onClick={() =>
              cmd.confirm({
                title: "Confirmar importación",
                summary: `Se crearán ${parsed.filter((r) => r.status === "Listo").length} contactos con base legal sin aprobar.`,
                run: async () => {
                  await cmd.run("/contactos/importar", {
                    contactos: parsed
                      .filter((r) => r.status === "Listo")
                      .map((r) => ({
                        id: crypto.randomUUID(),
                        empresaId: selected.empresaId,
                        nombre: r.nombre,
                        correo: r.correo,
                        estadoCorreo: "desconocido",
                        etapa: "identificado",
                        baseLegal: {
                          tipo: selected.tipo,
                          aprobadaPorAdmin: false,
                        },
                        excluido: false,
                        origen: selected.origen,
                        evidencias: [
                          {
                            campo: "correo",
                            valor: r.correo,
                            fuente: "manual",
                            obtenidoEn: new Date().toISOString(),
                            estado: "pendiente",
                          },
                        ],
                        creadoEn: new Date().toISOString(),
                        actualizadoEn: new Date().toISOString(),
                      })),
                  });
                  onClose();
                },
              })
            }
          >
            Importar filas válidas
          </Button>
        </>
      )}
    </Modal>
  );
}
