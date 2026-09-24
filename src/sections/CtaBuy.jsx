import { Link } from "react-router-dom";
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
          <Link to="/rezerwacja" className="btn btn--red" onClick={() => window.scrollTo({ top: 0 })}><EText id="cta.buy" /> <span className="btn__arrow">›</span></Link>
          <Link to="/voucher" className="btn btn--red btn--gift" onClick={() => window.scrollTo({ top: 0 })}><svg className="nav__gift" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12v9H4v-9" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z" /></svg><EText id="cta.gift" /> <span className="btn__arrow">›</span></Link>
        </div>
      </div>
    </section>
  );
}
