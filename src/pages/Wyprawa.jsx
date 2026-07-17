import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { useRevealOnScroll } from "../lib/hooks";
import { useLightbox } from "../components/Lightbox";
import { fmtEur } from "../lib/ice";
import "../sections/wyprawa.css";

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
// "Sobota, 06.06.2026 — Przylot" → { day, what }
const splitDay = (l) => {
  const i = l.indexOf("—");
  return i < 0 ? { day: l, what: "" } : { day: l.slice(0, i).trim(), what: l.slice(i + 1).trim() };
};

/* Google embed for the trip route. With two or more stops we ask for directions, which drops a real
   pin on every place and links them with the route; a single stop just centres the map on it. */
const mapEmbed = (points, fallback) => {
  const q = (s) => encodeURIComponent(String(s || "").trim());
  if (points.length >= 2) {
    const to = points.slice(1).map((p) => q(p.place)).join("+to:");
    return `https://maps.google.com/maps?saddr=${q(points[0].place)}&daddr=${to}&output=embed`;
  }
  return `https://maps.google.com/maps?q=${q(points[0]?.place || fallback)}&z=8&output=embed`;
};

/* A "wyprawa" (trip) — Monaco and friends. Luxury layout; the product's accent colour drives
   the whole page (--pc). Two modes:
     upcoming → dates + packages, bookable
     past     → a recap band on top, packages hidden (they stay in the CMS for the next edition) */
