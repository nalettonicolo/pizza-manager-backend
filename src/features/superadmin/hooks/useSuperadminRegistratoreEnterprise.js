import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/contexts/AuthContext";
import {
  fetchRegistratoreAuditLog,
  fetchRegistratoreState,
  upsertRegistratoreState,
} from "@/features/superadmin/services/superadminService";

export const REGISTRATORE_STORAGE_KEY = "registratore_standalone_v2";
const LS_PREFIX = "pm_superadmin_";

export function getInitialRegistratoreState() {
  return {
    carrello: {
      righe: [],
      clienteNome: "",
      clientePiva: "",
      clienteIndirizzo: "",
      note: "",
      pagamento: "contanti",
    },
    vendite: [],
    fattureCliente: [],
    fatturePassive: [],
    ddt: [],
  };
}

function readLocal(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLocal(storageKey, data) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (e) {
    console.warn("[registratore enterprise] localStorage", e);
  }
}

function mergeWithInitial(raw) {
  const base = getInitialRegistratoreState();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    carrello: { ...base.carrello, ...(raw.carrello || {}) },
  };
}

function applyServerRowToRefs(row, { storageKey, setDataState, setServerUpdatedAt, setServerRevision, lastSyncedRevisionRef }) {
  if (!row?.payload || typeof row.payload !== "object") return;
  const merged = mergeWithInitial(row.payload);
  setDataState(merged);
  writeLocal(storageKey, merged);
  setServerUpdatedAt(row.updated_at ?? null);
  const rev = Number(row.revision) || 0;
  setServerRevision(rev);
  lastSyncedRevisionRef.current = rev;
}

/**
 * Stato registratore Super Admin: Supabase + cache locale, revisione server, audit append-only,
 * rilevamento multi-scheda (ultima scrittura vince al salvataggio; conflitto se modifiche locali + revisione avanzata altrove).
 */
