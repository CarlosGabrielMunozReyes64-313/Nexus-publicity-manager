import { Link, useLocation } from "react-router-dom";
import { useResource } from "../../api/hooks";
import { request } from "../../api/client";
import * as S from "../../api/schemas";
import type { Secuencia } from "../../types";
import { Card, QueryState } from "../../components/ui";
import { Intro, Resource, useCommand } from "../shared";
import EditorSecuencia from "./EditorSecuencia";
export default function Page() {
  const q = useResource("/secuencias", S.secuenciaSchema.array());
  const id = useLocation().pathname.split("/")[2];
  const s = q.data?.find((s) => s.id === id);
  return (
    <>
      <Intro
        title="Secuencias"
        description="Conversaciones útiles, con tiempo y contexto. Revisa cada paso antes de aprobar."
      />
      <QueryState loading={q.isPending} error={q.error} retry={q.refetch}>
        {s ? (
          <Editor key={s.id} initial={s} />
        ) : (
          <div className="grid">
            {q.data?.map((s) => (
              <Card key={s.id} title={s.nombre}>
                <p>{s.objetivo}</p>
                <p>
                  {s.pasos.length} pasos · {s.llamadaAccion}
                </p>
                <Link to={`/secuencias/${s.id}/editar`}>
                  Editar secuencia →
                </Link>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}
/** La secuencia guardada: mismo editor que las rutas de Propuestas. */
function Editor({ initial }: { initial: Secuencia }) {
  const cmd = useCommand();
  const contactos = useResource("/contactos", S.contactoSchema.array());
  return (
    <EditorSecuencia
      inicial={initial}
      aviso="Este cambio devuelve la campaña a revisión y pausa los envíos pendientes."
      contactos={(contactos.data ?? []).map((c) => ({
        value: c.id,
        label: c.nombre,
      }))}
      vistaPrevia={(contactoId) =>
        request(
          `/secuencias/${initial.id}/previsualizar`,
          S.vistaPreviaSchema,
          "POST",
          { contactoId },
        )
      }
      alGuardar={(s) =>
        cmd.ask(
          "Guardar nueva versión de secuencia",
          "Las campañas asociadas vuelven a revisión y sus inscripciones se pausan.",
          `/secuencias/${s.id}`,
          s,
          "PUT",
        )
      }
      extra={
        <Card title="Condiciones del sistema">
          <p>Respuesta → pausa</p>
          <p>Baja o rebote duro → supresión</p>
          <p>Reunión → sale de la secuencia</p>
          <p>Cliente → sale toda su empresa</p>
          <Resource path="/campanas" schema={S.campanaSchema.array()}>
            {(cams) => (
              <small>
                {cams.filter((c) => c.secuenciaId === initial.id).length}{" "}
                campañas utilizan esta secuencia.
              </small>
            )}
          </Resource>
        </Card>
      }
    />
  );
}
