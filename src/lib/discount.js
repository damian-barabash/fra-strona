// Kody rabatowe in the configurators. The server (admin-api `discount.check`) says what a code is;
// the browser previews what it is worth on the current choice with the same maths as the checkout
// (supabase/functions/_shared/discounts.ts) — and the checkout recomputes everything anyway.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { adminCall } from "./api";
import { gross, round2 } from "./vat";

const KEY = "fra_kod";
const FREE_BELOW = 1;
const MIN_CHECK_MS = 1500;     // the timing-board animation needs its three sectors

export const normCode = (s) => String(s ?? "").toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "").replace(/-+/g, "-").slice(0, 40);
const store = {
  get() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; } },
  set(v) { try { v ? sessionStorage.setItem(KEY, JSON.stringify(v)) : sessionStorage.removeItem(KEY); } catch { /* private mode */ } },
};
/** the order is paid — the code is spent, nothing to carry over to the next purchase */
export const forgetDiscount = () => store.set(null);

/** Does a product code fit the current choice? ctx = { kind, car_id, custom, sessions, package_id, slug, variant, trip_package_id } */
export function fits(code, ctx) {
  if (!code) return false;
  if (code.kind !== "product") return true;
  const t = code.target || {};
  if (t.kind !== ctx.kind) return false;
  if (t.kind === "track") {
    if (t.car_id === "own" && !ctx.custom) return false;
    if (t.car_id && t.car_id !== "own" && ctx.car_id !== t.car_id) return false;
    return !t.sessions || Number(ctx.sessions) === Number(t.sessions);
  }
  if (t.kind === "ice") return !t.package_id || ctx.package_id === t.package_id;
  if (t.kind === "product") return ctx.slug === t.slug && (!t.variant || ctx.variant === t.variant);
  if (t.kind === "trip") return t.package_id ? ctx.trip_package_id === t.package_id : (!t.slug || ctx.slug === t.slug);
  return false;
}

/** What the code does to the current choice. net = list price (net, in `currency`) of the whole order. */
export function previewOf(code, ctx, eurPln = 4.35) {
  const net = Number(ctx.net) || 0;
  if (!code) return null;
  const ok = fits(code, ctx);
  if (!net) return { ok, ready: false };
  const g = gross(net);
  const base = ctx.currency === "EUR" ? round2(g * eurPln) : g;
  const unit = round2(base / Math.max(1, Number(ctx.persons) || 1));
  if (!ok) return { ok, ready: true, base, off: 0, toPay: base };
  const pct = Math.min(100, Math.max(0, Number(code.value) || 0));
  // a general code: X zł, or X % of the whole order (all persons); a product code: one place
  let off = code.kind === "amount" ? (code.value_type === "percent" ? round2((base * pct) / 100) : Number(code.value) || 0)
    : code.value_type === "full" ? unit
    : code.value_type === "percent" ? round2((unit * pct) / 100)
    : Math.min(Number(code.value) || 0, unit);
  off = Math.min(round2(off), base);
  if (base - off < FREE_BELOW) off = base;
  return { ok, ready: true, base, off: round2(off), toPay: round2(base - off), free: base - off <= 0 };
}

/** "−100 zł" / "−20%" / "cały produkt" — what the code is worth, in words */
export function valueLabel(code, t) {
  if (!code) return "";
  if (code.value_type === "percent") return `−${Number(code.value).toLocaleString("pl-PL")}%`;
  if (code.kind === "amount" || code.value_type === "amount") return `−${Number(code.value).toLocaleString("pl-PL")} zł`;
  return t ? t("disc.full") : "100%";
}

/* The configurator's code state.
   status: idle → checking (sectors run) → landing (the discount flies to the price) → ok | error | redirect
   opts.kind — this configurator (track | ice | product | trip | voucher);
   opts.firstStep — on the first step a product code for this very configurator re-opens it preset. */
