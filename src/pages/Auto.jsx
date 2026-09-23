import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { useRevealOnScroll } from "../lib/hooks";
import { useLightbox } from "../components/Lightbox";
import { carPrice, fmtZl } from "../lib/flota";
import { tint, isLight } from "../lib/util";
import "../sections/auto.css";

/* /flota/:slug — one car. Fully CMS-driven (panel → Samochody): sport cars link to the configurator
   and the voucher, race cars (category "race") are read-only — no prices, contact instead. */
export default function Auto() {
  const { slug } = useParams();
  const { allCars, cars, raceCars, ready, t, L, lang, cmsMode, isAdmin } = useStore();
  const openLightbox = useLightbox();
  const editing = cmsMode && isAdmin;
  const car = allCars.find((c) => c.slug === slug);
  useRevealOnScroll([car?.id, allCars.length]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);

  if (!car) {
    if (ready && allCars.length) return <Navigate to="/flota" replace />;
    return <div className="au"><Nav /><main style={{ minHeight: "60vh" }} /><Footer /></div>;
  }
  const race = car.category === "race";
  const photos = Array.isArray(car.photos) ? car.photos : [];
  const hero = car.png || photos[0];
  const from = race ? 0 : carPrice(car, 3, "lodz");
  const specs = [
    ["fleet.l_engine", car.engine], ["fleet.l_power", car.power], ["fleet.l_torque", car.torque], ["fleet.l_speed", car.top_speed],
    ["auto.l_accel", car.accel], ["auto.l_weight", car.weight], ["auto.l_drive", car.drive],
  ].filter(([, v]) => v);
  const others = (race ? raceCars : cars).filter((c) => c.id !== car.id).slice(0, 6);
  const dark = !isLight(car.color);

  return (
    <div className={editing ? "cms-on au" : "au"} style={{ ["--cc"]: car.color || "#34373d" }}>
      <ScrollProgress />
      <Nav />
      <main>
        {/* ---- hero: the car on its colour stage with the giant badge ---- */}
        <section className="au-hero" style={{ background: `linear-gradient(180deg, ${tint(car.color, 0.55)}, ${car.color})` }}>
          <div className="au-hero__badge" style={{ color: dark ? "rgba(0,0,0,.35)" : "rgba(0,0,0,.14)" }}>{car.badge}</div>
          <div className="container au-hero__inner">
            <div className="au-hero__text">
              <span className={`au-hero__eyebrow ${dark ? "" : "is-dark"}`}>{race ? t("auto.raceTag") : t("auto.eyebrow")}</span>
              <h1 className={`au-hero__title ${dark ? "" : "is-dark"}`}>{car.name}</h1>
              <div className="au-hero__chips">
                {car.power && <span className="au-chip"><b>{t("fleet.l_power")}</b>{car.power}</span>}
                {car.engine && <span className="au-chip"><b>{t("fleet.l_engine")}</b>{car.engine}</span>}
                {car.drive && <span className="au-chip"><b>{t("auto.l_drive")}</b>{car.drive}</span>}
              </div>
              <div className="au-hero__btns">
                {race ? (
                  <Link to="/kontakt" className="btn btn--dark" onClick={() => window.scrollTo({ top: 0 })}>{t("auto.contact")} <span className="btn__arrow">›</span></Link>
                ) : (
                  <>
                    <Link to={`/rezerwacja?car=${car.id}`} className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}>{t("auto.book")} <span className="btn__arrow">›</span></Link>
                    <Link to="/voucher" className="btn btn--dark" onClick={() => window.scrollTo({ top: 0 })}>{t("auto.voucher")}</Link>
                    {from > 0 && <span className={`au-hero__from ${dark ? "" : "is-dark"}`}>{t("auto.from")} <b>{fmtZl(from)}</b> {t("card.net")}</span>}
                  </>
                )}
              </div>
            </div>
            <div className="au-hero__media">
              {hero && <img src={hero} alt={car.name} className={car.png ? "au-hero__png" : "au-hero__photo"} />}
            </div>
          </div>
        </section>

        {/* ---- specs + about ---- */}
        <section className="section section--paper au-body">
          <div className="tex" />
          <div className="container au-body__grid">
            <aside className="au-specs reveal-left">
              <span className="au-kicker">{t("auto.specs")}</span>
              <dl>
                {specs.map(([k, v]) => <div key={k}><dt>{t(k)}</dt><dd>{v}</dd></div>)}
              </dl>
              {race && <p className="au-specs__note">{t("auto.raceNote").replace(/<[^>]+>/g, "")}</p>}
            </aside>
            <div className="au-about">
              <span className="au-kicker reveal-up">{t("auto.about")}</span>
              <h2 className="h-section au-about__title reveal-up rv-d1">{car.name}</h2>
              {L(car, "description") && <p className="au-about__p au-about__p--lead reveal-up rv-d2">{L(car, "description")}</p>}
              {L(car, "intro") && <p className="au-about__p reveal-up rv-d3">{L(car, "intro")}</p>}
            </div>
          </div>
        </section>

        {/* ---- gallery ---- */}
        {!!photos.length && (
          <section className="au-gallery">
            {photos.map((src, i) => (
              <figure key={i} className={`au-gal zoomable reveal-scale rv-d${(i % 3) + 1}`} onClick={() => openLightbox(photos, i)}>
                <img src={src} alt="" loading="lazy" /><span className="pd-gal__zoom">⤢</span>
              </figure>
            ))}
          </section>
        )}

        {/* ---- other cars ---- */}
        {!!others.length && (
          <section className="section section--dark au-others">
            <div className="container">
              <div className="au-others__head"><EText id="auto.other" as="h2" className="h-section reveal-up" /><Link to="/flota" className="au-others__all" onClick={() => window.scrollTo({ top: 0 })}>{t("auto.back")} ›</Link></div>
              <div className="au-others__grid">
                {others.map((c, i) => (
                  <Link key={c.id} to={`/flota/${c.slug}`} className={`au-mini reveal-up rv-d${(i % 4) + 1}`} style={{ ["--cc"]: c.color }} onClick={() => window.scrollTo({ top: 0 })}>
                    <span className="au-mini__media">{(c.png || c.photos?.[0]) && <img src={c.png || c.photos?.[0]} alt={c.name} loading="lazy" />}</span>
                    <b>{c.name}</b>
                    <small>{lang === "en" ? "See the car ›" : "Zobacz auto ›"}</small>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}
