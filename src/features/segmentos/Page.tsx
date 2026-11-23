import { useEffect, useState } from "react";
import type { z } from "zod";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../../api/client";
import { useResource } from "../../api/hooks";
import { fechaHora } from "../../lib/formato";
import * as S from "../../api/schemas";
import type { Segmento, ReglaSegmento } from "../../types";
import { Button, Card, Badge, QueryState, Table } from "../../components/ui";
import { Intro, Select, useCommand } from "../shared";
import { coincide } from "../../lib/reglas";
export default function Page() {
  const q = useResource("/segmentos", S.segmentoSchema.array());
  const id = useLocation().pathname.split("/")[2];
  const [newItem, setNewItem] = useState(false);
  const item = q.data?.find((s) => s.id === id);
  return (
    <>
      <Intro
        title="Segmentos"
        description="Agrupa contactos por criterios explícitos y revisables."
        action={
          <div className="row">
            <PedirSegmentos />
            <Button variant="primary" onClick={() => setNewItem(true)}>
              Nuevo segmento
            </Button>
          </div>
        }
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {item || newItem ? (
          <Editor
            key={item?.id ?? "new"}
            item={item}
            close={() => setNewItem(false)}
          />
        ) : (
          <>
            <PedidosSegmentos />
            <div className="grid">
              {q.data?.map((s) => (
                <Card key={s.id} title={s.nombre}>
                  <Badge>{s.estado}</Badge>
                  <p>{s.justificacion}</p>
                  <p>
                    {s.tamano} contactos · versión {s.version} ·{" "}
                    {s.propuestoPor}
                  </p>
                  <Link to={`/segmentos/${s.id}`}>Revisar reglas →</Link>
                </Card>
              ))}
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
/** Pide al Segmentador nuevas propuestas de segmentos (tarea en segundo plano). */
function PedirSegmentos() {
  const cmd = useCommand();
  return (
    <Button
      onClick={() =>
        cmd.confirm({
          title: "Pedir propuestas de segmentos",
          summary:
            "El agente Segmentador revisará sus empresas y el cliente ideal y propondrá segmentos. Consume presupuesto de IA. Los segmentos propuestos aparecen aquí, en Segmentos, en unos minutos para que usted los apruebe.",
          run: async () => {
            await cmd.run("/segmentos/proponer");
            return "Pedido enviado. Siga su avance aquí.";
          },
        })
      }
    >
      Pedir propuestas al agente
    </Button>
  );
}
function Editor({ item, close }: { item?: Segmento; close: () => void }) {
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [reglas, setReglas] = useState<ReglaSegmento[]>(
    item?.reglas ?? [{ campo: "municipio", operador: "es", valor: "Palmira" }],
  );
  const [j, setJ] = useState(item?.justificacion ?? "");
  // Aprobar actúa sobre la versión guardada: con cambios sin guardar, el conteo
  // mostrado no correspondería a lo que se aprueba.
  const [sucio, setSucio] = useState(false);
  const cambiarReglas = (nuevas: ReglaSegmento[]) => {
    setReglas(nuevas);
    setSucio(true);
  };
  const c = useResource("/contactos", S.contactoSchema.array());
  const e = useResource("/empresas", S.empresaSchema.array());
  const cmd = useCommand();
  const matches = (c.data ?? []).filter((c) =>
    coincide(c, e.data ?? [], reglas),
  );
  const sinGuardar = !!item && sucio;
  return (
    <div className="grid">
      <Card title="Constructor de reglas">
        <form
          className="stack"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (
              await cmd.save(
                item ? `/segmentos/${item.id}` : "/segmentos",
                {
                  ...item,
                  id: item?.id ?? "nuevo",
                  nombre,
                  reglas,
                  justificacion: j,
                  tamano: matches.length,
                  version: item?.version ?? 1,
                  estado: "propuesto",
                  propuestoPor: "admin",
                },
                item ? "PATCH" : "POST",
              )
            ) {
              setSucio(false);
              close();
            }
          }}
        >
          <label>
            Nombre
            <input
              required
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setSucio(true);
              }}
            />
          </label>
          <label>
            Justificación
            <textarea
              required
              value={j}
              onChange={(e) => {
                setJ(e.target.value);
                setSucio(true);
              }}
            />
          </label>
          {reglas.map((r, i) => (
            <fieldset key={i}>
              <legend>Regla {i + 1}</legend>
              <Select
                all={false}
                label="Campo"
                value={r.campo}
                onChange={(v) =>
                  cambiarReglas(
                    reglas.map((x, k) => (k === i ? { ...x, campo: v } : x)),
                  )
                }
                options={[
                  "municipio",
                  "sector",
                  "tamano",
                  "puntaje",
                  "etapa",
                  "origen",
                  "baseLegal",
                  "contactoIds",
                ]}
              />
              <Select
                all={false}
                label="Operador"
                value={r.operador}
                onChange={(v) =>
                  cambiarReglas(
                    reglas.map((x, k) =>
                      k === i
                        ? { ...x, operador: v as ReglaSegmento["operador"] }
                        : x,
                    ),
                  )
                }
                options={S.reglaSchema.shape.operador.options}
              />
              <label>
                Valor
                <input
                  required
                  value={r.valor}
                  onChange={(e) =>
                    cambiarReglas(
                      reglas.map((x, k) =>
                        k === i ? { ...x, valor: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <Button
                onClick={() => cambiarReglas(reglas.filter((_, k) => k !== i))}
              >
                Quitar regla
              </Button>
            </fieldset>
          ))}
          <Button
            onClick={() =>
              cambiarReglas([
                ...reglas,
                { campo: "sector", operador: "contiene", valor: "" },
              ])
            }
          >
            Añadir regla
          </Button>
          <Button variant="primary" type="submit" disabled={cmd.pending}>
            Guardar para revisión
          </Button>
          {sinGuardar && (
            <p className="notice warning">
              Hay cambios sin guardar. Guárdelos para revisión antes de aprobar
              el segmento.
            </p>
          )}
          {item && (
            <div className="row">
              <Button
                disabled={item.estado === "aprobado" || sinGuardar}
                title={
                  sinGuardar ? "Guarde los cambios antes de aprobar" : undefined
                }
                onClick={() =>
                  cmd.ask(
                    "Aprobar segmento",
                    `${matches.length} contactos coinciden. Solo los elegibles podrán entrar en campañas.`,
                    `/segmentos/${item.id}/aprobar`,
                  )
                }
              >
                Aprobar
              </Button>
              <Button
                onClick={() =>
                  cmd.ask(
                    "Archivar segmento",
                    "Las campañas asociadas volverán a revisión.",
                    `/segmentos/${item.id}`,
                    { estado: "archivado" },
                    "PATCH",
                  )
                }
              >
                Archivar
              </Button>
              {item.estado === "aprobado" && (
                <Button
                  variant="primary"
                  onClick={() =>
                    cmd.confirm({
                      title: "Pedir secuencia a la IA",
                      summary: `La IA escribirá una secuencia de 3 correos para «${item.nombre}» con el objetivo «Que completen el diagnóstico RSE Express». Para elegir otro objetivo o número de correos, use «Nueva con IA» en Secuencias de correo. Consume presupuesto de IA. No se envía nada: la secuencia aparece en Secuencias de correo para que usted la edite y apruebe.`,
                      run: async () => {
                        await cmd.run(`/segmentos/${item.id}/proponer-campana`);
                        return "Pedido enviado. La secuencia aparecerá en Secuencias de correo cuando esté lista.";
                      },
                    })
                  }
                >
                  Pedir secuencia a la IA
                </Button>
              )}
            </div>
          )}
        </form>
      </Card>
      <Card title={`Vista previa · ${matches.length} contactos`}>
        <Table
          data={matches}
          columns={[
            { accessorKey: "nombre", header: "Nombre" },
            { accessorKey: "correo", header: "Correo" },
            { accessorKey: "etapa", header: "Etapa" },
          ]}
        />
      </Card>
    </div>
  );
}

type Pedido = z.infer<typeof S.solicitudAgenteSchema>;
const pedidoActivo = (p: Pedido) =>
  p.estado === "pendiente" || p.estado === "en_proceso";
function estadoPedido(
  p: Pedido,
): [string, "success" | "warning" | "error" | "info"] {
  if (p.estado === "pendiente")
    return [p.intentos > 0 ? "Reintento programado" : "En cola", "warning"];
  if (p.estado === "en_proceso") return ["El agente está trabajando", "info"];
  if (p.estado === "completada") return ["Lista", "success"];
  if (p.estado === "fallida") return ["No se pudo completar", "error"];
  return ["Cancelado", "info"];
}
/** Pedidos de segmentos al agente: avance y motivo de un fallo. */
function PedidosSegmentos() {
  const cache = useQueryClient();
  const q = useQuery({
    queryKey: ["/agentes/solicitudes"],
    queryFn: () =>
      request("/agentes/solicitudes", S.solicitudAgenteSchema.array()),
    refetchInterval: (query) =>
      query.state.data?.some(
        (p) => p.tipo === "proponer_segmentos" && pedidoActivo(p),
      )
        ? 4000
        : false,
  });
  const pedidos = (q.data ?? []).filter((p) => p.tipo === "proponer_segmentos");
  const listas = pedidos.filter((p) => p.estado === "completada").length;
  useEffect(() => {
    // Un pedido terminado deja segmentos nuevos: se recarga la lista.
    if (listas) void cache.invalidateQueries({ queryKey: ["/segmentos"] });
  }, [listas, cache]);
  if (!pedidos.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <Card title="Pedidos de segmentos al agente">
        <ul className="list">
          {pedidos.map((p) => (
            <li key={p.id}>
              <div className="row">
                <strong>Propuestas de segmentos</strong>
                <Badge tono={estadoPedido(p)[1]}>{estadoPedido(p)[0]}</Badge>
                <small className="muted">{fechaHora(p.creadaEn)}</small>
              </div>
              {p.error && (
                <p className={p.estado === "fallida" ? "danger" : "muted"}>
                  {p.error}
                  {p.estado === "pendiente" && p.proximoIntento
                    ? ` Nuevo intento: ${fechaHora(p.proximoIntento)}.`
                    : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
