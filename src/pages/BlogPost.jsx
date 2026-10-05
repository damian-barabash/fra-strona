import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import BlogCta from "../sections/BlogCta";
import PostCard from "../components/PostCard";
import { useLightbox } from "../components/Lightbox";
import { useRevealOnScroll } from "../lib/hooks";
import { useSeo, breadcrumbs, SITE, abs, clip } from "../lib/seo";
import { sanitizeRich, plainText, wordCount } from "../lib/richtext";
import { postDate, postState } from "../lib/blog";
import "../sections/richtext.css";
import "../sections/blog.css";

const SHARE = [
  { k: "facebook", l: "Facebook", href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${u}`, d: "M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.6C16.7 2.5 15.7 2.4 14.6 2.4c-2.4 0-4 1.5-4 4.1v2H8v3.3h2.6V21H14v-9.2h2.7l.4-3.3z" },
  { k: "linkedin", l: "LinkedIn", href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, d: "M4.5 9h3.3v11H4.5zM6.1 3.6a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM10 9h3.1v1.5h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V20h-3.3v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V20H10z" },
  { k: "x", l: "X", href: (u, t) => `https://twitter.com/intent/tweet?url=${u}&text=${t}`, d: "M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.2 4.7H5.4z" },
  { k: "whatsapp", l: "WhatsApp", href: (u, t) => `https://wa.me/?text=${t}%20${u}`, d: "M12 2.5a9.4 9.4 0 0 0-8.1 14.2L2.5 21.5l4.9-1.3A9.4 9.4 0 1 0 12 2.5zm0 17.1c-1.4 0-2.8-.4-4-1.1l-.300-.200-2.9.800.8-2.8-.200-.300a7.7 7.7 0 1 1 6.6 3.6zm4.2-5.8c-.200-.100-1.4-.700-1.6-.800s-.400-.100-.500.1-.600.8-.700.9-.300.2-.500.1a6.3 6.3 0 0 1-3.1-2.7c-.200-.400.2-.400.6-1.2.100-.100 0-.300 0-.400l-.700-1.7c-.200-.500-.400-.400-.500-.400h-.500c-.200 0-.400.1-.600.3a2.6 2.6 0 0 0-.800 1.9c0 1.1.800 2.2.9 2.4s1.6 2.5 4 3.5c1.5.600 2 .700 2.8.600.4-.100 1.4-.600 1.6-1.1s.200-1 .100-1.1z" },
];
const COPY_D = "M9 9V4h11v11h-5v5H4V9zm2 0h4v4h3V6h-7zM6 11v7h7v-7z";

/* /blog/:slug — one post. The cards of all posts are in the store; the article body is fetched with
   the page. A signed-in admin also sees drafts and scheduled posts (with a notice). */
export default function BlogPost() {
  const { slug } = useParams();
  const { posts, getters, loadPost, ready, L, t, lang, isAdmin, cmsMode } = useStore();
  const navigate = useNavigate();
  const openLightbox = useLightbox();
  const editing = cmsMode && isAdmin;
  const bodyRef = useRef(null);
  const [asked, setAsked] = useState("");      // slug whose full row has been requested and answered
  const [copied, setCopied] = useState(false);

  const p = getters.posts.find((x) => x.slug === slug) || null;
  const live = !!p && posts.some((x) => x.id === p.id);
  const full = !!p && p.body_pl != null;

  useEffect(() => { window.scrollTo({ top: 0 }); setCopied(false); }, [slug]);
  useEffect(() => {
    if (full) { setAsked(slug); return; }
    let off = false;
    loadPost(slug).then(() => { if (!off) setAsked(slug); });
    return () => { off = true; };
  }, [slug, full, loadPost]);

  const missing = !p && ready && asked === slug;
  const url = `${SITE}/blog/${slug}`;
  const body = useMemo(() => sanitizeRich(L(p, "body")), [p, L]);
  const descr = p ? (p.seo_desc || p.excerpt_pl || clip(plainText(p.body_pl), 200)) : "";

  useSeo({
    title: p ? (p.seo_title || p.title_pl) : missing ? "Nie ma takiego wpisu" : "Blog",
    path: `/blog/${slug}`,
    description: descr,
    image: p?.cover,
    type: p ? "article" : "website",
    noindex: missing || (!!p && !live),
    article: p && live ? { published: p.published_at, modified: (p.updated_at || "").slice(0, 19) || p.published_at, section: p.tag_pl, author: p.author || "Fastline Racing Academy" } : null,
    jsonld: p && live ? [
      { "@type": "BlogPosting", "@id": `${url}#article`, url, headline: clip(p.title_pl, 110), description: clip(descr, 300), inLanguage: "pl",
        ...(p.cover ? { image: [abs(p.cover)] } : {}),
        datePublished: p.published_at, dateModified: (p.updated_at || p.published_at || "").slice(0, 10),
        author: p.author ? { "@type": "Person", name: p.author } : { "@id": `${SITE}/#organization` },
        publisher: { "@id": `${SITE}/#organization` }, mainEntityOfPage: { "@id": `${url}#webpage` }, isPartOf: { "@id": `${SITE}/blog#blog` },
        ...(p.tag_pl ? { articleSection: p.tag_pl } : {}), ...(full ? { wordCount: wordCount(p.body_pl) } : {}) },
      breadcrumbs([{ name: "Blog", path: "/blog" }, { name: p.title_pl, path: `/blog/${p.slug}` }]),
    ] : undefined,
  });

  // neighbours in time + three more to read (same category first)
  const idx = p ? posts.findIndex((x) => x.id === p.id) : -1;
  const newer = idx > 0 ? posts[idx - 1] : null;
  const older = idx >= 0 && idx < posts.length - 1 ? posts[idx + 1] : null;
  const also = useMemo(() => {
    if (!p) return [];
    const others = posts.filter((x) => x.id !== p.id);
    return [...others.filter((x) => x.tag_pl && x.tag_pl === p.tag_pl), ...others.filter((x) => !x.tag_pl || x.tag_pl !== p.tag_pl)].slice(0, 3);
  }, [posts, p]);

  // every block of the article slides in as it is reached
  useEffect(() => {
    const root = bodyRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const els = [...root.children];
    els.forEach((el) => el.classList.add("reveal-up"));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.06, rootMargin: "0px 0px -4% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [body]);
  useRevealOnScroll([p?.id, also.length, full]);

  // links inside the article: site pages open through the router (curtain), photos open full screen
  const onBodyClick = (e) => {
    const a = e.target.closest?.("a[href]");
    if (a) {
      const href = a.getAttribute("href");
      if (href.startsWith("/") && !href.startsWith("//") && a.target !== "_blank" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); navigate(href); window.scrollTo({ top: 0 }); }
      return;
    }
    const img = e.target.closest?.("img");
    if (img && bodyRef.current) {
      const all = [...bodyRef.current.querySelectorAll("img")].map((x) => x.currentSrc || x.src);
      openLightbox(all, all.indexOf(img.currentSrc || img.src));
    }
  };

  const enc = encodeURIComponent(url), encT = encodeURIComponent(p ? L(p, "title") : "");
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch { /* clipboard blocked */ } };
  const shareBtns = () => (
    <>
      {SHARE.map((s) => (
        <a key={s.k} className="bp-share" href={s.href(enc, encT)} target="_blank" rel="noopener noreferrer" aria-label={`${t("blog.share")}: ${s.l}`} title={s.l}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={s.d} /></svg>
        </a>
      ))}
      <button type="button" className={`bp-share ${copied ? "bp-share--ok" : ""}`} onClick={copy} aria-label={t("blog.copy")} title={copied ? t("blog.copied") : t("blog.copy")}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={copied ? "M9.5 16.2L5.3 12l-1.4 1.4 5.6 5.6 11-11L19.1 6.6z" : COPY_D} /></svg>
      </button>
    </>
  );

  if (!p) {
    return (
      <div className="bp">
        <Nav />
        <main>
          {missing ? (
            <section className="bp-404">
              <div><b aria-hidden="true">404</b><h1>{t("blog.notFound")}</h1><p>{t("blog.notFoundText")}</p>
                <Link className="btn btn--red" to="/blog" onClick={() => window.scrollTo({ top: 0 })}>{t("blog.back")} <span className="btn__arrow">›</span></Link></div>
            </section>
          ) : <div style={{ minHeight: "80vh", background: "var(--ink)" }} />}
        </main>
        <Footer />
      </div>
    );
  }

  const tag = L(p, "tag");
  const state = postState(p);
  return (
    <div className={`bp ${editing ? "cms-on" : ""}`}>
      <ScrollProgress />
      <Nav />
      <main>
        <article>
          <header className={`bp-hero ${p.cover ? "" : "bp-hero--plain"}`}>
            {p.cover
              ? <><div className="bp-hero__media"><img src={p.cover} alt={p.cover_alt || L(p, "title")} fetchpriority="high" decoding="async" /></div><div className="bp-hero__scrim" /></>
              : <div className="bp-hero__flag" />}
            <div className="container bp-hero__in">
              <nav className="bp-crumbs reveal-up" aria-label="Breadcrumb">
                <Link to="/" onClick={() => window.scrollTo({ top: 0 })}>Fastline</Link><i>›</i>
                <Link to="/blog" onClick={() => window.scrollTo({ top: 0 })}>{t("nav.blog")}</Link>
              </nav>
              {tag && <span className="bp-hero__tag reveal-up rv-d1">{tag}</span>}
              <h1 className="bp-hero__title reveal-up rv-d1">{L(p, "title")}</h1>
              <div className="bp-hero__meta reveal-up rv-d2">
                <time dateTime={p.published_at}>{postDate(p.published_at, lang)}</time>
                {p.reading_min ? <><i /><span>{p.reading_min} {t("blog.min")}</span></> : null}
                <i /><span>{p.author || t("blog.by")}</span>
              </div>
            </div>
          </header>
          {state !== "live" && <div className="bp-draft"><div className="container">{t("blog.draft")}{state === "scheduled" ? ` (${postDate(p.published_at, lang)})` : ""}</div></div>}

          <div className="bp-wrap">
            <div className="tex" />
            <div className="container bp-layout">
              <aside className="bp-side reveal-left" aria-label={t("blog.share")}>
                <span className="bp-side__lbl">{t("blog.share")}</span>
                {shareBtns()}
              </aside>
              <div className="bp-main">
                {L(p, "excerpt") && <p className="bp-lead reveal-up">{L(p, "excerpt")}</p>}
                {full
                  ? <div ref={bodyRef} className="rt bp-body" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: body }} />
                  : <div className="bp-skel" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} />)}</div>}
                <footer className="bp-foot reveal-up">
                  <Link className="bp-back" to="/blog" onClick={() => window.scrollTo({ top: 0 })}><i>‹</i> {t("blog.back")}</Link>
                  <div className="bp-foot__share">{shareBtns()}</div>
                </footer>
              </div>
            </div>
          </div>
        </article>

        {(newer || older) && (
          <nav className="bp-nav" aria-label="Wpisy">
            {older
              ? <Link className="bp-nav__item reveal-left" to={`/blog/${older.slug}`} onClick={() => window.scrollTo({ top: 0 })}><span className="bp-nav__lbl">‹ {t("blog.prev")}</span><span className="bp-nav__ttl">{L(older, "title")}</span></Link>
              : <span className="bp-nav__item bp-nav__item--none" />}
            {newer
              ? <Link className="bp-nav__item reveal-right" to={`/blog/${newer.slug}`} onClick={() => window.scrollTo({ top: 0 })}><span className="bp-nav__lbl">{t("blog.next")} ›</span><span className="bp-nav__ttl">{L(newer, "title")}</span></Link>
              : <span className="bp-nav__item bp-nav__item--none" />}
          </nav>
        )}

        {also.length > 0 && (
          <section className="section section--paper bp-also">
            <div className="container">
              <header className="bp-also__head">
                <span className="eyebrow reveal-up">{t("blog.also")}</span>
                <h2 className="h-section reveal-up rv-d1">{t("blog.alsoTitle")}</h2>
              </header>
              <div className="bl-grid">{also.map((x, i) => <PostCard key={x.id} p={x} delay={i * 0.07} />)}</div>
            </div>
          </section>
        )}

        <BlogCta />
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}
