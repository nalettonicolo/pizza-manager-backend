import { useState, useEffect } from "react";
import { getPublicTenantInfo } from "@/features/services/publicService";
import { getIsSaaSClient } from "@/utils/saasHost";
import { getSaaSLegalConfig, getStorefrontLegalConfig } from "@/config/legalEntity";

/**
 * Configurazione titolare / sito per pagine legali (privacy, cookie, termini).
 */
export function useLegalEntity() {
  const saas = getIsSaaSClient();
  const [loading, setLoading] = useState(() => !saas);
  const [config, setConfig] = useState(() => (saas ? getSaaSLegalConfig() : null));

  useEffect(() => {
    if (saas) {
      setConfig(getSaaSLegalConfig());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    getPublicTenantInfo()
      .then((tenant) => {
        if (!cancelled) setConfig(getStorefrontLegalConfig(tenant));
      })
      .catch(() => {
        if (!cancelled) setConfig(getStorefrontLegalConfig(null));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [saas]);

  const isSaaS = getIsSaaSClient();
  return {
    loading,
    isSaaS,
    config: config ?? (isSaaS ? getSaaSLegalConfig() : getStorefrontLegalConfig(null)),
  };
}
