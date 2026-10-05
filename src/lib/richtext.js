/* Rich text of a blog post: what the panel's editor may produce and what the article page renders.
   Posts are stored as HTML with ONE BLOCK PER LINE (paragraph, heading, list, quote, figure, button
   row, divider) — the server translates them block by block, so the format matters.
   The same allow-list runs when saving (editor) and when showing (page). */

const DROP = /^(SCRIPT|STYLE|OBJECT|EMBED|FORM|INPUT|TEXTAREA|SELECT|BUTTON|LINK|META|TITLE|SVG|MATH|TEMPLATE|NOSCRIPT)$/;
const KEEP = /^(P|H2|H3|H4|UL|OL|LI|BLOCKQUOTE|FIGURE|FIGCAPTION|IMG|A|STRONG|EM|U|S|BR|HR|SPAN|IFRAME)$/;
const RENAME = { B: "strong", I: "em", H1: "h2", H5: "h4", H6: "h4", STRIKE: "s", DEL: "s", DIV: "p" };
const BLOCK = /^(P|H2|H3|H4|UL|OL|BLOCKQUOTE|FIGURE|HR)$/;
const CLASSES = {
  P: ["rt-cta"],
  A: ["rt-btn", "rt-btn--dark", "rt-btn--ghost"],
  FIGURE: ["rt-fig", "rt-fig--wide", "rt-fig--left", "rt-fig--right", "rt-video"],
};
const HREF = /^(https?:\/\/|\/(?!\/)|mailto:|tel:|#)/i;
const SRC = /^(https:\/\/|\/(?!\/))/i;
const EMBED = /^https:\/\/(www\.youtube(-nocookie)?\.com\/embed\/[\w-]+|player\.vimeo\.com\/video\/\d+)(\?[\w=&;-]*)?$/;
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i;

/** A YouTube / Vimeo page address → the address of its player (null when it is neither). */
export function embedUrl(input) {
  const u = String(input || "").trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

function cleanAttrs(el) {
  const tag = el.tagName;
  const allowed = CLASSES[tag] || [];
  [...el.attributes].forEach((a) => {
    const n = a.name.toLowerCase(), v = a.value.trim();
    let keep = false;
    if (n === "class") {
      const cls = v.split(/\s+/).filter((c) => allowed.includes(c));
      if (cls.length) { el.setAttribute("class", cls.join(" ")); keep = true; }
    } else if (n === "style") {
      const out = [];
      v.split(";").forEach((d) => {
        const [k, ...rest] = d.split(":"); const key = (k || "").trim().toLowerCase(), val = rest.join(":").trim();
        if (key === "text-align" && /^(P|H2|H3|H4|LI|BLOCKQUOTE)$/.test(tag) && /^(center|right|left|justify)$/i.test(val)) { if (!/^left$/i.test(val)) out.push(`text-align:${val.toLowerCase()}`); }
        else if (key === "color" && tag === "SPAN" && COLOR.test(val)) out.push(`color:${val}`);
      });
      if (out.length) { el.setAttribute("style", out.join(";")); keep = true; }
    } else if (tag === "A") keep = (n === "href" && HREF.test(v)) || (n === "target" && v === "_blank");
    else if (tag === "IMG") keep = (n === "src" && SRC.test(v)) || n === "alt" || ((n === "width" || n === "height") && /^\d+$/.test(v));
    else if (tag === "IFRAME") keep = n === "src" && EMBED.test(v);
    if (!keep) el.removeAttribute(a.name);
  });
  if (tag === "A") { if (el.getAttribute("target") === "_blank") el.setAttribute("rel", "noopener noreferrer"); }
  if (tag === "IMG") { el.setAttribute("loading", "lazy"); el.setAttribute("decoding", "async"); if (!el.hasAttribute("alt")) el.setAttribute("alt", ""); }
  if (tag === "IFRAME") { el.setAttribute("loading", "lazy"); el.setAttribute("allowfullscreen", ""); el.setAttribute("title", "Wideo"); }
}

function walk(node, doc) {
  [...node.childNodes].forEach((c) => {
    if (c.nodeType === 8) { c.remove(); return; }                 // comments (Word leaves plenty)
    if (c.nodeType !== 1) return;
    if (DROP.test(c.tagName)) { c.remove(); return; }
    let el = c;
    const to = RENAME[el.tagName];
    if (to) {
      const n = doc.createElement(to);
      [...el.attributes].forEach((a) => n.setAttribute(a.name, a.value));
      n.append(...el.childNodes); el.replaceWith(n); el = n;
    }
    walk(el, doc);
    if (!KEEP.test(el.tagName)) { el.replaceWith(...el.childNodes); return; }
    cleanAttrs(el);
    const t = el.tagName;
    if ((t === "A" && !el.getAttribute("href")) || (t === "SPAN" && !el.attributes.length)) { el.replaceWith(...el.childNodes); return; }
    if ((t === "IMG" || t === "IFRAME") && !el.getAttribute("src")) el.remove();
  });
}

const isEmpty = (el) => !el.textContent.replace(/[\s ​]/g, "") && !el.querySelector("img, iframe");

/** Sanitise editor / pasted HTML and lay it out as one top-level block per line. */
export function sanitizeRich(html) {
  if (!html || typeof html !== "string") return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild;
  walk(root, doc);

  // top level: only blocks — loose text and inline tags are gathered into paragraphs
  let run = null;
  [...root.childNodes].forEach((n) => {
    const block = n.nodeType === 1 && BLOCK.test(n.tagName);
    if (block) { run = null; return; }
    if (n.nodeType === 3 && !n.textContent.trim() && !run) { n.remove(); return; }
    if (!run) { run = doc.createElement("p"); n.before(run); }
    run.append(n);
  });
  // a paragraph may not hold blocks (browsers nest them when pasting) — lift them out
  root.querySelectorAll("p p, p h2, p h3, p h4, p ul, p ol, p figure, p blockquote, p hr").forEach((b) => {
    const p = b.closest("p"); if (p && p !== b && p.parentNode) p.after(b);
  });
  root.querySelectorAll("figure").forEach((f) => {
    if (!f.querySelector("img, iframe")) { f.remove(); return; }
    if (!f.className) f.className = f.querySelector("iframe") ? "rt-video" : "rt-fig";
    f.querySelectorAll("figcaption").forEach((c) => { if (isEmpty(c)) c.remove(); });
  });
  // a picture pasted on its own line becomes a proper figure
  [...root.children].forEach((p) => {
    if (p.tagName !== "P" || p.children.length !== 1 || p.textContent.trim()) return;
    const img = p.firstElementChild;
    if (img.tagName !== "IMG") return;
    const f = doc.createElement("figure"); f.className = "rt-fig"; f.append(img); p.replaceWith(f);
  });
  [...root.children].forEach((b) => { if (b.tagName !== "HR" && isEmpty(b)) b.remove(); });

  // browsers pad the text with &nbsp; while typing (after a link, at line ends) — ordinary spaces go out
  const tidy = (h) => h.replace(/\s*\n\s*/g, " ").replace(/(&nbsp;|\s)+(<\/(p|h2|h3|h4|li|blockquote|figcaption)>)/g, "$2").replace(/&nbsp;(?=[^\s<&])/g, " ");
  return [...root.children].map((b) => tidy(b.outerHTML)).join("\n");
}

export const plainText = (html) => String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
export const wordCount = (html) => plainText(html).split(" ").filter(Boolean).length;
export const readingMinutes = (html) => Math.max(1, Math.round(wordCount(html) / 200));
