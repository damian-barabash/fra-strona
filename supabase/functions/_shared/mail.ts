// Resend mailer + branded HTML templates for Fastline Racing Academy.
// The key lives in the edge secrets (RESEND_KEY) with an app_config fallback (resend_key).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.5";

export const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export const cfg = async (key: string, fallback = ""): Promise<string> => {
  const { data } = await db.from("app_config").select("value").eq("key", key).maybeSingle();
  return (data?.value ?? fallback) as string;
};
export const listOf = (s: string) => String(s || "").split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /.+@.+\..+/.test(x));

export const esc = (s: unknown) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
export const zl = (n: number, currency = "PLN") =>
  currency === "EUR" ? `${(Number(n) || 0).toLocaleString("pl-PL")} €` : `${(Number(n) || 0).toLocaleString("pl-PL")} zł`;

const SITE = (Deno.env.get("SITE_URL") ?? "https://fastlineracingacademy.pl").replace(/\/$/, "");

/** Branded shell: black header with the red eyebrow, white card, grey footer. */
export function shell(title: string, body: string, opts: { eyebrow?: string; preheader?: string } = {}) {
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f1f2f4;font-family:Arial,Helvetica,sans-serif;color:#14161a">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader ?? "")}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f2f4"><tr><td align="center" style="padding:28px 12px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border:1px solid #e3e5e8">
  <tr><td style="background:#0d0d0d;padding:26px 30px;border-top:4px solid #e30613">
    <div style="color:#e30613;font-size:11px;letter-spacing:3px;font-weight:bold">${esc(opts.eyebrow ?? "FASTLINE RACING ACADEMY")}</div>
    <div style="color:#fff;font-size:24px;font-weight:800;letter-spacing:.5px;margin-top:8px;line-height:1.15;text-transform:uppercase">${esc(title)}</div>
  </td></tr>
  <tr><td style="padding:28px 30px;font-size:15px;line-height:1.65">${body}</td></tr>
  <tr><td style="background:#f4f5f6;padding:18px 30px;font-size:11.5px;line-height:1.6;color:#8a8f96;border-top:1px solid #e3e5e8">
    Fastline Racing Academy · FASTLINE EVENTS sp. z o.o. · ul. Wita Stwosza 48, 02-661 Warszawa<br>
    <a href="${SITE}" style="color:#e30613;text-decoration:none">fastlineracingacademy.pl</a> · racingacademy@fastline.pl · +48 603 102 665
  </td></tr>
</table></td></tr></table></body></html>`;
}

export const row = (label: string, value: unknown, bold = false) =>
  `<tr><td style="padding:8px 0;color:#6c7075;width:42%;vertical-align:top;border-bottom:1px solid #eef0f2">${esc(label)}</td><td style="padding:8px 0;border-bottom:1px solid #eef0f2;${bold ? "font-weight:bold;" : ""}">${value ?? "—"}</td></tr>`;
export const table = (rows: string) => `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:6px 0 14px">${rows}</table>`;
export const button = (href: string, label: string) =>
  `<div style="margin:22px 0 6px"><a href="${href}" style="display:inline-block;background:#e30613;color:#fff;text-decoration:none;font-weight:bold;letter-spacing:2px;font-size:12px;padding:14px 24px;text-transform:uppercase">${esc(label)} ›</a></div>`;
export const chip = (s: string, color = "#e30613") =>
  `<span style="display:inline-block;background:${color};color:#fff;font-size:10px;font-weight:bold;letter-spacing:2px;padding:5px 9px;text-transform:uppercase">${esc(s)}</span>`;

export async function sendMail(to: string | string[], subject: string, html: string, replyTo?: string) {
  const key = Deno.env.get("RESEND_KEY") || (await cfg("resend_key"));
  const from = await cfg("contact_from", "Fastline Racing Academy <kontakt.na.stronie@fastlineracingacademy.pl>");
  const list = Array.isArray(to) ? to : listOf(to);
  if (!key) return { ok: false, error: "mail not configured" };
  if (!list.length) return { ok: false, error: "no recipients" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: list, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: body?.message || `resend ${r.status}` };
  return { ok: true, id: body?.id };
}
