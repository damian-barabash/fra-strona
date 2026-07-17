import { Link } from "react-router-dom";
import { useStore } from "../lib/store";

export default function CmsBar() {
  const { isAdmin, cmsMode, setCmsMode, logout, lang } = useStore();
  if (!isAdmin) return null;
  return (
    <div style={bar}>
      <span style={{ font: "800 13px var(--font-display)", letterSpacing: ".08em", color: "#fff" }}>
        FRA · CMS
      </span>
      <button style={cmsMode ? btnOn : btn} onClick={() => setCmsMode(!cmsMode)}>
        {cmsMode ? "● Edycja PL" : "Podgląd"}
      </button>
      {cmsMode && lang === "en" && (
        <span style={{ font: "600 11px var(--font-body)", color: "#ffd24a" }}>
          Edytujesz źródło PL — EN tłumaczy się automatycznie
        </span>
      )}
      <Link to="/admin" style={btn}>Panel</Link>
      <button style={btn} onClick={logout}>Wyloguj</button>
    </div>
  );
}

const bar = {
  position: "fixed", left: "50%", bottom: 18, transform: "translateX(-50%)", zIndex: 200,
  display: "flex", alignItems: "center", gap: 12, padding: "9px 14px",
  background: "rgba(13,13,13,.94)", backdropFilter: "blur(10px)", borderRadius: 999,
  boxShadow: "0 10px 40px rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.12)",
};
const btn = {
  font: "700 12px var(--font-display)", letterSpacing: ".06em", textTransform: "uppercase",
  color: "#fff", background: "rgba(255,255,255,.1)", padding: "8px 14px", borderRadius: 999,
  cursor: "pointer", textDecoration: "none",
};
const btnOn = { ...btn, background: "var(--red)" };
