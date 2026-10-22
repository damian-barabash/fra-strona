import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { EText } from "./Editable";
import { parseYt, ytThumb, ytEmbed, ytTitle } from "../lib/youtube";
import "./youtube.css";

/* Video block: one big player + a playlist when there is more than one video.
   Nothing from YouTube loads until the visitor presses play (only the poster images) — the iframe
   would cost ~1 MB of scripts on every page view.
   `list` is the panel text (one link per line), `accent` recolours the block for themed pages. */
export default function VideoBlock({ list, eyebrowId = "yt.eyebrow", titleId = "yt.title", accent, className = "" }) {
  const { t, raw } = useStore();
  const videos = useMemo(() => parseYt(list), [list]);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [names, setNames] = useState({});
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => { setCur(0); setPlaying(false); }, [list]);

  // titles left empty in the panel come from YouTube
  useEffect(() => {
    videos.filter((v) => !v.title && !names[v.id]).forEach((v) => ytTitle(v.id).then((n) => n && setNames((x) => ({ ...x, [v.id]: n }))));
  }, [videos]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, [videos.length]);

  if (!videos.length) return null;
  const v = videos[Math.min(cur, videos.length - 1)];
  const name = (x) => x.title || names[x.id] || "";
  const channel = raw("soc.youtube").pl?.trim();
  const pick = (i) => { setCur(i); setPlaying(true); };
  const on = inView ? " in" : "";

  return (
    <section ref={ref} className={`yts ${videos.length > 1 ? "yts--list" : "yts--one"} ${className}`} style={accent ? { ["--yt-accent"]: accent } : undefined}>
      <div className="container yts__in">
        <div className={`yts__head reveal-up${on}`}>
          <div>
            <EText id={eyebrowId} as="span" className="eyebrow yts__eyebrow" />
            <EText id={titleId} as="h2" className="h-section yts__title" />
          </div>
          {channel && <a className="yts__channel" href={channel} target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.7 15.1V8.9l5.8 3.1-5.8 3.1Z" /></svg>{t("yt.channel")} ›</a>}
        </div>
        <div className="yts__grid">
          <div className={`yts__stage reveal-scale rv-d1${on}`}>
            {playing
              ? <iframe key={v.id} src={ytEmbed(v.id)} title={name(v) || "YouTube"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
              : (
                <button type="button" className="yts__poster" onClick={() => setPlaying(true)} aria-label={`${t("yt.play")}: ${name(v)}`}>
                  {/* sddefault (640 px) exists for every video; the HD cover does not (404 for some uploads) */}
                  <img key={v.id} src={ytThumb(v.id, "sddefault")} alt="" loading="lazy" />
                  <span className="yts__play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></span>
                  {name(v) && <span className="yts__cap">{name(v)}</span>}
                </button>
              )}
          </div>
          {videos.length > 1 && (
            <div className={`yts__side reveal-up rv-d2${on}`}><ol className="yts__list">
              {videos.map((x, i) => (
                <li key={x.id}>
                  <button type="button" className={`yts__item${i === cur ? " is-on" : ""}`} onClick={() => pick(i)} aria-current={i === cur ? "true" : undefined}>
                    <span className="yts__thumb"><img src={ytThumb(x.id)} alt="" loading="lazy" /><span className="yts__n">{String(i + 1).padStart(2, "0")}</span></span>
                    <span className="yts__name">{name(x)}</span>
                  </button>
                </li>
              ))}
            </ol></div>
          )}
        </div>
      </div>
    </section>
  );
}
