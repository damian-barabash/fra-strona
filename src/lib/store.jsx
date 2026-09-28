import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import { DEFAULTS } from "./defaults";
import { authLogin, authVerify, adminCall } from "./api";
import { track, chain, isMutation, hasUnsaved } from "./sync";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const LS_LANG = "fra_lang";
const LS_TOKEN = "fra_admin_token";

const ACTION_LABEL = (a) => ({
  "config.set": "Ustawienia", "media.upload": "Wysyłka pliku", "admins.create": "Nowe konto", "admins.update": "Konto administratora",
  "admins.delete": "Usunięcie konta", "bookings.markPaid": "Oznaczenie jako opłacone", "bookings.resendMail": "Ponowna wysyłka e-maili",
  "bookings.cancel": "Anulowanie zamówienia", "bookings.delete": "Usunięcie zamówienia", "messages.delete": "Usunięcie wiadomości",
}[a] || a);

export function StoreProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(LS_LANG) || "pl");
  const [content, setContent] = useState({}); // key -> {pl,en,kind}
  const [allCars, setCars] = useState([]);   // every car (sport + race) — the admin edits this list
  const [instructors, setInstructors] = useState([]);
  const [events, setEvents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [banners, setBanners] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [terms, setTerms] = useState([]); // available booking dates
  const [mediaList, setMediaList] = useState([]); // press / "Media o nas"
  const [products, setProducts] = useState([]); // offer: STAGE 1-3, S&S, SIM, Heels…
  const [icePackages, setIcePackages] = useState([]); // Laponia packages (price + days)
  const [iceWindows, setIceWindows] = useState([]);   // Laponia date windows
  const [tripPackages, setTripPackages] = useState([]);     // trip packages (Monaco…)
  const [tripAttractions, setTripAttractions] = useState([]); // "W programie" of a trip
  const [tripPoints, setTripPoints] = useState([]);           // pins on the trip map (route)
  const [ready, setReady] = useState(false);

  // admin
  const [token, setToken] = useState(() => localStorage.getItem(LS_TOKEN) || "");
  const [admin, setAdmin] = useState(null);
  const [cmsMode, setCmsMode] = useState(false);

  useEffect(() => { localStorage.setItem(LS_LANG, lang); document.documentElement.lang = lang; }, [lang]);

  // initial data load
  const load = useCallback(async () => {
    const [c, cr, ins, ev, pr, bn, tr, md, tm, pd, ip, iw, tp, ta, tpt] = await Promise.all([
      supabase.from("content").select("*"),
      supabase.from("cars").select("*").eq("visible", true).order("sort"),
      supabase.from("instructors").select("*").eq("visible", true).order("sort"),
      supabase.from("events").select("*").eq("visible", true).order("sort"),
      supabase.from("programs").select("*").eq("visible", true).order("sort"),
      supabase.from("banners").select("*").eq("visible", true).order("sort"),
      supabase.from("tracks").select("*").eq("visible", true).order("sort"),
      supabase.from("media").select("*").eq("visible", true).order("sort"),
      supabase.from("terms").select("*").eq("visible", true).order("sort"),
      supabase.from("products").select("*").eq("visible", true).order("sort"),
      supabase.from("ice_packages").select("*").eq("visible", true).order("sort"),
      supabase.from("ice_windows").select("*").eq("visible", true).order("sort"),
      supabase.from("trip_packages").select("*").eq("visible", true).order("sort"),
      supabase.from("trip_attractions").select("*").eq("visible", true).order("sort"),
      supabase.from("trip_points").select("*").eq("visible", true).order("sort"),
    ]);
    const map = {};
    (c.data || []).forEach((r) => { map[r.key] = { pl: r.pl, en: r.en, kind: r.kind }; });
    setContent(map);
    setCars(cr.data || []);
    setInstructors(ins.data || []);
    setEvents(ev.data || []);
    setPrograms(pr.data || []);
    setBanners(bn.data || []);
    setTracks(tr.data || []);
    setMediaList(md.data || []);
    setTerms(tm.data || []);
    setProducts(pd.data || []);
    setIcePackages(ip.data || []);
    setIceWindows(iw.data || []);
    setTripPackages(tp.data || []);
    setTripAttractions(ta.data || []);
    setTripPoints(tpt.data || []);
    setReady(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  // verify existing admin token
  useEffect(() => {
    if (!token) return;
    authVerify(token).then((r) => {
      if (r.ok) setAdmin(r.admin);
      else { setToken(""); localStorage.removeItem(LS_TOKEN); }
    });
  }, [token]);

  // ---- content getters ----
  const raw = useCallback((key) => content[key] || DEFAULTS[key] || { pl: "", en: "", kind: "text" }, [content]);
  const t = useCallback((key) => {
    const r = raw(key);
    if (lang === "en") return r.en || r.pl || "";
    return r.pl || "";
  }, [raw, lang]);
  // media resolves to pl (source of truth), en unused
  const media = useCallback((key) => raw(key).pl || "", [raw]);

  // pick localized field of an entity row: field base like "description" -> description_en/_pl
  const L = useCallback((row, base) => {
    if (!row) return "";
    if (lang === "en") return row[`${base}_en`] || row[`${base}_pl`] || "";
    return row[`${base}_pl`] || "";
  }, [lang]);

  // ---- admin actions ----
  const login = async (l, p) => {
    const r = await authLogin(l, p);
    if (r.ok) { setToken(r.token); setAdmin(r.admin); localStorage.setItem(LS_TOKEN, r.token); }
    return r;
  };
  const logout = () => {
    if (hasUnsaved() && !confirm("Nie wszystkie zmiany zostały jeszcze zapisane na serwerze. Wylogować mimo to? Te zmiany mogą nie zostać zastosowane.")) return;
    setToken(""); setAdmin(null); setCmsMode(false); localStorage.removeItem(LS_TOKEN); };

  // optimistic content edit
  const setContentLocal = (key, pl, kind) =>
    setContent((c) => ({ ...c, [key]: { ...(c[key] || raw(key)), pl, kind: kind || raw(key).kind } }));

  // optimistic: the text/photo changes on screen at once, the save (+ server-side EN translation) runs
  // in the background; a failure restores the previous value and shows up in the sync indicator
  const saveContent = (key, pl, kind) => {
    const before = content[key];
    const k = kind || raw(key).kind;
    setContentLocal(key, pl, kind);
    return chain(`content:${key}`, () => track(`Treść: ${key}`, async () => {
      const r = await adminCall(token, "content.save", { items: [{ key, pl, kind: k }] });
      if (r.ok && r.rows?.[0]) setContent((c) => ({ ...c, [key]: { pl: r.rows[0].pl, en: r.rows[0].en, kind: r.rows[0].kind } }));
      return r;
    }, () => setContent((c) => { const n = { ...c }; if (before) n[key] = before; else delete n[key]; return n; })));
  };

  // configurators, price board and the home slider only ever see the sport cars; the race cars
  // (Mini Cup, GT3 Cup, Super Trofeo) are shown for reading on the Flota tab and their own pages
  const cars = allCars.filter((c) => (c.category || "sport") === "sport");
  const raceCars = allCars.filter((c) => c.category === "race");

  const setters = { cars: setCars, instructors: setInstructors, events: setEvents, programs: setPrograms, banners: setBanners, tracks: setTracks, media: setMediaList, terms: setTerms, products: setProducts, ice_packages: setIcePackages, ice_windows: setIceWindows, trip_packages: setTripPackages, trip_attractions: setTripAttractions, trip_points: setTripPoints };
  const getters = { cars: allCars, instructors, events, programs, banners, tracks, media: mediaList, terms, products, ice_packages: icePackages, ice_windows: iceWindows, trip_packages: tripPackages, trip_attractions: tripAttractions, trip_points: tripPoints };

  // public checkout: the edge function creates the pending booking + the Tpay transaction and
  // answers with payment_url; the browser only ever sends ids (prices are computed server-side)
  const checkout = (action) => (payload) =>
    adminCall(token, action, { ...payload, return_origin: window.location.origin, lang });
  const createBooking = checkout("booking.create");
  const createIceBooking = checkout("booking.createIce");
  const createTripBooking = checkout("booking.createTrip");
  const createProductBooking = checkout("booking.createProduct");
  const createVoucherBooking = checkout("booking.createVoucher");
  const orderStatus = (id) => adminCall("", "booking.status", { id });

  /* ---- optimistic collection edits ----
     The list changes immediately; the request runs in the background (per-record queue, so two quick
     edits of one row can't overtake each other). A new row gets a temporary id until the server
     answers — editing, deleting or reordering it meanwhile waits for the real id. On failure the
     change is rolled back and listed in the sync indicator with a retry. */
  const TABLE_LABEL = { cars: "Samochód", instructors: "Instruktor", events: "Wydarzenie", programs: "Kafelek", banners: "Baner", tracks: "Tor", media: "Media o nas", terms: "Termin", products: "Produkt", ice_packages: "Laponia — pakiet", ice_windows: "Laponia — termin", trip_packages: "Wyprawa — pakiet", trip_attractions: "Wyprawa — atrakcja", trip_points: "Wyprawa — punkt" };
  const labelOf = (table, row) => `${TABLE_LABEL[table] || table}: ${row?.name || row?.title_pl || row?.label_pl || row?.label || row?.date || row?.id || "nowy"}`;
  const isTmp = (id) => typeof id === "string" && id.startsWith("tmp-");
  const created = useRef(new Map()); // tmp id → Promise<real id | null>
  const realId = async (id) => (isTmp(id) ? await (created.current.get(id) || Promise.resolve(null)) : id);
  const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0);
  const clean = (row) => { const { _pending, _rev, ...rest } = row; return rest; };

  const rev = useRef(0);
  const upsertEntity = (table, row) => {
    const set = setters[table];
    const tmp = row.id ? null : `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const localId = row.id || tmp;
    const myRev = ++rev.current;
    // what to restore on failure: the last server version (an unsaved new row simply disappears)
    const prev = row.id && !isTmp(row.id) ? getters[table]?.find((x) => x.id === row.id) : null;
    const prevSaved = prev && !prev._pending ? prev : prev ? clean(prev) : null;
    set((list) => {
      const optimistic = { ...row, id: localId, _pending: true, _rev: myRev };
      const next = list.some((x) => x.id === localId) ? list.map((x) => (x.id === localId ? optimistic : x)) : [...list, optimistic];
      return next.sort(bySort);
    });
    let serverId = isTmp(localId) ? null : localId;
    const mine = (x) => x.id === localId || (serverId != null && x.id === serverId);
    const op = chain(`${table}:${localId}`, () => track(labelOf(table, row), async () => {
      // a brand-new row goes without id; an edit of a still-unsaved new row waits for its real id
      const id = tmp ? null : await realId(localId);
      if (!tmp && id === null) return { ok: false, error: "nie utworzono rekordu" };
      serverId = id;
      const payload = clean(tmp ? row : { ...row, id });
      if (tmp) delete payload.id;
      const r = await adminCall(token, `${table}.upsert`, payload);
      if (r.ok && r.row) {
        serverId = r.row.id;
        // a newer local edit of the same row wins on screen — only the real id is taken over
        set((list) => list.map((x) => (mine(x) ? (x._rev === myRev ? r.row : { ...x, id: r.row.id }) : x)).sort(bySort));
      }
      return r;
    }, () => set((list) => {
      const cur = list.find(mine);
      if (cur && cur._rev !== myRev) return list;                       // a newer edit is on screen — keep it
      return (prevSaved ? list.map((x) => (mine(x) ? prevSaved : x)) : list.filter((x) => !mine(x))).sort(bySort);
    })));
    if (tmp) created.current.set(tmp, op.then((r) => (r.ok && r.row ? r.row.id : null)));
    return op;
  };
  const deleteEntity = (table, id) => {
    const set = setters[table];
    const prev = getters[table]?.find((x) => x.id === id);
    set((list) => list.filter((x) => x.id !== id));
    return chain(`${table}:${id}`, () => track(`Usunięcie — ${labelOf(table, prev)}`, async () => {
      const rid = await realId(id);
      if (rid === null) return { ok: true }; // the row never reached the server — nothing to delete
      return adminCall(token, `${table}.delete`, { id: rid });
    }, () => prev && set((list) => [...list, prev].sort(bySort))));
  };
  const reorderEntity = (table, ids) => {
    const set = setters[table];
    const before = getters[table] || [];
    set((list) => ids.map((id, i) => ({ ...list.find((x) => x.id === id), sort: i + 1 })));
    return chain(`${table}:order`, () => track(`Kolejność — ${TABLE_LABEL[table] || table}`, async () => {
      const real = (await Promise.all(ids.map(realId))).filter((x) => x !== null);
      return adminCall(token, `${table}.reorder`, { ids: real });
    }, () => set(() => before)));
  };

  // every other admin action that changes data (settings, uploads, accounts, orders) is tracked too
  const call = (action, payload) =>
    isMutation(action) ? track(ACTION_LABEL(action), () => adminCall(token, action, payload)) : adminCall(token, action, payload);

  const value = {
    lang, setLang, ready,
    content, cars, allCars, raceCars, instructors, events, programs, banners, tracks, terms, mediaList, products, icePackages, iceWindows, tripPackages, tripAttractions, tripPoints,
    raw, t, media, L, reload: load,
    token, admin, isAdmin: !!admin,
    // permissions: the owner (moderator) can do everything, an admin only what its perms allow
    isOwner: admin?.role === "owner",
    can: (perm) => admin?.role === "owner" || !!admin?.perms?.[perm],
    cmsMode, setCmsMode: (v) => setCmsMode((cur) => { const next = typeof v === "function" ? v(cur) : v; return next && !(admin?.role === "owner" || admin?.perms?.content) ? false : next; }),
    login, logout,
    setContentLocal, saveContent,
    upsertEntity, deleteEntity, reorderEntity, getters, createBooking, createIceBooking, createTripBooking, createProductBooking, createVoucherBooking, orderStatus,
    adminCall: call,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
