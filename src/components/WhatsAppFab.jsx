import { useStore } from "../lib/store";

/* Floating WhatsApp button (bottom-right, like on the old site). Number lives in the content
   key `wa.number` — editable in the CMS (Menu → not needed; inline edit on any page shows it). */
export default function WhatsAppFab() {
  const { t, isAdmin, cmsMode } = useStore();
  const num = (t("wa.number") || "48732098423").replace(/\D/g, "");
  if (!num) return null;
  return (
    <a className="wa-fab" href={`https://wa.me/${num}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"
      onClick={(e) => isAdmin && cmsMode && e.preventDefault()}>
      <span className="wa-fab__pulse" />
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <path fill="#fff" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-1.9c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.9S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.6l-.4-.3-3.8 1.1 1.2-3.6-.3-.4a10.4 10.4 0 0 1-1.7-5.7C5.1 10 10 5.2 16 5.2s10.9 4.8 10.9 10.6S22 26.4 16 26.4zm5.9-7.9c-.3-.2-1.9-1-2.2-1.1-.3-.1-.5-.2-.7.2-.2.3-.8 1.1-1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2.1-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.4 3.6 5.8 5 .8.3 1.4.6 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.8.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z" />
      </svg>
    </a>
  );
}
