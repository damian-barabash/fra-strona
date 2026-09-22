import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { EText } from "../components/Editable";
import { useReveal } from "../lib/hooks";

/* Six programme tiles in one seamless strip (no gaps). The caps title sits at the top,
   the short description at the bottom next to the red WIĘCEJ button.
   Every tile links to a real page (CMS field "link"): internal routes use the SPA Link. */
export default function Programs() {
  const { programs, L, t, cmsMode, isAdmin } = useStore();
  const [ref, inView] = useReveal();
  const editing = cmsMode && isAdmin;

  const Tile = ({ p, i }) => {
    const inner = (
      <>
        <img src={p.image} alt={L(p, "title")} loading="lazy" />
        <div className="pcard__scrim" />
        <div className="pcard__top">
          <span className="pcard__tag">{L(p, "tag")}</span>
          <h3 className="pcard__title">{L(p, "title")}</h3>
        </div>
        <div className="pcard__bottom">
          <p className="pcard__desc">{L(p, "desc")}</p>
          <span className="pcard__arrow"><span>{t("programs.cta")}</span><i>›</i></span>
        </div>
      </>
    );
    const style = { transitionDelay: `${i * 55}ms` };
    const href = p.link || "/oferta";
    const ext = /^https?:\/\//i.test(href);
    if (ext) return <a className="pcard" href={href} target="_blank" rel="noreferrer" style={style} onClick={(e) => editing && e.preventDefault()}>{inner}</a>;
    return <Link className="pcard" to={href} style={style} onClick={(e) => { if (editing) { e.preventDefault(); return; } window.scrollTo({ top: 0 }); }}>{inner}</Link>;
  };

  return (
    <section className="section section--paper programs" id="programy">
      <div className="tex" />
      <div className="container">
        <div className="programs__head">
          <EText id="programs.eyebrow" as="span" className="eyebrow" />
          <EText id="programs.title" as="h2" className="programs__title" />
          <EText id="programs.sub" as="p" className="lead" />
        </div>
        <div className={`programs__row reveal ${inView ? "in" : ""}`} ref={ref}>
          {programs.map((p, i) => <Tile key={p.id} p={p} i={i} />)}
        </div>
      </div>
    </section>
  );
}
