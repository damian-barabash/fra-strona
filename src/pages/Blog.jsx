import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import BlogCta from "../sections/BlogCta";
import PostCard from "../components/PostCard";
import { EText } from "../components/Editable";
import { useRevealOnScroll } from "../lib/hooks";
import { useSeo, breadcrumbs, SITE, abs } from "../lib/seo";
import { postDate } from "../lib/blog";
import "../sections/blog.css";

const PAGE = 9;

/* /blog — the wall of posts written in the panel (tab "Blog"): the newest one large, the rest as
   cards, filtered by category. */
export default function Blog() {
  const { posts, ready, L, t, lang, cmsMode, isAdmin } = useStore();
  const editing = cmsMode && isAdmin;
  const [cat, setCat] = useState("");
  const [shown, setShown] = useState(PAGE);

  useSeo({
    title: "Blog — technika jazdy sportowej, porady i relacje z toru",
    path: "/blog",
    description: "Blog Fastline Racing Academy: technika jazdy sportowej i wyścigowej, porady instruktorów, kulisy szkoleń na torze, relacje z wypraw i nowości z naszej floty.",
    jsonld: [
      { "@type": "Blog", "@id": `${SITE}/blog#blog`, url: `${SITE}/blog`, name: "Blog Fastline Racing Academy", inLanguage: "pl", publisher: { "@id": `${SITE}/#organization` },
        blogPost: posts.slice(0, 30).map((p) => ({ "@type": "BlogPosting", headline: p.title_pl, url: `${SITE}/blog/${p.slug}`, datePublished: p.published_at, ...(p.cover ? { image: abs(p.cover) } : {}) })) },
      breadcrumbs([{ name: "Blog", path: "/blog" }]),
    ],
  });

  // categories in the order of their newest post, with counts
  const cats = useMemo(() => {
    const m = new Map();
    posts.forEach((p) => { const k = (p.tag_pl || "").trim(); if (k) m.set(k, { key: k, label: L(p, "tag") || k, n: (m.get(k)?.n || 0) + 1 }); });
    return [...m.values()];
  }, [posts, L]);
  const list = cat ? posts.filter((p) => (p.tag_pl || "").trim() === cat) : posts;
  const feat = !cat ? list[0] : null;
  const rest = feat ? list.slice(1) : list;
  const visible = rest.slice(0, shown);

  useRevealOnScroll([posts.length, cat, shown]);
  const pick = (k) => { setCat(k); setShown(PAGE); };

  return (
    <div className={`bl ${editing ? "cms-on" : ""}`}>
      <ScrollProgress />
      <Nav />
      <main>
        <header className="bl-head">
          <div className="bl-head__flag" />
          <div className="bl-head__streaks" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} style={{ ["--i"]: i }} />)}</div>
          <span className="bl-head__ghost" aria-hidden="true">BLOG</span>
          <div className="container bl-head__inner">
            <EText id="blog.eyebrow" as="span" className="eyebrow reveal-up" />
            <EText id="blog.title" as="h1" className="h-display bl-head__title reveal-up rv-d1" />
            <EText id="blog.intro" as="p" className="lead bl-head__sub reveal-up rv-d2" multiline />
            {posts.length > 0 && (
              <div className="bl-head__stats reveal-up rv-d3">
                <div className="bl-stat"><b>{posts.length}</b><i>{t("blog.count")}</i></div>
                {cats.length > 1 && <div className="bl-stat"><b>{cats.length}</b><i>{t("blog.cats")}</i></div>}
                <div className="bl-stat bl-stat--txt"><b>{postDate(posts[0].published_at, lang)}</b><i>{t("blog.newest")}</i></div>
              </div>
            )}
          </div>
        </header>

        <section className="section bl-wall">
          <div className="tex" />
          <div className="container">
            {ready && posts.length === 0 && <div className="bl-empty reveal-up"><b>00</b>{t("blog.empty")}</div>}

            {feat && (
              <article className="bl-feat reveal-up">
                <Link className="bl-feat__media" to={`/blog/${feat.slug}`} onClick={() => window.scrollTo({ top: 0 })} aria-label={L(feat, "title")}>
                  {feat.cover && <img src={feat.cover} alt={feat.cover_alt || L(feat, "title")} decoding="async" />}
                  <span className="bl-feat__flag">{t("blog.latest")}</span>
                </Link>
                <div className="bl-feat__body">
                  <span className="bl-feat__no" aria-hidden="true">01</span>
                  <span className="bl-meta">
                    {L(feat, "tag") && <span className="bl-meta__tag">{L(feat, "tag")}</span>}
                    {L(feat, "tag") && <i />}
                    <time dateTime={feat.published_at}>{postDate(feat.published_at, lang)}</time>
                    {feat.reading_min ? <><i /><span>{feat.reading_min} {t("blog.min")}</span></> : null}
                  </span>
                  <h2 className="bl-feat__title"><Link to={`/blog/${feat.slug}`} onClick={() => window.scrollTo({ top: 0 })}>{L(feat, "title")}</Link></h2>
                  {L(feat, "excerpt") && <p className="bl-feat__exc">{L(feat, "excerpt")}</p>}
                  <Link className="btn btn--red" to={`/blog/${feat.slug}`} onClick={() => window.scrollTo({ top: 0 })}>{t("blog.read")} <span className="btn__arrow">›</span></Link>
                </div>
              </article>
            )}

            {cats.length > 1 && (
              <div className="bl-filter reveal-up" role="tablist" aria-label="Kategorie">
                <span className="bl-filter__lbl">FILTR</span>
                <button type="button" role="tab" aria-selected={!cat} className={`bl-chip ${!cat ? "on" : ""}`} onClick={() => pick("")}>{t("blog.all")}<sup>{posts.length}</sup></button>
                {cats.map((c) => <button type="button" role="tab" aria-selected={cat === c.key} key={c.key} className={`bl-chip ${cat === c.key ? "on" : ""}`} onClick={() => pick(c.key)}>{c.label}<sup>{c.n}</sup></button>)}
              </div>
            )}

            {visible.length > 0 && (
              <div className="bl-grid">
                {visible.map((p, i) => <PostCard key={p.id} p={p} no={i + (feat ? 2 : 1)} delay={(i % 3) * 0.07} />)}
              </div>
            )}
            {cat && !list.length && <div className="bl-empty">{t("blog.emptyCat")}</div>}
            {rest.length > shown && (
              <div className="bl-more"><button type="button" className="btn btn--dark" onClick={() => setShown((n) => n + PAGE)}>{t("blog.more")} <span className="btn__arrow">›</span></button></div>
            )}
          </div>
        </section>

        <BlogCta />
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}
