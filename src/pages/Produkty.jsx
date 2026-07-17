import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { useRevealOnScroll } from "../lib/hooks";
import "../sections/produkty.css";

const pad2 = (n) => String(n).padStart(2, "0");

/* /produkty — the offer wall. Every product is a big "plate": photo + code + title.
   Products with an external_url (Heels) leave the site instead of opening a subpage. */
export default function Produkty() {
  const { products, L, t, cmsMode, isAdmin } = useStore();
  const editing = cmsMode && isAdmin;
  useRevealOnScroll([products.length]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

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
          <div className="container">
            {products.map((p, i) => <Plate key={p.id} p={p} i={i} L={L} t={t} editing={editing} />)}
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
              <Link to="/rezerwacja" className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}>
                {t("prod.ctaBook")} <span className="btn__arrow">›</span>
              </Link>
              <Link to="/kalendarz" className="btn btn--ghost pr-cta__ghost" onClick={() => window.scrollTo({ top: 0 })}>
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

/* one product plate — photo tilts under the cursor, colour washes in on hover */
function Plate({ p, i, L, t, editing }) {
  const ref = useRef(null);
  const ext = !!p.external_url;

  // eased mouse parallax on the photo (desktop only)
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
        {/* a product with its own brand (Heels) shows its logo instead of the code plate */}
        {p.logo
          ? <span className={`pp__logo ${p.theme === "ice" ? "pp__logo--ice" : ""}`}><img src={p.logo} alt={L(p, "title")} /></span>
          : <span className="pp__code">{p.code}</span>}
        {ext && <span className="pp__ext">↗</span>}
      </div>

      <div className="pp__body">
        <span className="pp__idx">{pad2(i + 1)}</span>
        <span className="pp__tag">{L(p, "tag")}</span>
        <h2 className="pp__title">{L(p, "title")}</h2>
        <p className="pp__exc">{L(p, "excerpt")}</p>
        <span className="pp__go">
          {ext ? t("prod.goExt") : t("prod.go")} <i>›</i>
        </span>
      </div>
    </>
  );

  const cls = `pp reveal-up rv-d${(i % 3) + 1} ${i % 2 ? "pp--flip" : ""} ${ext ? "pp--ext" : ""}`;
  const style = { ["--pc"]: p.color || "var(--red)" };

  if (ext) {
    return (
      <a ref={ref} className={cls} style={style} href={p.external_url} target="_blank" rel="noreferrer"
        onClick={(e) => editing && e.preventDefault()}>
        {inner}
      </a>
    );
  }
  return (
    <Link ref={ref} className={cls} style={style} to={`/produkty/${p.slug}`}
      onClick={(e) => { if (editing) { e.preventDefault(); return; } window.scrollTo({ top: 0 }); }}>
      {inner}
    </Link>
  );
}
