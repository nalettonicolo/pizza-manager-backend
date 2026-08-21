import { useState, useEffect, useCallback, useRef } from "react";
import { useTenant } from "@/app/contexts/TenantContext";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";
import { importLocalIfDbEmpty } from "@/features/admin/hooks/importLocalIfDbEmpty";
import {
  contabilitaPagamentiTableReachable,
  listContabilitaPagamentiFatture,
  insertContabilitaPagamentoFattura,
  updateContabilitaPagamentoFattura,
  deleteContabilitaPagamentoFattura,
} from "@/features/admin/services/adminService";

/** Pagamenti fatture: Supabase se tabella disponibile, altrimenti localStorage. */
export function useContabilitaPagamentiStorage() {
  const { tenantId } = useTenant();
  const { data: localData, setData: setLocalData, ready: localReady } = useTenantLocalJson("contabilita_pagamenti", {
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
        const dbOk = await contabilitaPagamentiTableReachable(tenantId);
        if (cancelled) return;
        if (dbOk) {
          let rows = await listContabilitaPagamentiFatture(tenantId);
          if (cancelled) return;
          const { imported } = await importLocalIfDbEmpty({
            localItems: localData.righe,
            dbItems: rows,
            importItem: (row) => insertContabilitaPagamentoFattura(tenantId, row),
            onClearedLocal: () => setLocalData({ righe: [] }),
          });
          if (imported > 0) rows = await listContabilitaPagamentiFatture(tenantId);
          if (cancelled) return;
          setRighe(rows);
          setBackend("db");
        } else {
          setRighe(localData.righe || []);
          setBackend("local");
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e?.message || "Errore storage pagamenti");
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
  }, [tenantId, localReady, localData.righe, setLocalData]);

  const addRiga = useCallback(
    async (row) => {
      const uiRow = { ...row, id: row.id || newLocalId() };
      if (backend === "db" && tenantId) {
        const saved = await insertContabilitaPagamentoFattura(tenantId, uiRow);
        setRighe((prev) => [saved, ...prev]);
        return saved;
      }
      setLocalData((d) => ({ ...d, righe: [uiRow, ...(d.righe || [])] }));
      setRighe((prev) => [uiRow, ...prev]);
      return uiRow;
    },
    [backend, tenantId, setLocalData],
  );

  const togglePagato = useCallback(
    async (id) => {
      const current = righe.find((r) => r.id === id);
      if (!current) return;
      const next = !current.pagato;
      if (backend === "db" && tenantId) {
        const saved = await updateContabilitaPagamentoFattura(id, { pagato: next });
        setRighe((prev) => prev.map((r) => (r.id === id ? saved : r)));
        return;
      }
      setLocalData((d) => ({
        ...d,
        righe: (d.righe || []).map((r) => (r.id === id ? { ...r, pagato: next } : r)),
      }));
      setRighe((prev) => prev.map((r) => (r.id === id ? { ...r, pagato: next } : r)));
    },
    [backend, tenantId, righe, setLocalData],
  );

  const removeRiga = useCallback(
    async (id) => {
      if (backend === "db" && tenantId) {
        await deleteContabilitaPagamentoFattura(id);
      } else {
        setLocalData((d) => ({ ...d, righe: (d.righe || []).filter((r) => r.id !== id) }));
      }
      setRighe((prev) => prev.filter((r) => r.id !== id));
    },
    [backend, tenantId, setLocalData],
  );

  return { righe, addRiga, togglePagato, removeRiga, ready, backend, loadErr };
}
