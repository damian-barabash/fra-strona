import { useStore } from "../lib/store";
import Nav from "../sections/Nav";
import Footer from "../sections/Footer";
import CmsBar from "../sections/CmsBar";
import ScrollProgress from "../sections/ScrollProgress";
import { EText } from "../components/Editable";
import { useReveal, useRevealOnScroll } from "../lib/hooks";
import { useSeo, breadcrumbs, SITE, clip } from "../lib/seo";

// asymmetric bento pattern → an "unusual" broken-grid press wall
const SPAN = ["xl", "sm", "tall", "sm", "wide", "sm", "sm", "tall", "wide", "sm", "xl", "sm", "sm", "wide", "sm", "tall"];
const pad2 = (n) => String(n + 1).padStart(2, "0");

export default function MediaPage() {
  const { mediaList, L, t, cmsMode, isAdmin } = useStore();
  useSeo({ title: "Media o nas", path: "/media-o-nas", description: "Fastline Racing Academy w mediach — publikacje, relacje i materiały wideo o szkoleniach na torze i zespole Fastline Racing.", jsonld: breadcrumbs([{ name: "Media o nas", path: "/media-o-nas" }]) });
  const editing = cmsMode && isAdmin;
  const [ref, inView] = useReveal();
  useRevealOnScroll([mediaList.length]);

  return (
    <div className={editing ? "cms-on" : ""}>
      <ScrollProgress />
      <Nav />
      <main>
        <section className="section mwall" ref={ref}>
          <div className="tex" />
          <div className="container">
            <header className="mwall__head">
              <EText id="media.eyebrow" as="span" className="eyebrow reveal-up" />
              <EText id="media.title" as="h1" className="h-display mwall__title reveal-up rv-d1" />
              <EText id="media.intro" as="p" className="lead mwall__intro reveal-up rv-d2" multiline />
            </header>

            {mediaList.length === 0 ? (
              <div className="mwall__empty">{t("media.empty")}</div>
            ) : (
              <div className={`mwall__grid ${inView ? "in" : ""}`}>
                {mediaList.map((m, i) => {
                  const size = SPAN[i % SPAN.length];
                  const title = L(m, "title");
                  const tag = L(m, "tag");
                  const excerpt = L(m, "excerpt");
                  const noimg = !m.photo;
                  return (
                    <a
                      key={m.id}
                      className={`mwall__card m-${size} ${noimg ? "mwall__card--noimg" : ""}`}
                      href={m.url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => { if (editing || !m.url) e.preventDefault(); }}
                      style={{ transitionDelay: `${(i % 6) * 0.05}s` }}
                    >
                      {!noimg && <span className="mwall__img" style={{ backgroundImage: `url(${m.photo})` }} />}
                      <span className="mwall__grad" />
                      <span className="mwall__no">{pad2(i)}</span>
                      {tag && <span className="mwall__tag">{tag}</span>}
                      <span className="mwall__body">
                        <span className="mwall__src">
                          {m.source}{m.date ? ` · ${m.date}` : ""}
                        </span>
                        <span className="mwall__ttl">{title}</span>
                        {size === "xl" && excerpt && <span className="mwall__exc">{excerpt}</span>}
                        <span className="mwall__read">{t("media.readmore")} <i>↗</i></span>
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
      <CmsBar />
    </div>
  );
}