export default function Wyprawa({ p }) {
  const { t, L, lang, tripPackages, tripAttractions, tripPoints, cmsMode, isAdmin } = useStore();
  const nav = useNavigate();
  const openLightbox = useLightbox();
  const editing = cmsMode && isAdmin;

  const past = p.trip_status === "past";
  const packages = tripPackages.filter((x) => x.product_slug === p.slug);
  const attractions = tripAttractions.filter((x) => x.product_slug === p.slug);
  const points = tripPoints.filter((x) => x.product_slug === p.slug);   // pins on the map (route)
  const schedule = lines(L(p, "schedule")).map(splitDay);
  const intro = lines(L(p, "intro"));
  const recap = lines(L(p, "recap"));
  const recapPhotos = Array.isArray(p.recap_photos) ? p.recap_photos : [];
  const gallery = Array.isArray(p.photos) ? p.photos : [];

  const [open, setOpen] = useState(null);   // expanded attraction
  useRevealOnScroll([p.id, attractions.length, packages.length, points.length]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [p.id]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  const buy = (pkg) => { window.scrollTo({ top: 0 }); nav(`/zakup-wyprawa?pakiet=${pkg.id}`); };
  const style = { ["--pc"]: p.color || "#c9a227" };
  const mapSrc = mapEmbed(points, p.map_query || L(p, "title"));

  return (
    <div className={`wy ${editing ? "cms-on" : ""} ${past ? "wy--past" : ""}`} style={style}>
      <ScrollProgress />
      <Nav />
      <main>
        {/* ---------------- HERO ---------------- */}
        <section className="wy-hero">
          {p.video
            ? <video className="wy-hero__vid" src={p.video} autoPlay loop muted playsInline poster={p.photo} />
            : <img className="wy-hero__vid" src={p.photo} alt="" />}
          <div className="wy-hero__scrim" />
          <div className="wy-hero__glow" />

          <div className="container wy-hero__inner">
            <span className="wy-hero__eyebrow">{L(p, "tag")}</span>
            <h1 className="wy-hero__title">{L(p, "title")}</h1>
            <div className="wy-hero__rule"><span /></div>
            <div className="wy-hero__dates">{L(p, "trip_dates")}</div>
            <p className="wy-hero__sub">{L(p, "excerpt")}</p>

            <div className="wy-hero__btns">
              {past ? (
                <>
                  <span className="wy-badge">{t("wy.pastBadge")}</span>
                  <a href="#wy-relacja" className="btn wy-btn">{t("wy.seeRecap")} <span className="btn__arrow">›</span></a>
                </>
              ) : (
                <>
                  <a href="#wy-pakiety" className="btn wy-btn">{t("wy.buy")} <span className="btn__arrow">›</span></a>
                  <a href="#wy-program" className="btn wy-btn--ghost">{t("wy.seeProgram")}</a>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ---------------- RECAP (only for a finished trip) ---------------- */}
        {past && (
          <section className="wy-sec wy-sec--recap" id="wy-relacja">
            <div className="container wy-recap">
              <div className="wy-recap__text">
                <span className="wy-kicker">{t("wy.recapEyebrow")}</span>
                <h2 className="wy-h2">{t("wy.recapTitle")}</h2>
                {recap.map((r, i) => <p key={i} className={`wy-p reveal-up rv-d${i + 1}`}>{r}</p>)}
                <Link to="/kontakt" className="btn wy-btn" onClick={() => window.scrollTo({ top: 0 })}>
                  {t("wy.recapCta")} <span className="btn__arrow">›</span>
                </Link>
              </div>
              {/* only the real photos from the trip — until the admin adds them, just the placeholder */}
              <div className={`wy-recap__grid ${recapPhotos.length ? "" : "is-empty"}`}>
                {recapPhotos.map((src, i) => (
                  <figure key={i} className={`wy-recap__ph zoomable reveal-scale rv-d${(i % 3) + 1}`}
                    onClick={() => openLightbox(recapPhotos, i)}>
                    <img src={src} alt="" loading="lazy" />
                  </figure>
                ))}
                {!recapPhotos.length && <span className="wy-recap__soon">{t("wy.photosSoon")}</span>}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- INTRO ---------------- */}
        <section className="wy-sec wy-intro">
          <div className="container wy-intro__grid">
            <div className="wy-intro__side reveal-left">
              <span className="wy-kicker">{t("prod.aboutLabel")}</span>
              <span className="wy-bar" />
              <span className="wy-intro__code">{p.code}</span>
            </div>
            <div>
              {intro.map((par, i) => (
                <p key={i} className={`wy-p wy-p--lead reveal-up rv-d${(i % 3) + 1}`}>{par}</p>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- ATTRACTIONS ---------------- */}
        {!!attractions.length && (
          <section className="wy-sec wy-sec--dark wy-prog" id="wy-program">
            <div className="container">
              <div className="wy-prog__head">
                <span className="wy-kicker">{t("wy.progEyebrow")}</span>
                <h2 className="wy-h2 wy-h2--light">{t("wy.progTitle")}</h2>
              </div>
              <div className="wy-prog__grid">
                {attractions.map((a, i) => (
                  <article key={a.id} className={`wy-att reveal-up rv-d${(i % 3) + 1}`} onClick={() => setOpen(a)}>
                    <div className="wy-att__media">
                      {a.photo && <img src={a.photo} alt="" loading="lazy" />}
                      <span className="wy-att__wash" />
                      <span className="wy-att__n">{String(i + 1).padStart(2, "0")}</span>
                      {a.optional && <span className="wy-att__opt">{t("wy.optional")}</span>}
                    </div>
                    <div className="wy-att__body">
                      <h3 className="wy-att__t">{L(a, "title")}</h3>
                      <p className="wy-att__s">{L(a, "short")}</p>
                      <span className="wy-att__go">{t("wy.see")} <i>›</i></span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- MAP + SCHEDULE ---------------- */}
        <section className="wy-sec wy-map">
          <div className="container wy-map__grid">
            <div className="wy-map__box reveal-left">
              <span className="wy-kicker">{t("wy.mapEyebrow")}</span>
              <h2 className="wy-h2">{t("wy.mapTitle")}</h2>
              <div className="wy-map__frame">
                {/* branded Google map — tinted with the trip's accent colour; every stop from the CMS
                    becomes a pin (two or more stops → Google draws the route between them) */}
                <iframe
                  title={`Mapa — ${L(p, "title")}`}
                  src={mapSrc}
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <span className="wy-map__tint" />
                <span className="wy-map__pin">
                  <i>{t("wy.route")}</i>
                  <b>{p.map_query || L(p, "title")}</b>
                </span>
              </div>

              {!!points.length && (
                <ol className="wy-pins">
                  {points.map((pt, i) => (
                    <li key={pt.id} className={`wy-pin reveal-up rv-d${(i % 4) + 1}`}>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pt.place)}`}
                        target="_blank" rel="noreferrer">
                        <span className="wy-pin__n">{i + 1}</span>
                        <span className="wy-pin__b">
                          <b>{L(pt, "title") || pt.place}</b>
                          {L(pt, "note") && <i>{L(pt, "note")}</i>}
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {!!schedule.length && (
              <div className="wy-sched">
                <span className="wy-kicker">{t("wy.schedEyebrow")}</span>
                <h2 className="wy-h2">{t("wy.schedTitle")}</h2>
                <ol className="wy-sched__list">
                  {schedule.map((d, i) => (
                    <li key={i} className={`reveal-up rv-d${(i % 5) + 1}`}>
                      <span className="wy-sched__n">{String(i + 1).padStart(2, "0")}</span>
                      <span className="wy-sched__d">{d.day}</span>
                      <span className="wy-sched__w">{d.what}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </section>

        {/* ---------------- PACKAGES (upcoming only) ---------------- */}
        {!past && !!packages.length && (
          <section className="wy-sec wy-sec--dark wy-pkgs" id="wy-pakiety">
            <div className="container">
              <div className="wy-pkgs__head">
                <span className="wy-kicker">{L(p, "trip_dates")}</span>
                <h2 className="wy-h2 wy-h2--light">{t("wy.pkgTitle")}</h2>
              </div>
              <div className="wy-pkgs__grid">
                {packages.map((pk, i) => (
                  <article key={pk.id} className={`wy-pkg reveal-up rv-d${(i % 3) + 1}`}>
                    <span className="wy-pkg__ribbon" />
                    <h3 className="wy-pkg__name">{L(pk, "name")}</h3>
                    <div className="wy-pkg__price">{fmtEur(pk.price, pk.currency)}<i>{t("d2r.net")}</i></div>
                    <ul className="wy-pkg__list">
                      {lines(L(pk, "includes")).map((l, j) => <li key={j}><span>✓</span>{l}</li>)}
                    </ul>
                    {lines(L(pk, "note")).length > 0 && (
                      <div className="wy-pkg__note">
                        {lines(L(pk, "note")).map((n, j) => <span key={j}>{n}</span>)}
                      </div>
                    )}
                    <button className="btn wy-btn wy-pkg__btn" onClick={() => buy(pk)}>
                      {t("wy.buy")} <span className="btn__arrow">›</span>
                    </button>
                  </article>
                ))}
              </div>
              {L(p, "price_note") && <p className="wy-note">{L(p, "price_note")}</p>}
            </div>
          </section>
        )}

        {/* ---------------- GALLERY ---------------- */}
        {!!gallery.length && (
          <section className="wy-gallery">
            {gallery.map((src, i) => (
              <figure key={i} className={`wy-gal zoomable reveal-scale rv-d${(i % 3) + 1}`} onClick={() => openLightbox(gallery, i)}>
                <img src={src} alt="" loading="lazy" />
                <span className="wy-gal__zoom">⤢</span>
              </figure>
            ))}
          </section>
        )}

        <div className="container wy-back">
          <Link to="/produkty" onClick={() => window.scrollTo({ top: 0 })}>‹ {t("prod.back")}</Link>
        </div>
      </main>

      {/* attraction detail sheet */}
      <AnimatePresence>
        {open && (
          <motion.div className="wy-sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}>
            <motion.div className="wy-sheet__box" onClick={(e) => e.stopPropagation()}
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}>
              <button className="wy-sheet__x" onClick={() => setOpen(null)} aria-label="close">×</button>
              {open.photo && <img className="wy-sheet__img" src={open.photo} alt="" />}
              <div className="wy-sheet__body">
                {open.optional && <span className="wy-att__opt wy-att__opt--sheet">{t("wy.optional")}</span>}
                <h3 className="wy-sheet__t">{L(open, "title")}</h3>
                <p className="wy-sheet__p">{L(open, "body")}</p>
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
