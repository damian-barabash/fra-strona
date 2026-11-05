import { SUPABASE_URL } from "../config";

// written by scripts/media-mirror.mjs before the build (not in git); missing (dev, tests) = [] → Storage URLs as before
const LIST = Object.values(import.meta.glob("./media-mirror.json", { eager: true, import: "default" }))[0];
const MIRRORED = Array.isArray(LIST) ? LIST : [];

/* Files from the Supabase Storage bucket "media" are copied to GitHub Pages at build time
   (scripts/media-mirror.mjs → /media/<path>). Here a Storage URL is swapped for that copy — only
   when the file really is in the copy (the list comes from the build), so an upload made after the
   last build keeps loading from Storage. Saves Supabase "cached egress" (Free plan: 5.5 GB/month).
   Only what is drawn changes; the data (and what the panel saves) keeps the Storage URLs. */
export const STORAGE = `${SUPABASE_URL}/storage/v1/object/public/media/`;
export const LOCAL = "/media/";
const SET = new Set(MIRRORED);
const VARIANT = /@\d+(\.webp)$/;

const nameOf = (rest) => {
  const clean = rest.split(/[?#]/)[0];
  try { return decodeURIComponent(clean); } catch { return clean; }
};
const mirrored = (name) => SET.has(name) || (VARIANT.test(name) && SET.has(name.replace(VARIANT, "$1")));

/** Storage URL → /media/… when the build copied that file; anything else unchanged */
export function local(url) {
  if (typeof url !== "string" || !SET.size || !url.startsWith(STORAGE)) return url;
  const rest = url.slice(STORAGE.length);
  return mirrored(nameOf(rest)) ? LOCAL + rest : url;
}

/** is there a mirrored file with this storage path (e.g. the "-m.webm" phone version of a video)? */
export const hasLocal = (path) => SET.has(path);

const RE = new RegExp(STORAGE.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&") + "[^\"')\\s<>]+", "g");
/** every Storage URL inside a string (HTML of a blog post, a CSS background) */
export function localIn(text) {
  if (typeof text !== "string" || !SET.size || !text.includes(STORAGE)) return text;
  return text.replace(RE, local);
}

/** props of any element: src / poster / style backgrounds / inner HTML (used by the JSX runtime) */
export function localProps(type, p) {
  if (!p || !SET.size) return p;
  let out = p;
  const set = (k, v) => { if (v !== out[k]) { if (out === p) out = { ...p }; out[k] = v; } };
  if (type === "img" || type === "video" || type === "source") {
    if (p.src) set("src", local(p.src));
    if (p.poster) set("poster", local(p.poster));
  }
  const s = p.style;
  if (s && (s.backgroundImage || s.background)) {
    const bi = s.backgroundImage && localIn(s.backgroundImage);
    const bg = s.background && localIn(s.background);
    if (bi !== s.backgroundImage || bg !== s.background) set("style", { ...s, ...(s.backgroundImage ? { backgroundImage: bi } : {}), ...(s.background ? { background: bg } : {}) });
  }
  // inner HTML only when not edited in place — what is typed there gets saved
  const h = p.dangerouslySetInnerHTML;
  if (h && typeof h.__html === "string" && !p.contentEditable) {
    const html = localIn(h.__html);
    if (html !== h.__html) set("dangerouslySetInnerHTML", { __html: html });
  }
  return out;
}
