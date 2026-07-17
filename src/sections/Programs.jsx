import { useStore } from "../lib/store";
import { EText } from "../components/Editable";
import { useReveal } from "../lib/hooks";

export default function Programs() {
  const { programs, L } = useStore();
  const [ref, inView] = useReveal();

  return (
    <section className="section section--paper" id="programy">
      <div className="tex" />
      <div className="container">
        <div className="programs__head">
          <EText id="programs.eyebrow" as="span" className="eyebrow" />
          <EText id="programs.title" as="h2" className="programs__title" />
          <EText id="programs.sub" as="p" className="lead" />
        </div>

        <div className={`programs__row reveal ${inView ? "in" : ""}`} ref={ref}>
          {programs.map((p, i) => (
            <a key={p.id} className="pcard" href={p.link || "#"} style={{ transitionDelay: `${i * 55}ms` }}>
              <img src={p.image} alt={L(p, "title")} loading="lazy" />
              <div className="pcard__scrim" />
              <div className="pcard__tag">{L(p, "tag")}</div>
              <div className="pcard__body">
                <div className="pcard__title">{L(p, "title")}</div>
                <div className="pcard__desc">{L(p, "desc")}</div>
              </div>
              <span className="pcard__arrow">›</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
