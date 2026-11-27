import { useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Download, Plus } from "lucide-react";
import { descargar } from "../../api/client";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import {
  Badge,
  Button,
  Card,
  Modal,
  QueryState,
  Table,
} from "../../components/ui";
import { Intro, Select, useCommand } from "../shared";
import { BotonEliminar } from "../eliminar/Eliminar";

/** Guarda un Blob como archivo (exportaciones a Excel). */
export function guardarArchivo(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportar(ruta: string, nombre: string) {
  const blob = await descargar(ruta);
  guardarArchivo(blob, nombre);
}

export default function Page() {
  const id = useLocation().pathname.split("/")[2];
  const [archivadas, setArchivadas] = useState(false);
  const q = useResource(
    `/listas${archivadas ? "?archivadas=true" : ""}`,
    S.listaSchema.array(),
  );
  const [params] = useSearchParams();
  const [crear, setCrear] = useState(Boolean(params.get("desdeSegmento")));
  const item = q.data?.find((l) => l.id === id);
  return (
    <>
      <Intro
        title={item?.nombre ?? "Listas de envío"}
        description="Audiencias para tus secuencias: una lista estática guarda a sus miembros; una vinculada sigue a su segmento. Las bajas salen siempre."
        action={
          !id && (
            <Button variant="primary" onClick={() => setCrear(true)}>
              <Plus size={16} /> Nueva lista
            </Button>
          )
        }
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {id ? (
          item ? (
            <Detalle lista={item} />
          ) : (
            <Card>
              Lista no encontrada. <Link to="/listas">Volver</Link>
            </Card>
          )
        ) : (
          <Card>
            <label className="row">
              <input
                type="checkbox"
                checked={archivadas}
                onChange={(e) => setArchivadas(e.target.checked)}
              />
              Mostrar archivadas
            </label>
            <Table
              data={q.data ?? []}
              columns={[
                {
                  accessorKey: "nombre",
                  header: "Lista",
                  cell: ({ row }) => (
                    <Link to={`/listas/${row.original.id}`}>
                      <strong>{row.original.nombre}</strong>
                    </Link>
                  ),
                },
                {
                  id: "tipo",
                  header: "Tipo",
                  cell: ({ row }) => (
                    <Badge
                      tono={
                        row.original.tipo === "vinculada" ? "info" : undefined
                      }
                    >
                      {row.original.tipo === "vinculada"
                        ? "vinculada al segmento"
                        : "estática"}
                    </Badge>
                  ),
                },
                { accessorKey: "miembros", header: "Miembros" },
                { accessorKey: "elegibles", header: "Elegibles hoy" },
                {
                  id: "estado",
                  header: "Estado",
                  cell: ({ row }) =>
                    row.original.archivada ? (
                      <Badge>archivada</Badge>
                    ) : (
                      <Badge tono="success">activa</Badge>
                    ),
                },
              ]}
            />
          </Card>
        )}
      </QueryState>
      {crear && (
        <NuevaLista
          onClose={() => setCrear(false)}
          segmentoInicial={params.get("desdeSegmento") ?? ""}
        />
      )}
    </>
  );
}

function NuevaLista({
  onClose,
  segmentoInicial,
}: {
  onClose: () => void;
  segmentoInicial: string;
}) {
  const navigate = useNavigate();
  const cmd = useCommand();
  const segmentos = useResource("/segmentos", S.segmentoSchema.array());
  const [nombre, setNombre] = useState("");
  const [segmento, setSegmento] = useState(segmentoInicial);
  const [modo, setModo] = useState<"estatica" | "vinculada">("estatica");
  const [error, setError] = useState("");
  return (
    <Modal title="Nueva lista de envío" onClose={onClose}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const r = await cmd.run("/listas", {
              nombre,
              ...(segmento ? { segmentoId: segmento, modo } : {}),
            });
            cmd.notify(
              segmento && modo === "estatica"
                ? `Lista creada con ${String(r.miembros ?? 0)} miembros del segmento.`
                : "Lista creada.",
            );
            onClose();
            navigate(`/listas/${String(r.id)}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo crear");
          }
        }}
      >
        <label>
          Nombre
          <input
            required
            maxLength={120}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <Select
          label="Crear desde un segmento (opcional)"
          value={segmento}
          onChange={setSegmento}
          options={(segmentos.data ?? [])
            .filter((s) => s.estado !== "archivado")
            .map((s) => ({ value: s.id, label: `${s.nombre} (${s.tamano})` }))}
        />
        {segmento && (
          <fieldset>
            <legend>¿Qué guarda la lista?</legend>
            <label className="row">
              <input
                type="radio"
                name="modo"
                checked={modo === "estatica"}
                onChange={() => setModo("estatica")}
              />
              Guardar los miembros actuales (no cambia si el segmento cambia)
            </label>
            <label className="row">
              <input
                type="radio"
                name="modo"
                checked={modo === "vinculada"}
                onChange={() => setModo("vinculada")}
              />
              Mantener la audiencia vinculada al segmento (cambia con sus
              reglas)
            </label>
          </fieldset>
        )}
        {error && (
          <p role="alert" className="danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={cmd.pending}>
          Crear lista
        </Button>
      </form>
    </Modal>
  );
}

function Detalle({
  lista,
}: {
  lista: import("zod").infer<typeof S.listaSchema>;
}) {
  const cmd = useCommand();
  const irA = useNavigate();
  const miembros = useResource(
    `/listas/${lista.id}/miembros?limite=500`,
    S.miembrosListaSchema,
  );
  const contactos = useResource("/contactos", S.contactoSchema.array());
  const [nombre, setNombre] = useState(lista.nombre);
  const [agregar, setAgregar] = useState("");
  const [buscar, setBuscar] = useState("");
  const enLista = new Set(miembros.data?.miembros.map((m) => m.id));
  const candidatos = (contactos.data ?? [])
    .filter((c) => !enLista.has(c.id) && !c.excluido)
    .filter((c) =>
      `${c.nombre} ${c.correo ?? ""}`
        .toLowerCase()
        .includes(buscar.toLowerCase()),
    )
    .slice(0, 50);
  const estatica = lista.tipo === "estatica";
  return (
    <div className="stack">
      <Link to="/listas">← Todas las listas</Link>
      <div className="grid">
        <Card title="Datos">
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              void cmd.save(`/listas/${lista.id}`, { nombre }, "PATCH");
            }}
          >
            <label>
              Nombre
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={lista.archivada}
              />
            </label>
            <Button
              type="submit"
              disabled={lista.archivada || nombre === lista.nombre}
            >
              Renombrar
            </Button>
          </form>
          <p>
            {estatica ? (
              <Badge>estática</Badge>
            ) : (
              <>
                <Badge tono="info">vinculada al segmento</Badge>{" "}
                <Link to={`/segmentos/${lista.segmentoId}`}>ver segmento</Link>
              </>
            )}{" "}
            · {lista.miembros} miembros · {lista.elegibles} elegibles hoy
            {lista.retirados ? ` · ${lista.retirados} retirados` : ""}
          </p>
          <p className="muted">
            {estatica
              ? "Sus miembros solo cambian cuando usted los añade o quita (o cuando alguien se da de baja)."
              : "Sus miembros se recalculan con las reglas del segmento cada vez que se usa."}
          </p>
          {lista.campanas?.length ? (
            <p>
              Audiencia de:{" "}
              {lista.campanas.map((c) => (
                <Link
                  key={c.id}
                  to={`/secuencias/${c.secuenciaId}`}
                  style={{ marginRight: 8 }}
                >
                  {c.nombre} ({c.estado})
                </Link>
              ))}
            </p>
          ) : null}
          <div className="row">
            <Button
              onClick={() =>
                void exportar(
                  `/contactos/exportar?ambito=lista&listaId=${lista.id}`,
                  `lista-${lista.nombre}.xlsx`,
                ).catch((e: unknown) =>
                  cmd.notify(
                    e instanceof Error ? e.message : "No se pudo exportar",
                  ),
                )
              }
            >
              <Download size={14} /> Exportar a Excel
            </Button>
            {lista.archivada ? (
              <Button
                onClick={() =>
                  cmd.ask(
                    "Restaurar lista",
                    "Vuelve a poder elegirse como audiencia.",
                    `/listas/${lista.id}/restaurar`,
                  )
                }
              >
                Restaurar
              </Button>
            ) : (
              <Button
                onClick={() =>
                  cmd.ask(
                    "Archivar lista",
                    "No se borra nada. Deja de poder elegirse y una secuencia que la use no se podrá aprobar ni programar hasta cambiar su audiencia.",
                    `/listas/${lista.id}/archivar`,
                  )
                }
              >
                Archivar
              </Button>
            )}
            <BotonEliminar
              recurso="listas"
              ids={[lista.id]}
              etiqueta="Eliminar lista"
              onDone={() => irA("/listas")}
            />
          </div>
          <p className="muted">
            Eliminar la lista no borra a sus contactos: siguen en la aplicación.
          </p>
        </Card>
        {estatica && !lista.archivada && (
          <Card title="Añadir contactos">
            <label>
              Buscar
              <input
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                placeholder="Nombre o correo"
              />
            </label>
            <Select
              all={false}
              label="Contacto"
              value={agregar}
              onChange={setAgregar}
              options={[
                { value: "", label: "Elija un contacto" },
                ...candidatos.map((c) => ({
                  value: c.id,
                  label: `${c.nombre} · ${c.correo ?? "sin correo"}`,
                })),
              ]}
            />
            <Button
              disabled={!agregar}
              onClick={async () => {
                if (
                  await cmd.save(`/listas/${lista.id}/agregar`, {
                    contactoIds: [agregar],
                  })
                )
                  setAgregar("");
              }}
            >
              Añadir a la lista
            </Button>
            <p className="muted">
              También puede añadir varios desde Contactos (selección → «Añadir a
              lista») o al importar.
            </p>
          </Card>
        )}
      </div>
      <Card title={`Miembros (${miembros.data?.total ?? "…"})`}>
        <QueryState
          loading={miembros.isPending}
          error={miembros.error}
          retry={miembros.refetch}
        >
          <Table
            data={miembros.data?.miembros ?? []}
            columns={[
              {
                accessorKey: "nombre",
                header: "Contacto",
                cell: ({ row }) => (
                  <Link to={`/contactos/${row.original.id}`}>
                    {row.original.nombre}
                  </Link>
                ),
              },
              { accessorKey: "correo", header: "Correo" },
              { accessorKey: "empresa", header: "Empresa" },
              {
                id: "elegible",
                header: "Envíos",
                cell: ({ row }) =>
                  row.original.elegible ? (
                    <Badge tono="success">elegible</Badge>
                  ) : (
                    <span title={row.original.motivo}>
                      <Badge tono="warning">
                        {row.original.motivo ?? "no elegible"}
                      </Badge>
                    </span>
                  ),
              },
              {
                id: "quitar",
                header: "",
                cell: ({ row }) => (
                  <div className="row">
                    {estatica && !lista.archivada && (
                      <Button
                        onClick={() =>
                          cmd.ask(
                            "Quitar de esta lista",
                            `${row.original.nombre} saldrá solo de «${lista.nombre}». El contacto sigue en la aplicación y en sus otras listas.`,
                            `/listas/${lista.id}/quitar`,
                            { contactoIds: [row.original.id] },
                          )
                        }
                      >
                        Quitar de esta lista
                      </Button>
                    )}
                    <BotonEliminar
                      recurso="contactos"
                      ids={[row.original.id]}
                      compacto
                    />
                  </div>
                ),
              },
            ]}
          />
          {miembros.data?.retirados.length ? (
            <>
              <h3>Retirados</h3>
              <ul className="list">
                {miembros.data.retirados.map((r) => (
                  <li key={r.id}>
                    {r.nombre} ·{" "}
                    {r.motivoRetiro === "baja"
                      ? "se dio de baja"
                      : "quitado a mano"}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </QueryState>
      </Card>
    </div>
  );
}
