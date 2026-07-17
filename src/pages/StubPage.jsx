import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { useRevealOnScroll } from "../lib/hooks";

export default function StubPage({ which }) {
  const { cmsMode, isAdmin } = useStore();
  const k = which; // "media" | "team"
  useRevealOnScroll([]);
  return (
    <div className={cmsMode && isAdmin ? "cms-on" : ""}>
      <ScrollProgress />
      <Nav />
      <main>
        <section className="stub">
          <div className="tex" />
          <div className="container stub__inner">
            <EText id="stub.soon" as="span" className="eyebrow reveal-up" />
            <EText id={`stub.${k}.title`} as="h1" className="stub__title h-display reveal-up rv-d1" />
            <EText id={`stub.${k}.body`} as="p" className="lead stub__body reveal-up rv-d2" multiline />
            <Link to="/" className="btn btn--red stub__btn reveal-up rv-d3" onClick={() => window.scrollTo({ top: 0 })}>
              <EText id="stub.back" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}
