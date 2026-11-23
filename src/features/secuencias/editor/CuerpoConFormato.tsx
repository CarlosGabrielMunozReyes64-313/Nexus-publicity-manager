import { useEffect, useState } from "react";
import { EditorContent, Node, mergeAttributes, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Link2, List, ListOrdered, Unlink } from "lucide-react";
import { Button } from "../../../components/ui";
import { hrefPermitido, htmlATexto, limpiarHtml } from "../../../lib/html";
import { VARIABLES } from "../util";
import styles from "./Editor.module.css";

const ENLACE = "{{enlace}}";

/**
 * Variable como ficha no editable: en el editor se ve «{{nombre}}» como una sola pieza
 * (no se puede romper a medias) y al guardar vuelve a ser el texto `{{nombre}}`.
 */
const Variable = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      nombre: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-variable") ?? "",
        renderHTML: (a: { nombre: string }) => ({ "data-variable": a.nombre }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-variable]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "nx-variable",
        contenteditable: "false",
      }),
      `{{${node.attrs.nombre as string}}}`,
    ];
  },
  renderText({ node }) {
    return `{{${node.attrs.nombre as string}}}`;
  },
});

/** HTML guardado → HTML del editor: cada `{{x}}` del texto pasa a ser una ficha. */
export function aEditor(html: string): string {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><body>${limpiarHtml(html)}</body>`,
    "text/html",
  );
  const textos: Text[] = [];
  const recorrer = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  while (recorrer.nextNode()) textos.push(recorrer.currentNode as Text);
  for (const t of textos) {
    const partes = (t.textContent ?? "").split(/(\{\{\w+\}\})/);
    if (partes.length === 1) continue;
    const frag = doc.createDocumentFragment();
    for (const p of partes) {
      const m = /^\{\{(\w+)\}\}$/.exec(p);
      if (m) {
        const span = doc.createElement("span");
        span.setAttribute("data-variable", m[1]);
        span.textContent = p;
        frag.append(span);
      } else if (p) frag.append(doc.createTextNode(p));
    }
    t.replaceWith(frag);
  }
  return doc.body.innerHTML;
}

/** HTML del editor → HTML a guardar: fichas a `{{x}}` y la lista blanca del servidor. */
export function deEditor(html: string): string {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><body>${html}</body>`,
    "text/html",
  );
  doc.body.querySelectorAll("span[data-variable]").forEach((s) => {
    s.replaceWith(doc.createTextNode(`{{${s.getAttribute("data-variable")}}}`));
  });
  const limpio = limpiarHtml(doc.body.innerHTML);
  return limpio === "<p></p>" ? "" : limpio;
}

/**
 * «Texto con formato» con TipTap: negrita, cursiva, listas, enlaces (https: o el
 * enlace de la campaña) y variables como fichas. Cada cambio entrega el HTML limpio y
 * su versión en texto simple, que es la que el servidor guarda en `cuerpo`.
 */
export default function CuerpoConFormato({
  html,
  onCambiar,
}: {
  html: string;
  onCambiar: (html: string, texto: string) => void;
}) {
  const [enlace, setEnlace] = useState<string | null>(null);
  const [errorEnlace, setErrorEnlace] = useState("");
  const [verTexto, setVerTexto] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        HTMLAttributes: { rel: null, target: null },
        isAllowedUri: (url) => hrefPermitido(url) !== null,
      }),
      Variable,
    ],
    content: aEditor(html),
    editorProps: {
      attributes: {
        "aria-label": "Cuerpo con formato",
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: ({ editor: e }) => {
      const limpio = deEditor(e.getHTML());
      onCambiar(limpio, htmlATexto(limpio));
    },
  });
  // Si el correo cambia desde fuera (restaurar, «Usar sugerencia»), se recarga.
  useEffect(() => {
    if (!editor) return;
    if (deEditor(editor.getHTML()) !== limpiarHtml(html))
      editor.commands.setContent(aEditor(html), { emitUpdate: false });
  }, [html, editor]);

  if (!editor) return null;
  const aplicarEnlace = () => {
    const url = (enlace ?? "").trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setEnlace(null);
      return;
    }
    if (!hrefPermitido(url)) {
      setErrorEnlace("Use un enlace https:// o el enlace de la campaña.");
      return;
    }
    const { empty } = editor.state.selection;
    const cadena = editor.chain().focus().extendMarkRange("link");
    if (empty)
      cadena
        .insertContent({
          type: "text",
          text: url === ENLACE ? "enlace del diagnóstico" : url,
          marks: [{ type: "link", attrs: { href: url } }],
        })
        .run();
    else cadena.setLink({ href: url }).run();
    setEnlace(null);
    setErrorEnlace("");
  };
  const texto = htmlATexto(deEditor(editor.getHTML()));
  return (
    <div className={styles.formato}>
      <span className={styles.etiqueta}>Cuerpo</span>
      <div
        className={styles.herramientas}
        role="toolbar"
        aria-label="Formato"
        // Los botones no le quitan el foco ni la selección al texto.
        onMouseDown={(e) => {
          if ((e.target as Element).closest("button")) e.preventDefault();
        }}
      >
        <button
          type="button"
          aria-label="Negrita"
          aria-pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          aria-label="Cursiva"
          aria-pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          aria-label="Lista con viñetas"
          aria-pressed={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={15} />
        </button>
        <button
          type="button"
          aria-label="Lista numerada"
          aria-pressed={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          aria-label="Enlace"
          aria-pressed={editor.isActive("link")}
          onClick={() =>
            setEnlace(
              (editor.getAttributes("link").href as string | undefined) ??
                ENLACE,
            )
          }
        >
          <Link2 size={15} />
        </button>
        {editor.isActive("link") && (
          <button
            type="button"
            aria-label="Quitar enlace"
            onClick={() =>
              editor.chain().focus().extendMarkRange("link").unsetLink().run()
            }
          >
            <Unlink size={15} />
          </button>
        )}
        <select
          aria-label="Insertar variable"
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            editor
              .chain()
              .focus()
              .insertContent({
                type: "variable",
                attrs: { nombre: e.target.value },
              })
              .run();
          }}
        >
          <option value="">Insertar variable…</option>
          {VARIABLES.map((v) => (
            <option key={v} value={v}>{`{{${v}}}`}</option>
          ))}
        </select>
      </div>
      {enlace !== null && (
        <div className={styles.enlace}>
          <label>
            Dirección del enlace
            <input
              value={enlace}
              onChange={(e) => {
                setEnlace(e.target.value);
                setErrorEnlace("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  aplicarEnlace();
                }
              }}
              placeholder="https://… o {{enlace}}"
            />
          </label>
          <small className="muted">
            {"{{enlace}}"} es el enlace de la campaña, con seguimiento de clics.
          </small>
          {errorEnlace && (
            <small role="alert" className={styles.error}>
              {errorEnlace}
            </small>
          )}
          <div className="row">
            <Button onClick={aplicarEnlace}>Aplicar enlace</Button>
            <Button onClick={() => setEnlace(null)}>Cancelar</Button>
          </div>
        </div>
      )}
      <EditorContent editor={editor} className={styles.prosa} />
      <button
        type="button"
        className={styles.verTexto}
        aria-expanded={verTexto}
        onClick={() => setVerTexto(!verTexto)}
      >
        {verTexto
          ? "Ocultar versión en texto simple"
          : "Ver versión en texto simple"}
      </button>
      {verTexto && (
        <pre
          className={styles.textoSimple}
          aria-label="Versión en texto simple"
        >
          {texto}
        </pre>
      )}
    </div>
  );
}
