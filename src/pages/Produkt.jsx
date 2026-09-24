import { useEffect, useRef } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { useRevealOnScroll } from "../lib/hooks";
import { useLightbox } from "../components/Lightbox";
import Laponia from "./Laponia";
import D2R from "./D2R";
import Wyprawa from "./Wyprawa";
import "../sections/produkty.css";
import { useSeo, breadcrumbs, SITE, clip, nice } from "../lib/seo";

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
/* a field may start with "## Own heading" — the page then shows that instead of the default label */
const headed = (s, fallback) => {
  const ls = lines(s);
  if (ls[0]?.startsWith("## ")) return { label: ls[0].slice(3).trim(), body: ls.slice(1).join("\n"), items: ls.slice(1) };
  return { label: fallback, body: ls.join("\n"), items: ls };
};

/* /produkty/:slug — one product. Content is fully CMS-driven (admin tab "Produkty"). */
export default function Produkt() {
  const { slug } = useParams();
  const { products, ready, L, t, cmsMode, isAdmin } = useStore();
  const openLightbox = useLightbox();
  const editing = cmsMode && isAdmin;
  const p = products.find((x) => x.slug === slug);
  useSeo({
    title: p ? `${nice(p.title_pl)}${p.tag_pl ? ` — ${nice(p.tag_pl).toLowerCase()}` : ""}` : "Oferta",
    path: `/produkty/${slug}`,
    description: p ? `${p.excerpt_pl || ""} ${p.intro_pl || ""}` : "",
    image: p?.photo,
    type: "product",
    jsonld: p ? [
      { "@type": p.theme === "wyprawa" ? "TouristTrip" : "Course", "@id": `${SITE}/produkty/${p.slug}#product`, name: p.title_pl, description: clip(`${p.excerpt_pl || ""} ${p.intro_pl || ""}`, 300), image: p.photo ? `${SITE}${p.photo}` : `${SITE}/og.jpg`, url: `${SITE}/produkty/${p.slug}`, provider: { "@id": `${SITE}/#organization` },
        ...(p.theme !== "wyprawa" ? { courseMode: "Onsite", hasCourseInstance: { "@type": "CourseInstance", courseMode: "Onsite", location: p.places_pl || "Tor Łódź / Tor Poznań" } } : {}),
        ...(p.price ? { offers: { "@type": "Offer", price: p.price, priceCurrency: p.currency || "PLN", availability: "https://schema.org/InStock", url: `${SITE}/produkty/${p.slug}`, seller: { "@id": `${SITE}/#organization` } } } : {}) },
      breadcrumbs([{ name: "Oferta", path: "/oferta" }, { name: p.title_pl, path: `/produkty/${p.slug}` }]),
    ] : undefined,
  });

  useRevealOnScroll([p?.id, products.length]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);

  // products can bring their own page style — Laponia is frozen, Driver2Racer is red-hot
  if (p && p.theme === "ice") return <Laponia p={p} />;
  if (p && p.theme === "d2r") return <D2R p={p} />;
  if (p && p.theme === "wyprawa") return <Wyprawa p={p} />;

  if (!p) {
    // data still loading → keep the frame; loaded and still missing → back to the wall
    if (ready && products.length) return <Navigate to="/produkty" replace />;
    return <div className="pd"><Nav /><main style={{ minHeight: "60vh" }} /><Footer /></div>;
  }
  if (p.external_url) return <Navigate to="/produkty" replace />;

  const style = { ["--pc"]: p.color || "var(--red)" };
  const learn = lines(L(p, "learn"));
  const includes = lines(L(p, "includes"));
  const places = lines(L(p, "places"));
  const pk = headed(L(p, "packages"), null);
  const packages = pk.items;
  const intro = lines(L(p, "intro"));
  const gallery = Array.isArray(p.photos) ? p.photos : [];
  // info-only products (the simulator) never say "packages" — they have training stages
  const pkgLabel = pk.label || (p.info_only ? t("prod.stages") : t("prod.packages"));
  const theory = headed(L(p, "theory"), t("prod.theory")), practice = headed(L(p, "practice"), t("prod.practice"));
  const buyTo = p.buy_direct ? `/zakup?produkt=${p.slug}` : "/rezerwacja";

  return (
    <div className={editing ? "cms-on pd" : "pd"} style={style}>
      <ScrollProgress />
      <Nav />
      <main>
        <Hero p={p} L={L} t={t} places={places} packages={packages} pkgLabel={pkgLabel} />

        {/* ---- intro ---- */}
        {!!intro.length && (
          <section className="section section--paper pd-intro">
            <div className="tex" />
            <div className="container pd-intro__grid">
              <div className="pd-intro__side reveal-left">
                <span className="pd-kicker">{t("prod.aboutLabel")}</span>
                <span className="pd-intro__bar" />
              </div>
              <div className="pd-intro__text">
                {intro.map((par, i) => (
                  <p key={i} className={`pd-intro__p reveal-up rv-d${(i % 3) + 1}`}>{par}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---- theory / practice ---- */}
        {(theory.body || practice.body) && (
          <section className="section section--dark pd-parts">
            <div className="speedfx">{[0, 1, 2].map((i) => (
              <span key={i} style={{ top: `${22 + i * 26}%`, left: "-30%", width: "48%", animationDelay: `${i * 1.05}s` }} />
            ))}</div>
            <div className="container pd-parts__grid">
              {[
                { n: "01", label: theory.label, body: theory.body },
                { n: "02", label: practice.label, body: practice.body },
              ].filter((x) => x.body).map((x, i) => (
                <article key={x.n} className={`pd-part reveal-up rv-d${i + 1}`}>
                  <span className="pd-part__n">{x.n}</span>
                  <h3 className="pd-part__h">{x.label}</h3>
                  <p className="pd-part__b" style={{ whiteSpace: "pre-line" }}>{x.body}</p>
                  <span className="pd-part__glow" />
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ---- what you learn + what's included ---- */}
        {(learn.length > 0 || includes.length > 0) && (
          <section className="section section--paper pd-lists">
            <div className="tex" />
            <div className="container pd-lists__grid">
              {!!learn.length && (
                <div className="pd-list">
                  <h3 className="pd-list__h reveal-up">{t("prod.learn")}</h3>
                  <ul className="pd-list__ul">
                    {learn.map((l, i) => (
                      <li key={i} className={`pd-li reveal-up rv-d${(i % 5) + 1}`}>
                        <span className="pd-li__mark" />{l}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!!includes.length && (
                <div className="pd-list pd-list--box">
                  <h3 className="pd-list__h reveal-up">{t("prod.includes")}</h3>
                  <ul className="pd-list__ul">
                    {includes.map((l, i) => (
                      <li key={i} className={`pd-li pd-li--check reveal-up rv-d${(i % 5) + 1}`}>
                        <span className="pd-li__tick">✓</span>{l}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---- packages ---- */}
        {!!packages.length && (
          <section className="section section--paper pd-pkgs">
            <div className="tex" />
            <div className="container">
              <h3 className="h-section pd-pkgs__h reveal-up">{pkgLabel}</h3>
              <div className="pd-pkgs__grid">
                {packages.map((line, i) => {
                  const [head, ...rest] = line.split("—");
                  const tail = rest.join("—").trim();
                  return (
                    <div key={i} className={`pd-pkg reveal-up rv-d${(i % 4) + 1}`}>
                      <span className="pd-pkg__n">{String(i + 1).padStart(2, "0")}</span>
                      <span className="pd-pkg__name">{head.trim()}</span>
                      {tail && <span className="pd-pkg__sub">{tail}</span>}
                      {!p.info_only && (
                        <Link to={p.buy_direct ? `${buyTo}&wariant=${i}` : buyTo} className="pd-pkg__go" onClick={() => window.scrollTo({ top: 0 })}>
                          {p.buy_direct ? t("prod.buy") : t("prod.pick")} ›
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
              {L(p, "price_note") && <p className="pd-pkgs__note reveal-up">{L(p, "price_note")}</p>}
            </div>
          </section>
        )}

        {/* ---- gallery (click → fullscreen viewer) ---- */}
        {!!gallery.length && (
          <section className="pd-gallery">
            {gallery.map((src, i) => (
              <figure key={i} className={`pd-gal zoomable reveal-scale rv-d${(i % 3) + 1}`} onClick={() => openLightbox(gallery, i)}>
                <img src={src} alt="" loading="lazy" />
                <span className="pd-gal__zoom">⤢</span>
              </figure>
            ))}
          </section>
        )}

        {/* ---- CTA (info-only products, e.g. the simulator, get contact instead of booking) ---- */}
        <section className="section section--dark pd-cta">
          <div className="speedfx">{[0, 1, 2].map((i) => (
            <span key={i} style={{ top: `${26 + i * 24}%`, left: "-30%", width: "46%", animationDelay: `${i * 1.2}s` }} />
          ))}</div>
          <div className="container pd-cta__inner">
            <div>
              <span className="eyebrow reveal-up">{L(p, "tag")}</span>
              <h2 className="h-display pd-cta__title reveal-up rv-d1">{L(p, "title")}</h2>
              <p className="lead pd-cta__sub reveal-up rv-d2">{p.info_only ? t("prod.infoSub") : p.buy_direct ? t("prod.ctaSubBuy") : t("prod.ctaSub")}</p>
            </div>
            <div className="pd-cta__btns reveal-up rv-d3">
              {p.info_only ? (
                <a href="/#kontakt" className="btn btn--red">
                  {t("prod.contact")} <span className="btn__arrow">›</span>
                </a>
              ) : (
                <>
                  <Link to={buyTo} className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}>
                    {p.buy_direct ? t("prod.buy") : t("prod.book")} <span className="btn__arrow">›</span>
                  </Link>
                  <Link to="/kalendarz" className="btn btn--ghost pd-cta__ghost" onClick={() => window.scrollTo({ top: 0 })}>
                    {t("prod.ctaCal")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        <div className="container pd-back">
          <Link to="/produkty" onClick={() => window.scrollTo({ top: 0 })}>‹ {t("prod.back")}</Link>
        </div>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* hero — photo with a colour wash, code plate and quick facts */
function Hero({ p, L, t, places, packages, pkgLabel }) {
  const buyTo = p.buy_direct ? `/zakup?produkt=${p.slug}` : "/rezerwacja";
  const ref = useRef(null);

  // subtle photo parallax while scrolling through the hero
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight || 1)));
        el.style.setProperty("--sy", (y * 60).toFixed(1) + "px");
        el.style.setProperty("--sz", (1 + y * 0.08).toFixed(3));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <section className="pd-hero">
      <div className="pd-hero__media" ref={ref}>
        <img src={p.photo} alt={L(p, "title")} />
      </div>
      <div className="pd-hero__scrim" />
      <div className="pd-hero__wash" />
      <div className="pd-hero__streaks">{[0, 1, 2, 3].map((i) => <span key={i} style={{ ["--i"]: i }} />)}</div>

      <div className="container pd-hero__inner">
        <span className="pd-hero__code">{p.code}</span>
        <span className="pd-hero__tag">{L(p, "tag")}</span>
        <h1 className="pd-hero__title">{L(p, "title")}</h1>
        <p className="pd-hero__exc">{L(p, "excerpt")}</p>

        <div className="pd-hero__facts">
          {!!places.length && (
            <div className="pd-fact">
              <span className="pd-fact__l">{t("prod.places")}</span>
              <span className="pd-fact__v">{places.join(" · ")}</span>
            </div>
          )}
          {!!packages.length && (
            <div className="pd-fact">
              <span className="pd-fact__l">{pkgLabel}</span>
              <span className="pd-fact__v">{packages.map((x) => x.split("—")[0].trim()).join(" · ")}</span>
            </div>
          )}
        </div>

        <div className="pd-hero__btns">
          {!p.info_only && (
            <Link to={buyTo} className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}>
              {p.buy_direct ? t("prod.buy") : t("prod.book")} <span className="btn__arrow">›</span>
            </Link>
          )}
          <a href="#pd-more" className={`btn ${p.info_only ? "btn--red" : "btn--ghost pd-hero__ghost"}`}>{t("prod.more")}</a>
        </div>
      </div>
      <span id="pd-more" />
    </section>
  );
}