export function useDiscount({ kind, firstStep = false } = {}) {
  const [sp] = useSearchParams();
  const loc = useLocation();
  const nav = useNavigate();
  const fromUrl = normCode(sp.get("kod"));
  const saved = store.get();
  const [s, setS] = useState(() => (saved?.code && (!fromUrl || fromUrl === saved.code.code)
    ? { status: "ok", code: saved.code, eur: saved.eur, error: "", input: saved.code.code, seq: 0 }
    : { status: "idle", code: null, eur: 4.35, error: "", input: fromUrl || "", seq: 0 }));
  const live = useRef(true);
  const landTimer = useRef(0);
  const opts = useRef({ kind, firstStep }); opts.current = { kind, firstStep };
  // StrictMode mounts twice — the flag has to come back on with the second mount
  useEffect(() => { live.current = true; return () => { live.current = false; clearTimeout(landTimer.current); }; }, []);

  // a product code belongs to some configurator: another one → go there; this one on its first step →
  // re-open it with the choice preset (unless the address already says so)
  const routeFor = useCallback((code) => {
    if (code.kind !== "product" || !code.url) return null;
    const u = new URL(code.url, window.location.origin);
    const here = new URLSearchParams(loc.search);
    const same = u.pathname === loc.pathname && [...u.searchParams].every(([k, v]) => k === "kod" || here.get(k) === v);
    if (same) return null;
    if (code.target?.kind === opts.current.kind && !opts.current.firstStep) return null;
    return u.pathname + u.search;
  }, [loc.pathname, loc.search]);

  const apply = useCallback(async (raw, { quiet = false } = {}) => {
    const code = normCode(raw);
    if (!code) return;
    setS((x) => ({ ...x, status: quiet ? x.status : "checking", error: "", input: code }));
    const t0 = performance.now();
    const r = await adminCall("", "discount.check", { code }).catch(() => ({ ok: false, error: "Brak połączenia — spróbuj ponownie." }));
    if (!quiet) await new Promise((res) => setTimeout(res, Math.max(0, MIN_CHECK_MS - (performance.now() - t0))));
    if (!live.current) return;
    if (!r?.ok) {
      if (quiet) { store.set(null); setS((x) => ({ ...x, status: "idle", code: null })); return; }
      setS((x) => ({ ...x, status: "error", code: null, reason: r?.reason || "notfound", error: r?.error || "", seq: x.seq + 1 }));
      return;
    }
    store.set({ code: r.code, eur: r.eur_pln });
    const go = routeFor(r.code);
    if (go) {
      setS((x) => ({ ...x, status: "redirect", code: r.code, eur: r.eur_pln, seq: x.seq + 1 }));
      setTimeout(() => { if (live.current) nav(go); }, 1700);
      return;
    }
    if (quiet) { setS((x) => ({ ...x, status: "ok", code: r.code, eur: r.eur_pln })); return; }
    // the field flies the discount to the price and calls land(); if nothing is there to fly, land anyway
    setS((x) => ({ ...x, status: "landing", code: r.code, eur: r.eur_pln, seq: x.seq + 1 }));
    clearTimeout(landTimer.current);
    landTimer.current = setTimeout(() => setS((x) => (x.status === "landing" ? { ...x, status: "ok" } : x)), 1600);
  }, [nav, routeFor]);

  const land = useCallback(() => setS((x) => (x.status === "landing" ? { ...x, status: "ok" } : x)), []);
  const clear = useCallback(() => { store.set(null); setS((x) => ({ ...x, status: "idle", code: null, error: "", input: "" })); }, []);
  const setInput = useCallback((v) => setS((x) => ({ ...x, input: normCode(v), status: x.status === "error" ? "idle" : x.status })), []);

  // ?kod= in the address (a link from an e-mail, or the redirect of a product code) → checked on arrival;
  // a code remembered from earlier in this visit is re-validated quietly (it may have been used meanwhile)
  useEffect(() => {
    if (fromUrl && !(saved?.code?.code === fromUrl)) apply(fromUrl);
    else if (saved?.code) apply(saved.code.code, { quiet: true });
  }, []); // eslint-disable-line

  const applied = s.status === "ok" ? s.code : null;
  return { ...s, applied, apply, land, clear, setInput, preview: (ctx) => previewOf(applied, { kind, ...ctx }, s.eur) };
}
