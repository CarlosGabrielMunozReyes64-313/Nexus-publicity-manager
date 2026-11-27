/** Utilidades del editor de diseño (HTML de correo con tablas e imágenes). */

export const esDiseno = (html?: string | null) =>
  Boolean(html && /<(table|img)\b/i.test(html));

const FUENTE = "font-family:Arial,Helvetica,sans-serif";

/** Esqueleto inicial: marco de 600 px, encabezado, texto, botón y pie con firma y baja. */
export const ESQUELETO = [
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f6f4">',
  '<tr><td align="center" style="padding:24px 12px">',
  '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:8px">',
  `<tr><td style="padding:28px 32px 4px 32px;${FUENTE};font-size:24px;font-weight:bold;color:#0f4c3a">Título del correo</td></tr>`,
  `<tr><td style="padding:12px 32px;${FUENTE};font-size:16px;line-height:1.6;color:#1a2e24"><p style="margin:0 0 14px 0">Hola, {{nombre}}:</p><p style="margin:0 0 14px 0">Escriba aquí el mensaje para {{empresa}}.</p></td></tr>`,
  botonHtml("Hacer el diagnóstico", "{{enlace}}"),
  `<tr><td style="padding:20px 32px 28px 32px;border-top:1px solid #e3ebe6;${FUENTE};font-size:13px;line-height:1.6;color:#5b6f65"><p style="margin:0 0 10px 0">{{firma}}</p><p style="margin:0">{{baja}}</p></td></tr>`,
  "</table></td></tr></table>",
].join("\n");

export function botonHtml(texto: string, href: string) {
  const t = texto.replace(/[<>"&]/g, "");
  const h = href.replace(/["<>]/g, "");
  return (
    '<tr><td style="padding:8px 32px 24px 32px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    `<td style="background-color:#3bb273;border-radius:6px"><a href="${h}" style="display:inline-block;padding:13px 26px;${FUENTE};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">${t}</a></td>` +
    "</tr></table></td></tr>"
  );
}

export function imagenHtml(ruta: string, alt: string, ancho = 600) {
  const a = alt.replace(/[<>"&]/g, "");
  return `<tr><td style="padding:0"><img src="${ruta}" alt="${a}" width="${ancho}" style="display:block;width:100%;max-width:${ancho}px;height:auto;border:0"></td></tr>`;
}

export function parrafoHtml() {
  return `<tr><td style="padding:12px 32px;${FUENTE};font-size:16px;line-height:1.6;color:#1a2e24"><p style="margin:0 0 14px 0">Nuevo párrafo.</p></td></tr>`;
}

/** Imágenes que aparecen en el HTML, en orden: src y alt. */
export function imagenesDe(
  html: string,
): { src: string; alt: string; indice: number }[] {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map((m, indice) => ({
    src: /\ssrc="([^"]*)"/i.exec(m[0])?.[1] ?? "",
    alt: /\salt="([^"]*)"/i.exec(m[0])?.[1] ?? "",
    indice,
  }));
}

/** Cambia src o alt de la imagen número `indice`. */
export function cambiarImagen(
  html: string,
  indice: number,
  cambio: { src?: string; alt?: string },
) {
  let n = -1;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    n += 1;
    if (n !== indice) return tag;
    let t = tag;
    if (cambio.src !== undefined)
      t = /\ssrc="/i.test(t)
        ? t.replace(/\ssrc="[^"]*"/i, ` src="${cambio.src}"`)
        : t.replace(/<img/i, `<img src="${cambio.src}"`);
    if (cambio.alt !== undefined) {
      const alt = cambio.alt.replace(/[<>"&]/g, "");
      t = /\salt="/i.test(t)
        ? t.replace(/\salt="[^"]*"/i, ` alt="${alt}"`)
        : t.replace(/<img/i, `<img alt="${alt}"`);
    }
    return t;
  });
}

/** Inserta una fila nueva antes del pie (la fila que contiene {{firma}}). */
export function insertarFila(html: string, fila: string) {
  const i = html.lastIndexOf("<tr", html.indexOf("{{firma}}"));
  if (i < 0) return html + fila;
  return html.slice(0, i) + fila + "\n" + html.slice(i);
}

/** Texto simple aproximado (el servidor genera el definitivo con las mismas reglas). */
export function htmlATexto(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const partes: string[] = [];
  const recorrer = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      partes.push((n.textContent ?? "").replace(/\s+/g, " "));
      return;
    }
    if (!(n instanceof HTMLElement)) return;
    const tag = n.tagName.toLowerCase();
    if (tag === "img") return;
    if (tag === "br") partes.push("\n");
    if (tag === "li") partes.push("\n- ");
    n.childNodes.forEach(recorrer);
    if (tag === "a") {
      const href = n.getAttribute("href");
      if (href && href !== n.textContent?.trim()) partes.push(` (${href})`);
    }
    if (["p", "h1", "h2", "h3", "table", "ul", "ol"].includes(tag))
      partes.push("\n\n");
    if (["div", "tr", "td"].includes(tag)) partes.push("\n");
  };
  doc.body.childNodes.forEach(recorrer);
  return partes
    .join("")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
