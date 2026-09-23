import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { useRevealOnScroll } from "../lib/hooks";
import { PACKAGES, carPrice, customPrice, fmtZl, isPoznan } from "../lib/flota";
import { fmtEur, iceDateRange } from "../lib/ice";
import "../sections/cennik.css";
import { useSeo, breadcrumbs, SITE, clip } from "../lib/seo";

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

/* /cennik — the live price board. Session prices come straight from the CMS (cars × packages,
   per track), Laponia from `ice_packages`, Safe & Sport from its product.
   Clicking any cell drops you into the configurator with that car + package preselected. */
export default function Cennik() {
  const { cars, icePackages, iceWindows, products, raw, t, L, lang, cmsMode, isAdmin } = useStore();
  useSeo({
    title: "Cennik szkoleń jazdy na torze",
    path: "/cennik",
    description: `Ceny szkoleń Fastline Racing Academy (netto): pakiety 3, 6 i 9 sesji na torach Łódź i Poznań, od ${Math.min(...cars.map((c) => c.price_3 || Infinity).filter(Number.isFinite), 1450)} zł. Ice Driving Laponia, wyprawy i vouchery.`,
    jsonld: [
      { "@type": "OfferCatalog", name: "Cennik Fastline Racing Academy", itemListElement: cars.filter((c) => c.price_3).map((c) => ({ "@type": "Offer", name: `${c.name} — 3 sesje na torze`, price: c.price_3, priceCurrency: "PLN", url: `${SITE}/flota/${c.slug}`, availability: "https://schema.org/InStock" })) },
      breadcrumbs([{ name: "Cennik", path: "/cennik" }]),
    ],
  });
  const nav = useNavigate();
  const editing = cmsMode && isAdmin;
  const [track, setTrack] = useState("lodz");   // price set: Łódź (base) or Poznań

  useRevealOnScroll([cars.length, track]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const book = (car, sessions) => {
    window.scrollTo({ top: 0 });
    nav(`/rezerwacja?car=${car.id}&sessions=${sessions}`);
  };
  const safe = products.find((p) => p.slug === "safe-and-sport-driving-academy");
  const window_ = iceWindows[0];

  return (
    <div className={editing ? "cms-on cn" : "cn"}>
      <ScrollProgress />
      <Nav />
      <main>
        {/* ---------------- HEADER ---------------- */}
        <section className="cn-head">
          <div className="cn-head__flag" />
          <div className="speedfx">{[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ top: `${18 + i * 22}%`, left: "-30%", width: "52%", animationDelay: `${i * 0.9}s` }} />
          ))}</div>
          <div className="container cn-head__inner">
            <EText id="cen.eyebrow" as="span" className="eyebrow reveal-up" />
            <EText id="cen.title" as="h1" className="h-display cn-head__title reveal-up rv-d1" />
            <EText id="cen.sub" as="p" className="lead cn-head__sub reveal-up rv-d2" multiline />
          </div>
        </section>

        {/* ---------------- SESSION PRICE BOARD ---------------- */}
        <section className="section section--paper cn-board" id="cennik-sesje">
          <div className="tex" />
          <div className="container">
            <div className="cn-board__head">
              <div>
                <EText id="cen.boardEyebrow" as="span" className="eyebrow reveal-up" />
                <EText id="cen.boardTitle" as="h2" className="h-section cn-board__title reveal-up rv-d1" />
              </div>
              {/* track switch — the whole board re-prices itself */}
              <div className="cn-board__right reveal-up rv-d2">
              <span className="cn-netto">{lang === "en" ? "ALL PRICES NET" : "WSZYSTKIE CENY NETTO"}</span>
              <div className="cn-switch" role="tablist">
                {[{ k: "lodz", l: t("cen.lodz") }, { k: "poznan", l: t("cen.poznan") }].map((x) => (
                  <button key={x.k} role="tab" aria-selected={track === x.k}
                    className={`cn-switch__b ${track === x.k ? "on" : ""}`} onClick={() => setTrack(x.k)}>
                    {x.l}
                  </button>
                ))}
              </div>
              </div>
            </div>

            <div className="cn-table reveal-up rv-d2">
              <div className="cn-row cn-row--head">
                <span className="cn-cell cn-cell--car">{t("cen.car")}</span>
                {PACKAGES.map((p) => (
                  <span key={p.n} className="cn-cell cn-cell--pkg">
                    <b>{p.n}</b>
                    <i>{lang === "en" ? p.en : p.pl}</i>
                  </span>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={track}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28 }}>
                  {cars.map((c) => (
                    <div className="cn-row" key={c.id}>
                      <span className="cn-cell cn-cell--car">
                        {(c.png || c.photos?.[0]) && <img src={c.png || c.photos?.[0]} alt="" loading="lazy" />}
                        <span className="cn-car">
                          <b>{c.name}</b>
                          <i>{c.power}{c.engine ? ` · ${c.engine}` : ""}</i>
                        </span>
                      </span>
                      {PACKAGES.map((p) => {
                        const price = carPrice(c, p.n, track);
                        return (
                          <button key={p.n} className={`cn-cell cn-cell--price ${price ? "" : "is-off"}`}
                            disabled={!price} onClick={() => book(c, p.n)}
                            title={`${c.name} · ${p.n} ${lang === "en" ? "sessions" : "sesji"}`}>
                            <span className="cn-cell__lbl">{p.n}×</span>
                            {price ? <>{fmtZl(price)} <small className="cn-net">{t("card.net")}</small></> : "—"}
                            <span className="cn-cell__go">{t("cen.book")} ›</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* own car */}
                  <div className="cn-row cn-row--own">
                    <span className="cn-cell cn-cell--car">
                      <span className="cn-own">⌁</span>
                      <span className="cn-car">
                        <b>{t("flota.customName")}</b>
                        <i>{t("cen.ownSub")}</i>
                      </span>
                    </span>
                    {PACKAGES.map((p) => {
                      const price = customPrice(raw, p.n, track);
                      return (
                        <button key={p.n} className={`cn-cell cn-cell--price ${price ? "" : "is-off"}`}
                          disabled={!price}
                          onClick={() => { window.scrollTo({ top: 0 }); nav(`/rezerwacja?custom=1&sessions=${p.n}`); }}>
                          <span className="cn-cell__lbl">{p.n}×</span>
                          {price ? <>{fmtZl(price)} <small className="cn-net">{t("card.net")}</small></> : "—"}
                          <span className="cn-cell__go">{t("cen.book")} ›</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="cn-notes reveal-up">
              {isPoznan(track) && <EText id="cen.poznanNote" as="p" className="cn-note cn-note--red" />}
              <EText id="cen.sessionNote" as="p" className="cn-note" multiline />
            </div>
          </div>
        </section>

        {/* ---------------- LAPONIA + SAFE & SPORT ---------------- */}
        <section className="section section--paper cn-more">
          <div className="tex" />
          <div className="container cn-more__grid">
            {!!icePackages.length && (
              <div className="cn-block cn-block--ice reveal-up">
                <span className="cn-block__eyebrow">ICE DRIVING EXPERIENCE</span>
                <h3 className="cn-block__title">LAPONIA</h3>
                {window_ && <div className="cn-block__meta">{iceDateRange(window_, lang)}</div>}
                <ul className="cn-list">
                  {icePackages.map((pk) => (
                    <li key={pk.id}>
                      <span>{L(pk, "name")} <i>{L(pk, "sessions")}</i></span>
                      <b>{fmtEur(pk.price, pk.currency)} <small className="cn-net">{t("card.net")}</small></b>
                    </li>
                  ))}
                </ul>
                <Link to="/produkty/ice-driving-laponia" className="cn-block__link" onClick={() => window.scrollTo({ top: 0 })}>
                  {t("cen.seeMore")} ›
                </Link>
              </div>
            )}

            {safe && (
              <div className="cn-block reveal-up rv-d1">
                <span className="cn-block__eyebrow">{L(safe, "tag")}</span>
                <h3 className="cn-block__title">{L(safe, "title")}</h3>
                <ul className="cn-list">
                  {lines(L(safe, "packages")).map((l, i) => {
                    const parts = l.split("—").map((x) => x.trim());
                    const price = parts.length > 1 ? parts.pop() : "";
                    return (
                      <li key={i}>
                        <span>{parts[0]} <i>{parts.slice(1).join(" — ")}</i></span>
                        <b>{price} {price && <small className="cn-net">{t("card.net")}</small>}</b>
                      </li>
                    );
                  })}
                </ul>
                <Link to={`/produkty/${safe.slug}`} className="cn-block__link" onClick={() => window.scrollTo({ top: 0 })}>
                  {t("cen.seeMore")} ›
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="section section--dark cn-cta">
          <div className="container cn-cta__inner">
            <div>
              <EText id="cen.ctaEyebrow" as="span" className="eyebrow reveal-up" />
              <EText id="cen.ctaTitle" as="h2" className="h-display cn-cta__title reveal-up rv-d1" />
              <EText id="cen.ctaSub" as="p" className="lead cn-cta__sub reveal-up rv-d2" multiline />
            </div>
            <div className="cn-cta__btns reveal-up rv-d3">
              <Link to="/rezerwacja" className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}>
                {t("cen.ctaBook")} <span className="btn__arrow">›</span>
              </Link>
              <Link to="/kalendarz" className="btn btn--ghost cn-cta__ghost" onClick={() => window.scrollTo({ top: 0 })}>
                {t("prod.ctaCal")}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}
