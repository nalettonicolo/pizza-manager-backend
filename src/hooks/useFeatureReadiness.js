import { useAuth } from "@/app/contexts/AuthContext"
import { isFeatureVisibleForRuolo, featureReadinessInfo } from "@/config/featureReadiness"

/**
 * Per gating leggero dentro una pagina (un controllo, una sezione) invece di un'intera route —
 * usa ComingSoonGate.jsx quando serve sostituire tutto il contenuto di una pagina.
 * @param {string} featureKey
 * @returns {{ visible: boolean, info: { label: string, motivo: string, stato: string } | null }}
 */
export function useFeatureReadiness(featureKey) {
  const { ruolo } = useAuth()
  return {
    visible: isFeatureVisibleForRuolo(featureKey, ruolo),
    info: featureReadinessInfo(featureKey),
  }
}
