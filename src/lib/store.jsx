import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { DEFAULTS } from "./defaults";
import { authLogin, authVerify, adminCall } from "./api";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const LS_LANG = "fra_lang";
const LS_TOKEN = "fra_admin_token";

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
  const logout = () => { setToken(""); setAdmin(null); setCmsMode(false); localStorage.removeItem(LS_TOKEN); };

  // optimistic content edit
  const setContentLocal = (key, pl, kind) =>
    setContent((c) => ({ ...c, [key]: { ...(c[key] || raw(key)), pl, kind: kind || raw(key).kind } }));

  const saveContent = async (key, pl, kind) => {
    setContentLocal(key, pl, kind);
    const r = await adminCall(token, "content.save", { items: [{ key, pl, kind: kind || raw(key).kind }] });
    if (r.ok && r.rows?.[0]) setContent((c) => ({ ...c, [key]: { pl: r.rows[0].pl, en: r.rows[0].en, kind: r.rows[0].kind } }));
    return r;
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

  const upsertEntity = async (table, row) => {
    const r = await adminCall(token, `${table}.upsert`, row);
    if (r.ok && r.row) {
      setters[table]((list) => {
        const exists = list.some((x) => x.id === r.row.id);
        const next = exists ? list.map((x) => (x.id === r.row.id ? r.row : x)) : [...list, r.row];
        return next.sort((a, b) => a.sort - b.sort);
      });
    }
    return r;
  };
  const deleteEntity = async (table, id) => {
    setters[table]((list) => list.filter((x) => x.id !== id)); // optimistic
    return adminCall(token, `${table}.delete`, { id });
  };
  const reorderEntity = async (table, ids) => {
    setters[table]((list) => ids.map((id, i) => ({ ...list.find((x) => x.id === id), sort: i + 1 })));
    return adminCall(token, `${table}.reorder`, { ids });
  };

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
    adminCall: (action, payload) => adminCall(token, action, payload),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
