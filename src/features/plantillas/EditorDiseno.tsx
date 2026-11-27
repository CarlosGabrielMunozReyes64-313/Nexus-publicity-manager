import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { request } from "../../api/client";
import { useResource } from "../../api/hooks";
import * as S from "../../api/schemas";
import { Button, Modal } from "../../components/ui";
import {
  botonHtml,
  cambiarImagen,
  htmlATexto,
  imagenesDe,
  imagenHtml,
  insertarFila,
  parrafoHtml,
} from "./diseno";

const VARIABLES = [
  "nombre",
  "cargo",
  "empresa",
  "municipio",
  "senal",
  "enlace",
  "firma",
  "baja",
];
const MAX_IMAGEN = 1_500_000;

async function aBase64(file: File): Promise<string> {
  const buf = new Uint8Array(
    typeof file.arrayBuffer === "function"
      ? await file.arrayBuffer()
      : await new Promise<ArrayBuffer>((ok, mal) => {
          const r = new FileReader();
          r.onload = () => ok(r.result as ArrayBuffer);
          r.onerror = () => mal(r.error);
          r.readAsArrayBuffer(file);
        }),
  );
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Editor de correos con diseño: código HTML con ayudas para imágenes, botones y textos.
 *
 * El servidor vuelve a limpiar el HTML con su lista blanca y genera el texto simple. */
export default function EditorDiseno({
  html,
  onCambiar,
  soloLectura = false,
}: {
  html: string;
  onCambiar: (html: string, texto: string) => void;
  soloLectura?: boolean;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [eligiendo, setEligiendo] = useState<number | "nueva" | null>(null);
  const [boton, setBoton] = useState(false);
  const cambiar = (h: string) => onCambiar(h, htmlATexto(h));
  const imagenes = imagenesDe(html);
  const insertarEnCursor = (texto: string) => {
    const el = area.current;
    const i = el?.selectionStart ?? html.length;
    cambiar(html.slice(0, i) + texto + html.slice(el?.selectionEnd ?? i));
  };
  return (
    <div className="stack">
      {imagenes.length > 0 && (
        <fieldset className="stack">
          <legend>Imágenes del diseño</legend>
          {imagenes.map((im) => (
            <div
              key={im.indice}
              className="row"
              style={{ alignItems: "center" }}
            >
              <img
                src={im.src}
                alt=""
                style={{
                  width: 96,
                  height: 48,
                  objectFit: "cover",
                  border: "1px solid #dde5e0",
                  borderRadius: 4,
                }}
              />
              <label style={{ flex: 1 }}>
                Texto alternativo de la imagen {im.indice + 1}
                <input
                  value={im.alt}
                  disabled={soloLectura}
                  required
                  placeholder="Describe la imagen (obligatorio)"
                  onChange={(e) =>
                    cambiar(
                      cambiarImagen(html, im.indice, { alt: e.target.value }),
                    )
                  }
                />
              </label>
              {!soloLectura && (
                <Button onClick={() => setEligiendo(im.indice)}>
                  Cambiar imagen
                </Button>
              )}
            </div>
          ))}
        </fieldset>
      )}
      {!soloLectura && (
        <div className="row">
          <Button onClick={() => setEligiendo("nueva")}>Añadir imagen</Button>
          <Button onClick={() => setBoton(true)}>Añadir botón</Button>
          <Button onClick={() => cambiar(insertarFila(html, parrafoHtml()))}>
            Añadir párrafo
          </Button>
          <label>
            Insertar variable
            <select
              value=""
              aria-label="Insertar variable en el diseño"
              onChange={(e) =>
                e.target.value && insertarEnCursor(`{{${e.target.value}}}`)
              }
            >
              <option value="">Elegir…</option>
              {VARIABLES.map((v) => (
                <option key={v} value={v}>{`{{${v}}}`}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <label>
        Código HTML del diseño
        <textarea
          ref={area}
          rows={16}
          spellCheck={false}
          readOnly={soloLectura}
          value={html}
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
          }}
          onChange={(e) => cambiar(e.target.value)}
        />
      </label>
      <p className="muted">
        Edite los textos directamente en el código (entre las etiquetas) y mire
        el resultado en la vista previa. Solo se conservan estilos seguros; las
        imágenes deben subirse aquí o estar en una dirección https://. El texto
        simple se genera solo y viaja junto al diseño.
      </p>
      {eligiendo !== null && (
        <ElegirImagen
          onClose={() => setEligiendo(null)}
          onElegir={(ruta, alt) => {
            cambiar(
              eligiendo === "nueva"
                ? insertarFila(html, imagenHtml(ruta, alt))
                : cambiarImagen(html, eligiendo, {
                    src: ruta,
                    ...(alt ? { alt } : {}),
                  }),
            );
            setEligiendo(null);
          }}
        />
      )}
      {boton && (
        <NuevoBoton
          onClose={() => setBoton(false)}
          onCrear={(t, h) => {
            cambiar(insertarFila(html, botonHtml(t, h)));
            setBoton(false);
          }}
        />
      )}
    </div>
  );
}

function ElegirImagen({
  onClose,
  onElegir,
}: {
  onClose: () => void;
  onElegir: (ruta: string, alt: string) => void;
}) {
  const q = useResource("/imagenes", S.imagenSchema.array());
  const cache = useQueryClient();
  const [alt, setAlt] = useState("");
  const [externa, setExterna] = useState("");
  const [error, setError] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const subir = async (file?: File) => {
    setError("");
    if (!file) return;
    if (!/\.(png|jpe?g|gif)$/i.test(file.name))
      return setError("Use una imagen PNG, JPG o GIF.");
    if (file.size > MAX_IMAGEN)
      return setError(
        "La imagen supera 1,5 MB: redúzcala (ideal: 1200 px de ancho).",
      );
    setSubiendo(true);
    try {
      const r = await request(
        "/imagenes",
        S.imagenSchema.extend({ ok: S.okSchema.shape.ok }),
        "POST",
        {
          nombre: file.name,
          contenido: await aBase64(file),
        },
      );
      await cache.invalidateQueries({ queryKey: ["/imagenes"] });
      onElegir(r.ruta, alt || file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setSubiendo(false);
    }
  };
  return (
    <Modal title="Elegir imagen" onClose={onClose}>
      <div className="stack">
        <label>
          Texto alternativo (lo leen los lectores de pantalla y se ve si la
          imagen no carga)
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Ej.: Equipo de NEXUS en una visita"
          />
        </label>
        <label>
          Subir una imagen (PNG, JPG o GIF, hasta 1,5 MB)
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif"
            disabled={subiendo}
            onChange={(e) => void subir(e.target.files?.[0])}
          />
        </label>
        {subiendo && <p role="status">Subiendo…</p>}
        {error && (
          <p role="alert" className="danger">
            {error}
          </p>
        )}
        {q.data && q.data.length > 0 && (
          <>
            <p className="muted">O elija una ya subida:</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))",
                gap: 8,
              }}
            >
              {q.data.map((im) => (
                <button
                  key={im.id}
                  type="button"
                  title={im.nombre}
                  onClick={() =>
                    onElegir(im.ruta, alt || im.nombre.replace(/\.[^.]+$/, ""))
                  }
                  style={{
                    padding: 0,
                    border: "1px solid #dde5e0",
                    borderRadius: 6,
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={im.ruta}
                    alt={im.nombre}
                    style={{
                      width: "100%",
                      height: 72,
                      objectFit: "cover",
                      borderRadius: "6px 6px 0 0",
                    }}
                  />
                  <small
                    style={{
                      display: "block",
                      padding: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {im.ejemplo ? "Ejemplo · " : ""}
                    {im.nombre}
                  </small>
                </button>
              ))}
            </div>
          </>
        )}
        <label>
          O pegue una dirección https:// de una imagen publicada
          <input
            value={externa}
            onChange={(e) => setExterna(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <Button
          disabled={!/^https:\/\/\S+$/.test(externa)}
          onClick={() => onElegir(externa, alt || "Imagen")}
        >
          Usar esa dirección
        </Button>
      </div>
    </Modal>
  );
}

function NuevoBoton({
  onClose,
  onCrear,
}: {
  onClose: () => void;
  onCrear: (texto: string, href: string) => void;
}) {
  const [texto, setTexto] = useState("Hacer el diagnóstico");
  const [href, setHref] = useState("{{enlace}}");
  const valido =
    texto.trim() && (href === "{{enlace}}" || /^https:\/\/\S+$/.test(href));
  return (
    <Modal title="Añadir botón" onClose={onClose}>
      <div className="stack">
        <label>
          Texto del botón
          <input value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <label>
          Enlace ({"{{enlace}}"} = enlace de la secuencia, con medición de
          clics)
          <input value={href} onChange={(e) => setHref(e.target.value)} />
        </label>
        <Button
          variant="primary"
          disabled={!valido}
          onClick={() => onCrear(texto.trim(), href.trim())}
        >
          Añadir
        </Button>
      </div>
    </Modal>
  );
}
