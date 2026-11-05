/* Copies the Supabase Storage bucket "media" (photos, videos and covers uploaded in the panel) into
   public/media/ before `vite build`, so GitHub Pages serves them instead of Supabase.
   Why: every picture shown from Storage counts toward the Supabase "cached egress" limit
   (5.5 GB/month on the Free plan; the site used ~12 GB in 10.2026). GitHub Pages traffic is free.

   - Only new or changed files are downloaded (state in public/media/.mirror.json: size + eTag).
     In CI the folder is kept between runs by actions/cache (deploy.yml), so a normal build downloads
     nothing — otherwise the mirror itself would eat the egress it saves.
   - Files deleted from the bucket are deleted here too.
   - Writes src/lib/media-mirror.json = list of mirrored files (without the @480/@960/@1600 copies — a
     picture is listed only when all its copies are here). The page swaps a Storage URL for /media/…
     only for listed files (src/lib/media.js); an upload made after the build stays on Storage
     until the next build (push, nightly cron, blog deploy).
   - Never fails the build: on any error the list is written with what is complete (worst case
     empty = everything from Storage, like before).
   Skip with MEDIA_MIRROR=0. */
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPABASE_URL, SUPABASE_ANON } from "../src/config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "public", "media");
const STATE = join(DIR, ".mirror.json");
const LIST = join(ROOT, "src", "lib", "media-mirror.json");
const H = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
const VARIANT = /@\d+\.webp$/;

const writeList = (names) => {
  writeFileSync(LIST, JSON.stringify([...names].sort()) + "\n");
  console.log(`[media] ${names.length} files served from GitHub Pages (/media/)`);
};

if (process.env.MEDIA_MIRROR === "0") {
  writeList([]);
  process.exit(0);
}

async function listAll() {
  const out = [];
  const ls = async (prefix) => {
    for (let offset = 0; ; offset += 1000) {
      const res = await get(`${SUPABASE_URL}/storage/v1/object/list/media`, {
        method: "POST",
        headers: { ...H, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
      });
      const rows = await res.json();
      for (const o of rows) {
        const p = prefix ? `${prefix}/${o.name}` : o.name;
        if (!o.id) await ls(p);                         // a folder
        else if (o.name !== ".emptyFolderPlaceholder") out.push({ path: p, size: o.metadata?.size ?? null, etag: o.metadata?.eTag ?? o.updated_at ?? null });
      }
      if (rows.length < 1000) break;
    }
  };
  await ls("");
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Storage answers 429 when asked too fast — wait and try again (up to ~1 min per file)
async function get(url, init) {
  for (let i = 0; ; i++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    if ((res.status === 429 || res.status >= 500) && i < 6) { await sleep(1000 * 2 ** i); continue; }
    throw new Error(`HTTP ${res.status}`);
  }
}

const enc = (p) => p.split("/").map(encodeURIComponent).join("/");

async function main() {
  mkdirSync(DIR, { recursive: true });
  let state = {};
  try { state = JSON.parse(readFileSync(STATE, "utf8")); } catch { /* first run */ }

  let files;
  try { files = await listAll(); }
  catch (e) {
    // no list today: serve what the last run copied (a file deleted since then just stays reachable)
    const prev = Object.entries(state).filter(([p, s]) => existsSync(join(DIR, p)) && statSync(join(DIR, p)).size === s.bytes);
    console.warn(`[media] bucket list failed (${e.message}) — using the previous copy (${prev.length} files)`);
    files = prev.map(([path, s]) => ({ path, size: s.size, etag: s.etag }));
  }

  const want = new Set(files.map((f) => f.path));
  // remove what is no longer in the bucket
  for (const p of Object.keys(state)) {
    if (!want.has(p)) { rmSync(join(DIR, p), { force: true }); delete state[p]; }
  }

  const ok = new Set();
  const todo = [];
  for (const f of files) {
    const local = join(DIR, f.path);
    const s = state[f.path];
    if (s && s.etag === f.etag && s.size === f.size && existsSync(local) && statSync(local).size === s.bytes) ok.add(f.path);
    else todo.push(f);
  }

  let bytes = 0, failed = 0;
  const worker = async () => {
    for (let f; (f = todo.shift());) {
      try {
        const res = await get(`${SUPABASE_URL}/storage/v1/object/public/media/${enc(f.path)}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const local = join(DIR, f.path);
        mkdirSync(dirname(local), { recursive: true });
        writeFileSync(local, buf);
        state[f.path] = { size: f.size, etag: f.etag, bytes: buf.length };
        bytes += buf.length;
        ok.add(f.path);
      } catch (e) {
        failed++;
        console.warn(`[media] ${f.path}: ${e.message}`);
      }
    }
  };
  const n = todo.length;
  await Promise.all(Array.from({ length: 3 }, worker));
  writeFileSync(STATE, JSON.stringify(state));
  console.log(`[media] bucket ${files.length} files · downloaded ${n - failed} (${(bytes / 1048576).toFixed(1)} MB) · failed ${failed}`);

  // stray local files (not in the state) — e.g. a half-written download from an aborted run
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  for (const abs of walk(DIR)) {
    const rel = relative(DIR, abs).split("\\").join("/");
    if (rel !== ".mirror.json" && !state[rel]) rmSync(abs, { force: true });
  }

  // a picture counts only when every copy of it that exists in the bucket is here too
  const copiesOf = new Map();
  for (const p of want) if (VARIANT.test(p)) {
    const base = p.replace(VARIANT, ".webp");
    if (!copiesOf.has(base)) copiesOf.set(base, []);
    copiesOf.get(base).push(p);
  }
  const list = [...ok].filter((p) => !VARIANT.test(p) && (copiesOf.get(p) || []).every((c) => ok.has(c)));
  writeList(list);
}

main().catch((e) => {
  console.warn(`[media] ${e.message} — keeping everything on Storage`);
  writeList([]);
});
