import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Public contact-form endpoint.
   Stores the message, then sends it through Resend to the address configured in `app_config`
   (RLS-locked): resend_key / contact_to / contact_from. Nothing sensitive lives in the front-end. */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

const cfg = async (key, fallback = "") => {
  const { data } = await db.from("app_config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? fallback;
};

const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

function template({ full_name, email, phone, subject, message }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f6;font-family:Arial,Helvetica,sans-serif;color:#14161a">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
    <table width="100%" style="max-width:600px;background:#fff;border:1px solid #e4e6e8">
      <tr><td style="background:#0d0d0d;padding:22px 26px">
        <div style="color:#e30613;font-size:11px;letter-spacing:3px;font-weight:bold">FASTLINE RACING ACADEMY</div>
        <div style="color:#fff;font-size:22px;font-weight:bold;letter-spacing:1px;margin-top:6px">NOWA WIADOMOŚĆ ZE STRONY</div>
      </td></tr>
      <tr><td style="padding:26px">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6">
          <tr><td style="color:#6c7075;width:120px;padding:6px 0">Imię i nazwisko</td><td style="font-weight:bold">${esc(full_name)}</td></tr>
          <tr><td style="color:#6c7075;padding:6px 0">E-mail</td><td><a href="mailto:${esc(email)}" style="color:#e30613;font-weight:bold">${esc(email)}</a></td></tr>
          <tr><td style="color:#6c7075;padding:6px 0">Telefon</td><td style="font-weight:bold">${esc(phone) || "—"}</td></tr>
          <tr><td style="color:#6c7075;padding:6px 0">Temat</td><td style="font-weight:bold">${esc(subject) || "—"}</td></tr>
        </table>
        <div style="margin-top:20px;padding-top:18px;border-top:1px solid #e4e6e8;white-space:pre-wrap;font-size:15px;line-height:1.7">${esc(message)}</div>
      </td></tr>
      <tr><td style="background:#f4f5f6;padding:16px 26px;font-size:11px;color:#9aa0a6">
        Wiadomość wysłana z formularza kontaktowego na fastlineracingacademy.pl
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const p = await req.json();
    const full_name = String(p.full_name ?? "").trim().slice(0, 120);
    const email = String(p.email ?? "").trim().slice(0, 160);
    const phone = String(p.phone ?? "").trim().slice(0, 60);
    const subject = String(p.subject ?? "").trim().slice(0, 120);
    const message = String(p.message ?? "").trim().slice(0, 4000);

    if (!full_name || !message) return json({ ok: false, error: "missing data" }, 400);
    if (!/.+@.+\..+/.test(email)) return json({ ok: false, error: "bad email" }, 400);

    // keep the message even if the mail fails, so nothing is ever lost
    const { data: row } = await db.from("messages")
      .insert({ full_name, email, phone, subject, message })
      .select("id").single();

    const key = Deno.env.get("RESEND_KEY") || await cfg("resend_key");
    const to = await cfg("contact_to", "marcin.piotrowski@greywolfgroup.pl");
    const from = await cfg("contact_from", "Fastline Racing Academy <kontakt.na.stronie@fastlineracingacademy.pl>");
    if (!key) return json({ ok: false, error: "mail not configured", id: row?.id }, 500);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: `Fastline — ${subject || "wiadomość ze strony"} — ${full_name}`,
        html: template({ full_name, email, phone, subject, message }),
      }),
    });
    const body = await r.json().catch(() => ({}));

    if (!r.ok) {
      const err = body?.message || `resend ${r.status}`;
      if (row?.id) await db.from("messages").update({ sent: false, error: err }).eq("id", row.id);
      return json({ ok: false, error: err, id: row?.id }, 502);
    }

    if (row?.id) await db.from("messages").update({ sent: true }).eq("id", row.id);
    return json({ ok: true, id: row?.id });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
