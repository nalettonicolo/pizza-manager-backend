import { useState, useEffect, useCallback, useRef } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";
import {
  contabilitaFattureTableReachable,
  listContabilitaFatture,
  insertContabilitaFattura,
  deleteContabilitaFattura,
} from "@/features/admin/services/adminService";

/** Fatture passive: Supabase se tabella disponibile, altrimenti localStorage tenant. */
export function useContabilitaFattureStorage() {
  const { tenantId } = useTenant();
  const { data: localData, setData: setLocalData, ready: localReady } = useTenantLocalJson("contabilita_fatture", {
    fatture: [],
  });
  const [fatture, setFatture] = useState([]);
  const [backend, setBackend] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const probedRef = useRef(false);

  useEffect(() => {
    probedRef.current = false;
    setReady(false);
    setBackend(null);
    setFatture([]);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !localReady || probedRef.current) return;
    probedRef.current = true;
    let cancelled = false;
    setLoadErr(null);
    (async () => {
      try {
        const dbOk = await contabilitaFattureTableReachable(tenantId);
        if (cancelled) return;
        if (dbOk) {
          const rows = await listContabilitaFatture(tenantId);
          if (cancelled) return;
          setFatture(rows);
          setBackend("db");
        } else {
          setFatture(localData.fatture || []);
          setBackend("local");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e?.message || "Errore storage fatture");
          setFatture(localData.fatture || []);
          setBackend("local");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, localReady, localData.fatture]);

  const addFattura = useCallback(
    async (row) => {
      const uiRow = { ...row, id: row.id || newLocalId() };
      if (backend === "db" && tenantId) {
        const saved = await insertContabilitaFattura(tenantId, uiRow);
        setFatture((prev) => [saved, ...prev]);
        return saved;
      }
      setLocalData((d) => ({ ...d, fatture: [uiRow, ...(d.fatture || [])] }));
      setFatture((prev) => [uiRow, ...prev]);
      return uiRow;
    },
    [backend, tenantId, setLocalData],
  );

  const removeFattura = useCallback(
    async (id) => {
      if (backend === "db" && tenantId) {
        await deleteContabilitaFattura(id);
      } else {
        setLocalData((d) => ({ ...d, fatture: (d.fatture || []).filter((r) => r.id !== id) }));
      }
      setFatture((prev) => prev.filter((r) => r.id !== id));
    },
    [backend, tenantId, setLocalData],
  );

  return { fatture, addFattura, removeFattura, ready, backend, loadErr };
}
