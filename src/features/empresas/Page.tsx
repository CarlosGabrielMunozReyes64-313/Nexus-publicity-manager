import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import {
  Button,
  Card,
  Badge,
  Table,
  EvidenceList,
  Tabs,
  Modal,
  QueryState,
} from "../../components/ui";
import { Intro, Resource, Select, useCommand } from "../shared";
import { moneda } from "../../lib/formato";
import type { Empresa, Duplicado } from "../../types";
export default function Page() {
  const q = useResource("/empresas", S.empresaSchema.array());
  const [tab, setTab] = useState("Empresas");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const cmd = useCommand();
  const id = useLocation().pathname.split("/")[2];
  const e = q.data?.find((e) => e.id === id);
  return (
    <>
      <Intro
        title={e?.razonSocial ?? "Empresas"}
        description="Una vista compartida de cada cuenta, sus señales y su potencial."
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Nueva empresa
          </Button>
        }
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {id ? (
          e ? (
            <>
              <Link to="/empresas">← Empresas</Link>
              <div className="grid" style={{ marginTop: 20 }}>
                <Card title="Datos de la empresa">
                  <EvidenceList items={e.evidencias} />
                  <p>
                    <Badge>{e.estadoCuenta}</Badge> · {e.sector} · {e.municipio}
                  </p>
                  <h3>Señales comerciales</h3>
                  {e.senales.map((s, i) => (
                    <p key={i}>{s.descripcion}</p>
                  ))}
                </Card>
                <Card
                  title={`Puntaje de afinidad · ${e.puntaje?.total ?? "Sin datos"}/100`}
                >
                  {e.puntaje?.incompleto && (
                    <p className="notice warning">
                      Puntaje incompleto: hay datos pendientes.
                    </p>
                  )}
                  {e.puntaje?.criterios.map((c) => (
                    <p key={c.nombre}>
                      <Badge>
                        {c.cumple === null
                          ? "pendiente"
                          : c.cumple
                            ? "verificado"
                            : "no cumple"}
                      </Badge>{" "}
                      {c.nombre} · {c.peso} puntos
                      <br />
                      <small>{c.explicacion}</small>
                    </p>
                  ))}
                </Card>
                <Card title="Contactos vinculados">
                  <Resource path="/contactos" schema={S.contactoSchema.array()}>
                    {(items) => (
                      <div className="stack">
                        {items
                          .filter((c) => c.empresaId === e.id)
                          .map((c) => (
                            <Link key={c.id} to={`/contactos/${c.id}`}>
                              {c.nombre} · {c.cargo}
                            </Link>
                          ))}
                      </div>
                    )}
                  </Resource>
                </Card>
                <Card title="Oportunidades e historial">
                  <Resource
                    path="/oportunidades"
                    schema={S.oportunidadSchema.array()}
                  >
                    {(items) => (
                      <>
                        {items
                          .filter((o) => o.empresaId === e.id)
                          .map((o) => (
                            <p key={o.id}>
                              <Badge>{o.etapa}</Badge> {o.reto} ·{" "}
                              {moneda(o.valorEstimadoCOP)}
                            </p>
                          ))}
                      </>
                    )}
                  </Resource>
                  <Resource
                    path={`/auditoria?entidadId=${e.id}`}
                    schema={S.auditoriaSchema.array()}
                  >
                    {(items) => (
                      <small>
                        {items.length} acciones registradas ·{" "}
                        <Link to="/auditoria">Ver registro</Link>
                      </small>
                    )}
                  </Resource>
                </Card>
              </div>
            </>
          ) : (
            <Card>Empresa no encontrada.</Card>
          )
        ) : (
          <>
            <Tabs
              items={["Empresas", "Duplicados"]}
              value={tab}
              onChange={setTab}
            />
            {tab === "Empresas" ? (
              <Card>
                <div className="toolbar">
                  <label>
                    Buscar empresa
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <Table
                  data={(q.data ?? []).filter((e) =>
                    `${e.razonSocial} ${e.sector} ${e.municipio}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )}
                  columns={[
                    {
                      accessorKey: "razonSocial",
                      header: "Razón social",
                      cell: (c) => (
                        <Link to={`/empresas/${c.row.original.id}`}>
                          <strong>{c.row.original.razonSocial}</strong>
                        </Link>
                      ),
                    },
                    { accessorKey: "sector", header: "Sector" },
                    { accessorKey: "municipio", header: "Municipio" },
                    { accessorKey: "tamano", header: "Empleados" },
                    {
                      id: "puntaje",
                      header: "Puntaje",
                      cell: (c) => (
                        <>
                          {c.row.original.puntaje?.total ?? "Sin datos"}{" "}
                          {c.row.original.puntaje?.incompleto && "· incompleto"}
                        </>
                      ),
                    },
                    {
                      accessorKey: "estadoCuenta",
                      header: "Cuenta",
                      cell: (c) => <Badge>{c.row.original.estadoCuenta}</Badge>,
                    },
                  ]}
                />
              </Card>
            ) : (
              <Resource path="/duplicados" schema={S.duplicadoSchema.array()}>
                {(items) => (
                  <div className="stack">
                    {items.length ? (
                      items.map((d) => (
                        <Duplicate key={d.id} d={d} empresas={q.data ?? []} />
                      ))
                    ) : (
                      <Card>No hay duplicados pendientes.</Card>
                    )}
                  </div>
                )}
              </Resource>
            )}
          </>
        )}
      </QueryState>
      {creating && (
        <Modal title="Nueva empresa" onClose={() => setCreating(false)}>
          <form
            className="stack"
            onSubmit={async (ev) => {
              ev.preventDefault();
              const form = new FormData(ev.currentTarget);
              const name = String(form.get("nombre"));
              if (
                await cmd.save("/empresas", {
                  id: "nuevo",
                  razonSocial: name,
                  municipio: String(form.get("municipio")),
                  sector: String(form.get("sector")),
                  tamano: "desconocido",
                  estadoCuenta: "prospecto",
                  senales: [],
                  evidencias: [
                    {
                      campo: "razonSocial",
                      valor: name,
                      fuente: "manual",
                      obtenidoEn: new Date().toISOString(),
                      estado: "pendiente",
                    },
                  ],
                })
              )
                setCreating(false);
            }}
          >
            <label>
              Razón social
              <input name="nombre" required />
            </label>
            <label>
              Municipio
              <input name="municipio" required />
            </label>
            <label>
              Sector
              <input name="sector" required />
            </label>
            <Button type="submit" variant="primary">
              Crear empresa
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Duplicate({ d, empresas }: { d: Duplicado; empresas: Empresa[] }) {
  const a = empresas.find((e) => e.id === d.principalId)!;
  const b = empresas.find((e) => e.id === d.duplicadoId)!;
  const [choices, setChoices] = useState<Record<string, string>>({});
  const cmd = useCommand();
  return (
    <Card title={d.motivo}>
      <div className="grid">
        <h3>{a.razonSocial} · Principal</h3>
        <h3>{b.razonSocial} · Duplicado</h3>
      </div>
      {(
        [
          "razonSocial",
          "sector",
          "municipio",
          "tamano",
          "sitioWeb",
          "dominio",
        ] as const
      ).map((k) => (
        <Select
          key={k}
          all={false}
          label={k}
          value={choices[k] ?? "principal"}
          onChange={(v) => setChoices({ ...choices, [k]: v })}
          options={[
            { value: "principal", label: `Principal: ${a[k] ?? "Sin datos"}` },
            { value: "duplicado", label: `Duplicado: ${b[k] ?? "Sin datos"}` },
          ]}
        />
      ))}
      <p>
        Los contactos, oportunidades y evidencias se conservarán en la empresa
        principal.
      </p>
      <Button
        onClick={() =>
          cmd.ask(
            "Confirmar fusión",
            `Se conservará ${a.razonSocial} y se eliminará la ficha duplicada. Revisa los valores seleccionados.`,
            `/duplicados/${d.id}/resolver`,
            choices,
          )
        }
      >
        Fusionar con los campos seleccionados
      </Button>
    </Card>
  );
}
