/* Small helpers shared by the blog list, the article page and the panel. */
export const postDate = (iso, lang = "pl", opts = { day: "numeric", month: "long", year: "numeric" }) => {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(lang === "en" ? "en-GB" : "pl-PL", opts);
};
export const pad2 = (n) => String(n).padStart(2, "0");
export const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
/** draft (hidden) · scheduled (date still ahead) · live */
export const postState = (p) => (p.visible === false ? "draft" : String(p.published_at || "") > todayIso() ? "scheduled" : "live");
