import { FN, SUPABASE_ANON } from "../config";
import { WIDTHS } from "./img";

// Authorization always carries the anon key (the gateway may verify it); our own admin session
// token travels in x-admin-token, so the panel keeps working whatever the JWT setting is.
async function post(path, body, token) {
  const r = await fetch(`${FN}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      ...(token ? { "x-admin-token": token } : {}),
    },
    body: JSON.stringify(body),
  });
  return r.json();
}

export const authLogin = (login, password) => post("admin-auth", { login, password });
export const authVerify = (token) => post("admin-auth", { action: "verify", token });
export const adminCall = (token, action, payload) => post("admin-api", { action, payload }, token);
// public contact form → stored + e-mailed via Resend (key lives server-side in app_config)
export const sendContact = (payload) => post("contact", payload);

/** Convert + upload with visible stages: "convert" (→ WebP in the browser), "upload", "done".
 *  onStage({ stage, from, to, name }) fires on every change so the UI can show what is happening. */
export async function processUpload(file, path, adminCall, onStage = () => {}) {
  const isVideo = file.type.startsWith("video/");
  const name = file.name;
  onStage({ stage: "convert", from: file.size, name });
  const isImage = !isVideo && file.type.startsWith("image/");
  const conv = isImage ? await imageToWebp(file) : null;
  const dataUrl = conv ? conv.dataUrl : await fileToDataUrl(file);
  const bytesOut = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4);
  const ext = isVideo ? (file.type === "video/webm" ? "webm" : "mp4") : "webp";
  onStage({ stage: "upload", from: file.size, to: bytesOut, name, webp: !isVideo });
  // smaller copies for phones (lib/img.js): uploaded first, and the file name carries the original width
  // ("…~2000.webp") so the page knows they exist. If a copy fails, the photo goes up without them.
  let finalPath = `${path}.${ext}`;
  if (conv?.copies.length) {
    const base = `${path}~${conv.width}`;
    const ok = await Promise.all(conv.copies.map((c) => adminCall("media.upload", { path: `${base}@${c.width}.webp`, dataUrl: c.dataUrl }).then((x) => x.ok, () => false)));
    if (ok.every(Boolean)) finalPath = `${base}.webp`;
  }
  const r = await adminCall("media.upload", { path: finalPath, dataUrl });
  if (!r.ok) { onStage({ stage: "error", error: r.error, name }); return null; }
  onStage({ stage: "done", from: file.size, to: bytesOut, name, webp: !isVideo, url: r.url });
  return r.url;
}
export const fmtBytes = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// convert an image File to a webp data URL via canvas (client-side, keeps uploads small)
export async function fileToWebpDataUrl(file, maxW = 2000, quality = 0.85) {
  if (!file.type.startsWith("image/")) return await fileToDataUrl(file); // video / other: pass through
  const dataUrl = await fileToDataUrl(file);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", quality);
}

/** the photo as WebP (max 2000 px) + scaled copies for lib/img.js srcset (only those that are smaller) */
async function imageToWebp(file, maxW = 2000, quality = 0.85) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const draw = (w, hq = true) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = Math.max(1, Math.round((img.height * w) / img.width));
      const ctx = canvas.getContext("2d");
      if (hq) ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", quality);
    };
    const width = Math.round(Math.min(img.width, maxW));
    const dataUrl = draw(width, false);   // the photo itself: drawn exactly as before
    // a browser without WebP encoding (old Safari) gives PNG — then no copies, the photo goes as before
    if (!dataUrl.startsWith("data:image/webp")) return { dataUrl, width, copies: [] };
    const size = (d) => d.length;
    const copies = WIDTHS.filter((w) => w < width * 0.92).map((w) => ({ width: w, dataUrl: draw(w) }));
    // lib/img.js expects every copy below the width — all or none (a flat graphic may not shrink)
    return { dataUrl, width, copies: copies.every((c) => size(c.dataUrl) < size(dataUrl) * 0.85) ? copies : [] };
  } finally { URL.revokeObjectURL(url); }
}

export function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

export function extOf(dataUrl) {
  const m = dataUrl.match(/^data:([^;]+);/);
  const mime = m ? m[1] : "image/webp";
  return { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "video/webm": "webm", "video/mp4": "mp4" }[mime] || "bin";
}
