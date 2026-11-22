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
import { MultiSelect } from "../../components/ui/MultiSelect";
import { Intro, useCommand } from "../shared";
import { MUNICIPIOS, SECTORES, TIPOS_EMPRESA, armarConsulta } from "./opciones";
import { MODO_DEMO } from "../../lib/modo";

export default function Page() {
  const q = useResource("/descubrimiento/busquedas", S.busquedaSchema.array());
  const [tipos, setTipos] = useState<string[]>([]);
  const [municipios, setMunicipios] = useState<string[]>([
    "Palmira",
    "Candelaria",
  ]);
  const [sectores, setSectores] = useState<string[]>([]);
  const [tamano, setTamano] = useState("");
  const cmd = useCommand();
  const activa = q.data?.some(
    (b) => b.estado === "ejecutando" || b.estado === "en_cola",
  );
  useEffect(() => {
    if (activa) {
      const timer = setInterval(() => q.refetch(), 2500);
      return () => clearInterval(timer);
    }
  }, [activa]);
  return (
    <>
      <Intro
        title="Descubrimiento"
        description="Encuentra empresas afines. Revisa la evidencia antes de incorporarlas."
      />
      <p className="notice">
        Solo se consultan sitios web públicos de empresas y registros abiertos.
        No se consultan redes sociales. Cada dato se comprueba en el sitio
        oficial de la empresa antes de mostrarse.
      </p>
      <Card title="Nueva búsqueda">
        <form
          className="toolbar"
          style={{ alignItems: "flex-start" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!tipos.length) return;
            cmd.confirm({
              title: MODO_DEMO
                ? "Iniciar búsqueda simulada"
                : "Iniciar búsqueda real",
              summary: MODO_DEMO ? (
                <p>
                  Modo demostración: se generará un resultado ficticio; no se
                  consulta ningún servicio externo.
                </p>
              ) : (
                <>
                  <p>
                    El agente de IA configurado en el servidor buscará en
                    fuentes web públicas y comprobará cada cita en el sitio
                    oficial de la empresa.
                  </p>
                  <p>
                    Consume presupuesto de IA dentro de los topes por tarea y
                    mensual del servidor. Los resultados quedan pendientes de su
                    revisión: no se crean contactos ni se envían correos.
                  </p>
                </>
              ),
              run: async () => {
                await cmd.run("/descubrimiento/busquedas", {
                  consulta: armarConsulta(tipos),
                  municipios,
                  sectores,
                  tamano,
                });
                void q.refetch();
                return MODO_DEMO
                  ? "Búsqueda simulada en curso."
                  : "Búsqueda en cola. El progreso se actualiza en esta pantalla.";
              },
            });
          }}
        >
          <MultiSelect
            label="¿Qué empresas buscas?"
            groups={TIPOS_EMPRESA}
            value={tipos}
            onChange={setTipos}
            placeholder="Elige uno o más tipos"
            allowAdd
            storageKey="nexus.descubrimiento.tipos"
          />
          <MultiSelect
            label="Municipios"
            groups={MUNICIPIOS}
            value={municipios}
            onChange={setMunicipios}
            placeholder="Cualquier municipio"
          />
          <MultiSelect
            label="Sectores"
            groups={SECTORES}
            value={sectores}
            onChange={setSectores}
            placeholder="Cualquier sector"
          />
          <label>
            Tamaño
            <select
              name="tamano"
              value={tamano}
              onChange={(e) => setTamano(e.target.value)}
              style={{ minHeight: 41 }}
            >
              <option value="">Cualquiera</option>
              <option value="1-10">1-10</option>
              <option value="11-50">11-50</option>
              <option value="51-200">51-200</option>
              <option value="200+">200+</option>
            </select>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span aria-hidden style={{ visibility: "hidden" }}>
              .
            </span>
            <Button
              type="submit"
              variant="primary"
              disabled={cmd.pending || !tipos.length}
            >
              Iniciar búsqueda
            </Button>
          </div>
        </form>
        {!tipos.length && (
          <small>
            Elige al menos un tipo de empresa, o usa «Agregar +» para escribir
            el tuyo.
          </small>
        )}
      </Card>
      <div className="stack" style={{ marginTop: 20 }}>
        <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
          {q.data?.map((b) => (
            <Card key={b.id} title={b.criterios.consulta}>
              <p>
                <Badge>{b.estado}</Badge>
                {b.criterios.municipios.length > 0 &&
                  ` · ${b.criterios.municipios.join(", ")}`}
                {b.criterios.sectores.length > 0 &&
                  ` · ${b.criterios.sectores.join(", ")}`}
                {` · ${b.progreso}%`}
                {b.estado === "terminada" &&
                  ` · ${b.resultados.length} resultado${b.resultados.length === 1 ? "" : "s"}`}
              </p>
              {b.estado !== "terminada" && b.estado !== "error" && (
                <progress
                  aria-label={`Progreso ${b.criterios.consulta}`}
                  value={b.progreso}
                  max={100}
                />
              )}
              {b.error && (
                <p
                  className={`notice ${b.estado === "error" ? "danger" : "warning"}`}
                  role={b.estado === "error" ? "alert" : undefined}
                >
                  {b.error}
                </p>
              )}
              {b.estado === "terminada" && b.resultados.length === 0 && (
                <p className="notice">
                  La búsqueda terminó sin empresas cuyo nombre se pudiera
                  comprobar en su sitio oficial. Pruebe con menos tipos o
                  municipios por búsqueda.
                </p>
              )}
              {b.resultados.some((r) => r.estado === "pendiente") && (
                <p className="notice">
                  Revise cada resultado y pulse «Aceptar» para crear la empresa
                  y, si publica un correo corporativo, su contacto.
                </p>
              )}
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
                            r.contactoCorporativo.correo
                              ? `Se creará ${r.empresa.razonSocial} y un contacto corporativo (${r.contactoCorporativo.correo}) sin base legal aprobada ni correo verificado.`
                              : `Se creará ${r.empresa.razonSocial} con sus evidencias. No hay correo corporativo publicado, así que no se crea ningún contacto.`,
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
