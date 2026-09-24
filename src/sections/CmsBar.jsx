import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import EditorToolbar from "../components/EditorToolbar";

/* Floating admin bar (only for a logged-in admin): toggles inline editing + hosts the
   rich-text toolbar that pops up above a text selection. */
export default function CmsBar() {
  const { isAdmin, cmsMode, setCmsMode, logout, admin, can } = useStore();
  if (!isAdmin) return null;
  const mayEdit = can("content");
  return (
    <>
      <div className="cmsbar">
        <span className="cmsbar__who">{admin?.name || admin?.login}</span>
        {mayEdit && (
          <button className={`cmsbar__btn ${cmsMode ? "on" : ""}`} onClick={() => setCmsMode((v) => !v)}>
            {cmsMode ? "✎ Edycja: WŁĄCZONA" : "✎ Edytuj stronę"}
          </button>
        )}
        <Link className="cmsbar__btn" to="/admin">Panel</Link>
        <button className="cmsbar__btn" onClick={logout}>Wyloguj</button>
        {cmsMode && <span className="cmsbar__hint">Kliknij tekst, aby edytować · zaznacz fragment, aby formatować · kliknij zdjęcie/wideo, aby podmienić</span>}
      </div>
      <EditorToolbar />
    </>
  );
}
