import { useState, useEffect, useCallback, useRef } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";
import {
  contabilitaFoodcostTableReachable,
  listContabilitaFoodcostManuali,
  insertContabilitaFoodcostManuale,
  deleteContabilitaFoodcostManuale,
} from "@/features/admin/services/adminService";

/** Righe food cost manuali: Supabase se tabella disponibile, altrimenti localStorage. */
export function useContabilitaFoodcostManualStorage() {
  const { tenantId } = useTenant();
  const { data: localData, setData: setLocalData, ready: localReady } = useTenantLocalJson("contabilita_foodcost", {
    righe: [],
  });
  const [righe, setRighe] = useState([]);
  const [backend, setBackend] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const probedRef = useRef(false);

  useEffect(() => {
    probedRef.current = false;
    setReady(false);
    setBackend(null);
    setRighe([]);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !localReady || probedRef.current) return;
    probedRef.current = true;
    let cancelled = false;
    setLoadErr(null);
    (async () => {
      try {
        const dbOk = await contabilitaFoodcostTableReachable(tenantId);
        if (cancelled) return;
        if (dbOk) {
          const rows = await listContabilitaFoodcostManuali(tenantId);
          if (cancelled) return;
          setRighe(rows);
          setBackend("db");
        } else {
          setRighe(localData.righe || []);
          setBackend("local");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e?.message || "Errore storage food cost");
          setRighe(localData.righe || []);
          setBackend("local");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, localReady, localData.righe]);

  const addRiga = useCallback(
    async (row) => {
      const uiRow = { ...row, id: row.id || newLocalId() };
      if (backend === "db" && tenantId) {
        const saved = await insertContabilitaFoodcostManuale(tenantId, uiRow);
        setRighe((prev) => [saved, ...prev]);
        return saved;
      }
      setLocalData((d) => ({ ...d, righe: [uiRow, ...(d.righe || [])] }));
      setRighe((prev) => [uiRow, ...prev]);
      return uiRow;
    },
    [backend, tenantId, setLocalData],
  );

  const removeRiga = useCallback(
    async (id) => {
      if (backend === "db" && tenantId) {
        await deleteContabilitaFoodcostManuale(id);
      } else {
        setLocalData((d) => ({ ...d, righe: (d.righe || []).filter((r) => r.id !== id) }));
      }
      setRighe((prev) => prev.filter((r) => r.id !== id));
    },
    [backend, tenantId, setLocalData],
  );

  return { righe, addRiga, removeRiga, ready, backend, loadErr };
}
