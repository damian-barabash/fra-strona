import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import { DEFAULTS } from "./defaults";
import { authLogin, authVerify, adminCall } from "./api";
import { track, chain, isMutation, hasUnsaved } from "./sync";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const LS_LANG = "fra_lang";
const LS_TOKEN = "fra_admin_token";

const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0);
// blog cards: everything but the article body
const POST_CARD = "id,slug,title_pl,title_en,tag_pl,tag_en,excerpt_pl,excerpt_en,cover,cover_alt,author,published_at,reading_min,visible,sort,created_at,updated_at";
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// the site shows visible rows only; the lists themselves also hold the hidden ones once an admin is in
const useVisible = (list) => useMemo(() => (list.some((x) => x.visible === false) ? list.filter((x) => x.visible !== false) : list), [list]);

const ACTION_LABEL = (a) => ({
  "config.set": "Ustawienia", "media.upload": "Wysyłka pliku", "admins.create": "Nowe konto", "admins.update": "Konto administratora",
  "admins.delete": "Usunięcie konta", "bookings.markPaid": "Oznaczenie jako opłacone", "bookings.resendMail": "Ponowna wysyłka e-maili",
  "bookings.cancel": "Anulowanie zamówienia", "bookings.delete": "Usunięcie zamówienia", "messages.delete": "Usunięcie wiadomości",
}[a] || a);

