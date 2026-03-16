import { useMemo } from "react"
import { useTenant } from "@/app/contexts/TenantContext"

/**
 * Piani abbonamento: FREE, PRO, ENTERPRISE.
 * Le feature sono abilitate per piano >= livello richiesto.
 */
export const PLAN_LEVELS = { FREE: 0, PRO: 1, ENTERPRISE: 2 }

/** Feature flag per piano: nome_feature -> livello minimo (FREE=0, PRO=1, ENTERPRISE=2) */
export const PLAN_FEATURES = {
  slot_illimitati_operatore: PLAN_LEVELS.PRO,   // Lato pizzeria: nessun limite slot (sempre true per cassa/operatori)
  slot_illimitati_cliente: PLAN_LEVELS.PRO,    // Cliente online: slot illimitati (FREE = slot limitati da tempistiche)
  report_avanzati: PLAN_LEVELS.PRO,
  multi_punto_vendita: PLAN_LEVELS.ENTERPRISE,
  white_label: PLAN_LEVELS.ENTERPRISE,
}

export function usePlan() {
  const { tenantData } = useTenant()
  const plan = (tenantData?.piano || "FREE").toUpperCase()
  const level = PLAN_LEVELS[plan] ?? PLAN_LEVELS.FREE

  const canUseFeature = useMemo(() => {
    return (featureName) => {
      const required = PLAN_FEATURES[featureName]
      if (required == null) return true
      return level >= required
    }
  }, [level])

  return {
    plan,
    level,
    canUseFeature,
    isFree: level === PLAN_LEVELS.FREE,
    isPro: level >= PLAN_LEVELS.PRO,
    isEnterprise: level >= PLAN_LEVELS.ENTERPRISE,
  }
}
