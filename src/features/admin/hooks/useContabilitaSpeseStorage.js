import { useState, useEffect, useCallback, useRef } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";
import { importLocalIfDbEmpty } from "@/features/admin/hooks/importLocalIfDbEmpty";
import {
  contabilitaSpeseTableReachable,
  listContabilitaSpese,
  insertContabilitaSpesa,
  deleteContabilitaSpesa,
} from "@/features/admin/services/adminService";

/**
 * Spese contabilità (locale | personale): DB hybrid.
 * @param {"locale"|"personale"} ambito
 * @param {string} localKey chiave localStorage tenant
 */
export function useContabilitaSpeseStorage(ambito, localKey) {
  const { tenantId } = useTenant();
  const { data: localData, setData: setLocalData, ready: localReady } = useTenantLocalJson(localKey, { spese: [] });
  const [spese, setSpese] = useState([]);
  const [backend, setBackend] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const probedRef = useRef(false);

  useEffect(() => {
    probedRef.current = false;
    setReady(false);
    setBackend(null);
    setSpese([]);
  }, [tenantId, ambito]);

  useEffect(() => {
    if (!tenantId || !localReady || probedRef.current) return;
    probedRef.current = true;
    let cancelled = false;
    setLoadErr(null);
    (async () => {
      try {
        const dbOk = await contabilitaSpeseTableReachable(tenantId);
        if (cancelled) return;
        if (dbOk) {
          let rows = await listContabilitaSpese(tenantId, ambito);
          if (cancelled) return;
          const { imported } = await importLocalIfDbEmpty({
            localItems: localData.spese,
            dbItems: rows,
            importItem: (row) => insertContabilitaSpesa(tenantId, ambito, row),
            onClearedLocal: () => setLocalData({ spese: [] }),
          });
          if (imported > 0) rows = await listContabilitaSpese(tenantId, ambito);
          if (cancelled) return;
          setSpese(rows);
          setBackend("db");
        } else {
          setSpese(localData.spese || []);
          setBackend("local");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e?.message || "Errore storage spese");
          setSpese(localData.spese || []);
          setBackend("local");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, localReady, localData.spese, ambito, setLocalData]);

  const addSpesa = useCallback(
    async (row) => {
      const uiRow = { ...row, id: row.id || newLocalId() };
      if (backend === "db" && tenantId) {
        const saved = await insertContabilitaSpesa(tenantId, ambito, uiRow);
        setSpese((prev) => [saved, ...prev]);
        return saved;
      }
      setLocalData((d) => ({ ...d, spese: [uiRow, ...(d.spese || [])] }));
      setSpese((prev) => [uiRow, ...prev]);
      return uiRow;
    },
    [backend, tenantId, ambito, setLocalData],
  );

  const removeSpesa = useCallback(
    async (id) => {
      if (backend === "db" && tenantId) {
        await deleteContabilitaSpesa(id);
      } else {
        setLocalData((d) => ({ ...d, spese: (d.spese || []).filter((r) => r.id !== id) }));
      }
      setSpese((prev) => prev.filter((r) => r.id !== id));
    },
    [backend, tenantId, setLocalData],
  );

  return { spese, addSpesa, removeSpesa, ready, backend, loadErr };
}
