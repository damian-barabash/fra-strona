import { useStore } from "../lib/store";
import { EText } from "../components/Editable";
import { useReveal } from "../lib/hooks";

export default function CtaBuy() {
  const [ref, inView] = useReveal();
  return (
    <section className="section section--paper cta" ref={ref}>
      <div className="tex" />
      <div className={`container reveal ${inView ? "in" : ""}`}>
        <EText id="cta.eyebrow" as="span" className="eyebrow" />
        <EText id="cta.title" as="h2" className="cta__title" />
        <div className="cta__btns">
          <a href="#" className="btn btn--red"><EText id="cta.buy" /> <span className="btn__arrow">›</span></a>
          <a href="#" className="btn btn--dark"><EText id="cta.gift" /> <span className="btn__arrow">›</span></a>
        </div>
      </div>
    </section>
  );
}
