import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { useRevealOnScroll } from "../lib/hooks";
import { LEGAL } from "../lib/legal";
import "../sections/legal.css";
import { useSeo, breadcrumbs, SITE, clip } from "../lib/seo";

/* Legal documents (privacy policy, payment terms) parsed from the old site.
   Served under the very same paths (/polityka-prywatnosci, /regulamin-platnosci) so the
   links keep working once the real domain is connected. Content lives in src/lib/legal.js. */
export default function Legal({ slug: fixedSlug }) {
  const params = useParams();
  const slug = fixedSlug || params.slug;
  const doc = LEGAL[slug];
  const { t, lang } = useStore();
  useSeo({ title: slug === "regulamin-platnosci" ? "Regulamin płatności" : "Polityka prywatności", path: `/${slug}`, description: slug === "regulamin-platnosci" ? "Regulamin płatności i rezerwacji szkoleń Fastline Racing Academy." : "Polityka prywatności serwisu Fastline Racing Academy — dane osobowe, cookies, prawa użytkownika." });
  useRevealOnScroll([slug]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);

  if (!doc) {
    return (
      <div className="lg">
        <Nav />
        <main className="container lg-missing">
          <h1>404</h1>
          <Link to="/" className="btn btn--red">← Fastline Racing Academy</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const title = lang === "en" ? doc.title_en : doc.title_pl;

  return (
    <div className="lg">
      <ScrollProgress />
      <Nav />
      <main>
        <section className="lg-head">
          <div className="lg-head__flag" />
          <div className="container">
            <span className="eyebrow reveal-up">Fastline Racing Academy</span>
            <h1 className="h-display lg-head__title reveal-up rv-d1">{title}</h1>
          </div>
        </section>

        <section className="section section--paper lg-body-wrap">
          <div className="tex" />
          <div className="container">
            <article className="lg-body reveal-up" dangerouslySetInnerHTML={{ __html: doc.body }} />
            <div className="lg-back">
              <Link to="/" onClick={() => window.scrollTo({ top: 0 })}>‹ {t("stub.back") || "POWRÓT"}</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}
