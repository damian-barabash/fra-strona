// Public forms: contact (Kontakt) and company-event inquiry (Dla firm).
// Every message is stored in `messages` first, then e-mailed via Resend to the configured recipients.
import { db, cfg, listOf, sendMail, shell, table, row, button, chip, esc } from "../_shared/mail.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const SITE = (Deno.env.get("SITE_URL") ?? "https://fastlineracingacademy.pl").replace(/\/$/, "");
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// simple flood guard: max 8 messages per e-mail per hour
async function flooded(email: string) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("email", email).gte("created_at", since);
  return (count ?? 0) >= 8;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const p = await req.json();
    const kind = p.kind === "firma" ? "firma" : "contact";
    const full_name = str(p.full_name, 120), email = str(p.email, 160), phone = str(p.phone, 60);
    const subject = str(p.subject, 120), message = str(p.message, 4000), company = str(p.company, 160);
    const meta = kind === "firma" && p.meta && typeof p.meta === "object" ? p.meta : null;
    if (!full_name || (!message && !meta)) return json({ ok: false, error: "missing data" }, 400);
    if (!/.+@.+\..+/.test(email)) return json({ ok: false, error: "bad email" }, 400);
    if (await flooded(email)) return json({ ok: false, error: "too many messages" }, 429);

    const { data: rowDb } = await db.from("messages").insert({ full_name, email, phone, subject: subject || (kind === "firma" ? "Event firmowy" : ""), message, kind, company, meta }).select("id").single();

    const to = listOf(await cfg(kind === "firma" ? "firma_to" : "contact_to", "marcin.piotrowski@greywolfgroup.pl"));
    let html: string, subj: string;
    if (kind === "firma") {
      const m = meta ?? {};
      const brief = table([
        row("Firma", esc(company || "—")), row("Osoba", `<b>${esc(full_name)}</b>`),
        row("E-mail", `<a href="mailto:${esc(email)}" style="color:#e30613">${esc(email)}</a>`), row("Telefon", esc(phone || "—")),
        row("Cel", esc(m.goal)), row("Liczba osób", esc(m.persons)), row("Lokalizacja", esc(m.track)), row("Długość", esc(m.length)),
        row("Pakiet aut", esc(m.cars)), row("Termin", esc(m.date || "do ustalenia")),
        row("Dodatki", esc(Array.isArray(m.extras) && m.extras.length ? m.extras.join(", ") : "brak")),
        row("Orientacyjna wycena", esc(m.estimate || "—")),
      ].join(""));
      html = shell("Zapytanie o event firmowy", `<p>${chip("DLA FIRM")}</p>${brief}${message ? `<p style="white-space:pre-wrap;border-left:3px solid #e30613;padding-left:14px">${esc(message)}</p>` : ""}${button(`${SITE}/admin`, "Otwórz w panelu")}`, { eyebrow: "EVENTY FIRMOWE" });
      subj = `Event firmowy — ${company || full_name}${m.persons ? ` — ${m.persons} os.` : ""}`;
      // auto-reply to the company
      await sendMail(email, "Dziękujemy za zapytanie — Fastline Racing Academy", shell("Dziękujemy za zapytanie", `<p>Cześć ${esc(full_name.split(" ")[0])}!</p><p>Otrzymaliśmy Twój brief eventu na torze. Łukasz Kaźmierczak odezwie się z propozycją programu i wyceną — zwykle w ciągu jednego dnia roboczego.</p>${brief}<p style="font-size:13px;color:#6c7075">Pilne? Zadzwoń: <a href="tel:+48603102665" style="color:#e30613">+48 603 102 665</a></p>`, { eyebrow: "EVENTY FIRMOWE" }));
    } else {
      html = shell("Nowa wiadomość ze strony", `<p>${chip("KONTAKT")}</p>${table([
        row("Imię i nazwisko", `<b>${esc(full_name)}</b>`), row("E-mail", `<a href="mailto:${esc(email)}" style="color:#e30613">${esc(email)}</a>`),
        row("Telefon", esc(phone || "—")), row("Temat", esc(subject || "—")),
      ].join(""))}<p style="white-space:pre-wrap;border-left:3px solid #e30613;padding-left:14px">${esc(message)}</p>${button(`${SITE}/admin`, "Otwórz w panelu")}`, { eyebrow: "FORMULARZ KONTAKTOWY" });
      subj = `Fastline — ${subject || "wiadomość ze strony"} — ${full_name}`;
    }
    const r = await sendMail(to, subj, html, email);
    await db.from("messages").update({ sent: r.ok, error: r.ok ? null : r.error }).eq("id", rowDb?.id ?? "");
    if (!r.ok) return json({ ok: false, error: r.error, id: rowDb?.id }, 502);
    return json({ ok: true, id: rowDb?.id });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
