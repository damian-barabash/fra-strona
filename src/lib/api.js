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

// convert an image File to a webp data URL via canvas (client-side, keeps uploads small)
export async function fileToWebpDataUrl(file, maxW = 2000, quality = 0.85) {
  if (file.type === "image/webp") return await fileToDataUrl(file);
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
