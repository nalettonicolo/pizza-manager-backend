import { useState, useEffect, useCallback, useRef } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import { useTenantLocalJson } from "@/features/admin/hooks/useTenantLocalJson";
import { importLocalIfDbEmpty } from "@/features/admin/hooks/importLocalIfDbEmpty";
import {
  magazzinoDdtTableReachable,
  listMagazzinoDdt,
  insertMagazzinoDdt,
  deleteMagazzinoDdt,
} from "@/features/admin/services/adminService";

/**
 * DDT magazzino: Supabase se tabella disponibile, altrimenti localStorage tenant.
 */
export function useMagazzinoDdtStorage() {
  const { tenantId } = useTenant();
  const { data: localData, setData: setLocalData, ready: localReady } = useTenantLocalJson("magazzino_ddt", {
    righe: [],
  });
  const [righe, setRighe] = useState([]);
  const [backend, setBackend] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const [migratedCount, setMigratedCount] = useState(0);
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
        const dbOk = await magazzinoDdtTableReachable(tenantId);
        if (cancelled) return;
        if (dbOk) {
          let rows = await listMagazzinoDdt(tenantId);
          if (cancelled) return;
          const { imported } = await importLocalIfDbEmpty({
            localItems: localData.righe,
            dbItems: rows,
            importItem: (row) => insertMagazzinoDdt(tenantId, row),
            onClearedLocal: () => setLocalData({ righe: [] }),
          });
          if (imported > 0) rows = await listMagazzinoDdt(tenantId);
          if (cancelled) return;
          if (imported > 0) setMigratedCount(imported);
          setRighe(rows);
          setBackend("db");
        } else {
          setRighe(localData.righe || []);
          setBackend("local");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e?.message || "Errore storage DDT");
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

  const addRow = useCallback(
    async (row) => {
      if (backend === "db" && tenantId) {
        const saved = await insertMagazzinoDdt(tenantId, row);
        setRighe((prev) => [saved, ...prev]);
        return saved;
      }
      setLocalData((d) => ({ ...d, righe: [row, ...(d.righe || [])] }));
      setRighe((prev) => [row, ...prev]);
      return row;
    },
    [backend, tenantId, setLocalData],
  );

  const removeRow = useCallback(
    async (id) => {
      if (backend === "db" && tenantId) {
        await deleteMagazzinoDdt(tenantId, id);
      } else {
        setLocalData((d) => ({ ...d, righe: (d.righe || []).filter((r) => r.id !== id) }));
      }
      setRighe((prev) => prev.filter((r) => r.id !== id));
    },
    [backend, tenantId, setLocalData],
  );

  return { righe, addRow, removeRow, ready, backend, loadErr, migratedCount };
}
