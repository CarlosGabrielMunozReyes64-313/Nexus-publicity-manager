import type { z } from "zod";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type * as S from "../../../api/schemas";
import { Card } from "../../../components/ui";
import styles from "./Editor.module.css";

type Revision = z.infer<typeof S.revisionSecuenciaSchema>;

/**
 * Lista de verificación: rojo lo que impide aprobar, ámbar lo que conviene revisar y
 * verde lo que está bien. La decisión la toma el servidor sobre el borrador guardado;
 * mientras hay cambios sin guardar se muestran también los errores locales.
 */
export default function Verificacion({
  rev,
  sucio,
  erroresLocales,
}: {
  rev?: Revision;
  sucio: boolean;
  erroresLocales: string[];
}) {
  const bloqueos = rev?.bloqueos ?? [];
  const errores = sucio ? erroresLocales : (rev?.errores ?? []);
  const bien: string[] = [];
  if (rev) {
    if (!errores.length) bien.push("Firma, enlace de baja y asunto en orden");
    if (rev.segmento?.estado === "aprobado") bien.push("Segmento aprobado");
    if (rev.elegibles > 0)
      bien.push(
        `${rev.elegibles} ${rev.elegibles === 1 ? "contacto elegible" : "contactos elegibles"}`,
      );
    if (rev.ventanaValida) bien.push("Ventana dentro del horario global");
    if (rev.gmailConectado) bien.push("Gmail conectado");
    if (rev.puedeAprobar && !sucio) bien.push("Lista para aprobar");
  }
  return (
    <Card title="Lista de verificación">
      {sucio && (
        <p className="muted">
          Hay cambios sin guardar: la verificación completa se actualiza al
          guardar.
        </p>
      )}
      <ul className={styles.verificacion}>
        {[...bloqueos, ...errores].map((t) => (
          <li key={"b" + t} className={styles.error}>
            <XCircle size={16} aria-label="Bloquea" /> {t}
          </li>
        ))}
        {(rev?.advertencias ?? []).map((t) => (
          <li key={"a" + t} className={styles.aviso}>
            <AlertTriangle size={16} aria-label="Revisar" /> {t}
          </li>
        ))}
        {bien.map((t) => (
          <li key={"o" + t} className={styles.ok}>
            <CheckCircle2 size={16} aria-label="Correcto" /> {t}
          </li>
        ))}
      </ul>
    </Card>
  );
}
