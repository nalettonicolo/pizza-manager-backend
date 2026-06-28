import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import AdminModuleShell from "@/features/admin/components/AdminModuleShell";
import { useTenantLocalJson, newLocalId } from "@/features/admin/hooks/useTenantLocalJson";
import { importLocalIfDbEmpty } from "@/features/admin/hooks/importLocalIfDbEmpty";
import { useTenant } from "@/app/contexts/TenantContext";
import { useTenantServizi } from "@/app/hooks/useTenantServizi";
import {
  getOrders,
  contabilitaMovimentiTableReachable,
  listContabilitaMovimenti,
  insertContabilitaMovimento,
  deleteContabilitaMovimento,
  getVenditeMacroCategorieInPeriod,
} from "@/features/admin/services/adminService";
import { aggregateIncassiDaOrdini, aggregateIncassiContantiElettronicoDaOrdini } from "@/utils/incassiFromOrdini";

function mapDbRowToUi(row) {
  return {
    id: row.id,
    data: row.data_mov,
    descrizione: row.descrizione || "",
    importo: Number(row.importo),
    tipo: row.tipo,
  };
}

function defaultMacroDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return {
    da: start.toISOString().slice(0, 10),
    a: end.toISOString().slice(0, 10),
  };
}

export default function GestioneIncassiPage() {
  const { tenantId } = useTenant();
  const { contabilitaMode } = useTenantServizi();
  const { data, setData, ready: localReady, storageKey } = useTenantLocalJson("contabilita_incassi", { movimenti: [] });
  const [dataMov, setDataMov] = useState(() => new Date().toISOString().slice(0, 10));
  const [descrizione, setDescrizione] = useState("");
  const [importo, setImporto] = useState("");
  const [tipo, setTipo] = useState("contanti");
  const [ordiniOggi, setOrdiniOggi] = useState([]);
  const [ordiniHintLoading, setOrdiniHintLoading] = useState(false);
  const [ordiniHintErr, setOrdiniHintErr] = useState(null);

  const [movimenti, setMovimenti] = useState([]);
  const [storageBackend, setStorageBackend] = useState(null);
  const [storageProbeDone, setStorageProbeDone] = useState(false);
  const [storageLoadErr, setStorageLoadErr] = useState(null);
  const [migratedCount, setMigratedCount] = useState(0);
  const [autoSyncBusy, setAutoSyncBusy] = useState(false);
  const probedRef = useRef(false);

  const [macroDa, setMacroDa] = useState(() => defaultMacroDateRange().da);
  const [macroA, setMacroA] = useState(() => defaultMacroDateRange().a);
  const [macroStats, setMacroStats] = useState(null);
  const [macroLoading, setMacroLoading] = useState(false);
  const [macroErr, setMacroErr] = useState(null);

  useEffect(() => {
    probedRef.current = false;
    setStorageProbeDone(false);
    setStorageBackend(null);
    setMovimenti([]);
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId || !localReady || probedRef.current) return;
    probedRef.current = true;
    let cancelled = false;
    setStorageLoadErr(null);
    (async () => {
      try {
        const dbOk = await contabilitaMovimentiTableReachable(tenantId);
        if (cancelled) return;
        if (dbOk) {
          let rows = await listContabilitaMovimenti(tenantId);
          if (cancelled) return;
          const { imported } = await importLocalIfDbEmpty({
            localItems: data.movimenti,
            dbItems: rows,
            importItem: (m) =>
              insertContabilitaMovimento(tenantId, {
                data: m.data,
                descrizione: m.descrizione ?? "",
                importo: m.importo,
                tipo: m.tipo,
              }),
            onClearedLocal: () => setData({ movimenti: [] }),
          });
          if (imported > 0) {
            setMigratedCount(imported);
            rows = await listContabilitaMovimenti(tenantId);
          }
          if (cancelled) return;
          setMovimenti(rows.map(mapDbRowToUi));
          setStorageBackend("db");
        } else {
          setMovimenti(data.movimenti || []);
          setStorageBackend("local");
        }
      } catch (e) {
        if (!cancelled) {
          setStorageLoadErr(e?.message || "Errore storage");
          setMovimenti(data.movimenti || []);
          setStorageBackend("local");
        }
      } finally {
        if (!cancelled) setStorageProbeDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, localReady, data.movimenti]);

  useEffect(() => {
    if (storageBackend !== "local") return;
    setMovimenti(data.movimenti || []);
  }, [storageBackend, data.movimenti]);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setOrdiniHintLoading(true);
    setOrdiniHintErr(null);
    getOrders(tenantId, { todayOnly: true, limit: 200 })
      .then((list) => {
        if (!cancelled) setOrdiniOggi(Array.isArray(list) ? list : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setOrdiniHintErr(e?.message || "Errore caricamento ordini");
          setOrdiniOggi([]);
        }
      })
      .finally(() => {
        if (!cancelled) setOrdiniHintLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const loadMacroVendite = useCallback(async () => {
    if (!tenantId) return;
    const startIso = `${macroDa}T00:00:00.000`;
    const endIso = `${macroA}T23:59:59.999`;
    setMacroLoading(true);
    setMacroErr(null);
    try {
      const data = await getVenditeMacroCategorieInPeriod(tenantId, startIso, endIso);
      setMacroStats(data);
    } catch (e) {
      setMacroErr(e?.message || "Errore caricamento vendite per categoria");
      setMacroStats(null);
    } finally {
      setMacroLoading(false);
    }
  }, [tenantId, macroDa, macroA]);

  useEffect(() => {
    void loadMacroVendite();
  }, [loadMacroVendite]);

  const totali = useMemo(() => {
    let contanti = 0;
    let elettronico = 0;
    for (const m of movimenti || []) {
      if (m.tipo === "contanti") contanti += m.importo;
      else elettronico += m.importo;
    }
    return { contanti, elettronico, totale: contanti + elettronico };
  }, [movimenti]);

  const suggerimentoOrdini = useMemo(() => aggregateIncassiDaOrdini(ordiniOggi), [ordiniOggi]);
  const macroOrdini = useMemo(() => aggregateIncassiContantiElettronicoDaOrdini(ordiniOggi), [ordiniOggi]);

  const registraIncassiAutomaticiDaOrdini = useCallback(async () => {
    if (!tenantId || storageBackend !== "db") return;
    const oggi = new Date().toISOString().slice(0, 10);
    setAutoSyncBusy(true);
    try {
      const inserted = [];
      if (macroOrdini.contanti > 0) {
        const r = await insertContabilitaMovimento(tenantId, {
          data: oggi,
          descrizione: `Sistema — incasso contanti da ordini (${oggi})`,
          importo: macroOrdini.contanti,
          tipo: "contanti",
        });
        inserted.push(mapDbRowToUi(r));
      }
      if (macroOrdini.elettronico > 0) {
        const r = await insertContabilitaMovimento(tenantId, {
          data: oggi,
          descrizione: `Sistema — incasso elettronico da ordini (${oggi})`,
          importo: macroOrdini.elettronico,
          tipo: "elettronico",
        });
        inserted.push(mapDbRowToUi(r));
      }
      if (macroOrdini.altro > 0) {
        const r = await insertContabilitaMovimento(tenantId, {
          data: oggi,
          descrizione: `Sistema — da pagare / altro da ordini (${oggi})`,
          importo: macroOrdini.altro,
          tipo: "elettronico",
        });
        inserted.push(mapDbRowToUi(r));
      }
      if (inserted.length) {
        setMovimenti((prev) => [...inserted, ...prev]);
      } else {
        alert("Nessun importo da registrare (ordini vuoti o già a zero).");
      }
    } catch (e) {
      alert("Registrazione automatica non riuscita. " + (e?.message || ""));
    } finally {
      setAutoSyncBusy(false);
    }
  }, [tenantId, storageBackend, macroOrdini]);

  const add = useCallback(async () => {
    const imp = Number(importo);
    if (!imp || imp <= 0 || !tenantId) return;
    const row = {
      id: newLocalId(),
      data: dataMov,
      descrizione: descrizione.trim() || "Incasso",
      importo: imp,
      tipo,
    };
    if (storageBackend === "db") {
      try {
        const inserted = await insertContabilitaMovimento(tenantId, row);
        setMovimenti((prev) => [{ id: inserted.id, data: inserted.data_mov, descrizione: inserted.descrizione, importo: Number(inserted.importo), tipo: inserted.tipo }, ...prev]);
      } catch (e) {
        alert("Salvataggio database non riuscito. " + (e?.message || ""));
        return;
      }
    } else {
      setData((d) => ({ ...d, movimenti: [row, ...d.movimenti] }));
    }
    setDescrizione("");
    setImporto("");
  }, [importo, tenantId, dataMov, descrizione, tipo, storageBackend, setData]);

  const remove = useCallback(
    async (id) => {
      if (storageBackend === "db") {
        try {
          await deleteContabilitaMovimento(id);
          setMovimenti((prev) => prev.filter((x) => x.id !== id));
        } catch (e) {
          alert("Eliminazione non riuscita. " + (e?.message || ""));
        }
      } else {
        setData((d) => ({ ...d, movimenti: d.movimenti.filter((x) => x.id !== id) }));
      }
    },
    [storageBackend, setData],
  );

  if (!localReady || !storageProbeDone) {
    return <p className="text-gray-400 text-sm">Caricamento…</p>;
  }

  const leadIncassi =
    contabilitaMode === "semplice"
      ? "Contabilità semplificata: registro incassi e conteggio pezzi venduti (pizze, fritti, dolci, bibite) dagli ordini nel periodo scelto. I totali usano le categorie del menu listino."
      : "Registro manuale degli incassi (contanti ed elettronico). Con il database aggiornato (sql_upgrade.sql) i movimenti si salvano su Supabase; altrimenti restano nel browser (localStorage).";

  return (
    <AdminModuleShell
      title={contabilitaMode === "semplice" ? "Incassi e vendite (semplificato)" : "Gestione incassi"}
      lead={leadIncassi}
      specTitle="Ambito"
      specChildren={
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Utile per versamenti, riepiloghi e riconciliazioni non ancora collegate al POS.</li>
          <li>
            Report vendite: <Link to="/admin/report">Admin → Report</Link>.
          </li>
          <li>
            Il riquadro «Da ordini oggi» legge solo gli ordini in database: non richiede moduli a pagamento.
          </li>
        </ul>
      }
    >
      {storageLoadErr ? (
        <p style={{ marginBottom: 12, fontSize: 13, color: "#b45309" }}>
          Storage database non usato ({storageLoadErr}); uso localStorage{storageKey ? ` (${storageKey})` : ""}.
        </p>
      ) : null}
      <div
        style={{
          marginBottom: 16,
          padding: 10,
          borderRadius: 8,
          fontSize: 13,
          background: storageBackend === "db" ? "#ecfdf5" : "#f8fafc",
          border: storageBackend === "db" ? "1px solid #6ee7b7" : "1px solid #e2e8f0",
          color: "#334155",
        }}
      >
        {storageBackend === "db" ? (
          <strong>Persistenza: database Supabase (tabella contabilita_movimenti).</strong>
        ) : (
          <strong>Persistenza: solo questo browser (localStorage). Esegui sql/sql_upgrade.sql su Supabase per attivare il DB.</strong>
        )}
        {migratedCount > 0 ? (
          <span style={{ display: "block", marginTop: 8, color: "#166534" }}>
            Importati {migratedCount} movimenti dal browser su Supabase.
          </span>
        ) : null}
      </div>

      <div
        style={{
          marginBottom: 20,
          padding: 14,
          borderRadius: 8,
          border: "1px solid #d8b4fe",
          background: "#faf5ff",
          fontSize: 14,
          color: "#4c1d95",
        }}
      >
        <strong style={{ display: "block", marginBottom: 8 }}>Pezzi venduti per categoria (da righe ordine)</strong>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b21a8", lineHeight: 1.5 }}>
          Classificazione da <strong>slug/nome categoria</strong> prodotto: pizze, fritti, dolci, bibite; il resto va in
          «altro». Le categorie ingredienti sono escluse. Allinea i nomi in{" "}
          <Link to="/admin/menu/categorie">Menu → Categorie</Link> per risultati coerenti.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block" }}>Dal</label>
            <input
              type="date"
              value={macroDa}
              onChange={(e) => setMacroDa(e.target.value)}
              style={{ marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block" }}>Al</label>
            <input
              type="date"
              value={macroA}
              onChange={(e) => setMacroA(e.target.value)}
              style={{ marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
            />
          </div>
          <button type="button" className="btn-primary" disabled={macroLoading} onClick={() => void loadMacroVendite()}>
            {macroLoading ? "Aggiornamento…" : "Aggiorna"}
          </button>
        </div>
        {macroErr ? (
          <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{macroErr}</p>
        ) : macroStats ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
            {[
              ["Pizze", macroStats.pizze],
              ["Fritti", macroStats.fritti],
              ["Dolci", macroStats.dolci],
              ["Bibite", macroStats.bibite],
              ["Altro", macroStats.altro],
            ].map(([label, n]) => (
              <div
                key={label}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: "#fff",
                  border: "1px solid #e9d5ff",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#1e1b4b" }}>{n}</div>
              </div>
            ))}
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: "#ede9fe",
                border: "1px solid #c4b5fd",
                textAlign: "center",
                gridColumn: "1 / -1",
              }}
            >
              <div style={{ fontSize: 12, color: "#5b21b6" }}>Totale pezzi (nel periodo)</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{macroStats.totalePezzi}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                {macroStats.ordiniNelPeriodo} ordini non annullati considerati
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginBottom: 20,
          padding: 14,
          borderRadius: 8,
          border: "1px solid #bae6fd",
          background: "#f0f9ff",
          fontSize: 14,
          color: "#0c4a6e",
        }}
      >
        <strong style={{ display: "block", marginBottom: 8 }}>Da ordini di oggi (non annullati)</strong>
        {ordiniHintLoading ? (
          <span style={{ color: "#64748b" }}>Caricamento…</span>
        ) : ordiniHintErr ? (
          <span style={{ color: "#b91c1c" }}>{ordiniHintErr}</span>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 8 }}>
              <span>
                <strong>Totale venduto</strong>: € {suggerimentoOrdini.totale.toFixed(2)}
              </span>
              <span style={{ color: "#64748b" }}>
                {suggerimentoOrdini.count} ordini attivi
                {suggerimentoOrdini.annullatiCount > 0
                  ? ` · ${suggerimentoOrdini.annullatiCount} annullati (esclusi)`
                  : ""}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 13 }}>
              {Object.keys(suggerimentoOrdini.byTipo)
                .sort()
                .map((k) => (
                  <span key={k}>
                    {k}: € {(suggerimentoOrdini.byTipo[k] || 0).toFixed(2)}
                  </span>
                ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: "#334155" }}>
              <strong>Ripartizione automatica (euristica)</strong>: contanti € {macroOrdini.contanti.toFixed(2)} · elettronico €{" "}
              {macroOrdini.elettronico.toFixed(2)}
              {macroOrdini.altro > 0 ? (
                <>
                  {" "}
                  · altro (da pagare / non classificato) € {macroOrdini.altro.toFixed(2)}
                </>
              ) : null}
            </div>
            {storageBackend === "db" ? (
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: 12 }}
                disabled={autoSyncBusy}
                onClick={() => void registraIncassiAutomaticiDaOrdini()}
              >
                {autoSyncBusy ? "Registrazione…" : "Registra movimenti da ordini (oggi)"}
              </button>
            ) : null}
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              Suggerimento per incrociare con i movimenti manuali sotto; il pulsante crea righe in tabella in base agli ordini (puoi
              duplicare importi se avevi già registrato manualmente — controlla prima).
            </p>
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 20,
          alignItems: "end",
        }}
      >
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Data</label>
          <input
            type="date"
            value={dataMov}
            onChange={(e) => setDataMov(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          >
            <option value="contanti">Contanti</option>
            <option value="elettronico">Elettronico (POS / bonifici entrata)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b" }}>Importo €</label>
          <input
            type="number"
            step="0.01"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 12, color: "#64748b" }}>Descrizione</label>
          <input
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
          />
        </div>
        <button type="button" className="btn-primary" onClick={() => void add()}>
          Registra incasso
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
          fontSize: 14,
          color: "#334155",
        }}
      >
        <span>
          <strong>Contanti:</strong> € {totali.contanti.toFixed(2)}
        </span>
        <span>
          <strong>Elettronico:</strong> € {totali.elettronico.toFixed(2)}
        </span>
        <span>
          <strong>Totale:</strong> € {totali.totale.toFixed(2)}
        </span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #e2e8f0", color: "#64748b" }}>
            <th style={{ padding: "10px 8px" }}>Data</th>
            <th style={{ padding: "10px 8px" }}>Descrizione</th>
            <th style={{ padding: "10px 8px" }}>Tipo</th>
            <th style={{ padding: "10px 8px" }}>Importo</th>
            <th style={{ padding: "10px 8px" }} />
          </tr>
        </thead>
        <tbody>
          {movimenti.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 8px" }}>{r.data}</td>
              <td style={{ padding: "10px 8px" }}>{r.descrizione}</td>
              <td style={{ padding: "10px 8px" }}>{r.tipo === "contanti" ? "Contanti" : "Elettronico"}</td>
              <td style={{ padding: "10px 8px" }}>€ {r.importo.toFixed(2)}</td>
              <td style={{ padding: "10px 8px" }}>
                <button
                  type="button"
                  style={{ color: "#b91c1c", border: "none", background: "none", cursor: "pointer" }}
                  onClick={() => void remove(r.id)}
                >
                  Elimina
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {movimenti.length === 0 ? (
        <p style={{ padding: 16, color: "#94a3b8", fontSize: 14 }}>Nessun movimento manuale.</p>
      ) : null}
    </AdminModuleShell>
  );
}
