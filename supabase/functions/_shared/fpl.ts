// Paid order → Fastline Performance Lab (performancelab.fastlineracingacademy.pl).
// FPL finds the client by e-mail or phone (or creates the account and sends the standard
// welcome e-mail with login details), records the payment + Race Litres and, for a track
// training, enrols the client on the matching FPL training.
// Best-effort: a failure never un-pays an order — it lands in bookings.meta.fpl and the admin can retry.
import { db } from "./mail.ts";

const FPL_API = (Deno.env.get("FPL_API_URL") ?? "https://performancelab.fastlineracingacademy.pl/api").replace(/\/$/, "");
const TIMEOUT_MS = 15_000;

export type FplSync = { ok: true; account: "created" | "invited" | "existing"; matchedBy?: string; litres?: number; enrolled?: boolean; at: string }
  | { ok: false; error: string; at: string };

const describe = (o: any) => {
  const what = [o.car_name || o.product_name, o.package_name, o.sessions ? `${o.sessions} sesji` : "", o.term_label, o.voucher_for ? `voucher dla: ${o.voucher_for}` : ""]
    .filter(Boolean).join(" · ");
  return `${o.is_test ? "[TEST] " : ""}Sklep FRA #${o.number} · ${what}`.slice(0, 300);
};

async function payloadOf(o: any) {
  const paid = o.paid_amount != null ? Number(o.paid_amount) : Number(o.amount_pln) || 0;
  const p: Record<string, unknown> = {
    orderId: o.id,
    number: o.number,
    kind: o.kind,
    email: o.email,
    phone: o.phone || undefined,
    fullName: o.full_name || o.email,
    amountGrosze: Math.max(0, Math.round(paid * 100)),
    paidAt: o.paid_at || new Date().toISOString(),
    description: describe(o),
    language: String(o.lang || "pl").toUpperCase() === "EN" ? "EN" : "PL",
  };
  if (o.kind === "track") {
    p.isCustomCar = !!o.is_custom;
    p.carName = o.car_name || undefined;
    if (o.sessions) p.sessions = o.sessions;
    if (o.car_id) {
      const { data: car } = await db.from("cars").select("slug").eq("id", o.car_id).maybeSingle();
      if (car?.slug) p.carSlug = car.slug;
    }
    if (o.term_id) {
      const { data: term } = await db.from("terms").select("date, track").eq("id", o.term_id).maybeSingle();
      if (term?.date) p.termDate = String(term.date).slice(0, 10);
      if (term?.track) p.trackSlug = term.track;
    }
  }
  return p;
}

/** Sends the order to FPL once; stores the outcome in bookings.meta.fpl. Never throws. */
export async function syncToFpl(o: any, force = false): Promise<FplSync | null> {
  if (o.status !== "paid") return null;
  if (!force && o.meta?.fpl?.ok) return o.meta.fpl;
  const key = Deno.env.get("FPL_SHOP_KEY") ?? "";
  if (!key) return null;   // integration not configured — nothing to record

  let result: FplSync;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const r = await fetch(`${FPL_API}/integrations/fra-shop/purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Fra-Shop-Key": key, "User-Agent": "fra-strona-edge/1" },
      body: JSON.stringify(await payloadOf(o)),
      signal: ctl.signal,
    }).finally(() => clearTimeout(timer));
    const body = await r.json().catch(() => ({}));
    if (!r.ok || !body?.ok) {
      const msg = Array.isArray(body?.message) ? body.message.join("; ") : body?.message || `HTTP ${r.status}`;
      result = { ok: false, error: String(msg).slice(0, 300), at: new Date().toISOString() };
    } else {
      // a repeated call ("already") keeps the first answer — that one says whether an invite went out
      const prev = o.meta?.fpl;
      result = body.already && prev?.ok ? prev : {
        ok: true, account: body.account, matchedBy: body.matchedBy, litres: body.litres,
        enrolled: !!body.enrolledSessionId, at: new Date().toISOString(),
      };
    }
  } catch (e) {
    result = { ok: false, error: (e instanceof Error && e.name === "AbortError") ? "timeout" : String(e).slice(0, 300), at: new Date().toISOString() };
  }
  if (!result.ok) console.error(`fpl sync #${o.number}:`, result.error);
  // re-read meta so a concurrent write (e.g. another field) is not lost
  const { data: cur } = await db.from("bookings").select("meta").eq("id", o.id).maybeSingle();
  await db.from("bookings").update({ meta: { ...(cur?.meta ?? {}), fpl: result } }).eq("id", o.id);
  return result;
}
