import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { useRevealOnScroll } from "../lib/hooks";
import { trackLabel, fmtZl, isPoznan } from "../lib/flota";
import {
  TERM_TYPES, typeOf, typeName, isoOf, parseDate, monthCells,
  WEEKDAYS, monthLabel, longDate, weekdayName, priceFrom,
  specialEvents, coversDay, specialsInMonth,
} from "../lib/kalendarz";
import "../sections/kalendarz.css";
import { useSeo, breadcrumbs, SITE, clip } from "../lib/seo";

/* The calendar runs on the CMS "Terminy" table: every term is one training day.
   Picking one jumps straight into the booking flow (car → sessions → details → payment). */
export default function Kalendarz() {
  const { terms, cars, products, iceWindows, t, L, lang, cmsMode, isAdmin } = useStore();
  useSeo({
    title: "Kalendarz szkoleń i wydarzeń na torze",
    path: "/kalendarz",
    description: "Terminy szkoleń Sport Driving Experience na torach Łódź i Poznań, Heels on the Track, Ice Driving w Laponii i wypraw Fastline. Wybierz datę i zarezerwuj miejsce.",
    jsonld: [
      ...terms.filter((x) => x.date >= new Date().toISOString().slice(0, 10)).slice(0, 12).map((x) => ({ "@type": "Event", name: x.title_pl || "Sport Driving Experience", startDate: x.date, eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: { "@type": "Place", name: x.location_pl, address: x.address || x.location_pl }, organizer: { "@id": `${SITE}/#organization` }, url: `${SITE}/kalendarz`, image: `${SITE}/og.jpg`, description: `${x.title_pl || "Sport Driving Experience"} — ${x.location_pl}, ${x.time || ""}`.trim() })),
      breadcrumbs([{ name: "Kalendarz", path: "/kalendarz" }]),
    ],
  });
  const nav = useNavigate();
  const editing = cmsMode && isAdmin;

  // Laponia seasons + trips (wyprawy) — shown on the board as coloured multi-day bands
  const specials = useMemo(() => specialEvents(products, iceWindows, lang), [products, iceWindows, lang]);

  const today = useMemo(() => isoOf(new Date()), []);
  const entries = useMemo(
    () => terms.filter((x) => x.date).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [terms],
  );
  const [typeFilter, setTypeFilter] = useState(null);
  const shown = useMemo(
    () => (typeFilter ? entries.filter((e) => (e.type || "sport") === typeFilter) : entries),
    [entries, typeFilter],
  );
  const upcoming = useMemo(() => shown.filter((e) => e.date >= today), [shown, today]);
  const byDate = useMemo(() => {
    const m = {};
    shown.forEach((e) => { (m[e.date] ||= []).push(e); });
    return m;
  }, [shown]);

  // month cursor — starts on the month of the first upcoming term (once data lands)
  const [cur, setCur] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [dir, setDir] = useState(1);
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current || !upcoming.length) return;
    const d = parseDate(upcoming[0].date);
    if (d) setCur({ y: d.getFullYear(), m: d.getMonth() });
  }, [upcoming.length]); // eslint-disable-line

  const step = (d) => {
    moved.current = true;
    setDir(d);
    setCur(({ y, m }) => {
      const nd = new Date(y, m + d, 1);
      return { y: nd.getFullYear(), m: nd.getMonth() };
    });
  };
  const jumpToNext = () => {
    const d = parseDate(upcoming[0]?.date);
    if (!d) return;
    moved.current = true;
    setDir(1);
    setCur({ y: d.getFullYear(), m: d.getMonth() });
    setSelId(upcoming[0].id);
  };

  const [selId, setSelId] = useState(null);
  const sel = shown.find((e) => e.id === selId) || upcoming[0] || shown[0] || null;

  // mobile: tapping a day opens a bottom sheet instead of the side rail
  const [sheet, setSheet] = useState(null);
  const isMobile = useIsMobile(900);
  const pick = (e, iso) => {
    if (isMobile) { setSheet(iso || e?.date); return; }
    if (e) setSelId(e.id);
  };
  useEffect(() => { document.body.style.overflow = sheet ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [sheet]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  useRevealOnScroll([shown.length, cur.y, cur.m]);

  const cells = useMemo(() => monthCells(cur.y, cur.m), [cur]);
  const monthSpecials = useMemo(() => specialsInMonth(specials, cur.y, cur.m), [specials, cur]);
  const monthHas = cells.some((c) => !c.out && (byDate[isoOf(c.date)]?.length)) || monthSpecials.length > 0;
  const openSpecial = (s) => { window.scrollTo({ top: 0 }); nav(`/produkty/${s.slug}`); };
  const tracksCount = new Set(upcoming.map((e) => e.track)).size;

  const book = (e) => { window.scrollTo({ top: 0 }); nav(`/rezerwacja?term=${e.id}`); };

  return (
    <div className={editing ? "cms-on kal" : "kal"}>
      <ScrollProgress />
      <Nav />
      <main>
        {/* ============ HEADER ============ */}
        <section className="kal-head">
          <div className="kal-head__flag" />
          <div className="speedfx">{[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ top: `${18 + i * 22}%`, left: "-30%", width: "50%", animationDelay: `${i * 0.9}s` }} />
          ))}</div>
          <div className="container kal-head__inner">
            <div className="kal-head__text">
              <EText id="kal.eyebrow" as="span" className="eyebrow reveal-up" />
              <EText id="kal.title" as="h1" className="h-display kal-head__title reveal-up rv-d1" />
              <EText id="kal.sub" as="p" className="lead kal-head__sub reveal-up rv-d2" multiline />
            </div>
            <div className="kal-stats reveal-up rv-d3">
              <div className="kal-stat">
                <span className="kal-stat__v">{upcoming.length}</span>
                <span className="kal-stat__l">{t("kal.statTerms")}</span>
              </div>
              <div className="kal-stat">
                <span className="kal-stat__v kal-stat__v--sm">{upcoming[0] ? longDate(upcoming[0].date, lang) : "—"}</span>
                <span className="kal-stat__l">{t("kal.statNext")}</span>
              </div>
              <div className="kal-stat">
                <span className="kal-stat__v">{tracksCount}</span>
                <span className="kal-stat__l">{t("kal.statTracks")}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============ BOARD ============ */}
        <section className="section section--paper kal-wrap" id="kalendarz">
          <div className="tex" />
          <div className="container kal-grid">
            <div className="kal-main">
              {/* toolbar: month switch + type legend/filter */}
              <div className="kal-bar reveal-up">
                <div className="kal-bar__month">
                  <button className="navbtn" onClick={() => step(-1)} aria-label={t("kal.prev")}>‹</button>
                  <span className="kal-bar__label">{monthLabel(cur.y, cur.m, lang)}</span>
                  <button className="navbtn navbtn--red" onClick={() => step(1)} aria-label={t("kal.next")}>›</button>
                </div>
                <div className="kal-legend">
                  {TERM_TYPES.map((ty) => (
                    <button
                      key={ty.slug}
                      className={`kal-chip ${typeFilter === ty.slug ? "on" : ""}`}
                      style={{ ["--tc"]: ty.color }}
                      onClick={() => setTypeFilter((f) => (f === ty.slug ? null : ty.slug))}
                    >
                      <i /> {lang === "en" ? ty.short_en : ty.short_pl}
                    </button>
                  ))}
                  {upcoming.length > 0 && (
                    <button className="kal-bar__next" onClick={jumpToNext}>{t("kal.jumpNext")} ›</button>
                  )}
                </div>
              </div>

              {/* special events this month — Laponia seasons & trips (multi-day) */}
              {monthSpecials.length > 0 && (
                <div className="kal-specials reveal-up">
                  {monthSpecials.map((s) => (
                    <button key={s.id} className={`kal-special kal-special--${s.kind} ${s.past ? "is-past" : ""}`}
                      style={{ ["--sc"]: s.color }} onClick={() => openSpecial(s)}>
                      <span className="kal-special__mark">{s.kind === "ice" ? "❄" : "✦"}</span>
                      <span className="kal-special__body">
                        <span className="kal-special__kind">{s.kind === "ice" ? t("kal.season") : t("kal.trip")}</span>
                        <span className="kal-special__ttl">{s.title}</span>
                        <span className="kal-special__dates">{s.subtitle || `${longDate(s.from, lang)} – ${longDate(s.to, lang)}`}</span>
                      </span>
                      <span className="kal-special__go">{s.past ? t("kal.recap") : t("kal.see")} ›</span>
                    </button>
                  ))}
                </div>
              )}

              {/* month board */}
              <div className="kal-board reveal-up rv-d1">
                <div className="kal-board__wd">
                  {WEEKDAYS[lang === "en" ? "en" : "pl"].map((w) => <span key={w}>{w}</span>)}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${cur.y}-${cur.m}`}
                    className="kal-board__grid"
                    initial={{ opacity: 0, x: dir * 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: dir * -40 }}
                    transition={{ duration: 0.32, ease: [0.16, 0.8, 0.3, 1] }}
                  >
                    {cells.map((c, i) => {
                      const iso = isoOf(c.date);
                      const list = byDate[iso] || [];
                      const past = iso < today;
                      const cov = c.out ? [] : coversDay(monthSpecials, iso);   // trip/season bands
                      const band = cov[0];
                      return (
                        <div
                          key={iso}
                          className={`kal-cell ${c.out ? "is-out" : ""} ${past ? "is-past" : ""} ${list.length ? "has" : ""} ${band ? "in-band" : ""} ${iso === today ? "is-today" : ""} ${sel && list.some((e) => e.id === sel.id) ? "is-sel" : ""}`}
                          style={{ ["--i"]: i % 7 + Math.floor(i / 7), ...(band ? { ["--sc"]: band.color } : {}) }}
                          onClick={() => (list.length ? pick(list[0], iso) : band && openSpecial(band))}
                        >
                          {band && (
                            <span className={`kal-cell__band ${band.start ? "is-start" : ""} ${band.end ? "is-end" : ""}`}
                              title={band.title}>
                              {band.start && <b>{band.kind === "ice" ? "❄" : "✦"} {band.title}</b>}
                            </span>
                          )}
                          <span className="kal-cell__n">{c.date.getDate()}</span>
                          {iso === today && <span className="kal-cell__today">{t("kal.today")}</span>}

                          <div className="kal-cell__events">
                            {list.map((e) => {
                              const ty = typeOf(e);
                              return (
                                <button
                                  key={e.id}
                                  className={`kal-pill ${sel?.id === e.id ? "on" : ""}`}
                                  style={{ ["--tc"]: ty.color }}
                                  onClick={(ev) => { ev.stopPropagation(); pick(e, iso); }}
                                >
                                  <span className="kal-pill__time">{e.time}</span>
                                  {/* phones: just the start hour, so nothing gets cut */}
                                  <span className="kal-pill__start">{String(e.time || "").split(/\s*[–-]\s*/)[0]}</span>
                                  <span className="kal-pill__ttl">{L(e, "title") || typeName(e, lang)}</span>
                                  {/* phones are too narrow for the full name — show the type instead */}
                                  <span className="kal-pill__short">{lang === "en" ? ty.short_en : ty.short_pl}</span>
                                  <span className="kal-pill__loc">{e.location_pl ? L(e, "location") : trackLabel(e.track, lang)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>

                {!monthHas && (
                  <div className="kal-board__empty">
                    {t("kal.emptyMonth")}
                    {upcoming.length > 0 && <button className="btn btn--ghost" onClick={jumpToNext}>{t("kal.jumpNext")}</button>}
                  </div>
                )}
              </div>
            </div>

            {/* side rail — the selected training (desktop) */}
            <aside className="kal-rail">
              <AnimatePresence mode="wait">
                {sel ? (
                  <motion.div
                    key={sel.id}
                    initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="kal-card"
                    style={{ ["--tc"]: typeOf(sel).color }}
                  >
                    <TermCard term={sel} cars={cars} lang={lang} t={t} L={L} onBook={() => book(sel)} />
                  </motion.div>
                ) : (
                  <div className="kal-card kal-card--empty" key="empty">{t("kal.emptyAll")}</div>
                )}
              </AnimatePresence>
            </aside>
          </div>
        </section>

        {/* ============ UPCOMING LIST ============ */}
        <section className="section section--dark kal-list">
          <div className="speedfx">{[0, 1, 2].map((i) => (
            <span key={i} style={{ top: `${26 + i * 24}%`, left: "-30%", width: "44%", animationDelay: `${i * 1.2}s` }} />
          ))}</div>
          <div className="container">
            <div className="kal-list__head">
              <EText id="kal.upEyebrow" as="span" className="eyebrow reveal-up" />
              <EText id="kal.upTitle" as="h2" className="h-section reveal-up rv-d1" />
            </div>

            {!upcoming.length ? (
              <div className="kal-list__empty reveal-up">{t("kal.emptyAll")}</div>
            ) : (
              <div className="kal-rows">
                {upcoming.map((e, i) => {
                  const ty = typeOf(e);
                  const d = parseDate(e.date);
                  const from = priceFrom(cars, e.track);
                  return (
                    <div key={e.id} className={`kal-row reveal-up rv-d${(i % 5) + 1}`} style={{ ["--tc"]: ty.color }}>
                      <div className="kal-row__date">
                        <span className="kal-row__day">{d?.getDate()}</span>
                        <span className="kal-row__mo">
                          {d?.toLocaleDateString(lang === "en" ? "en-GB" : "pl-PL", { month: "short" }).replace(".", "").toUpperCase()}
                        </span>
                      </div>
                      <div className="kal-row__main">
                        <span className="kal-row__badge">{lang === "en" ? ty.short_en : ty.short_pl}</span>
                        <span className="kal-row__ttl">{L(e, "title") || typeName(e, lang)}</span>
                        <span className="kal-row__meta">
                          {weekdayName(e.date, lang)} · {e.time} · {e.location_pl ? L(e, "location") : trackLabel(e.track, lang)}
                          {isPoznan(e.track) && <b className="kal-row__pz">POZNAŃ</b>}
                          {e.address && <small className="kal-row__addr">{e.address}</small>}
                        </span>
                      </div>
                      <div className="kal-row__price">
                        {from > 0 && <><span>{t("kal.from")}</span><b>{fmtZl(from)}</b></>}
                      </div>
                      <button className="btn btn--red kal-row__btn" onClick={() => book(e)}>
                        {t("kal.book")} <span className="btn__arrow">›</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ============ CTA ============ */}
        <section className="section section--paper kal-cta">
          <div className="tex" />
          <div className="container kal-cta__inner">
            <div>
              <EText id="kal.ctaEyebrow" as="span" className="eyebrow reveal-up" />
              <EText id="kal.ctaTitle" as="h2" className="h-display kal-cta__title reveal-up rv-d1" />
              <EText id="kal.ctaSub" as="p" className="lead reveal-up rv-d2" multiline />
            </div>
            <div className="kal-cta__btns reveal-up rv-d3">
              <Link to="/rezerwacja" className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}>
                {t("kal.ctaBook")} <span className="btn__arrow">›</span>
              </Link>
              <Link to="/flota" className="btn btn--ghost" onClick={() => window.scrollTo({ top: 0 })}>{t("kal.ctaFleet")}</Link>
            </div>
          </div>
        </section>
      </main>

      {/* ============ MOBILE SHEET ============ */}
      <AnimatePresence>
        {sheet && (
          <motion.div className="kal-sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSheet(null)}>
            <motion.div className="kal-sheet__box" onClick={(e) => e.stopPropagation()}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}>
              <div className="kal-sheet__grab" />
              <div className="kal-sheet__head">
                <span>{longDate(sheet, lang)}</span>
                <button className="kal-sheet__x" onClick={() => setSheet(null)} aria-label="close">×</button>
              </div>
              <div className="kal-sheet__body">
                {(byDate[sheet] || []).map((e) => (
                  <div key={e.id} className="kal-card kal-card--sheet" style={{ ["--tc"]: typeOf(e).color }}>
                    <TermCard term={e} cars={cars} lang={lang} t={t} L={L} onBook={() => book(e)} />
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
      <CmsBar />
    </div>
  );
}

/* one training: everything the user needs before jumping into the booking flow */
function TermCard({ term, cars, lang, t, L, onBook }) {
  const ty = typeOf(term);
  const from = priceFrom(cars, term.track);
  const desc = L(term, "description");
  return (
    <>
      <div className="kal-card__media">
        {term.photo
          ? <img src={term.photo} alt="" loading="lazy" />
          : <span className="kal-card__flag" />}
        <span className="kal-card__badge">{lang === "en" ? ty.short_en : ty.short_pl}</span>
      </div>

      <div className="kal-card__body">
        <span className="kal-card__wd">{weekdayName(term.date, lang)}</span>
        <h3 className="kal-card__ttl">{L(term, "title") || typeName(term, lang)}</h3>
        <div className="kal-card__date">{longDate(term.date, lang)}</div>

        <dl className="kal-card__facts">
          <div><dt>{t("kal.fTime")}</dt><dd>{term.time || "—"}</dd></div>
          <div><dt>{t("kal.fTrack")}</dt><dd>{term.location_pl ? L(term, "location") : trackLabel(term.track, lang)}{term.address && <small>{term.address}</small>}</dd></div>
          <div><dt>{t("kal.fSpots")}</dt><dd>{term.capacity || "—"}</dd></div>
          <div><dt>{t("kal.fPrice")}</dt><dd>{from > 0 ? `${t("kal.from")} ${fmtZl(from)}` : "—"}</dd></div>
        </dl>

        {desc && <p className="kal-card__desc">{desc}</p>}

        <button className="btn btn--red kal-card__btn" onClick={onBook}>
          {t("kal.book")} <span className="btn__arrow">›</span>
        </button>
        <p className="kal-card__hint">{t("kal.bookHint")}</p>
      </div>
    </>
  );
}

function useIsMobile(bp = 900) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth <= bp);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [bp]);
  return m;
}
