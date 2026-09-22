import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { useRevealOnScroll } from "../lib/hooks";
import "../sections/produkty.css";

const pad2 = (n) => String(n).padStart(2, "0");
const isTrip = (p) => p.theme === "wyprawa";

/* /oferta — the offer: a compact sticky menu on the left (filter SZKOLENIA / WYPRAWY + jump list),
   the big product plates on the right. Products with an external_url (Heels) leave the site. */
export default function Produkty() {
  const { products, L, t, cmsMode, isAdmin } = useStore();
  const { hash } = useLocation();
  const editing = cmsMode && isAdmin;
  const [filter, setFilter] = useState("all");   // all | training | trips
  const shown = useMemo(() => products.filter((p) => filter === "all" ? true : filter === "trips" ? isTrip(p) : !isTrip(p)), [products, filter]);
  useRevealOnScroll([shown.length, filter]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [hash, products.length]);

  const jump = (p) => (e) => {
    e.preventDefault();
    if (filter !== "all" && (filter === "trips") !== isTrip(p)) setFilter("all");
    setTimeout(() => document.getElementById(`p-${p.slug}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };

  return (
    <div className={editing ? "cms-on pr" : "pr"}>
      <ScrollProgress />
      <Nav />
      <main>
        <section className="pr-head">
          <div className="pr-head__flag" />
          <div className="speedfx">{[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ top: `${16 + i * 23}%`, left: "-30%", width: "52%", animationDelay: `${i * 0.85}s` }} />
          ))}</div>
          <div className="container pr-head__inner">
            <EText id="prod.eyebrow" as="span" className="eyebrow reveal-up" />
            <EText id="prod.title" as="h1" className="h-display pr-head__title reveal-up rv-d1" />
            <EText id="prod.sub" as="p" className="lead pr-head__sub reveal-up rv-d2" multiline />
            <div className="pr-head__count reveal-up rv-d3">
              <span>{pad2(products.length)}</span>
              <i>{t("prod.count")}</i>
            </div>
          </div>
        </section>

        <section className="section section--paper pr-wall">
          <div className="tex" />
          <div className="container pr-layout">
            {/* compact side menu */}
            <aside className="pr-menu reveal-left">
              <span className="pr-menu__lbl">{t("prod.menuLabel")}</span>
              <div className="pr-menu__filters">
                {[["all", "prod.filterAll"], ["training", "prod.filterTraining"], ["trips", "prod.filterTrips"]].map(([k, key]) => (
                  <button key={k} className={`pr-menu__f ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{t(key)}</button>
                ))}
              </div>
              <nav className="pr-menu__list">
                {products.map((p, i) => (
                  <a key={p.id} href={`#p-${p.slug}`} className={`pr-menu__i ${filter !== "all" && (filter === "trips") !== isTrip(p) ? "dim" : ""}`} style={{ ["--pc"]: p.color || "var(--red)" }} onClick={jump(p)}>
                    <i>{pad2(i + 1)}</i>
                    <span><b>{L(p, "title")}</b><small>{isTrip(p) ? t("prod.filterTrips") : (L(p, "tag") || p.code)}</small></span>
                  </a>
                ))}
              </nav>
              <span className="pr-menu__hint">{t("prod.menuHint")}</span>
            </aside>

            <div className="pr-plates">
              {shown.map((p, i) => <Plate key={p.id} p={p} i={products.indexOf(p)} L={L} t={t} editing={editing} />)}
            </div>
          </div>
        </section>

        <section className="section section--dark pr-cta">
          <div className="speedfx">{[0, 1, 2].map((i) => (
            <span key={i} style={{ top: `${28 + i * 22}%`, left: "-30%", width: "46%", animationDelay: `${i * 1.1}s` }} />
          ))}</div>
          <div className="container pr-cta__inner">
            <div>
              <EText id="prod.ctaEyebrow" as="span" className="eyebrow reveal-up" />
              <EText id="prod.ctaTitle" as="h2" className="h-display pr-cta__title reveal-up rv-d1" />
              <EText id="prod.ctaSub" as="p" className="lead pr-cta__sub reveal-up rv-d2" multiline />
            </div>
            <div className="pr-cta__btns reveal-up rv-d3">
              <Link to="/rezerwacja" className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}>{t("prod.ctaBook")} <span className="btn__arrow">›</span></Link>
              <Link to="/kalendarz" className="btn btn--ghost pr-cta__ghost" onClick={() => window.scrollTo({ top: 0 })}>{t("prod.ctaCal")}</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}

/* one product plate — photo tilts under the cursor, colour washes in on hover (the boss likes these — kept as they are) */
function Plate({ p, i, L, t, editing }) {
  const ref = useRef(null);
  const ext = !!p.external_url;

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(hover: none)").matches) return;
    let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const loop = () => {
      raf = 0;
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      el.style.setProperty("--rx", (-cy * 4).toFixed(2) + "deg");
      el.style.setProperty("--ry", (cx * 6).toFixed(2) + "deg");
      el.style.setProperty("--px", (cx * 18).toFixed(1) + "px");
      el.style.setProperty("--py", (cy * 12).toFixed(1) + "px");
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(loop);
    };
    const leave = () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); cancelAnimationFrame(raf); };
  }, []);

  const inner = (
    <>
      <div className="pp__media">
        <div className="pp__photo" style={{ backgroundImage: `url(${p.photo})` }} />
        <span className="pp__wash" />
        <span className="pp__grid" />
        <span className="pp__streaks">{[0, 1, 2].map((k) => <i key={k} style={{ ["--i"]: k }} />)}</span>
        {p.logo
          ? <span className={`pp__logo ${p.theme === "ice" ? "pp__logo--ice" : ""}`}><img src={p.logo} alt={L(p, "title")} /></span>
          : <span className="pp__code">{p.code}</span>}
        {ext && <span className="pp__ext">↗</span>}
      </div>
      <div className="pp__body">
        <span className="pp__idx">{pad2(i + 1)}</span>
        <span className="pp__tag">{L(p, "tag")}{isTrip(p) && p.trip_dates_pl ? ` · ${L(p, "trip_dates")}` : ""}</span>
        <h2 className="pp__title">{L(p, "title")}</h2>
        <p className="pp__exc">{L(p, "excerpt")}</p>
        <span className="pp__go">{ext ? t("prod.goExt") : t("prod.go")} <i>›</i></span>
      </div>
    </>
  );
  const cls = `pp reveal-up rv-d${(i % 3) + 1} ${i % 2 ? "pp--flip" : ""} ${ext ? "pp--ext" : ""}`;
  const style = { ["--pc"]: p.color || "var(--red)" };
  if (ext) return <a id={`p-${p.slug}`} ref={ref} className={cls} style={style} href={p.external_url} target="_blank" rel="noreferrer" onClick={(e) => editing && e.preventDefault()}>{inner}</a>;
  return <Link id={`p-${p.slug}`} ref={ref} className={cls} style={style} to={`/produkty/${p.slug}`} onClick={(e) => { if (editing) { e.preventDefault(); return; } window.scrollTo({ top: 0 }); }}>{inner}</Link>;
}
