import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import { Badge, Button, Card } from "../../components/ui";
import type { Empresa, PropuestaAgente } from "../../types";
import { useCommand } from "../shared";

const DESCARTE = "Descartado por el administrador";
const ETIQUETAS: Record<string, string> = {
  tamano: "Tamaño",
  sector: "Sector",
  municipio: "Municipio",
  razonSocial: "Razón social",
  sitioWeb: "Sitio web",
  telefono: "Teléfono",
  cargo: "Cargo",
};

const actual = (p: PropuestaAgente) =>
  p.versiones.find((v) => v.version === p.version) ?? p.versiones.at(-1);

function campos(p: PropuestaAgente): [string, string][] {
  const c = actual(p)?.contenido as { campos?: Record<string, unknown> } | null;
  if (c && typeof c === "object" && c.campos && typeof c.campos === "object")
    return Object.entries(c.campos).map(([k, v]) => [k, String(v)]);
  return [];
}

function correoInferido(p: PropuestaAgente) {
  const c = actual(p)?.contenido as { correo?: unknown } | null;
  return c && typeof c === "object" && typeof c.correo === "string"
    ? c.correo
    : p.resumen;
}

/** «Datos sugeridos por la IA»: enriquecimientos y correos deducidos de una empresa. */
export default function Sugerencias({ e }: { e: Empresa }) {
  const cmd = useCommand();
  const propuestas = useResource("/propuestas", S.propuestaSchema.array());
  const contactos = useResource("/contactos", S.contactoSchema.array());
  const deLaEmpresa = new Set(
    (contactos.data ?? []).filter((c) => c.empresaId === e.id).map((c) => c.id),
  );
  const pendientes = (propuestas.data ?? []).filter(
    (p) =>
      p.estado === "pendiente" &&
      ((p.tipo === "enriquecimiento" &&
        (p.objetivoId === e.id || deLaEmpresa.has(p.objetivoId ?? ""))) ||
        (p.tipo === "correo_inferido" && deLaEmpresa.has(p.objetivoId ?? ""))),
  );
  if (!pendientes.length) return null;
  const descartar = (p: PropuestaAgente) =>
    cmd.ask(
      "Descartar dato sugerido",
      "El dato no se guarda. Queda registrado como descartado.",
      `/propuestas/${p.id}/rechazar`,
      { comentario: DESCARTE, pedirNuevaVersion: false },
    );
  return (
    <Card title="Datos sugeridos por la IA">
      <ul className="list">
        {pendientes.map((p) =>
          p.tipo === "correo_inferido" ? (
            <li key={p.id}>
              <div className="row">
                <strong>{correoInferido(p)}</strong>
                <Badge tono="warning">Correo deducido</Badge>
              </div>
              <p className="notice warning">
                Correo deducido: verifícalo antes de usarlo
              </p>
              <Button onClick={() => descartar(p)}>Descartar</Button>
            </li>
          ) : (
            <li key={p.id}>
              {campos(p).map(([campo, valor]) => {
                const fuente = p.fuentes.find((f) => f.campo === campo);
                return (
                  <div key={campo}>
                    <strong>{ETIQUETAS[campo] ?? campo}:</strong> {valor}
                    {fuente && (
                      <small className="muted">
                        {" "}
                        · Fuente:{" "}
                        {fuente.url ? (
                          <a href={fuente.url} target="_blank" rel="noreferrer">
                            {fuente.fuente}
                          </a>
                        ) : (
                          fuente.fuente
                        )}
                        {fuente.cita ? ` — «${fuente.cita}»` : ""}
                      </small>
                    )}
                  </div>
                );
              })}
              {!campos(p).length && <p>{p.resumen}</p>}
              <div className="row" style={{ marginTop: 8 }}>
                <Button
                  variant="primary"
                  onClick={() =>
                    cmd.ask(
                      "Aceptar dato sugerido",
                      "Se guardará en la empresa junto con su fuente.",
                      `/propuestas/${p.id}/aprobar`,
                    )
                  }
                >
                  Aceptar
                </Button>
                <Button onClick={() => descartar(p)}>Descartar</Button>
              </div>
            </li>
          ),
        )}
      </ul>
    </Card>
  );
}

/** Cuántos datos sugeridos esperan revisión (para la tarjeta de la lista). */
export function useSugerenciasPendientes() {
  const propuestas = useResource("/propuestas", S.propuestaSchema.array());
  return (empresaId: string) =>
    (propuestas.data ?? []).filter(
      (p) =>
        p.estado === "pendiente" &&
        p.tipo === "enriquecimiento" &&
        p.objetivoId === empresaId,
    ).length;
}
