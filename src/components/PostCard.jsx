import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { postDate, pad2 } from "../lib/blog";

/* One blog post as a card — used by the blog wall and by "read next" under an article. */
export default function PostCard({ p, no, delay = 0 }) {
  const { L, t, lang } = useStore();
  const tag = L(p, "tag");
  return (
    <Link className="bl-card reveal-up" to={`/blog/${p.slug}`} style={{ transitionDelay: `${delay}s` }} onClick={() => window.scrollTo({ top: 0 })}>
      <span className={`bl-card__media ${p.cover ? "" : "bl-card__media--none"}`}>
        {p.cover && <img src={p.cover} alt={p.cover_alt || L(p, "title")} loading="lazy" decoding="async" />}
        {tag && <span className="bl-card__tag">{tag}</span>}
        {no != null && <span className="bl-card__no" aria-hidden="true">{pad2(no)}</span>}
      </span>
      <span className="bl-card__body">
        <span className="bl-meta">
          <time dateTime={p.published_at}>{postDate(p.published_at, lang)}</time>
          {p.reading_min ? <><i /><span>{p.reading_min} {t("blog.min")}</span></> : null}
        </span>
        <span className="bl-card__title">{L(p, "title")}</span>
        {L(p, "excerpt") && <span className="bl-card__exc">{L(p, "excerpt")}</span>}
        <span className="bl-card__read">{t("blog.read")} <i>›</i></span>
      </span>
    </Link>
  );
}
