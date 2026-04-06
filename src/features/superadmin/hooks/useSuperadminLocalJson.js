import { useState, useEffect, useCallback } from "react";

const PREFIX = "pm_superadmin_";

/**
 * Persistenza JSON in localStorage per la console Super Admin (nessun tenant, nessun servizio cliente).
 * Utile per prototipi distaccati (es. registratore cassa standalone).
 */
export function useSuperadminLocalJson(keySuffix, initialValue) {
  const storageKey = `${PREFIX}${keySuffix}`;

  const [data, setDataState] = useState(initialValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
  }, [storageKey]);

  const setData = useCallback(
    (updater) => {
      setDataState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {
          console.warn("[useSuperadminLocalJson]", e);
        }
        return next;
      });
    },
    [storageKey],
  );

  return { data, setData, ready, storageKey };
}
