import { useStore } from "../lib/store";

/* The real Fastline Racing Academy social profiles. URLs live in content keys `soc.*`
   (panel → Menu); an empty key hides the icon. Inline SVG so every icon shares one style. */
const ICONS = {
  facebook: <svg viewBox="0 0 24 24"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.2H7.4V14h2.7v8z" /></svg>,
  instagram: <svg viewBox="0 0 24 24"><path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM12 3.7c2.7 0 3 0 4.1.1 2.8.1 4.1 1.4 4.2 4.2.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c-.1 2.8-1.4 4.1-4.2 4.2-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-2.8-.1-4.1-1.4-4.2-4.2-.1-1.1-.1-1.4-.1-4.1s0-3 .1-4.1C3.8 5.2 5.1 3.9 7.9 3.8c1.1-.1 1.4-.1 4.1-.1zM12 2c-2.7 0-3.1 0-4.1.1C4.1 2.2 2.2 4.1 2.1 7.9 2 8.9 2 9.3 2 12s0 3.1.1 4.1c.2 3.8 2.1 5.7 5.8 5.8 1.1.1 1.4.1 4.1.1s3.1 0 4.1-.1c3.8-.2 5.7-2.1 5.8-5.8.1-1.1.1-1.4.1-4.1s0-3.1-.1-4.1c-.2-3.8-2.1-5.7-5.8-5.8C15.1 2 14.7 2 12 2z" /></svg>,
  linkedin: <svg viewBox="0 0 24 24"><path d="M6.9 8.5H3.6V21h3.3zM5.3 3a1.9 1.9 0 1 0 0 3.9 1.9 1.9 0 0 0 0-3.9zM21 13.4c0-3.5-1.9-5.2-4.4-5.2-2 0-2.9 1.1-3.4 1.9V8.5H9.9V21h3.3v-6.6c0-1.7.3-3.4 2.5-3.4 2.1 0 2.1 2 2.1 3.5V21H21z" /></svg>,
  youtube: <svg viewBox="0 0 24 24"><path d="M23 7.3a2.9 2.9 0 0 0-2-2C19.2 4.8 12 4.8 12 4.8s-7.2 0-9 .5a2.9 2.9 0 0 0-2 2C.5 9.1.5 12 .5 12s0 2.9.5 4.7a2.9 2.9 0 0 0 2 2c1.8.5 9 .5 9 .5s7.2 0 9-.5a2.9 2.9 0 0 0 2-2c.5-1.8.5-4.7.5-4.7s0-2.9-.5-4.7zM9.8 15.1V8.9l6 3.1z" /></svg>,
  tiktok: <svg viewBox="0 0 24 24"><path d="M16.6 5.8a4.3 4.3 0 0 1-1-3.3h-3.4v13.4a2.8 2.8 0 1 1-2-2.7V9.7a6.2 6.2 0 1 0 5.4 6.2V9.2a7.6 7.6 0 0 0 4.4 1.4V7.2a4.3 4.3 0 0 1-3.4-1.4z" /></svg>,
};
export const SOCIAL_KEYS = Object.keys(ICONS);

export default function Social({ className = "" }) {
  const { t } = useStore();
  const items = SOCIAL_KEYS.map((k) => ({ k, href: (t(`soc.${k}`) || "").trim() })).filter((x) => /^https?:\/\//.test(x.href));
  if (!items.length) return null;
  return (
    <div className={`social ${className}`}>
      {items.map((s) => (
        <a key={s.k} href={s.href} target="_blank" rel="noreferrer" aria-label={s.k} title={s.k}>{ICONS[s.k]}</a>
      ))}
    </div>
  );
}