export function StoreProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(LS_LANG) || "pl");
  const [content, setContent] = useState({}); // key -> {pl,en,kind}
  const [allCarsRaw, setCars] = useState([]);   // every car (sport + race) — the admin edits this list
  const [instructorsRaw, setInstructors] = useState([]);
  const [eventsRaw, setEvents] = useState([]);
  const [programsRaw, setPrograms] = useState([]);
  const [bannersRaw, setBanners] = useState([]);
  const [tracksRaw, setTracks] = useState([]);
  const [termsRaw, setTerms] = useState([]); // available booking dates
  const [mediaListRaw, setMediaList] = useState([]); // press / "Media o nas"
  const [productsRaw, setProducts] = useState([]); // offer: STAGE 1-3, S&S, SIM, Heels…
  const [icePackagesRaw, setIcePackages] = useState([]); // Laponia packages (price + days)
  const [iceWindowsRaw, setIceWindows] = useState([]);   // Laponia date windows
  const [tripPackagesRaw, setTripPackages] = useState([]);     // trip packages (Monaco…)
  const [tripAttractionsRaw, setTripAttractions] = useState([]); // "W programie" of a trip
  const [tripPointsRaw, setTripPoints] = useState([]);           // pins on the trip map (route)
  const [postsRaw, setPosts] = useState([]);                     // blog (public load: cards only, the article body comes with its page)
  const [ready, setReady] = useState(false);
  const setters = { posts: setPosts, cars: setCars, instructors: setInstructors, events: setEvents, programs: setPrograms, banners: setBanners, tracks: setTracks, media: setMediaList, terms: setTerms, products: setProducts, ice_packages: setIcePackages, ice_windows: setIceWindows, trip_packages: setTripPackages, trip_attractions: setTripAttractions, trip_points: setTripPoints };

  // admin
  const [token, setToken] = useState(() => localStorage.getItem(LS_TOKEN) || "");
  const [admin, setAdmin] = useState(null);
  const [cmsMode, setCmsMode] = useState(false);

  useEffect(() => { localStorage.setItem(LS_LANG, lang); document.documentElement.lang = lang; }, [lang]);

  // initial data load
  const load = useCallback(async () => {
    const [c, cr, ins, ev, pr, bn, tr, md, tm, pd, ip, iw, tp, ta, tpt, po] = await Promise.all([
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
      supabase.from("posts").select(POST_CARD).eq("visible", true).order("published_at", { ascending: false }),
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
    // an article opened meanwhile may already have brought its full row — keep the fuller one
    // …and once the panel's list is in (drafts, scheduled posts), a late public answer must not replace it
    setPosts((cur) => (adminRows.current ? cur : (po.data || []).map((r) => cur.find((x) => x.id === r.id && x.body_pl != null) || r)));
    setReady(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  // The public load above only brings visible rows. The panel needs the hidden ones as well — otherwise
  // a hidden product vanishes from its list while still holding its slug. Rows still being saved stay.
  const adminRows = useRef(false);
  const loadAdmin = useCallback(async (tok) => {
    const r = await adminCall(tok, "tables.all").catch(() => null);
    if (!r?.ok || !r.tables) return;
    adminRows.current = !!r.tables.posts;
    Object.entries(r.tables).forEach(([table, rows]) => setters[table]?.((list) => {
      const pending = list.filter((x) => x._pending);
      const keep = new Set(pending.map((x) => x.id));
      return [...rows.filter((x) => !keep.has(x.id)), ...pending].sort(bySort);
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // verify existing admin token
  useEffect(() => {
    if (!token) return;
    authVerify(token).then((r) => {
      if (r.ok) setAdmin(r.admin);
      else { setToken(""); localStorage.removeItem(LS_TOKEN); }
    });
  }, [token]);

  useEffect(() => { if (admin && ready) loadAdmin(token); /* eslint-disable-next-line */ }, [admin?.id, ready]);

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
    adminRows.current = false;
    setToken(""); setAdmin(null); setCmsMode(false); localStorage.removeItem(LS_TOKEN); load(); };

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
  const allCars = useVisible(allCarsRaw), instructors = useVisible(instructorsRaw), events = useVisible(eventsRaw), programs = useVisible(programsRaw),
    banners = useVisible(bannersRaw), tracks = useVisible(tracksRaw), terms = useVisible(termsRaw), mediaList = useVisible(mediaListRaw),
    products = useVisible(productsRaw), icePackages = useVisible(icePackagesRaw), iceWindows = useVisible(iceWindowsRaw),
    tripPackages = useVisible(tripPackagesRaw), tripAttractions = useVisible(tripAttractionsRaw), tripPoints = useVisible(tripPointsRaw);
  // the blog shows published posts, newest first (a future date = scheduled, an unchecked box = draft)
  const posts = useMemo(() => {
    const today = isoToday();
    return postsRaw.filter((p) => p.visible !== false && String(p.published_at || "") <= today)
      .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }, [postsRaw]);
  // the article page asks for the whole post (body included) once and keeps it here
  const loadPost = useCallback(async (slug) => {
    const { data } = await supabase.from("posts").select("*").eq("slug", slug).limit(1).then((r) => r, () => ({ data: null }));
    const row = data?.[0] || null;
    if (row) setPosts((list) => (list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id && !x._pending ? row : x)) : [...list, row]));
    return row;
  }, []);
  const cars = allCars.filter((c) => (c.category || "sport") === "sport");
  const raceCars = allCars.filter((c) => c.category === "race");

  // the panel edits the full lists (hidden rows included)
  const getters = { posts: postsRaw, cars: allCarsRaw, instructors: instructorsRaw, events: eventsRaw, programs: programsRaw, banners: bannersRaw, tracks: tracksRaw, media: mediaListRaw, terms: termsRaw, products: productsRaw, ice_packages: icePackagesRaw, ice_windows: iceWindowsRaw, trip_packages: tripPackagesRaw, trip_attractions: tripAttractionsRaw, trip_points: tripPointsRaw };

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
  const TABLE_LABEL = { posts: "Wpis na blogu", cars: "Samochód", instructors: "Instruktor", events: "Wydarzenie", programs: "Kafelek", banners: "Baner", tracks: "Tor", media: "Media o nas", terms: "Termin", products: "Produkt", ice_packages: "Laponia — pakiet", ice_windows: "Laponia — termin", trip_packages: "Wyprawa — pakiet", trip_attractions: "Wyprawa — atrakcja", trip_points: "Wyprawa — punkt" };
  const labelOf = (table, row) => `${TABLE_LABEL[table] || table}: ${row?.name || row?.title_pl || row?.label_pl || row?.label || row?.date || row?.id || "nowy"}`;
  const isTmp = (id) => typeof id === "string" && id.startsWith("tmp-");
  const created = useRef(new Map()); // tmp id → Promise<real id | null>
  const realId = async (id) => (isTmp(id) ? await (created.current.get(id) || Promise.resolve(null)) : id);
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
    content, cars, allCars, raceCars, instructors, events, programs, banners, tracks, terms, mediaList, products, icePackages, iceWindows, tripPackages, tripAttractions, tripPoints, posts, loadPost,
    raw, t, media, L, reload: async () => { await load(); if (admin) await loadAdmin(token); },
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
