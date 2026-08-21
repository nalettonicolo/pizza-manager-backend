import { useState, useEffect, useCallback, useRef } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";
import { importLocalIfDbEmpty } from "@/features/admin/hooks/importLocalIfDbEmpty";
import {
  magazzinoFornitoriTableReachable,
  listMagazzinoFornitori,
  upsertMagazzinoFornitore,
  deleteMagazzinoFornitore,
} from "@/features/admin/services/adminService";

/**
 * Fornitori magazzino: Supabase se tabella disponibile, altrimenti localStorage tenant.
 */
export function useMagazzinoFornitoriStorage() {
  const { tenantId } = useTenant();
  const { data: localData, setData: setLocalData, ready: localReady } = useTenantLocalJson("magazzino_fornitori", {
    fornitori: [],
  });
  const [fornitori, setFornitori] = useState([]);
  const [backend, setBackend] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState(null);
  const probedRef = useRef(false);

  useEffect(() => {
    probedRef.current = false;
    setReady(false);
    setBackend(null);
    setFornitori([]);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !localReady || probedRef.current) return;
    probedRef.current = true;
    let cancelled = false;
    setLoadErr(null);
    (async () => {
      try {
        const dbOk = await magazzinoFornitoriTableReachable(tenantId);
        if (cancelled) return;
        if (dbOk) {
          let rows = await listMagazzinoFornitori(tenantId);
          if (cancelled) return;
          const { imported } = await importLocalIfDbEmpty({
            localItems: localData.fornitori,
            dbItems: rows,
            importItem: (f) => upsertMagazzinoFornitore(tenantId, { ...f, id: undefined }),
            onClearedLocal: () => setLocalData({ fornitori: [] }),
          });
          if (imported > 0) rows = await listMagazzinoFornitori(tenantId);
          if (cancelled) return;
          setFornitori(rows);
          setBackend("db");
        } else {
          setFornitori(localData.fornitori || []);
          setBackend("local");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e?.message || "Errore storage fornitori");
          setFornitori(localData.fornitori || []);
          setBackend("local");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, localReady, localData.fornitori, setLocalData]);

  const persistFornitori = useCallback(
    async (nextList) => {
      if (backend === "db" && tenantId) {
        setFornitori(nextList);
        return;
      }
      setLocalData({ fornitori: nextList });
      setFornitori(nextList);
    },
    [backend, tenantId, setLocalData],
  );

  const addFornitore = useCallback(
    async (draft) => {
      const row = { ...draft, nome: draft.nome.trim() || "Fornitore senza nome" };
      if (backend === "db" && tenantId) {
        const saved = await upsertMagazzinoFornitore(tenantId, { ...row, listino: row.listino || [] });
        setFornitori((prev) => [...prev, saved]);
        return saved;
      }
      const withId = { ...row, id: row.id || newLocalId(), listino: row.listino || [] };
      setLocalData((d) => ({ ...d, fornitori: [...(d.fornitori || []), withId] }));
      setFornitori((prev) => [...prev, withId]);
      return withId;
    },
    [backend, tenantId, setLocalData],
  );

  const updateFornitore = useCallback(
    async (updated) => {
      if (backend === "db" && tenantId) {
        const saved = await upsertMagazzinoFornitore(tenantId, updated);
        setFornitori((prev) => prev.map((f) => (f.id === saved.id ? saved : f)));
        return saved;
      }
      setLocalData((d) => ({
        ...d,
        fornitori: (d.fornitori || []).map((f) => (f.id === updated.id ? updated : f)),
      }));
      setFornitori((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      return updated;
    },
    [backend, tenantId, setLocalData],
  );

  const removeFornitore = useCallback(
    async (id) => {
      if (backend === "db" && tenantId) {
        await deleteMagazzinoFornitore(tenantId, id);
      } else {
        setLocalData((d) => ({ ...d, fornitori: (d.fornitori || []).filter((f) => f.id !== id) }));
      }
      setFornitori((prev) => prev.filter((f) => f.id !== id));
    },
    [backend, tenantId, setLocalData],
  );

  return {
    fornitori,
    setFornitori: persistFornitori,
    addFornitore,
    updateFornitore,
    removeFornitore,
    ready,
    backend,
    loadErr,
  };
}
