import { useState } from "react";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import type { Respuesta } from "../../types";
import { Button, Card, Badge, QueryState } from "../../components/ui";
import { Intro, Select, Resource, useCommand } from "../shared";
import { fecha } from "../../lib/formato";
export default function Page() {
  const q = useResource("/respuestas", S.respuestaSchema.array());
  const [id, setId] = useState("r1");
  const [estado, setEstado] = useState("");
  const item = q.data?.find((r) => r.id === id);
  return (
    <>
      <Intro
        title="Respuestas"
        description="Escucha primero. La siguiente conversación merece tu atención."
      />
      <Select
        label="Estado"
        value={estado}
        onChange={setEstado}
        options={["pendiente", "atendida"]}
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        <div className="grid" style={{ marginTop: 20 }}>
          <div className="stack" style={{ alignContent: "start" }}>
            {q.data
              ?.filter((r) => !estado || r.estado === estado)
              .map((r) => (
                <Card key={r.id}>
                  <div className="row">
                    <Badge>{r.clasificacion}</Badge>
                    <small>{Math.round(r.confianza * 100)}% de confianza</small>
                  </div>
                  <p>{r.hilo.at(-1)?.texto}</p>
                  <div className="row">
                    <Badge>{r.estado}</Badge>
                    <Button onClick={() => setId(r.id)}>
                      Abrir conversación
                    </Button>
                  </div>
                </Card>
              ))}
          </div>
          {item && <Detail key={item.id} r={item} />}
        </div>
      </QueryState>
    </>
  );
}
function Detail({ r }: { r: Respuesta }) {
  const [text, setText] = useState(r.borrador ?? "");
  const cmd = useCommand();
  const c = useResource(`/contactos/${r.contactoId}`, S.contactoSchema);
  const [reto, setReto] = useState("Diagnóstico RSE Express");
  const [valor, setValor] = useState(1500000);
  return (
    <div className="stack" style={{ alignContent: "start" }}>
      <Card title={c.data?.nombre ?? "Conversación"}>
        {c.data && (
          <p>
            {c.data.correo} · {c.data.cargo} <Badge>{c.data.etapa}</Badge>
          </p>
        )}
        {r.confianza < 0.7 && (
          <p className="notice warning">Revisar: contacto en pausa</p>
        )}
        {r.clasificacion === "baja" && (
          <p className="notice">
            Baja ya procesada. Contacto suprimido y secuencia finalizada.
          </p>
        )}
        {r.hilo.map((h, i) => (
          <div
            key={i}
            style={{
              padding: 16,
              background: h.de === "nexus" ? "#f4f7f5" : "#e8f5ef",
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <small>
              {h.de === "nexus" ? "NEXUS" : "Contacto"} · {fecha(h.fecha)}
            </small>
            <p>{h.texto}</p>
          </div>
        ))}
        <Select
          all={false}
          label="Clasificación"
          value={r.clasificacion}
          onChange={(v) =>
            cmd.ask(
              "Cambiar clasificación",
              v === "baja"
                ? "La baja suprimirá el contacto y finalizará sus inscripciones."
                : "La clasificación será registrada y el contacto permanecerá en pausa.",
              `/respuestas/${r.id}`,
              { clasificacion: v },
              "PATCH",
            )
          }
          options={S.respuestaSchema.shape.clasificacion.options}
        />
        <label style={{ marginTop: 15 }}>
          Borrador sugerido · revisa antes de enviar
          <textarea
            disabled={c.data?.excluido}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="row">
          <Button
            variant="primary"
            disabled={!text.trim() || !c.data || c.data.excluido}
            onClick={() =>
              cmd.ask(
                "Enviar respuesta",
                <>
                  <p>Para: {c.data?.correo}</p>
                  <pre>{text}</pre>
                  <small>
                    En modo mock se registra el mensaje; no se envía correo
                    real.
                  </small>
                </>,
                `/respuestas/${r.id}/enviar-respuesta`,
                { texto: text },
              )
            }
          >
            Enviar respuesta
          </Button>
          <Button
            disabled={r.estado === "atendida"}
            onClick={() =>
              cmd.ask(
                "Marcar atendida",
                "La conversación se marcará atendida.",
                `/respuestas/${r.id}/atender`,
              )
            }
          >
            Marcar atendida
          </Button>
        </div>
      </Card>
      <Card title="Siguiente paso comercial">
        <label>
          Reto identificado
          <input value={reto} onChange={(e) => setReto(e.target.value)} />
        </label>
        <label>
          Valor estimado (COP)
          <input
            type="number"
            min={0}
            value={valor}
            onChange={(e) => setValor(Number(e.target.value))}
          />
        </label>
        <div className="row" style={{ marginTop: 16 }}>
          <Button
            disabled={!c.data}
            onClick={() =>
              cmd.ask(
                "Crear oportunidad",
                `${reto} · COP ${valor.toLocaleString("es-CO")}`,
                "/oportunidades",
                {
                  id: "nuevo",
                  empresaId: c.data?.empresaId,
                  etapa: "discovery",
                  reto,
                  valorEstimadoCOP: valor,
                  creadaEn: new Date().toISOString(),
                },
              )
            }
          >
            Crear oportunidad
          </Button>
          <Button
            disabled={!c.data || c.data.excluido}
            onClick={() =>
              cmd.ask(
                "Registrar reunión",
                "Se registrará la reunión y se retirará al contacto de su secuencia.",
                `/respuestas/${r.id}/reunion`,
              )
            }
          >
            Registrar reunión
          </Button>
        </div>
        <Resource
          path={`/contactos/${r.contactoId}/interacciones`}
          schema={S.interaccionSchema.array()}
        >
          {(items) => (
            <small>
              {items.filter((i) => i.tipo === "reunion").length} reuniones
              registradas para este contacto.
            </small>
          )}
        </Resource>
      </Card>
    </div>
  );
}
