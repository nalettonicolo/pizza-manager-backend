import { useAuth } from "@/app/contexts/AuthContext"
import { isFeatureVisibleForRuolo, featureReadinessInfo } from "@/config/featureReadiness"

/**
 * Mostra `children` così come sono al Super Admin (continua a vedere/testare tutto). Per
 * qualunque altro ruolo (tenant), se la funzionalità è segnata "beta" in featureReadiness.js
 * mostra un messaggio "Presto disponibile" al posto del contenuto vero, invece di esporre una
 * funzionalità non ancora garantita a un cliente pagante.
 *
 * @param {{ featureKey: string, children: React.ReactNode }} props
 */
export default function ComingSoonGate({ featureKey, children }) {
  const { ruolo } = useAuth()
  if (isFeatureVisibleForRuolo(featureKey, ruolo)) return children

  const info = featureReadinessInfo(featureKey)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "40vh",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 440,
          textAlign: "center",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          padding: "32px 28px",
          boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
        }}
      >
        <div style={{ fontSize: 34, marginBottom: 10 }} aria-hidden>
          🔜
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
          {info?.label || "Funzionalità"} — presto disponibile
        </h2>
        <p style={{ margin: 0, fontSize: 13.5, color: "#64748b", lineHeight: 1.55 }}>
          {info?.motivo ||
            "Questa funzionalità è ancora in verifica: la stiamo completando prima di renderla disponibile."}
        </p>
      </div>
    </div>
  )
}
