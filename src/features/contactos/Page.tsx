import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, Upload } from "lucide-react";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import type { Contacto, Empresa, BaseLegal } from "../../types";
import {
  Button,
  Card,
  Badge,
  Table,
  EvidenceList,
  Modal,
  QueryState,
} from "../../components/ui";
import { Intro, Select, Resource, useCommand } from "../shared";
import { motivoInscripcion } from "../../lib/reglas";
import { fecha } from "../../lib/formato";
import ImportCSV from "./ImportCSV";
export default function Page() {
  const navigate = useNavigate();
  const q = useResource("/contactos", S.contactoSchema.array());
  const eq = useResource("/empresas", S.empresaSchema.array());
  const sup = useResource("/supresiones", S.supresionSchema.array());
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [segment, setSegment] = useState(false);
  const cmd = useCommand();
  const id = useLocation().pathname.split("/")[2];
  const data = q.data ?? [];
  const empresas = eq.data ?? [];
  const c = data.find((c) => c.id === id);
  const filtered = data.filter((c) => {
    const e = empresas.find((e) => e.id === c.empresaId);
    const campos: Record<string, string> = {
      etapa: c.etapa,
      municipio: e?.municipio ?? "",
      sector: e?.sector ?? "",
      baseLegal: c.baseLegal.aprobadaPorAdmin ? "aprobada" : "pendiente",
      estadoCorreo: c.estadoCorreo,
      origen: c.origen,
      excluido: c.excluido ? "sí" : "no",
    };
    return (
      `${c.nombre} ${c.correo}`.toLowerCase().includes(search.toLowerCase()) &&
      Object.entries(filters).every(([k, v]) => !v || campos[k] === v)
    );
  });
  return (
    <>
      <Intro
        title={c?.nombre ?? "Contactos"}
        description="Personas, procedencia y permisos. Una relación empieza con información confiable."
        action={
          !id && (
            <div className="row">
              <Button onClick={() => setImporting(true)}>
                <Upload size={16} />
                Importar CSV
              </Button>
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus size={16} />
                Nuevo contacto
              </Button>
            </div>
          )
        }
      />
      <QueryState
        loading={q.isPending || eq.isPending || sup.isPending}
        error={q.error ?? eq.error ?? sup.error}
        retry={() => {
          q.refetch();
          eq.refetch();
          sup.refetch();
        }}
      >
        {id ? (
          c ? (
            <ContactDetail c={c} empresas={empresas} />
          ) : (
            <Card>Contacto no encontrado.</Card>
          )
        ) : (
          <Card>
            <div className="toolbar">
              <label>
                Buscar
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre o correo"
                />
              </label>
              {Object.entries({
                etapa: S.etapaSchema.options,
                municipio: ["Palmira", "Candelaria", "Cali"],
                sector: [...new Set(empresas.map((e) => e.sector))],
                baseLegal: ["aprobada", "pendiente"],
                estadoCorreo: S.contactoSchema.shape.estadoCorreo.options,
                origen: S.origenSchema.options,
                excluido: ["sí", "no"],
              }).map(([k, options]) => (
                <Select
                  key={k}
                  label={
                    k === "baseLegal"
                      ? "Base legal"
                      : k === "estadoCorreo"
                        ? "Estado del correo"
                        : k
                  }
                  value={filters[k] ?? ""}
                  onChange={(v) => setFilters({ ...filters, [k]: v })}
                  options={options}
                />
              ))}
            </div>
            {selected.length > 0 && (
              <div className="toolbar">
                <strong>{selected.length} seleccionados</strong>
                <Button
                  onClick={() => {
                    let motivo = "";
                    cmd.confirm({
                      title: "Excluir contactos",
                      summary: `Se excluirán ${selected.length} contactos y saldrán de sus secuencias.`,
                      reason: true,
                      onReason: (s) => {
                        motivo = s;
                      },
                      run: async () => {
                        for (const id of selected)
                          await cmd.run(`/contactos/${id}/excluir`, { motivo });
                        setSelected([]);
                      },
                    });
                  }}
                >
                  Excluir selección
                </Button>
                <Button onClick={() => setSegment(true)}>
                  Añadir a segmento
                </Button>
              </div>
            )}
            <Table
              data={filtered}
              columns={[
                {
                  id: "select",
                  header: "Selección",
                  cell: ({ row }) => (
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${row.original.nombre}`}
                      checked={selected.includes(row.original.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, row.original.id]
                            : selected.filter((x) => x !== row.original.id),
                        )
                      }
                    />
                  ),
                },
                {
                  accessorKey: "nombre",
                  header: "Contacto",
                  cell: ({ row }) => (
                    <>
                      <Link to={`/contactos/${row.original.id}`}>
                        <strong>{row.original.nombre}</strong>
                      </Link>
                      <br />
                      <small>{row.original.correo}</small>
                    </>
                  ),
                },
                {
                  id: "empresa",
                  header: "Empresa",
                  cell: ({ row }) => (
                    <Link to={`/empresas/${row.original.empresaId}`}>
                      {
                        empresas.find((e) => e.id === row.original.empresaId)
                          ?.razonSocial
                      }
                    </Link>
                  ),
                },
                {
                  accessorKey: "etapa",
                  header: "Etapa",
                  cell: (c) => <Badge>{c.row.original.etapa}</Badge>,
                },
                {
                  id: "legal",
                  header: "Base legal",
                  cell: (c) => (
                    <Badge>
                      {c.row.original.baseLegal.aprobadaPorAdmin
                        ? "aprobada"
                        : "pendiente"}
                    </Badge>
                  ),
                },
                {
                  accessorKey: "estadoCorreo",
                  header: "Correo",
                  cell: (c) => <Badge>{c.row.original.estadoCorreo}</Badge>,
                },
                {
                  id: "inscribir",
                  header: "Campaña",
                  cell: ({ row }) => {
                    const motivo =
                      motivoInscripcion(row.original, sup.data ?? []) ||
                      (empresas.find((e) => e.id === row.original.empresaId)
                        ?.estadoCuenta === "cliente"
                        ? "Empresa cliente"
                        : null);
                    return (
                      <span title={motivo ?? "Abrir ficha para inscribir"}>
                        <Button
                          disabled={!!motivo}
                          onClick={() => {
                            navigate(`/contactos/${row.original.id}`);
                          }}
                        >
                          Inscribir
                        </Button>
                      </span>
                    );
                  },
                },
              ]}
            />
          </Card>
        )}
      </QueryState>
      {importing && (
        <ImportCSV
          contactos={data}
          empresas={empresas}
          onClose={() => setImporting(false)}
        />
      )}
      {creating && (
        <CreateContact empresas={empresas} onClose={() => setCreating(false)} />
      )}
      {segment && (
        <Modal
          title="Añadir selección a segmento"
          onClose={() => setSegment(false)}
        >
          <p>Se creará un segmento con los contactos seleccionados.</p>
          <p className="notice">
            Los segmentos usan reglas dinámicas; la selección exacta se conserva
            mediante una regla de contacto.
          </p>
          <Button
            onClick={() => {
              cmd.ask(
                "Crear segmento",
                "Se creará un segmento propuesto con la selección actual.",
                "/segmentos",
                {
                  id: "nuevo",
                  nombre: `Selección de ${selected.length} contactos`,
                  reglas: [
                    {
                      campo: "contactoIds",
                      operador: "es",
                      valor: selected.join(","),
                    },
                  ],
                  justificacion: "Selección manual del administrador",
                  tamano: selected.length,
                  version: 1,
                  estado: "propuesto",
                  propuestoPor: "admin",
                },
              );
              setSegment(false);
            }}
          >
            Crear segmento con selección
          </Button>
        </Modal>
      )}
    </>
  );
}
function CreateContact({
  empresas,
  onClose,
}: {
  empresas: Empresa[];
  onClose: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [eid, setEid] = useState(empresas[0]?.id ?? "");
  const cmd = useCommand();
  return (
    <Modal title="Nuevo contacto" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await cmd.save("/contactos", {
              id: "nuevo",
              empresaId: eid,
              nombre,
              correo,
              estadoCorreo: "desconocido",
              etapa: "identificado",
              baseLegal: { tipo: "pendiente", aprobadaPorAdmin: false },
              excluido: false,
              origen: "manual",
              evidencias: [
                {
                  campo: "nombre",
                  valor: nombre,
                  fuente: "manual",
                  obtenidoEn: new Date().toISOString(),
                  estado: "pendiente",
                },
              ],
              creadoEn: new Date().toISOString(),
              actualizadoEn: new Date().toISOString(),
            })
          )
            onClose();
        }}
      >
        <label>
          Nombre
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label>
          Correo
          <input
            type="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>
        <Select
          all={false}
          label="Empresa"
          value={eid}
          onChange={setEid}
          options={empresas.map((e) => ({ value: e.id, label: e.razonSocial }))}
        />
        <Button type="submit" variant="primary" disabled={cmd.pending}>
          Crear contacto
        </Button>
      </form>
    </Modal>
  );
}
function ContactDetail({ c, empresas }: { c: Contacto; empresas: Empresa[] }) {
  const cmd = useCommand();
  const [legal, setLegal] = useState<BaseLegal | null>(null);
  return (
    <>
      <Link to="/contactos">← Todos los contactos</Link>
      <div className="grid" style={{ marginTop: 20 }}>
        <div className="stack">
          <Card title="Datos y procedencia">
            <p>
              <Link to={`/empresas/${c.empresaId}`}>
                {empresas.find((e) => e.id === c.empresaId)?.razonSocial}
              </Link>{" "}
              · <Badge>{c.etapa}</Badge>
            </p>
            <EvidenceList items={c.evidencias} />
            <p>
              {c.correo} · <Badge>{c.estadoCorreo}</Badge>
            </p>
            <Button
              variant="danger"
              disabled={c.excluido}
              onClick={() => {
                let motivo = "";
                cmd.confirm({
                  title: "Excluir contacto",
                  summary:
                    "Se detendrán sus secuencias y se agregará a la lista de supresión.",
                  reason: true,
                  onReason: (s) => {
                    motivo = s;
                  },
                  run: () => cmd.run(`/contactos/${c.id}/excluir`, { motivo }),
                });
              }}
            >
              Excluir contacto
            </Button>
            {c.excluido && <p>{c.motivoExclusion}</p>}
          </Card>
          <Card title="Base legal">
            <Badge>
              {c.baseLegal.aprobadaPorAdmin ? "aprobada" : "pendiente"}
            </Badge>
            <p>{c.baseLegal.tipo}</p>
            <p>{c.baseLegal.texto ?? "Texto sin registrar"}</p>
            <p>Prueba: {c.baseLegal.prueba ?? "Pendiente"}</p>
            <div className="row">
              <Button onClick={() => setLegal({ ...c.baseLegal })}>
                Registrar evidencia legal
              </Button>
              <Button
                disabled={
                  c.baseLegal.aprobadaPorAdmin ||
                  c.baseLegal.tipo === "pendiente" ||
                  !c.baseLegal.prueba ||
                  !c.baseLegal.texto
                }
                onClick={() =>
                  cmd.ask(
                    "Aprobar base legal",
                    <>
                      Confirma que revisaste la autorización de{" "}
                      <strong>{c.nombre}</strong> y su prueba:{" "}
                      {c.baseLegal.prueba}.
                    </>,
                    `/contactos/${c.id}/base-legal/aprobar`,
                  )
                }
              >
                Aprobar base
              </Button>
            </div>
          </Card>
        </div>
        <div className="stack">
          <Card title="Línea de tiempo">
            <Resource
              path={`/contactos/${c.id}/interacciones`}
              schema={S.interaccionSchema.array()}
            >
              {(items) => (
                <div className="timeline">
                  {items.map((i) => (
                    <article key={i.id}>
                      <small>
                        {fecha(i.fecha)} · {i.tipo}
                      </small>
                      <p>{i.resumen}</p>
                    </article>
                  ))}
                </div>
              )}
            </Resource>
          </Card>
          <Card title="Campañas">
            <Resource path="/supresiones" schema={S.supresionSchema.array()}>
              {(sup) => (
                <Resource path="/campanas" schema={S.campanaSchema.array()}>
                  {(campanas) => (
                    <>
                      {campanas.map((cam) => (
                        <div key={cam.id}>
                          <p>
                            {cam.nombre} <Badge>{cam.estado}</Badge>
                          </p>
                          <Button
                            disabled={
                              !!motivoInscripcion(c, sup) ||
                              empresas.find((e) => e.id === c.empresaId)
                                ?.estadoCuenta === "cliente" ||
                              !["aprobada", "activa", "pausada"].includes(
                                cam.estado,
                              )
                            }
                            title={motivoInscripcion(c, sup) ?? ""}
                            onClick={() =>
                              cmd.ask(
                                "Inscribir en campaña",
                                `${c.nombre} se inscribirá en ${cam.nombre}; la API validará también el segmento.`,
                                `/campanas/${cam.id}/inscribir`,
                                [c.id],
                              )
                            }
                          >
                            Inscribir contacto
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </Resource>
              )}
            </Resource>
          </Card>
        </div>
      </div>
      {legal && (
        <Modal title="Evidencia de base legal" onClose={() => setLegal(null)}>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await cmd.save(
                  `/contactos/${c.id}`,
                  { baseLegal: legal },
                  "PATCH",
                )
              )
                setLegal(null);
            }}
          >
            <Select
              all={false}
              label="Tipo de base"
              value={legal.tipo}
              onChange={(v) =>
                setLegal({ ...legal, tipo: v as BaseLegal["tipo"] })
              }
              options={S.contactoSchema.shape.baseLegal.shape.tipo.options}
            />
            <label>
              Texto de autorización
              <textarea
                required
                value={legal.texto ?? ""}
                onChange={(e) => setLegal({ ...legal, texto: e.target.value })}
              />
            </label>
            <label>
              Prueba / identificador
              <input
                required
                value={legal.prueba ?? ""}
                onChange={(e) =>
                  setLegal({
                    ...legal,
                    prueba: e.target.value,
                    fecha: new Date().toISOString(),
                  })
                }
              />
            </label>
            <Button type="submit" variant="primary">
              Guardar para revisión
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
