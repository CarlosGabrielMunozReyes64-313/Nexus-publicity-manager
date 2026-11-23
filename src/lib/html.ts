/**
 * «Texto con formato»: la misma lista blanca que el backend (app/motor/html.py).
 * El servidor siempre limpia el HTML; aquí se usa para la vista previa sin guardar,
 * para «Ver versión en texto simple» y en el modo demostración.
 */
const PERMITIDAS = new Set(["p", "br", "strong", "em", "ul", "ol", "li", "a"]);
const DESCARTAR = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "template",
]);
const ENLACE = "{{enlace}}";

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escaparAtributo = (t: string) => escapar(t).replace(/"/g, "&quot;");

export const hrefPermitido = (href: string | null) => {
  const v = (href ?? "").trim();
  return v === ENLACE || /^https:\/\//i.test(v) ? v : null;
};

function serializar(n: Node): string {
  if (n.nodeType === Node.TEXT_NODE) return escapar(n.textContent ?? "");
  if (n.nodeType !== Node.ELEMENT_NODE) return "";
  const el = n as Element;
  const tag = el.tagName.toLowerCase();
  if (DESCARTAR.has(tag)) return "";
  const hijos = [...el.childNodes].map(serializar).join("");
  if (!PERMITIDAS.has(tag)) return hijos;
  if (tag === "br") return "<br>";
  if (tag === "a") {
    const href = hrefPermitido(el.getAttribute("href"));
    return href ? `<a href="${escaparAtributo(href)}">${hijos}</a>` : hijos;
  }
  return `<${tag}>${hijos}</${tag}>`;
}

/** HTML seguro: solo p, br, strong, em, ul, ol, li y a (https: o {{enlace}}). */
export function limpiarHtml(html: string): string {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><body>${html ?? ""}</body>`,
    "text/html",
  );
  return [...doc.body.childNodes].map(serializar).join("").trim();
}

/** Versión en texto simple (la misma regla que usa el servidor para `cuerpo`). */
export function htmlATexto(html: string): string {
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><body>${limpiarHtml(html)}</body>`,
    "text/html",
  );
  const partes: string[] = [];
  const actual = () => partes.join("");
  const parrafo = () => {
    const t = actual();
    if (t && !t.endsWith("\n\n")) partes.push(t.endsWith("\n") ? "\n" : "\n\n");
  };
  const linea = () => {
    if (partes.length && !actual().endsWith("\n")) partes.push("\n");
  };
  const recorrer = (n: Node, listas: number[]) => {
    if (n.nodeType === Node.TEXT_NODE) {
      partes.push((n.textContent ?? "").replace(/\s+/g, " "));
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") {
      partes.push("\n");
      return;
    }
    if (tag === "p") parrafo();
    if (tag === "ul" || tag === "ol") {
      parrafo();
      listas = [...listas, tag === "ol" ? 1 : 0];
    }
    if (tag === "li") {
      linea();
      const nivel = listas.length - 1;
      if (nivel >= 0 && listas[nivel]) partes.push(`${listas[nivel]++}. `);
      else partes.push("- ");
    }
    for (const h of [...el.childNodes]) recorrer(h, listas);
    if (tag === "a") {
      const texto = (el.textContent ?? "").trim();
      const href = el.getAttribute("href");
      if (href && href !== texto) partes.push(texto ? ` (${href})` : href);
    }
    if (tag === "p" || tag === "ul" || tag === "ol") parrafo();
  };
  for (const n of [...doc.body.childNodes]) recorrer(n, []);
  return actual()
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plantilla mínima de un correo personal (igual que la del motor). */
export const conPlantilla = (cuerpo: string) =>
  '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
  '<body style="margin:0;padding:16px;background:#ffffff;">' +
  '<div style="max-width:600px;font-family:Arial,Helvetica,sans-serif;font-size:15px;' +
  `line-height:1.55;color:#1a2e24;">${cuerpo}</div></body></html>`;

/** Escapa un valor para insertarlo en HTML (las variables nunca aportan HTML). */
export const escaparHtml = (t: string) => escaparAtributo(t);
