/* Smaller copies of every site image, so a phone does not download a 2000 px photo for a 40 px thumbnail.
 *
 *   node scripts/img-variants.mjs            static images in public/assets
 *   node scripts/img-variants.mjs --storage  + photos uploaded through the panel (Supabase bucket "media");
 *                                            needs SUPABASE_ACCESS_TOKEN (PAT) to read the service key
 *
 * For each image wider than a variant width it writes `<name>@480.webp`, `@960`, `@1600` next to the
 * original (same picture, only scaled) and records the original's width in src/lib/img-variants.json.
 * The page (src/lib/img.js) turns that into `srcset`, and the browser picks the smallest copy that is
 * still sharp on the screen — the look does not change. Re-run after adding images to public/assets;
 * new uploads from the panel make their own copies (src/lib/api.js processUpload).
 * Needs `cwebp` and `sips` (macOS: brew install webp). Existing copies are kept (idempotent). */
import { execFileSync } from "node:child_process";
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { SUPABASE_URL } from "../src/config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "public");
const MANIFEST = join(ROOT, "src/lib/img-variants.json");
export const WIDTHS = [480, 960, 1600];
const IMG = /\.(webp|jpe?g|png)$/i;
const VARIANT = /@\d+\.webp$/;
const SKIP = [/^assets\/hero\//, /favicon/, /^og\./];

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const widthOf = (f) => Number(execFileSync("sips", ["-g", "pixelWidth", f], { encoding: "utf8" }).match(/pixelWidth: (\d+)/)?.[1] || 0);
const need = (w) => WIDTHS.filter((v) => v < w * 0.92);   // a copy almost as wide as the original is pointless
const stem = (p) => p.replace(IMG, "");
// cwebp: scaled; lossy q82 like the originals (alpha kept for the car cut-outs), lossless when the
// original is lossless (logos, track maps — flat graphics)
const lossless = (f) => /\.png$/i.test(f) || (/\.webp$/i.test(f) && readFileSync(f).subarray(0, 64).includes("VP8L"));
const encode = (src, out, w) => execFileSync("cwebp", ["-quiet", ...(lossless(src) ? ["-lossless", "-z", "9"] : ["-q", "82", "-m", "6", "-sharp_yuv", "-alpha_q", "90"]), "-resize", String(w), "0", src, "-o", out]);
// a copy that saves less than 15 % is not worth a srcset entry
const worth = (out, src) => statSync(out).size < statSync(src).size * 0.85;

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (IMG.test(n) && !VARIANT.test(n)) out.push(f);
  }
  return out;
}

/* manifest value: [original width, ...copy widths] */
let made = 0;
for (const f of walk(join(PUB, "assets"))) {
  const rel = relative(PUB, f);
  if (SKIP.some((re) => re.test(rel))) continue;
  const w = widthOf(f);
  const ok = [];
  for (const v of need(w)) {
    const out = join(PUB, `${stem(rel)}@${v}.webp`);
    if (!existsSync(out) || statSync(out).mtimeMs < statSync(f).mtimeMs) { encode(f, out, v); made++; }
    if (worth(out, f)) ok.push(v); else rmSync(out);
  }
  if (ok.length) manifest[`/${rel}`] = [w, ...ok]; else delete manifest[`/${rel}`];
}
console.log(`[img] static: ${Object.keys(manifest).filter((k) => k.startsWith("/")).length} images, ${made} new copies`);

if (process.argv.includes("--storage")) await storage();

const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(MANIFEST, JSON.stringify(sorted, null, 0).replace(/,"/g, ',\n"') + "\n");
console.log(`[img] manifest: ${Object.keys(sorted).length} entries → src/lib/img-variants.json`);

/* photos in the "media" bucket: download, make the copies, upload them next to the original.
   Manifest key = "st:<object path>" (the page maps the public URL to it). */
async function storage() {
  const pat = process.env.SUPABASE_ACCESS_TOKEN;
  if (!pat) { console.warn("[img] --storage needs SUPABASE_ACCESS_TOKEN"); return; }
  const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
  const keys = await (await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${pat}` } })).json();
  const service = keys.find?.((k) => k.name === "service_role")?.api_key;
  if (!service) { console.warn("[img] no service key"); return; }
  const H = { apikey: service, Authorization: `Bearer ${service}` };
  const list = [];
  const ls = async (prefix) => {
    for (let offset = 0; ; offset += 1000) {
      const r = await (await fetch(`${SUPABASE_URL}/storage/v1/object/list/media`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ prefix, limit: 1000, offset }) })).json();
      for (const o of r) {
        const p = prefix ? `${prefix}/${o.name}` : o.name;
        if (!o.id) await ls(p); else if (IMG.test(o.name) && !VARIANT.test(o.name)) list.push(p);
      }
      if (r.length < 1000) break;
    }
  };
  await ls("");
  const tmp = mkdtempSync(join(tmpdir(), "fra-img-"));
  let up = 0;
  try {
    for (const p of list) {
      const key = `st:${p}`;
      const src = join(tmp, "src" + (p.match(IMG)?.[0] || ".webp"));
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/media/${p}`);
      if (!res.ok) continue;
      writeFileSync(src, Buffer.from(await res.arrayBuffer()));
      const w = widthOf(src);
      if (Array.isArray(manifest[key]) && manifest[key][0] === w) continue;   // done on an earlier run
      const ok = [];
      for (const v of need(w)) {
        const name = `${stem(p)}@${v}.webp`;
        const out = join(tmp, `v${v}.webp`);
        encode(src, out, v);
        if (!worth(out, src)) continue;
        const r = await fetch(`${SUPABASE_URL}/storage/v1/object/media/${name}`, {
          method: "POST", headers: { ...H, "Content-Type": "image/webp", "x-upsert": "true", "cache-control": "max-age=31536000" }, body: readFileSync(out),
        });
        if (!r.ok) { console.warn("[img] upload failed", name, r.status, await r.text()); continue; }
        ok.push(v); up++;
      }
      if (ok.length) manifest[key] = [w, ...ok];
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
  console.log(`[img] storage: ${list.length} photos, ${up} copies uploaded`);
}
