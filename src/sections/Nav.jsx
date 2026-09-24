import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { EText } from "../components/Editable";
import { MENU, MENU_A, MENU_B, MENU_CTA, MENU_CTA2, MENU_HREF, hrefKey, ABOUT_ITEMS } from "../lib/menu";

import Social from "../components/Social";

export default function Nav() {
  const { lang, setLang, t, cmsMode, isAdmin } = useStore();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const editing = cmsMode && isAdmin;

  // frosted nav after scrolling a little past the top
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // resolve href from content (admin "Menu" tab), fall back to default
  const hrefOf = (id) => t(hrefKey(id)) || MENU_HREF[id] || "#";
  // in inline-edit mode don't navigate on click — let the label be edited in place
  const navGuard = (e) => { if (editing) e.preventDefault(); };
  const NavLink = ({ id }) => {
    if (id === "nav.about") return <AboutDropdown editing={editing} />;
    const href = hrefOf(id);
    // internal route ("/flota", "/o-szkole"…) → SPA Link (curtain transition); hash/external → <a>
    if (href.startsWith("/") && !href.startsWith("//"))
      return <Link to={href} onClick={(e) => { if (editing) { e.preventDefault(); return; } window.scrollTo({ top: 0 }); }}><EText id={id} /></Link>;
    return <a href={href} onClick={navGuard}><EText id={id} /></a>;
  };

  return (
    <>
      <header className={`nav nav--light ${scrolled ? "nav--scrolled" : ""}`}>
        {/* checkered flag watermark — decorative only, sits behind the menu and fades out before it */}
        <span className="nav__flag" aria-hidden="true" />
        <div className="container nav__inner">
          <Link className="nav__logo" to="/" aria-label="Fastline Racing Academy"
            onClick={() => window.scrollTo({ top: 0 })}>
            <img src="/assets/ui/logo.webp" alt="Fastline Racing Academy" />
          </Link>

          <nav className="nav__menu">
            <Link to={hrefOf(MENU_CTA).startsWith("/") ? hrefOf(MENU_CTA) : "/rezerwacja"} className="nav__cta"
              onClick={(e) => { if (editing) { e.preventDefault(); return; } window.scrollTo({ top: 0 }); }}>
              <EText id={MENU_CTA} /> <i>›</i>
            </Link>
            <Link to={hrefOf(MENU_CTA2).startsWith("/") ? hrefOf(MENU_CTA2) : "/voucher"} className="nav__cta nav__cta--dark"
              onClick={(e) => { if (editing) { e.preventDefault(); return; } window.scrollTo({ top: 0 }); }}>
              <EText id={MENU_CTA2} /> <i>›</i>
            </Link>
            {MENU_A.map((id) => <NavLink key={id} id={id} />)}
            <span className="nav__div" />
            {MENU_B.map((id) => <NavLink key={id} id={id} />)}
          </nav>

          <div className="nav__right">
            <span className="nav__div nav__div--r" />
            <Social className="nav__socials" />
            <div className="lang lang--dark">
              <button className={lang === "pl" ? "on" : ""} onClick={() => setLang("pl")}>PL</button>
              <span>/</span>
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
            </div>
            <button className="nav__burger" aria-label="menu" onClick={() => setOpen(true)}><span /></button>
          </div>
        </div>
      </header>

      <div className={`mobile-menu ${open ? "open" : ""}`}
        style={{ backgroundImage: "linear-gradient(rgba(13,13,13,.82),rgba(13,13,13,.92)), url(/assets/ui/menu_back.webp)" }}
        onClick={() => setOpen(false)}>
        <button className="mobile-menu__close" aria-label="close">×</button>
        {MENU.map((id) =>
          id === MENU_CTA || id === MENU_CTA2 ? (
            <Link key={id} to={hrefOf(id).startsWith("/") ? hrefOf(id) : (id === MENU_CTA ? "/rezerwacja" : "/voucher")} className={`mobile-menu__cta ${id === MENU_CTA2 ? "mobile-menu__cta--dark" : ""}`}
              onClick={(e) => { if (editing) { e.preventDefault(); return; } setOpen(false); window.scrollTo({ top: 0 }); }}><EText id={id} /> ›</Link>
          ) : id === "nav.about" ? (
            <div className="mobile-menu__group" key={id} onClick={(e) => e.stopPropagation()}>
              <span className="mobile-menu__grouplbl"><EText id="nav.about" /></span>
              {ABOUT_ITEMS.map((it) => (
                <Link className="mobile-menu__sub" key={it.key} to={it.to} onClick={() => setOpen(false)}>
                  <EText id={`${it.key}.label`} />
                </Link>
              ))}
            </div>
          ) : hrefOf(id).startsWith("/") && !hrefOf(id).startsWith("//") ? (
            <Link key={id} to={hrefOf(id)} onClick={(e) => { if (editing) { e.preventDefault(); return; } setOpen(false); window.scrollTo({ top: 0 }); }}><EText id={id} /></Link>
          ) : (
            <a key={id} href={hrefOf(id)} onClick={navGuard}><EText id={id} /></a>
          ),
        )}
        <div className="lang" style={{ marginTop: 10 }}>
          <button className={lang === "pl" ? "on" : ""} onClick={(e) => { e.stopPropagation(); setLang("pl"); }}>PL</button>
          <span>/</span>
          <button className={lang === "en" ? "on" : ""} onClick={(e) => { e.stopPropagation(); setLang("en"); }}>EN</button>
        </div>
      </div>
    </>
  );
}

/* "O NAS" hover/focus dropdown with the 3 sub-pages */
function AboutDropdown({ editing }) {
  const [open, setOpen] = useState(false);
  const closeT = useRef(null);
  const openNow = () => { clearTimeout(closeT.current); setOpen(true); };
  const closeSoon = () => { closeT.current = setTimeout(() => setOpen(false), 140); };

  return (
    <div className="nav__drop" onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        className={`nav__droptrig ${open ? "on" : ""}`}
        aria-haspopup="true" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <EText id="nav.about" />
        <svg className="nav__chev" width="9" height="6" viewBox="0 0 9 6" aria-hidden="true">
          <path d="M1 1l3.5 3.5L8 1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className={`nav__panel ${open ? "open" : ""}`} onMouseEnter={openNow} onMouseLeave={closeSoon}>
        {ABOUT_ITEMS.map((it) => (
          <Link
            key={it.key}
            to={it.to}
            className="nav__panel-item"
            onClick={(e) => { if (editing) { e.preventDefault(); return; } setOpen(false); window.scrollTo({ top: 0 }); }}
          >
            <EText id={`${it.key}.pre`} as="span" className="nav__panel-pre" />
            <EText id={`${it.key}.label`} as="span" className="nav__panel-title" />
          </Link>
        ))}
      </div>
    </div>
  );
}
