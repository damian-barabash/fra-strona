import { Link } from "react-router-dom";
import { EText } from "../components/Editable";

/* Red closing band of the blog pages: from reading to the track. */
export default function BlogCta() {
  const top = () => window.scrollTo({ top: 0 });
  return (
    <section className="bl-cta">
      <div className="container bl-cta__in">
        <div className="reveal-left">
          <EText id="blog.ctaEyebrow" as="span" className="eyebrow" />
          <EText id="blog.ctaTitle" as="h2" className="bl-cta__title" />
          <EText id="blog.ctaText" as="p" className="bl-cta__text" multiline />
        </div>
        <div className="bl-cta__btns reveal-right">
          <Link to="/rezerwacja" className="btn btn--dark" onClick={top}><EText id="blog.ctaBuy" /> <span className="btn__arrow">›</span></Link>
          <Link to="/kalendarz" className="btn btn--line" onClick={top}><EText id="blog.ctaCal" /> <span className="btn__arrow">›</span></Link>
        </div>
      </div>
    </section>
  );
}
