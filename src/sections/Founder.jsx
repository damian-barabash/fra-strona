import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { EText, EMedia } from "../components/Editable";
import { useReveal, useRevealOnScroll, useCountUp } from "../lib/hooks";

/* Founder block — Mariusz Miękoś as the man behind the school. Sits right before the
   instructors slider; the signature is the black version of his autograph. */
export default function Founder() {
  const { t, cmsMode, isAdmin } = useStore();
  const [ref, inView] = useReveal();
  const editing = cmsMode && isAdmin;
  useRevealOnScroll([]);   // the home page has no global reveal scanner — this block brings its own

  return (
    <section className={`section section--paper founder ${inView ? "in" : ""}`} id="zalozyciel" ref={ref}>
      <div className="tex" />
      <div className="container founder__grid">
        <div className="founder__media reveal-left">
          <span className="founder__rect" />
          <EMedia id="founder.photo" className="founder__fig" alt={t("founder.title")} />
          <span className="founder__num">01</span>
          <span className="founder__tape">FOUNDER · 9× MISTRZ POLSKI</span>
        </div>

        <div className="founder__text">
          <EText id="founder.eyebrow" as="span" className="eyebrow reveal-up" />
          <EText id="founder.title" as="h2" className="founder__title reveal-up rv-d1" />
          <EText id="founder.role" as="span" className="founder__role reveal-up rv-d2" />
          <EText id="founder.body" as="p" className="lead founder__body reveal-up rv-d3" multiline />

          <blockquote className="founder__quote reveal-up rv-d4">
            <span className="founder__qmark">“</span>
            <EText id="founder.quote" as="span" multiline />
          </blockquote>

          <div className="founder__stats reveal-up rv-d4">
            {[1, 2, 3].map((n) => <Stat key={n} n={n} inView={inView} t={t} />)}
          </div>

          <div className="founder__foot reveal-up rv-d5">
            <EMedia id="founder.sign" className="founder__sign" alt="" />
            <Link to="/mariusz-miekos-racing" className="btn btn--dark" onClick={(e) => { if (editing) { e.preventDefault(); return; } window.scrollTo({ top: 0 }); }}>
              <EText id="founder.cta" /> <span className="btn__arrow">›</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ n, inView, t }) {
  const v = useCountUp(t(`founder.s${n}v`), inView, 1400);
  return (
    <div className="founder__stat">
      <b>{v}</b>
      <EText id={`founder.s${n}l`} as="span" />
    </div>
  );
}
