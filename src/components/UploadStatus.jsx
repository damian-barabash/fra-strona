import { fmtBytes } from "../lib/api";

/* Little status chip shown next to every media upload: converting → uploading → done (with sizes). */
export default function UploadStatus({ st }) {
  if (!st) return null;
  const cls = `upst upst--${st.stage}`;
  if (st.stage === "convert") return <span className={cls}><i className="upst__spin" />Konwersja do WebP… <small>{fmtBytes(st.from)}</small></span>;
  if (st.stage === "upload") return <span className={cls}><i className="upst__spin" />Wysyłanie… <small>{st.webp ? `WebP ${fmtBytes(st.to)}` : fmtBytes(st.to)}</small></span>;
  if (st.stage === "error") return <span className={cls}>✕ Nie udało się: {st.error || "błąd"}</span>;
  return (
    <span className={cls}>
      ✓ {st.webp ? "Zapisano jako WebP" : "Wgrano"} <small>{fmtBytes(st.from)} → {fmtBytes(st.to)}{st.webp && st.from > st.to ? ` (−${Math.round((1 - st.to / st.from) * 100)}%)` : ""}</small>
    </span>
  );
}
