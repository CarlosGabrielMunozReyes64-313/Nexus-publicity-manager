import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import {
  Button,
  Card,
  Badge,
  EvidenceList,
  QueryState,
} from "../../components/ui";
import { Intro, useCommand } from "../shared";
export default function Page() {
  const q = useResource("/descubrimiento/busquedas", S.busquedaSchema.array());
  const [consulta, setConsulta] = useState("");
  const cmd = useCommand();
  useEffect(() => {
    if (q.data?.some((b) => b.estado === "ejecutando")) {
      const timer = setInterval(() => q.refetch(), 2500);
      return () => clearInterval(timer);
    }
  }, [q.data]);
  return (
    <>
      <Intro
        title="Descubrimiento"
        description="Encuentra empresas afines. Revisa la evidencia antes de incorporarlas."
      />
      <p className="notice">
        Solo se consultan sitios web públicos de empresas y registros abiertos.
        No se consultan redes sociales. En esta demostración no se realizan
        búsquedas externas.
      </p>
      <Card title="Nueva búsqueda">
        <form
          className="toolbar"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await cmd.save("/descubrimiento/busquedas", {
              consulta,
              municipios: String(f.get("municipios"))
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
              sectores: String(f.get("sectores"))
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
              tamano: String(f.get("tamano")),
            });
          }}
        >
          <label>
            ¿Qué empresas buscas?
            <input
              required
              minLength={3}
              placeholder="Fabricantes de empaques en Palmira"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
            />
          </label>
          <label>
            Municipios
            <input name="municipios" defaultValue="Palmira, Candelaria" />
          </label>
          <label>
            Sectores
            <input name="sectores" placeholder="Separados por coma" />
          </label>
          <label>
            Tamaño
            <select name="tamano">
              <option>11-50</option>
              <option>51-200</option>
              <option>1-10</option>
              <option>200+</option>
            </select>
          </label>
          <Button type="submit" variant="primary" disabled={cmd.pending}>
            Iniciar búsqueda simulada
          </Button>
        </form>
      </Card>
      <div className="stack" style={{ marginTop: 20 }}>
        <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
          {q.data?.map((b) => (
            <Card key={b.id} title={b.criterios.consulta}>
              <p>
                <Badge>{b.estado}</Badge> · {b.criterios.municipios.join(", ")}{" "}
                · {b.progreso}%
              </p>
              <progress
                aria-label={`Progreso ${b.criterios.consulta}`}
                value={b.progreso}
                max={100}
              />
              <div className="grid" style={{ marginTop: 20 }}>
                {b.resultados.map((r) => (
                  <Card key={r.id} title={r.empresa.razonSocial}>
                    <Badge>{r.estado}</Badge>
                    <p>
                      {r.empresa.municipio} · {r.empresa.sector}
                    </p>
                    <p>
                      {r.empresa.sitioWeb}
                      <br />
                      {r.contactoCorporativo.correo}
                      <br />
                      Tel. {r.contactoCorporativo.telefono} · WhatsApp{" "}
                      {r.contactoCorporativo.whatsapp}
                    </p>
                    <small>
                      Formulario: {r.contactoCorporativo.formularioUrl}
                    </small>
                    <EvidenceList items={r.evidencias} />
                    {r.personas.map((p, i) => (
                      <p key={i}>
                        {p.nombre} · {p.cargo}{" "}
                        <Badge>Requiere base legal</Badge>
                      </p>
                    ))}
                    {r.posibleDuplicadoDe && (
                      <p className="notice warning">
                        Posible duplicado.{" "}
                        <Link to={`/empresas/${r.posibleDuplicadoDe}`}>
                          Revisar empresa existente
                        </Link>
                      </p>
                    )}
                    <div className="row">
                      <Button
                        disabled={
                          r.estado !== "pendiente" || !!r.posibleDuplicadoDe
                        }
                        variant="primary"
                        onClick={() =>
                          cmd.ask(
                            "Aceptar resultado",
                            `Se creará ${r.empresa.razonSocial} y un contacto corporativo sin base legal aprobada ni correo verificado.`,
                            `/descubrimiento/resultados/${r.id}/aceptar`,
                          )
                        }
                      >
                        Aceptar
                      </Button>
                      <Button
                        disabled={r.estado !== "pendiente"}
                        onClick={() =>
                          cmd.ask(
                            "Descartar resultado",
                            "El resultado quedará descartado.",
                            `/descubrimiento/resultados/${r.id}/descartar`,
                          )
                        }
                      >
                        Descartar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          ))}
        </QueryState>
      </div>
    </>
  );
}
