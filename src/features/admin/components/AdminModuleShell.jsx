/**
 * Guscio comune per moduli Magazzino / Contabilità (titolo, lead, box specifiche).
 */
export default function AdminModuleShell({ title, lead, specTitle = "Specifiche", specChildren, children }) {
  return (
    <div className="admin-module-shell">
      <h1 className="dashboard-page-title">{title}</h1>
      {lead ? (
        <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#64748b", lineHeight: 1.55, maxWidth: 720 }}>
          {lead}
        </p>
      ) : null}
      {specChildren ? (
        <aside
          style={{
            marginBottom: 24,
            padding: "14px 16px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 13,
            color: "#475569",
            lineHeight: 1.55,
          }}
        >
          <strong style={{ display: "block", marginBottom: 8, color: "#0f172a" }}>{specTitle}</strong>
          {specChildren}
        </aside>
      ) : null}
      {children}
    </div>
  );
}
