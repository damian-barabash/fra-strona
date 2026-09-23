import { FN, SUPABASE_ANON } from "../config";

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
  const dataUrl = isVideo ? await fileToDataUrl(file) : await fileToWebpDataUrl(file);
  const bytesOut = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 3 / 4);
  const ext = isVideo ? (file.type === "video/webm" ? "webm" : "mp4") : "webp";
  onStage({ stage: "upload", from: file.size, to: bytesOut, name, webp: !isVideo });
  const r = await adminCall("media.upload", { path: `${path}.${ext}`, dataUrl });
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
