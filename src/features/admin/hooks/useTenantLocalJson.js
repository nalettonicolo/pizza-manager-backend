import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/app/contexts/TenantContext";

export function newLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Persistenza JSON in localStorage, isolata per tenant (MVP fino a tabelle Supabase).
 */
export function useTenantLocalJson(keySuffix, initialValue) {
  const { tenantId } = useTenant();
  const storageKey = tenantId ? `pm_admin_${tenantId}_${keySuffix}` : null;

  const [data, setDataState] = useState(initialValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!storageKey) {
      setDataState(initialValue);
      setReady(true);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setDataState(parsed);
      } else {
        setDataState(initialValue);
      }
    } catch {
      setDataState(initialValue);
    }
    setReady(true);
  }, [storageKey, initialValue]);

  const setData = useCallback(
    (updater) => {
      setDataState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch (e) {
            console.warn("[useTenantLocalJson]", e);
          }
        }
        return next;
      });
    },
    [storageKey],
  );

  return { data, setData, ready, storageKey };
}