export function useSuperadminRegistratoreEnterprise() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const storageKey = useMemo(() => `${LS_PREFIX}${REGISTRATORE_STORAGE_KEY}`, []);

  const [data, setDataState] = useState(() => getInitialRegistratoreState());
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [syncError, setSyncError] = useState(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState(null);
  const [serverRevision, setServerRevision] = useState(null);
  const [remoteUnavailable, setRemoteUnavailable] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);

  const saveTimerRef = useRef(null);
  const pendingPayloadRef = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const userIdRef = useRef(userId);
  const remoteUnRef = useRef(remoteUnavailable);
  userIdRef.current = userId;
  remoteUnRef.current = remoteUnavailable;
  const dirtyRef = useRef(false);
  const lastSyncedRevisionRef = useRef(0);
  const readyRef = useRef(false);

  const flushSave = useCallback(async () => {
    const payload = pendingPayloadRef.current;
    const uid = userIdRef.current;
    if (!payload || !uid || remoteUnRef.current) return;
    pendingPayloadRef.current = null;
    setSyncStatus("saving");
    setSyncError(null);
    try {
      const res = await upsertRegistratoreState(uid, payload);
      dirtyRef.current = false;
      if (res) {
        lastSyncedRevisionRef.current = res.revision;
        setServerRevision(res.revision);
        setServerUpdatedAt(res.updated_at);
      }
      setSyncStatus("idle");
      setConflict(null);
    } catch (e) {
      if (e?.code === "UNAVAILABLE") {
        setRemoteUnavailable(true);
        setSyncStatus("local_only");
        setSyncError("Salvataggio server non disponibile (migrazione SQL non applicata?).");
      } else {
        setSyncStatus("error");
        setSyncError(e?.message ?? "Errore salvataggio server");
      }
    }
  }, []);

  const checkRemoteNewerRevision = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid || remoteUnRef.current || !readyRef.current) return;
    const { row, error, unavailable } = await fetchRegistratoreState(uid);
    if (unavailable || error || !row) return;
    const remoteRev = Number(row.revision) || 0;
    if (remoteRev <= lastSyncedRevisionRef.current) return;

    if (!dirtyRef.current) {
      applyServerRowToRefs(row, {
        storageKey,
        setDataState,
        setServerUpdatedAt,
        setServerRevision,
        lastSyncedRevisionRef,
      });
      return;
    }

    setConflict({
      remoteRevision: remoteRev,
      remoteUpdatedAt: row.updated_at,
      remotePayload: row.payload,
    });
  }, [storageKey]);

  const refreshAudit = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid || remoteUnRef.current) return;
    setAuditLoading(true);
    setAuditError(null);
    try {
      const { rows, error, unavailable } = await fetchRegistratoreAuditLog(uid, { limit: 25 });
      if (unavailable) {
        setAuditRows([]);
        setAuditError("Tabella audit non presente: applica migrazione revision/audit.");
        return;
      }
      if (error) {
        setAuditError(error.message ?? "Errore caricamento audit");
        setAuditRows([]);
        return;
      }
      setAuditRows(rows || []);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    readyRef.current = ready && !authLoading;
  }, [ready, authLoading]);

  useEffect(() => {
    if (!ready || remoteUnavailable || !userId) return;
    function onVis() {
      if (document.visibilityState !== "visible") return;
      void checkRemoteNewerRevision();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [ready, remoteUnavailable, userId, checkRemoteNewerRevision]);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function load() {
      setSyncStatus("loading");
      setSyncError(null);

      if (!userId) {
        const local = mergeWithInitial(readLocal(storageKey));
        setDataState(local);
        setReady(true);
        setSyncStatus("local_only");
        setRemoteUnavailable(true);
        setServerRevision(null);
        setSyncError("Sessione non disponibile: dati solo in cache locale se presenti.");
        return;
      }

      const { row, error, unavailable } = await fetchRegistratoreState(userId);
      if (cancelled) return;

      if (unavailable) {
        setRemoteUnavailable(true);
        const local = mergeWithInitial(readLocal(storageKey));
        setDataState(local);
        setReady(true);
        setSyncStatus("local_only");
        setServerRevision(null);
        setSyncError(
          error ? "Tabella superadmin_registratore_state assente: esegui la migrazione SQL (sql_upgrade.sql)." : null,
        );
        return;
      }

      if (error) {
        setRemoteUnavailable(false);
        const local = mergeWithInitial(readLocal(storageKey));
        setDataState(local);
        setReady(true);
        setSyncStatus("error");
        setServerRevision(null);
        setSyncError(error.message || "Lettura da Supabase non riuscita (RLS o permessi).");
        return;
      }

      setRemoteUnavailable(false);

      if (row?.payload != null && typeof row.payload === "object" && Object.keys(row.payload).length > 0) {
        applyServerRowToRefs(row, {
          storageKey,
          setDataState,
          setServerUpdatedAt,
          setServerRevision,
          lastSyncedRevisionRef,
        });
        dirtyRef.current = false;
        setReady(true);
        setSyncStatus("idle");
        return;
      }

      const local = mergeWithInitial(readLocal(storageKey));
      const hasContent =
        (local.vendite && local.vendite.length > 0) ||
        (local.fattureCliente && local.fattureCliente.length > 0) ||
        (local.fatturePassive && local.fatturePassive.length > 0) ||
        (local.ddt && local.ddt.length > 0) ||
        (local.carrello?.righe && local.carrello.righe.length > 0);

      if (hasContent) {
        try {
          const res = await upsertRegistratoreState(userId, local);
          setDataState(local);
          writeLocal(storageKey, local);
          dirtyRef.current = false;
          if (res) {
            lastSyncedRevisionRef.current = res.revision;
            setServerRevision(res.revision);
            setServerUpdatedAt(res.updated_at);
          }
        } catch (e) {
          setDataState(local);
          writeLocal(storageKey, local);
          setSyncError(e?.message ?? "Impossibile importare la cache sul server.");
          setSyncStatus("error");
        }
      } else {
        const initial = getInitialRegistratoreState();
        setDataState(initial);
        writeLocal(storageKey, initial);
        lastSyncedRevisionRef.current = Number(row?.revision) || 0;
        setServerRevision(lastSyncedRevisionRef.current);
        setServerUpdatedAt(row?.updated_at ?? null);
      }
      setReady(true);
      setSyncStatus("idle");
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, storageKey]);

  const takeRemoteConflict = useCallback(() => {
    if (!conflict?.remotePayload) return;
    const merged = mergeWithInitial(conflict.remotePayload);
    setDataState(merged);
    writeLocal(storageKey, merged);
    dirtyRef.current = false;
    lastSyncedRevisionRef.current = conflict.remoteRevision;
    setServerRevision(conflict.remoteRevision);
    setServerUpdatedAt(conflict.remoteUpdatedAt ?? null);
    setConflict(null);
  }, [conflict, storageKey]);

  const dismissConflictKeepLocal = useCallback(() => {
    setConflict(null);
  }, []);

  const setData = useCallback(
    (updater) => {
      setSyncError(null);
      dirtyRef.current = true;
      setDataState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        writeLocal(storageKey, next);
        pendingPayloadRef.current = next;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (userIdRef.current && !remoteUnRef.current) {
          saveTimerRef.current = setTimeout(() => {
            void flushSave();
          }, 800);
        }
        return next;
      });
    },
    [storageKey, flushSave],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const uid = userIdRef.current;
      const payload = pendingPayloadRef.current;
      if (uid && !remoteUnRef.current && payload) {
        void upsertRegistratoreState(uid, payload)
          .then((res) => {
            if (res) lastSyncedRevisionRef.current = res.revision;
          })
          .catch(() => {});
      }
    };
  }, []);

  const saveNow = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    pendingPayloadRef.current = dataRef.current;
    void flushSave();
  }, [flushSave]);

  return {
    data,
    setData,
    ready: ready && !authLoading,
    syncStatus,
    syncError,
    serverUpdatedAt,
    serverRevision,
    remoteUnavailable,
    userId,
    saveNow,
    conflict,
    takeRemoteConflict,
    dismissConflictKeepLocal,
    checkRemoteNewerRevision,
    auditRows,
    auditLoading,
    auditError,
    refreshAudit,
  };
}
