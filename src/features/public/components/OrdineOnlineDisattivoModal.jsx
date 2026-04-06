export default function OrdineOnlineDisattivoModal({ open, onDismiss, localeNome }) {
  if (!open) return null

  return (
    <div
      className="public-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ordine-online-disattivo-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: "#fff",
          borderRadius: 12,
          padding: "24px 22px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
      >
        <h2 id="ordine-online-disattivo-title" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px", color: "#0f172a" }}>
          Ordine online non disponibile
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.5, color: "#475569" }}>
          {localeNome ? (
            <>
              Al momento <strong>{localeNome}</strong> non accetta ordini dalla vetrina online. Puoi comunque consultare il menù; per ordinare contatta il locale.
            </>
          ) : (
            <>Al momento non sono accettati ordini dalla vetrina online. Puoi comunque consultare il menù; per ordinare contatta il locale.</>
          )}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 8,
            border: "none",
            background: "#0f766e",
            color: "#fff",
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Ho capito
        </button>
      </div>
    </div>
  )
}
