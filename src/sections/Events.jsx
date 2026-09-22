import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import { EText } from "../components/Editable";
import { useReveal } from "../lib/hooks";
import { trackLabel, fmtZl } from "../lib/flota";
import { typeOf, isoOf, parseDate, longDate, weekdayName, priceFrom, specialEvents } from "../lib/kalendarz";

/* "NADCHODZĄCE WYDARZENIA" — fully synced with the calendar: upcoming terms (CMS „Terminy”)
   plus multi-day specials (Laponia season, trips). Nothing here is edited separately. */
const FALLBACK = { sport: "/assets/cars/toyota-gr-supra_1.webp", heels: "/assets/klocki/heels.webp", ice: "/assets/klocki/laponia.webp" };
const ICON = {
  sport: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="1" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  heels: <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 18c4-1 7-4 9-9l2-5 3 1-2 6c-1 3 0 4 2 5l4 2v2H3z" /></svg>,
  ice: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" /></svg>,
  trip: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 21V4h12l-2 4 2 4H4" /></svg>,
};

export default function Events() {
  const { terms, cars, products, iceWindows, t, L, lang } = useStore();
  const [sel, setSel] = useState(0);
  const [headRef, headIn] = useReveal();

  const items = useMemo(() => {
    const today = isoOf(new Date());
    const list = terms.filter((x) => x.date && x.date >= today).map((x) => {
      const ty = typeOf(x);
      return {
        id: x.id, kind: "term", type: ty.slug, color: ty.color, sort: x.date,
        title: L(x, "title") || ty[lang === "en" ? "en" : "pl"], date: x.date, time: x.time,
        place: x.location_pl ? L(x, "location") : trackLabel(x.track, lang), address: x.address,
        photo: x.photo || FALLBACK[ty.slug] || FALLBACK.sport, desc: L(x, "description"), spots: x.capacity,
        from: priceFrom(cars, x.track), to: `/rezerwacja?term=${x.id}`, badge: lang === "en" ? ty.short_en : ty.short_pl,
      };
    });
    specialEvents(products, iceWindows, lang).filter((s) => s.to >= today && !s.past).forEach((s) => {
      const p = products.find((x) => x.slug === s.slug);
      list.push({
        id: s.id, kind: s.kind, type: s.kind, color: s.color, sort: s.from,
        title: s.title, date: s.from, dateTo: s.to, time: s.kind === "ice" ? "09:00–16:00" : "",
        place: s.kind === "ice" ? "KUUSAMO · FINLANDIA" : (p?.place_pl ? L(p, "place") : s.subtitle), address: "",
        photo: p?.photo || FALLBACK.ice, desc: p ? L(p, "excerpt") : "", spots: null, from: 0,
        to: `/produkty/${s.slug}`, badge: s.kind === "ice" ? "ICE" : t("kal.trip"),
      });
    });
    return list.sort((a, b) => a.sort.localeCompare(b.sort)).slice(0, 8);
  }, [terms, products, iceWindows, cars, lang, L, t]);

  const ev = items[Math.min(sel, Math.max(0, items.length - 1))];

  return (
    <section className="section section--paper events" id="wydarzenia">
      <div className="tex" />
      <div className="container">
        <div className={`events__head reveal ${headIn ? "in" : ""}`} ref={headRef}>
          <EText id="events.eyebrow" as="span" className="eyebrow" />
          <EText id="events.title" as="h2" className="h-section" />
          <EText id="events.sub" as="p" className="lead events__sub" />
        </div>

        {!items.length ? (
          <div className="events__empty"><EText id="events.empty" /></div>
        ) : (
          <div className="events__grid">
            <div className="events__list">
              {items.map((e, i) => {
                const d = parseDate(e.date);
                return (
                  <button key={e.id} className={`evrow ${i === sel ? "sel" : ""}`} style={{ ["--tc"]: e.color }} onClick={() => setSel(i)}>
                    <span className="evrow__date">
                      <b>{d?.getDate()}</b>
                      <i>{d?.toLocaleDateString(lang === "en" ? "en-GB" : "pl-PL", { month: "short" }).replace(".", "")}</i>
                      {e.dateTo && <em>→ {parseDate(e.dateTo)?.getDate()}.{String((parseDate(e.dateTo)?.getMonth() ?? 0) + 1).padStart(2, "0")}</em>}
                    </span>
                    <span className="evrow__icon">{ICON[e.type] || ICON.sport}</span>
                    <span className="evrow__main">
                      <span className="evrow__badge">{e.badge}</span>
                      <span className="evrow__title">{e.title}</span>
                      <span className="evrow__meta">{e.time && <>{e.time} · </>}{e.place}</span>
                    </span>
                    <span className="evrow__go">›</span>
                  </button>
                );
              })}
            </div>

            <div className="events__panel" style={{ ["--tc"]: ev.color }}>
              <AnimatePresence mode="wait">
                <motion.div key={ev.id} className="events__card"
                  initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.32 }}>
                  <div className="events__media">
                    <img src={ev.photo} alt="" loading="lazy" />
                    <span className="events__badge">{ev.badge}</span>
                    <span className="events__day">
                      <b>{parseDate(ev.date)?.getDate()}</b>
                      <i>{parseDate(ev.date)?.toLocaleDateString(lang === "en" ? "en-GB" : "pl-PL", { month: "long" })}</i>
                    </span>
                  </div>
                  <div className="events__body">
                    <span className="events__wd">{ev.dateTo ? `${longDate(ev.date, lang)} – ${longDate(ev.dateTo, lang)}` : weekdayName(ev.date, lang)}</span>
                    <h3 className="events__ptitle">{ev.title}</h3>
                    <dl className="events__facts">
                      {ev.time && <div><dt>{t("kal.fTime")}</dt><dd>{ev.time}</dd></div>}
                      <div><dt>{t("kal.fTrack")}</dt><dd>{ev.place}{ev.address && <small>{ev.address}</small>}</dd></div>
                      {ev.spots && <div><dt>{t("events.spots")}</dt><dd>{ev.spots}</dd></div>}
                      {ev.from > 0 && <div><dt>{t("kal.fPrice")}</dt><dd>{t("events.from")} {fmtZl(ev.from)} <small>netto</small></dd></div>}
                    </dl>
                    {ev.desc && <p className="events__pdesc">{ev.desc}</p>}
                    <div className="events__pactions">
                      <Link to={ev.to} className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}>
                        {ev.kind === "term" ? <EText id="events.signup" /> : t("kal.see")} <span className="btn__arrow">›</span>
                      </Link>
                      <Link to="/kalendarz" className="btn btn--ghost" onClick={() => window.scrollTo({ top: 0 })}><EText id="events.cta" /></Link>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
