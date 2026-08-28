import { useState, useEffect, useCallback, useRef } from "react";
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

  // I chiamanti passano quasi sempre un letterale inline (es. { righe: [] }): un nuovo oggetto
  // a ogni render. Se initialValue restasse nelle dipendenze dell'effect sotto, la sua identità
  // che cambia ad ogni render lo farebbe ripartire in loop — e nei hook che lo usano (es.
  // useContabilitaFoodcostManualStorage) quel loop cancella ripetutamente il caricamento da
  // Supabase prima che completi, lasciando la pagina bloccata per sempre su "Caricamento…".
  // Il ref cattura sempre il valore più recente senza dover essere nelle dipendenze.
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  useEffect(() => {
    if (!storageKey) {
      setDataState(initialValueRef.current);
      setReady(true);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setDataState(parsed);
      } else {
        setDataState(initialValueRef.current);
      }
    } catch {
      setDataState(initialValueRef.current);
    }
    setReady(true);
  }, [storageKey]);

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
