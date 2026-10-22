/* YouTube lists typed in the panel: one video per line, "link | title" (the title is optional —
   without it the block asks YouTube for the real one). Any link form works: youtu.be/ID,
   watch?v=ID, /shorts/ID, /embed/ID, /live/ID or the bare 11-character ID. */
const ID = /^[\w-]{11}$/;

export function ytId(s) {
  const v = String(s || "").trim();
  if (ID.test(v)) return v;
  const m = v.match(/(?:youtu\.be\/|[?&]v=|\/(?:shorts|embed|live|v)\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function parseYt(text) {
  const seen = new Set();
  return String(text || "").split("\n").map((line) => {
    const [link, ...rest] = line.split("|");
    const id = ytId(link);
    if (!id || seen.has(id)) return null;
    seen.add(id);
    return { id, title: rest.join("|").trim() };
  }).filter(Boolean);
}

export const ytThumb = (id, size = "mqdefault") => `https://i.ytimg.com/vi_webp/${id}/${size}.webp`;
// youtube-nocookie: no YouTube cookies until the visitor presses play
export const ytEmbed = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;

const titles = new Map();
export function ytTitle(id) {
  if (!titles.has(id)) {
    titles.set(id, fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://youtu.be/${id}`)}&format=json`)
      .then((r) => (r.ok ? r.json() : null)).then((d) => d?.title || "").catch(() => ""));
  }
  return titles.get(id);
}
