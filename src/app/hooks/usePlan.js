import { useMemo } from "react"
import { useTenant } from "@/app/contexts/TenantContext"

/**
 * Piani: TRIAL (prova 7 gg), PRO, ENTERPRISE. FREE solo legacy DB.
 * Livello per feature gate: TRIAL e PRO stesso livello funzionale in prova.
 */
export const PLAN_LEVELS = { FREE: 1, TRIAL: 1, PRO: 1, ENTERPRISE: 2 }

/** Feature flag: nome_feature -> livello minimo */
export const PLAN_FEATURES = {
  slot_illimitati_operatore: PLAN_LEVELS.PRO,
  slot_illimitati_cliente: PLAN_LEVELS.PRO,
  report_avanzati: PLAN_LEVELS.PRO,
  multi_punto_vendita: PLAN_LEVELS.ENTERPRISE,
  white_label: PLAN_LEVELS.ENTERPRISE,
}

export function usePlan() {
  const { tenantData } = useTenant()
  const plan = (tenantData?.piano || "TRIAL").toUpperCase()
  const level = PLAN_LEVELS[plan] ?? PLAN_LEVELS.TRIAL

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
    isFree: plan === "FREE",
    isTrial: plan === "TRIAL",
    isPro: plan === "PRO" || plan === "TRIAL" || plan === "FREE",
    isEnterprise: plan === "ENTERPRISE",
  }
}
