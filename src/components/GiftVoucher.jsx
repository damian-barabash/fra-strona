/* Holiday voucher (/swieta-2026) drawn on the blank template: the boss's placeholder with its text removed
   (public/assets/swieta/voucher-blank.webp). Name, product and code are typed on top in the red panel, so the
   live preview, the envelope animation and the final CTA all show the voucher the customer is buying.
   Font sizes are container units (cqw) — it scales from a 300 px thumbnail to full width. */
export function GiftVoucher({ name, title, lines = [], code, validTo, lang = "pl", className = "", style }) {
  const L = lang === "en" ? { v: "GIFT VOUCHER", for: "FOR", on: "FOR", code: "VOUCHER NO.", till: "VALID UNTIL" } : { v: "VOUCHER PREZENTOWY", for: "DLA", on: "NA", code: "NR VOUCHERA", till: "WAŻNY DO" };
  const shown = (name || "").trim();
  return (
    <div className={`gvc ${className}`} style={style}>
      <img className="gvc__bg" src="/assets/swieta/voucher-blank.webp" srcSet="/assets/swieta/voucher-blank@900.webp 900w, /assets/swieta/voucher-blank.webp 1800w" sizes="(max-width: 900px) 100vw, 900px" alt="" draggable="false" />
      <div className="gvc__txt">
        <b className="gvc__v">{L.v}</b>
        <span className="gvc__s">{L.for}</span>
        <b className={`gvc__name ${shown ? "" : "is-empty"}`} key={shown}>{shown ? shown.toUpperCase() : "· · ·"}</b>
        <span className="gvc__s">{L.on}</span>
        <span className="gvc__title">{title || (lang === "en" ? "YOUR GIFT" : "TWÓJ PREZENT")}</span>
        <span className="gvc__lines">{lines.filter(Boolean).map((l, i) => <span key={i}>{String(l).toUpperCase()}</span>)}</span>
        {(code || validTo) && <span className="gvc__code">{code ? `${L.code} ${code}` : ""}{code && validTo ? " · " : ""}{validTo ? `${L.till} ${validTo}` : ""}</span>}
      </div>
    </div>
  );
}

/* a Santa hat for the fleet's cut-outs — the tip falls back over the roof and the pompom swings */
export function SantaHat({ className = "", style }) {
  return (
    <svg className={`santa ${className}`} style={style} viewBox="0 0 140 110" aria-hidden="true">
      <defs>
        <linearGradient id="sh-red" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff2b2b" /><stop offset=".55" stopColor="#d10a14" /><stop offset="1" stopColor="#7e0309" /></linearGradient>
        <radialGradient id="sh-fur" cx=".4" cy=".35" r=".8"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe3e8" /></radialGradient>
      </defs>
      <g className="santa__cone">
        <path d="M18 84 C 26 46, 52 14, 86 12 C 104 11, 120 22, 124 42 C 112 32, 98 30, 90 38 C 84 46, 90 62, 104 80 Z" fill="url(#sh-red)" />
        <path d="M40 60 C 54 36, 70 24, 88 20" stroke="rgba(255,255,255,.22)" strokeWidth="5" fill="none" strokeLinecap="round" />
        <g className="santa__pom"><circle cx="122" cy="46" r="13" fill="url(#sh-fur)" /><circle cx="117" cy="41" r="4" fill="#fff" opacity=".9" /></g>
      </g>
      <rect x="8" y="78" width="104" height="24" rx="12" fill="url(#sh-fur)" />
      <path d="M16 86 h88" stroke="#c9ced5" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

/* gold snowflake like the one on the voucher */
export function Flake({ className = "", style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 100 100" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none">
        {[0, 60, 120].map((a) => (
          <g key={a} transform={`rotate(${a} 50 50)`}>
            <path d="M50 6 V94" /><path d="M50 22 l-10 -10 M50 22 l10 -10 M50 78 l-10 10 M50 78 l10 10" /><path d="M50 38 l-8 -6 M50 38 l8 -6 M50 62 l-8 6 M50 62 l8 6" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/* a satin bow (gold edge) for gift-wrapped cards */
export function Bow({ className = "" }) {
  return (
    <svg className={`bow ${className}`} viewBox="0 0 220 120" aria-hidden="true">
      <defs>
        <linearGradient id="bw-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff3434" /><stop offset=".6" stopColor="#c40a14" /><stop offset="1" stopColor="#80040a" /></linearGradient>
        <linearGradient id="bw-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#a8792a" /><stop offset=".5" stopColor="#f6dc8e" /><stop offset="1" stopColor="#a8792a" /></linearGradient>
      </defs>
      <path d="M96 62 C 70 92, 58 112, 44 118 L 30 106 C 50 96, 70 80, 90 58 Z" fill="url(#bw-r)" stroke="url(#bw-g)" strokeWidth="2.5" />
      <path d="M124 62 C 150 92, 162 112, 176 118 L 190 106 C 170 96, 150 80, 130 58 Z" fill="url(#bw-r)" stroke="url(#bw-g)" strokeWidth="2.5" />
      <path d="M106 56 C 70 10, 20 4, 14 30 C 10 54, 52 70, 104 62 Z" fill="url(#bw-r)" stroke="url(#bw-g)" strokeWidth="3" />
      <path d="M114 56 C 150 10, 200 4, 206 30 C 210 54, 168 70, 116 62 Z" fill="url(#bw-r)" stroke="url(#bw-g)" strokeWidth="3" />
      <path d="M40 30 C 56 24, 80 34, 98 54" stroke="rgba(255,255,255,.25)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M180 30 C 164 24, 140 34, 122 54" stroke="rgba(0,0,0,.18)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="96" y="44" width="28" height="28" rx="6" fill="url(#bw-r)" stroke="url(#bw-g)" strokeWidth="3" />
    </svg>
  );
}

export const GiftIcon = () => (
  <svg className="sw-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9C9 3 5 5 7.5 9M12 9c3-6 7-4 4.5 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>
);
