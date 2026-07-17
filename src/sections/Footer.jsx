import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { EText } from "../components/Editable";

const SOC = [
  { k: "facebook", href: "https://facebook.com" },
  { k: "instagram", href: "https://instagram.com" },
  { k: "linkedin", href: "https://linkedin.com" },
];

// site pages that always live in the footer next to the products
const PAGES = [
  { key: "nav.products", to: "/produkty" },
  { key: "nav.calendar", to: "/kalendarz" },
  { key: "nav.pricing", to: "/cennik" },
  { key: "nav.fleet", to: "/flota" },
  { key: "about.szkola.label", to: "/o-szkole" },
  { key: "about.media.label", to: "/media-o-nas" },
  { key: "nav.contact", to: "/kontakt" },
];

/* The two middle columns are generated from the CMS products, so adding or renaming a product
   updates the footer automatically (external ones — Heels — keep their own link). */
export default function Footer() {
  const { t, L, products, cmsMode, isAdmin } = useStore();
  const editing = cmsMode && isAdmin;

  const half = Math.ceil(products.length / 2);
  const cols = [products.slice(0, half), products.slice(half)];

  const ProductLink = ({ p }) => {
    const inner = (
      <>
        <span className="fnav__title">{L(p, "title")}</span>
        <span className="fnav__sub">{L(p, "tag") || p.code}</span>
      </>
    );
    const cls = "fnav__item";
    if (p.external_url) {
      return (
        <a className={cls} href={p.external_url} target="_blank" rel="noreferrer"
          onClick={(e) => editing && e.preventDefault()}>{inner}</a>
      );
    }
    return (
      <Link className={cls} to={`/produkty/${p.slug}`}
        onClick={(e) => { if (editing) { e.preventDefault(); return; } window.scrollTo({ top: 0 }); }}>{inner}</Link>
    );
  };

  return (
    <footer className="footer" id="kontakt">
      <div className="footer__flag" />
      <div className="container footer__grid">
        <div className="footer__brand">
          <img className="footer__logo" src="/assets/ui/logo_dark.webp" alt="Fastline Racing Academy" />
          <EText id="footer.eyebrow" as="div" className="footer__eyebrow" />
          <EText id="footer.tagline" as="div" className="footer__tag" />
          <div className="footer__socials">
            {SOC.map((s) => (
              <a key={s.k} href={s.href} target="_blank" rel="noreferrer">
                <img src={`/assets/ui/${s.k}.webp`} alt={s.k} />
              </a>
            ))}
          </div>
        </div>

        {cols.map((col, i) => (
          <nav className="footer__nav" key={i}>
            {/* one label for both product columns; the second keeps a ghost copy so the rows line up */}
            <span className={`footer__navlbl ${i ? "footer__navlbl--ghost" : ""}`} aria-hidden={i ? "true" : undefined}>
              {t("footer.offer")}
            </span>
            {col.map((p) => <ProductLink key={p.id} p={p} />)}
          </nav>
        ))}

        <div className="footer__contact">
          <span className="footer__navlbl">{t("footer.pages")}</span>
          <nav className="footer__pages">
            {PAGES.map((pg) => (
              <Link key={pg.to} to={pg.to}
                onClick={(e) => { if (editing) { e.preventDefault(); return; } window.scrollTo({ top: 0 }); }}>
                {t(pg.key)}
              </Link>
            ))}
          </nav>

          <div className="footer__cline">
            <span className="footer__clbl">E-mail</span>
            <a href={`mailto:${t("footer.email")}`}><EText id="footer.email" /></a>
          </div>
          <div className="footer__cline">
            <span className="footer__cname"><EText id="footer.phoneName" /></span>
            <a href={`tel:${t("footer.phone").replace(/\s/g, "")}`}><EText id="footer.phone" /></a>
          </div>
        </div>
      </div>

      <div className="container footer__bottom">
        <EText id="footer.rights" as="div" className="footer__rights" />
        <nav className="footer__legal">
          <Link to="/polityka-prywatnosci" onClick={(e) => { if (editing) { e.preventDefault(); return; } window.scrollTo({ top: 0 }); }}>
            {t("footer.privacy")}
          </Link>
          <Link to="/regulamin-platnosci" onClick={(e) => { if (editing) { e.preventDefault(); return; } window.scrollTo({ top: 0 }); }}>
            {t("footer.terms")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
