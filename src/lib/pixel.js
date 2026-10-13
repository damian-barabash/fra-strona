/* Meta Pixel — loaded only after the visitor accepts cookies ("AKCEPTUJĘ"), never in the panel and
   never for search engines / automated browsers (a prerendered snapshot must not carry the script).

   Events: PageView on every page of the SPA, ViewContent on a product page and on the product card
   of a configurator, AddToCart when the card is ordered, InitiateCheckout on the payment step,
   Purchase on /platnosc once the server has confirmed the payment, Lead when a contact form
   (contact page, company event brief) has been accepted by the server. */
import { gross } from "./vat";

export const PIXEL_ID = "231855914162315";
const LS_PAID = "fra_px_paid";          // order ids already reported as Purchase (this browser)

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const automated = () => !get("fra_pixel_force")
  && (!!navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|prerender/i.test(navigator.userAgent || ""));

function ready() {
  if (get("fra_cookies") !== "all" || automated() || window.location.pathname.startsWith("/admin")) return false;
  if (!window.fbq) {
    const n = (window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    n.disablePushState = true;          // page views are sent by hand, once the new page is on screen
    const s = document.createElement("script");
    s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
    window.fbq("init", PIXEL_ID);
  }
  return true;
}

// the same event for the same thing within 2 s is one event (StrictMode runs effects twice in dev)
const recent = new Map();
function send(event, params, key = "", opts) {
  if (!ready()) return;
  const k = `${event}:${key}`, now = Date.now();
  if (now - (recent.get(k) || 0) < 2000) return;
  recent.set(k, now);
  if (opts) window.fbq("track", event, params || {}, opts);
  else if (params) window.fbq("track", event, params);
  else window.fbq("track", event);
}

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
/* item = { name, price (net), currency, id?, category? } → what Meta gets (value = gross, as paid) */
const content = (it) => ({
  content_name: it.name,
  ...(it.id ? { content_ids: [it.id], content_type: "product" } : {}),
  ...(it.category ? { content_category: it.category } : {}),
  ...(Number(it.price) > 0 ? { value: money(gross(it.price)), currency: it.currency || "PLN" } : {}),
});

export const pageView = () => send("PageView", null, window.location.pathname);
export const viewContent = (item) => { if (item?.name) send("ViewContent", content(item), `${item.id || item.name}:${item.price || ""}`); };

/* what the visitor is buying right now — set by the product card (or a direct-purchase page),
   read again by the payment step */
let cart = null;
export const setCart = (item) => { cart = item?.name ? item : null; };
export const addToCart = (item) => { if (item) setCart(item); if (cart) send("AddToCart", content(cart), `${cart.name}:${cart.price}`); };
export const initiateCheckout = () => { if (cart) send("InitiateCheckout", { ...content(cart), num_items: 1 }, `${cart.name}:${cart.price}`); };

/* a form that asks for contact instead of selling: name = which form, category = its subject */
export const lead = (name, category) => send("Lead", { content_name: name, ...(category ? { content_category: category } : {}) }, name);

/* order = row from booking.status with status "paid"; reported once per order in this browser */
export function purchase(order) {
  if (!order?.id || !ready()) return;
  let done = [];
  try { done = JSON.parse(get(LS_PAID) || "[]"); } catch { /* */ }
  if (done.includes(order.id)) return;
  const pln = Number(order.amount_pln) > 0;
  send("Purchase", {
    content_name: order.car_name || order.product_name || order.package_name || order.kind,
    content_category: order.kind,
    content_ids: [String(order.number || order.id)], content_type: "product", num_items: 1,
    value: money(pln ? order.amount_pln : gross(order.total)), currency: pln ? "PLN" : (order.currency || "PLN"),
  }, order.id, { eventID: order.id });
  try { localStorage.setItem(LS_PAID, JSON.stringify([...done, order.id].slice(-30))); } catch { /* private mode */ }
}
