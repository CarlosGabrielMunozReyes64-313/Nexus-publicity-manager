import { useLocation } from "react-router-dom";
import { Intro } from "../shared";
import Editor from "./editor/Editor";
import Lista from "./Lista";

/** /secuencias (lista) y /secuencias/:id (editor). /secuencias/:id/editar sigue funcionando. */
export default function Page() {
  const id = useLocation().pathname.split("/")[2];
  if (!id) return <Lista />;
  return (
    <>
      <Intro
        title="Secuencias de correo"
        description="Edita el borrador; lo aprobado se sigue enviando hasta que apruebes los cambios."
      />
      <Editor key={id} id={id} />
    </>
  );
}
