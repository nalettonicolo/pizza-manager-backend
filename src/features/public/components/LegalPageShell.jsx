import { Link } from "react-router-dom";
import "@/styles/legal-doc.css";

const LEGAL_LAST_UPDATED = "22 marzo 2026";

export default function LegalPageShell({ title, children, showUpdated = true, updatedAt }) {
  const dateLabel = updatedAt ?? LEGAL_LAST_UPDATED;
  return (
    <div className="legal-doc-outer">
      <Link to="/" className="legal-doc-back">
        ← Torna alla home
      </Link>
      <article className="legal-doc">
        <h1>{title}</h1>
        {showUpdated ? (
          <p className="legal-doc-updated">Ultimo aggiornamento: {dateLabel}</p>
        ) : null}
        <div className="legal-doc-body">{children}</div>
      </article>
    </div>
  );
}
