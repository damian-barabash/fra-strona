import VARIANTS from "./img-variants.json";
import { SUPABASE_URL } from "../config";

/* Responsive images without touching the markup. scripts/img-variants.mjs writes smaller copies
   (`<name>@480.webp`, `@960`, `@1600`) next to each image and lists them in img-variants.json
   ({ "/assets/…": [original width, ...copy widths], "st:<storage path>": […] }). Every <img> with a `sizes`
   prop passes through src/jsx (the JSX runtime), which adds the matching `srcset` here — the browser
   then downloads the smallest copy that is still sharp on that screen. Same picture, fewer bytes.
   Uploads from the panel carry their width in the file name (`…~2000.webp`, copies `…~2000@480.webp`). */
export const WIDTHS = [480, 960, 1600];
const STORAGE = `${SUPABASE_URL}/storage/v1/object/public/media/`;
const SITE = /^https?:\/\/(?:www\.)?(?:[a-z0-9-]+\.)?fastlineracingacademy\.pl(?=\/)/;
const stem = (u) => u.replace(/\.(webp|jpe?g|png)$/i, "");

function widthsOf(src) {
  const own = src.match(/~(\d{3,5})\.webp$/);           // panel upload: "…~2000.webp"
  if (own) { const w = Number(own[1]); return [w, ...WIDTHS.filter((v) => v < w * 0.92)]; }
  if (src.startsWith(STORAGE)) return VARIANTS[`st:${src.slice(STORAGE.length)}`];
  return VARIANTS[src.replace(SITE, "")];
}

const cache = new Map();
/** "a@480.webp 480w, …, a.webp 1800w" for an image that has copies, otherwise null */
export function srcsetOf(src) {
  if (typeof src !== "string" || !src || src.startsWith("data:") || src.startsWith("blob:")) return null;
  if (cache.has(src)) return cache.get(src);
  const clean = src.split(/[?#]/)[0];
  const list = clean === src ? widthsOf(src) : null;   // a query string = not our plain file
  const out = list && list.length > 1
    ? [...list.slice(1).map((w) => `${stem(src)}@${w}.webp ${w}w`), `${src} ${list[0]}w`].join(", ")
    : null;
  cache.set(src, out);
  return out;
}

/** props of an <img>: + srcSet when the component says how wide the picture is drawn (`sizes`).
 *  Opt-in on purpose: a picture without `sizes` keeps loading the original. `sizes="auto"` and a blanket
 *  "100vw" both pick copies that are too small for some layouts (object-fit: cover in tall boxes, grids
 *  sized by their image) — every `sizes` in the code is checked against all pages and screen sizes. */
export function withSrcset(p) {
  if (!p || !p.sizes || p.srcSet || p.srcset) return p;
  const set = srcsetOf(p.src);
  return set ? { ...p, srcSet: set } : p;
}
