import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { newLocalId } from "@/features/admin/hooks/useTenantLocalJson";
import {
  getInitialRegistratoreState,
  REGISTRATORE_STORAGE_KEY,
  useSuperadminRegistratoreEnterprise,
} from "@/features/superadmin/hooks/useSuperadminRegistratoreEnterprise";

const ALIQUOTE = [
  { value: 22, label: "22%" },
  { value: 10, label: "10%" },
  { value: 4, label: "4%" },
  { value: 0, label: "Esente" },
];

const PAGAMENTI = [
  { value: "contanti", label: "Contanti" },
  { value: "carta", label: "Carta / POS" },
  { value: "misto", label: "Misto" },
];

function emptyCarrello() {
  return {
    righe: [],
    clienteNome: "",
    clientePiva: "",
    clienteIndirizzo: "",
    note: "",
    pagamento: "contanti",
  };
}

function calcRiga(r) {
  const qty = Math.max(0, Number(r.qty) || 0);
  const pu = Math.max(0, Number(r.prezzoImponibileUnit) || 0);
  const al = Math.min(100, Math.max(0, Number(r.aliquotaIva) ?? 10));
  const imponibile = Math.round(qty * pu * 100) / 100;
  const iva = Math.round((imponibile * al) / 100 * 100) / 100;
  return { imponibile, iva, totale: Math.round((imponibile + iva) * 100) / 100 };
}

function calcRighe(righe) {
  return righe.reduce(
    (acc, r) => {
      const c = calcRiga(r);
      return {
        imponibile: acc.imponibile + c.imponibile,
        iva: acc.iva + c.iva,
        totale: acc.totale + c.totale,
      };
    },
    { imponibile: 0, iva: 0, totale: 0 },
  );
}

function formatEuro(n) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
}

export default function SuperadminRegistratoreCassaPage() {
  const {
    data,
    setData,
    ready,
    syncStatus,
    syncError,
    serverUpdatedAt,
    serverRevision,
    remoteUnavailable,
    saveNow,
    conflict,
    takeRemoteConflict,
    dismissConflictKeepLocal,
    checkRemoteNewerRevision,
    auditRows,
    auditLoading,
    auditError,
    refreshAudit,
  } = useSuperadminRegistratoreEnterprise();
  const [tab, setTab] = useState("cassa");
  const [auditOpen, setAuditOpen] = useState(false);
  const [printPayload, setPrintPayload] = useState(null);

  useEffect(() => {
    function onAfterPrint() {
      setPrintPayload(null);
    }
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

  const totalsCarrello = useMemo(() => calcRighe(data.carrello?.righe || []), [data.carrello?.righe]);

  /** Deve restare prima di qualsiasi return (ready): stesso numero di hook ogni render. */
  const ddtNumeri = useMemo(() => (data.ddt || []).map((r) => r.numero).filter(Boolean), [data.ddt]);

  if (!ready) {
    return (
      <div className="sa-callout-muted">
        <p style={{ margin: 0 }}>Caricamento registratore…</p>
      </div>
    );
  }

  function updateCarrello(fn) {
    setData((d) => ({ ...d, carrello: fn(d.carrello || emptyCarrello()) }));
  }

  function addRigaCarrello(preset) {
    updateCarrello((c) => ({
      ...c,
      righe: [
        ...c.righe,
        {
          id: newLocalId(),
          descrizione: preset?.descrizione ?? "",
          qty: 1,
          prezzoImponibileUnit: preset?.prezzoImponibileUnit ?? 0,
          aliquotaIva: preset?.aliquotaIva ?? 10,
        },
      ],
    }));
  }

  function chiudiVendita() {
    const righe = data.carrello?.righe || [];
    if (!righe.length) return;
    const t = calcRighe(righe);
    const vendita = {
      id: newLocalId(),
      createdAt: new Date().toISOString(),
      clienteNome: (data.carrello?.clienteNome || "").trim(),
      clientePiva: (data.carrello?.clientePiva || "").trim(),
      note: (data.carrello?.note || "").trim(),
      pagamento: data.carrello?.pagamento || "contanti",
      righe: righe.map((r) => ({ ...r })),
      ...t,
    };
    setData((d) => ({
      ...d,
      vendite: [vendita, ...(d.vendite || [])],
      carrello: emptyCarrello(),
    }));
  }

  function resetAll() {
    if (
      !window.confirm(
        "Azzerare tutti i dati del registratore (vendite, fatture, DDT)? Verranno aggiornati anche server e cache locale.",
      )
    ) {
      return;
    }
    setData(getInitialRegistratoreState());
  }

  function openPrint(kind, doc) {
    setPrintPayload({ kind, doc, at: new Date().toISOString() });
    setTimeout(() => window.print(), 0);
  }

  return (
    <>
      <header className="sa-page-header" style={{ maxWidth: "min(1100px, 100%)" }}>
        <p className="sa-page-kicker">Strumenti piattaforma</p>
        <h1 className="dashboard-page-title sa-page-title">Registratore di cassa (standalone)</h1>
        <p className="sa-page-lede">
          Modulo <strong>enterprise</strong> distaccato dal servizio tenant: nessun ordine né tabella pizzeria. Stato su{" "}
          <strong>Supabase</strong> (<code>superadmin_registratore_state</code> con <code>revision</code> monotona;{" "}
          <code>superadmin_registratore_audit</code> append-only per ogni salvataggio). Multi-scheda: se hai modifiche non
          salvate e un’altra finestra salva, compare un avviso; altrimenti al ritorno sulla scheda i dati server aggiornati si
          applicano da soli. Cache locale: <code>pm_superadmin_{REGISTRATORE_STORAGE_KEY}</code>.
        </p>
      </header>

      {conflict ? (
        <div className="sa-reg-conflict" role="alert">
          <p style={{ margin: "0 0 10px", fontWeight: 700 }}>
            Altra sessione ha salvato una versione più recente (revisione {conflict.remoteRevision}).
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#5c534c", lineHeight: 1.5 }}>
            Hai modifiche locali non ancora inviate. Puoi scaricare i dati dal server (perdi le modifiche in questa scheda) o
            ignorare e continuare: al prossimo salvataggio la tua copia sovrascriverà il server (ultima scrittura vince).
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button type="button" className="btn-primary" onClick={takeRemoteConflict}>
              Usa dati dal server
            </button>
            <button type="button" className="sa-btn-outline" onClick={dismissConflictKeepLocal}>
              Ignora, tengo le mie modifiche
            </button>
          </div>
        </div>
      ) : null}

      <div className="sa-reg-sync-bar" role="status">
        {syncStatus === "loading" ? (
          <span className="sa-reg-sync-pill sa-reg-sync-loading">Caricamento da server…</span>
        ) : syncStatus === "saving" ? (
          <span className="sa-reg-sync-pill sa-reg-sync-saving">Salvataggio su Supabase…</span>
        ) : syncStatus === "error" && syncError ? (
          <span className="sa-reg-sync-pill sa-reg-sync-err">{syncError}</span>
        ) : remoteUnavailable || syncStatus === "local_only" ? (
          <span className="sa-reg-sync-pill sa-reg-sync-warn">
            Solo cache locale — applica la migrazione SQL o verifica il ruolo superadmin
          </span>
        ) : serverUpdatedAt ? (
          <span className="sa-reg-sync-pill sa-reg-sync-ok">
            Sincronizzato
            {serverRevision != null ? ` · rev. ${serverRevision}` : ""} ·{" "}
            {new Date(serverUpdatedAt).toLocaleString("it-IT")}
          </span>
        ) : (
          <span className="sa-reg-sync-pill sa-reg-sync-ok">Pronto · sync automatica dopo ogni modifica</span>
        )}
        {!remoteUnavailable && syncStatus !== "loading" && (
          <>
            <button type="button" className="sa-btn-outline sa-reg-sync-btn" onClick={() => void checkRemoteNewerRevision()}>
              Controlla aggiornamenti
            </button>
            <button type="button" className="sa-btn-outline sa-reg-sync-btn" onClick={() => saveNow()}>
              Salva ora su server
            </button>
          </>
        )}
      </div>

      <div className="sa-reg-audit-block">
        <button
          type="button"
          className="sa-reg-audit-toggle"
          aria-expanded={auditOpen}
          onClick={() => {
            setAuditOpen((o) => !o);
            if (!auditOpen) void refreshAudit();
          }}
        >
          Log audit append-only {auditOpen ? "▼" : "▶"}
        </button>
        {auditOpen ? (
          <div className="sa-reg-audit-body">
            {auditLoading ? (
              <p className="sa-reg-audit-muted">Caricamento…</p>
            ) : auditError ? (
              <p className="sa-reg-audit-err">{auditError}</p>
            ) : auditRows.length === 0 ? (
              <p className="sa-reg-audit-muted">Nessuna voce (salva almeno una volta dopo la migrazione audit).</p>
            ) : (
              <>
                <p className="sa-reg-audit-muted" style={{ marginBottom: 10 }}>
                  Ogni riga è immutabile lato client; conserva payload prima/dopo per tracciabilità.
                </p>
                <div className="sa-table-wrap">
                  <table className="sa-data-table">
                    <thead>
                      <tr>
                        <th>Data (UTC)</th>
                        <th>Op</th>
                        <th>Revisione</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.created_at ? new Date(r.created_at).toLocaleString("it-IT") : "—"}</td>
                          <td>{r.op}</td>
                          <td>{r.revision}</td>
                          <td style={{ fontSize: 12 }}>
                            {r.op === "update" ? "snapshot prima/dopo in DB" : "primo salvataggio"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="sa-btn-outline" style={{ marginTop: 10 }} onClick={() => void refreshAudit()}>
                  Aggiorna elenco
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="sa-reg-toolbar">
        <div className="sa-tabs" role="tablist" aria-label="Sezioni registratore">
          {[
            { id: "cassa", label: "Cassa" },
            { id: "fatture", label: "Fatture" },
            { id: "ddt", label: "DDT" },
          ].map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              className={`sa-tab ${tab === x.id ? "sa-tab-active" : ""}`}
              onClick={() => setTab(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="sa-reg-toolbar-actions">
          <button type="button" className="sa-btn-outline" onClick={resetAll}>
            Azzera dati locali
          </button>
        </div>
      </div>

      {tab === "cassa" && (
        <section className="sa-reg-grid" aria-labelledby="sa-cassa-title">
          <h2 id="sa-cassa-title" className="sr-only">
            Cassa
          </h2>
          <div className="sa-reg-panel">
            <h3 className="sa-form-section-title">Aggiungi righe</h3>
            <p className="sa-form-section-lede">Prezzi come imponibile unitario; IVA calcolata per riga.</p>
            <div className="sa-quick-grid">
              {[
                { descrizione: "Pizza margherita", prezzoImponibileUnit: 5.5, aliquotaIva: 10 },
                { descrizione: "Bibita 0,33 l", prezzoImponibileUnit: 1.2, aliquotaIva: 22 },
                { descrizione: "Coperto", prezzoImponibileUnit: 2, aliquotaIva: 10 },
              ].map((p) => (
                <button key={p.descrizione} type="button" className="sa-chip-add" onClick={() => addRigaCarrello(p)}>
                  + {p.descrizione}
                </button>
              ))}
            </div>
            <button type="button" className="sa-btn-outline" style={{ marginTop: 12 }} onClick={() => addRigaCarrello()}>
              + Riga vuota
            </button>

            <h3 className="sa-form-section-title" style={{ marginTop: 24 }}>
              Cliente (opzionale)
            </h3>
            <div className="sa-field-grid">
              <label className="sa-field">
                Ragione sociale / nome
                <input
                  value={data.carrello?.clienteNome ?? ""}
                  onChange={(e) => updateCarrello((c) => ({ ...c, clienteNome: e.target.value }))}
                />
              </label>
              <label className="sa-field">
                P.IVA
                <input
                  value={data.carrello?.clientePiva ?? ""}
                  onChange={(e) => updateCarrello((c) => ({ ...c, clientePiva: e.target.value }))}
                />
              </label>
              <label className="sa-field sa-field-span2">
                Indirizzo
                <input
                  value={data.carrello?.clienteIndirizzo ?? ""}
                  onChange={(e) => updateCarrello((c) => ({ ...c, clienteIndirizzo: e.target.value }))}
                />
              </label>
              <label className="sa-field sa-field-span2">
                Note scontrino
                <input value={data.carrello?.note ?? ""} onChange={(e) => updateCarrello((c) => ({ ...c, note: e.target.value }))} />
              </label>
              <label className="sa-field">
                Pagamento
                <select
                  value={data.carrello?.pagamento ?? "contanti"}
                  onChange={(e) => updateCarrello((c) => ({ ...c, pagamento: e.target.value }))}
                >
                  {PAGAMENTI.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="sa-reg-panel">
            <h3 className="sa-form-section-title">Carrello</h3>
            <div className="sa-table-wrap">
              <table className="sa-data-table">
                <thead>
                  <tr>
                    <th>Descrizione</th>
                    <th>Qtà</th>
                    <th>Imp. unit.</th>
                    <th>IVA</th>
                    <th>Totale</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(data.carrello?.righe || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="sa-table-empty">
                        Nessuna riga. Usa i pulsanti rapidi o «Riga vuota».
                      </td>
                    </tr>
                  ) : (
                    (data.carrello?.righe || []).map((r) => {
                      const c = calcRiga(r);
                      return (
                        <tr key={r.id}>
                          <td>
                            <input
                              className="sa-table-input"
                              value={r.descrizione}
                              onChange={(e) =>
                                updateCarrello((car) => ({
                                  ...car,
                                  righe: car.righe.map((x) => (x.id === r.id ? { ...x, descrizione: e.target.value } : x)),
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="sa-table-input sa-table-input-narrow"
                              type="number"
                              min={0}
                              step={1}
                              value={r.qty}
                              onChange={(e) =>
                                updateCarrello((car) => ({
                                  ...car,
                                  righe: car.righe.map((x) => (x.id === r.id ? { ...x, qty: e.target.value } : x)),
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="sa-table-input sa-table-input-narrow"
                              type="number"
                              min={0}
                              step={0.01}
                              value={r.prezzoImponibileUnit}
                              onChange={(e) =>
                                updateCarrello((car) => ({
                                  ...car,
                                  righe: car.righe.map((x) => (x.id === r.id ? { ...x, prezzoImponibileUnit: e.target.value } : x)),
                                }))
                              }
                            />
                          </td>
                          <td>
                            <select
                              className="sa-table-input sa-table-input-narrow"
                              value={r.aliquotaIva}
                              onChange={(e) =>
                                updateCarrello((car) => ({
                                  ...car,
                                  righe: car.righe.map((x) => (x.id === r.id ? { ...x, aliquotaIva: Number(e.target.value) } : x)),
                                }))
                              }
                            >
                              {ALIQUOTE.map((a) => (
                                <option key={a.value} value={a.value}>
                                  {a.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{formatEuro(c.totale)}</td>
                          <td>
                            <button
                              type="button"
                              className="sa-table-action"
                              onClick={() =>
                                updateCarrello((car) => ({
                                  ...car,
                                  righe: car.righe.filter((x) => x.id !== r.id),
                                }))
                              }
                            >
                              Rimuovi
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="sa-totals-bar">
              <span>Imponibile {formatEuro(totalsCarrello.imponibile)}</span>
              <span>IVA {formatEuro(totalsCarrello.iva)}</span>
              <strong>Totale {formatEuro(totalsCarrello.totale)}</strong>
            </div>
            <div className="sa-actions-row">
              <button
                type="button"
                className="btn-primary"
                disabled={!(data.carrello?.righe || []).length}
                onClick={() => {
                  chiudiVendita();
                }}
              >
                Chiudi vendita
              </button>
              <button
                type="button"
                className="sa-btn-outline"
                disabled={!(data.carrello?.righe || []).length}
                onClick={() =>
                  openPrint("scontrino", {
                    tipo: "Scontrino / ricevuta (prova)",
                    righe: data.carrello?.righe || [],
                    cliente: data.carrello,
                    ...totalsCarrello,
                  })
                }
              >
                Anteprima stampa
              </button>
              <button
                type="button"
                className="sa-btn-outline"
                disabled={!(data.carrello?.righe || []).length}
                onClick={() => {
                  const righe = data.carrello?.righe || [];
                  const t = calcRighe(righe);
                  const f = {
                    id: newLocalId(),
                    numero: `FC-${String((data.fattureCliente?.length || 0) + 1).padStart(4, "0")}`,
                    data: new Date().toISOString().slice(0, 10),
                    clienteNome: (data.carrello?.clienteNome || "").trim() || "Cliente generico",
                    clientePiva: (data.carrello?.clientePiva || "").trim(),
                    clienteIndirizzo: (data.carrello?.clienteIndirizzo || "").trim(),
                    righe: righe.map((x) => ({ ...x })),
                    ...t,
                    nota: "Generata dal carrello (bozza)",
                  };
                  setData((d) => ({
                    ...d,
                    fattureCliente: [f, ...(d.fattureCliente || [])],
                  }));
                  setTab("fatture");
                }}
              >
                Emetti fattura da carrello
              </button>
            </div>
          </div>

          <div className="sa-reg-panel sa-reg-panel-wide">
            <h3 className="sa-form-section-title">Storico vendite chiuse</h3>
            <div className="sa-table-wrap">
              <table className="sa-data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Cliente</th>
                    <th>Pagamento</th>
                    <th>Totale</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(data.vendite || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="sa-table-empty">
                        Nessuna vendita registrata.
                      </td>
                    </tr>
                  ) : (
                    (data.vendite || []).map((v) => (
                      <tr key={v.id}>
                        <td>{new Date(v.createdAt).toLocaleString("it-IT")}</td>
                        <td>{v.clienteNome || "—"}</td>
                        <td>{v.pagamento}</td>
                        <td>{formatEuro(v.totale)}</td>
                        <td>
                          <button type="button" className="sa-table-action" onClick={() => openPrint("vendita", v)}>
                            Stampa
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === "fatture" && <FattureSection data={data} setData={setData} ddtNumeri={ddtNumeri} openPrint={openPrint} />}

      {tab === "ddt" && <DdtSection data={data} setData={setData} openPrint={openPrint} />}

      {printPayload &&
        createPortal(
          <div className="sa-print-root" role="presentation">
            <PrintBlock payload={printPayload} />
          </div>,
          document.body,
        )}
    </>
  );
}

function FattureSection({ data, setData, ddtNumeri, openPrint }) {
  const [numero, setNumero] = useState("");
  const [dataDoc, setDataDoc] = useState(() => new Date().toISOString().slice(0, 10));
  const [fornitore, setFornitore] = useState("");
  const [riferimentoDdt, setRiferimentoDdt] = useState("");
  const [importo, setImporto] = useState("");
  const [noteFp, setNoteFp] = useState("");

  function addPassive() {
    if (!numero.trim()) return;
    const row = {
      id: newLocalId(),
      numero: numero.trim(),
      data: dataDoc,
      fornitore: fornitore.trim(),
      riferimentoDdt: riferimentoDdt.trim(),
      importo: Number(importo) || 0,
      note: noteFp.trim(),
    };
    setData((d) => ({ ...d, fatturePassive: [row, ...(d.fatturePassive || [])] }));
    setNumero("");
    setImporto("");
    setNoteFp("");
  }

  function removePassive(id) {
    setData((d) => ({ ...d, fatturePassive: (d.fatturePassive || []).filter((x) => x.id !== id) }));
  }

  function removeCliente(id) {
    setData((d) => ({ ...d, fattureCliente: (d.fattureCliente || []).filter((x) => x.id !== id) }));
  }

  return (
    <section className="sa-reg-fatture">
      <div className="sa-callout-muted" style={{ marginBottom: 20 }}>
        <p style={{ margin: 0 }}>
          <strong>Fatture a cliente</strong> (emesse): numerazione locale, righe e totali; stampa anteprima.{" "}
          <strong>Fatture passive</strong> (fornitori): registro semplificato collegabile ai DDT.
        </p>
      </div>

      <div className="sa-reg-panel sa-reg-panel-wide">
        <h3 className="sa-form-section-title">Fatture a cliente</h3>
        <div className="sa-table-wrap">
          <table className="sa-data-table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Data</th>
                <th>Cliente</th>
                <th>Totale</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data.fattureCliente || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="sa-table-empty">
                    Nessuna fattura. Usa «Emetti fattura da carrello» nella tab Cassa.
                  </td>
                </tr>
              ) : (
                (data.fattureCliente || []).map((f) => (
                  <tr key={f.id}>
                    <td>{f.numero}</td>
                    <td>{f.data}</td>
                    <td>{f.clienteNome}</td>
                    <td>{formatEuro(f.totale)}</td>
                    <td>
                      <button type="button" className="sa-table-action" onClick={() => openPrint("fatturaCliente", f)}>
                        Stampa
                      </button>{" "}
                      <button type="button" className="sa-table-action" onClick={() => removeCliente(f.id)}>
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sa-reg-panel sa-reg-panel-wide">
        <h3 className="sa-form-section-title">Fatture passive (fornitori)</h3>
        <p className="sa-form-section-lede">Collega il numero DDT registrato nella tab DDT per tracciabilità interna.</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#5c534c" }}>Suggerimenti DDT</label>
          <select
            value=""
            onChange={(e) => e.target.value && setRiferimentoDdt(e.target.value)}
            style={{ display: "block", marginTop: 6, maxWidth: 360, padding: 8, borderRadius: 8, border: "1px solid #e8d5c4" }}
          >
            <option value="">— Seleziona DDT —</option>
            {ddtNumeri.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="sa-field-grid">
          <label className="sa-field">
            Numero fattura
            <input value={numero} onChange={(e) => setNumero(e.target.value)} />
          </label>
          <label className="sa-field">
            Data
            <input type="date" value={dataDoc} onChange={(e) => setDataDoc(e.target.value)} />
          </label>
          <label className="sa-field">
            Fornitore
            <input value={fornitore} onChange={(e) => setFornitore(e.target.value)} />
          </label>
          <label className="sa-field">
            Rif. DDT
            <input value={riferimentoDdt} onChange={(e) => setRiferimentoDdt(e.target.value)} />
          </label>
          <label className="sa-field">
            Importo imponibile+IVA (€)
            <input type="number" min={0} step={0.01} value={importo} onChange={(e) => setImporto(e.target.value)} />
          </label>
          <label className="sa-field sa-field-span2">
            Note
            <input value={noteFp} onChange={(e) => setNoteFp(e.target.value)} />
          </label>
        </div>
        <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={addPassive}>
          Registra fattura passiva
        </button>

        <div className="sa-table-wrap" style={{ marginTop: 20 }}>
          <table className="sa-data-table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Data</th>
                <th>Fornitore</th>
                <th>Rif. DDT</th>
                <th>Importo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data.fatturePassive || []).map((f) => (
                <tr key={f.id}>
                  <td>{f.numero}</td>
                  <td>{f.data}</td>
                  <td>{f.fornitore || "—"}</td>
                  <td>{f.riferimentoDdt || "—"}</td>
                  <td>{formatEuro(f.importo)}</td>
                  <td>
                    <button type="button" className="sa-table-action" onClick={() => openPrint("fatturaPassiva", f)}>
                      Stampa
                    </button>{" "}
                    <button type="button" className="sa-table-action" onClick={() => removePassive(f.id)}>
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DdtSection({ data, setData, openPrint }) {
  const [numero, setNumero] = useState("");
  const [dataDoc, setDataDoc] = useState(() => new Date().toISOString().slice(0, 10));
  const [destinatario, setDestinatario] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [causale, setCausale] = useState("Vendita / consegna");
  const [note, setNote] = useState("");
  const [rigaDesc, setRigaDesc] = useState("");
  const [rigaQty, setRigaQty] = useState("1");
  const [righeDraft, setRigheDraft] = useState([]);

  function addRigaDraft() {
    if (!rigaDesc.trim()) return;
    setRigheDraft((r) => [
      ...r,
      { id: newLocalId(), descrizione: rigaDesc.trim(), qty: Math.max(0, Number(rigaQty) || 0) },
    ]);
    setRigaDesc("");
    setRigaQty("1");
  }

  function registerDdt() {
    if (!numero.trim()) return;
    const row = {
      id: newLocalId(),
      numero: numero.trim(),
      data: dataDoc,
      destinatario: destinatario.trim(),
      indirizzo: indirizzo.trim(),
      causale: causale.trim(),
      note: note.trim(),
      righe: righeDraft.map((x) => ({ ...x })),
    };
    setData((d) => ({ ...d, ddt: [row, ...(d.ddt || [])] }));
    setNumero("");
    setNote("");
    setRigheDraft([]);
  }

  function remove(id) {
    setData((d) => ({ ...d, ddt: (d.ddt || []).filter((x) => x.id !== id) }));
  }

  return (
    <section>
      <div className="sa-callout-muted" style={{ marginBottom: 20 }}>
        <p style={{ margin: 0 }}>
          DDT di <strong>uscita</strong> (trasporto merce): destinatario, causale e righe. Persistenza solo locale; in
          produzione si collegheranno PDF, firma digitale e integrazioni SDI dove previsto.
        </p>
      </div>
      <div className="sa-reg-panel sa-reg-panel-wide">
        <h3 className="sa-form-section-title">Nuovo DDT</h3>
        <div className="sa-field-grid">
          <label className="sa-field">
            Numero DDT
            <input value={numero} onChange={(e) => setNumero(e.target.value)} />
          </label>
          <label className="sa-field">
            Data
            <input type="date" value={dataDoc} onChange={(e) => setDataDoc(e.target.value)} />
          </label>
          <label className="sa-field sa-field-span2">
            Destinatario
            <input value={destinatario} onChange={(e) => setDestinatario(e.target.value)} />
          </label>
          <label className="sa-field sa-field-span2">
            Indirizzo
            <input value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} />
          </label>
          <label className="sa-field sa-field-span2">
            Causale
            <input value={causale} onChange={(e) => setCausale(e.target.value)} />
          </label>
          <label className="sa-field sa-field-span2">
            Note
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        <h4 style={{ margin: "20px 0 8px", fontSize: 14 }}>Righe merce</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
          <label className="sa-field" style={{ flex: "1 1 200px" }}>
            Descrizione
            <input value={rigaDesc} onChange={(e) => setRigaDesc(e.target.value)} />
          </label>
          <label className="sa-field" style={{ flex: "0 0 88px" }}>
            Qtà
            <input type="number" min={0} step={1} value={rigaQty} onChange={(e) => setRigaQty(e.target.value)} />
          </label>
          <button type="button" className="sa-btn-outline" onClick={addRigaDraft}>
            Aggiungi riga
          </button>
        </div>
        <ul style={{ margin: "0 0 16px", paddingLeft: 18 }}>
          {righeDraft.map((r) => (
            <li key={r.id}>
              {r.descrizione} — {r.qty}{" "}
              <button type="button" className="sa-table-action" onClick={() => setRigheDraft((x) => x.filter((y) => y.id !== r.id))}>
                rimuovi
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-primary" onClick={registerDdt}>
          Registra DDT
        </button>

        <div className="sa-table-wrap" style={{ marginTop: 24 }}>
          <table className="sa-data-table">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Data</th>
                <th>Destinatario</th>
                <th>Causale</th>
                <th>Righe</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data.ddt || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="sa-table-empty">
                    Nessun DDT.
                  </td>
                </tr>
              ) : (
                (data.ddt || []).map((d) => (
                  <tr key={d.id}>
                    <td>{d.numero}</td>
                    <td>{d.data}</td>
                    <td>{d.destinatario || "—"}</td>
                    <td>{d.causale || "—"}</td>
                    <td>{(d.righe || []).length}</td>
                    <td>
                      <button type="button" className="sa-table-action" onClick={() => openPrint("ddt", d)}>
                        Stampa
                      </button>{" "}
                      <button type="button" className="sa-table-action" onClick={() => remove(d.id)}>
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function PrintBlock({ payload }) {
  const { kind, doc, at } = payload;
  return (
    <div className="sa-print-sheet">
      <p className="sa-print-brand">PizzaManager — Registratore standalone (prova)</p>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>Generato: {new Date(at).toLocaleString("it-IT")}</p>
      <h1 className="sa-print-title">{String(kind)}</h1>
      <PrintDocBody kind={kind} doc={doc} />
      <p className="sa-print-foot">Documento non fiscale — solo anteprima locale Super Admin. Nessun invio SDI o al sistema di interscambio.</p>
    </div>
  );
}

function PrintDocBody({ kind, doc }) {
  if (kind === "fatturaCliente" && doc?.righe) {
    const t = calcRighe(doc.righe);
    return (
      <div>
        <p>
          <strong>{doc.numero}</strong> del {doc.data} — {doc.clienteNome}
          {doc.clientePiva ? ` · P.IVA ${doc.clientePiva}` : ""}
        </p>
        {doc.clienteIndirizzo ? <p style={{ margin: "6px 0" }}>{doc.clienteIndirizzo}</p> : null}
        <table className="sa-print-table">
          <thead>
            <tr>
              <th>Descrizione</th>
              <th>Qtà</th>
              <th>Totale</th>
            </tr>
          </thead>
          <tbody>
            {doc.righe.map((r) => (
              <tr key={r.id}>
                <td>{r.descrizione}</td>
                <td>{r.qty}</td>
                <td>{formatEuro(calcRiga(r).totale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 12, fontWeight: 700 }}>
          Imponibile {formatEuro(t.imponibile)} · IVA {formatEuro(t.iva)} · Totale {formatEuro(t.totale)}
        </p>
      </div>
    );
  }
  if (kind === "vendita" && doc?.righe) {
    const t = calcRighe(doc.righe);
    return (
      <div>
        <p>Pagamento: {doc.pagamento}</p>
        <table className="sa-print-table">
          <thead>
            <tr>
              <th>Descrizione</th>
              <th>Qtà</th>
              <th>Totale</th>
            </tr>
          </thead>
          <tbody>
            {doc.righe.map((r) => (
              <tr key={r.id}>
                <td>{r.descrizione}</td>
                <td>{r.qty}</td>
                <td>{formatEuro(calcRiga(r).totale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 12, fontWeight: 700 }}>Totale {formatEuro(t.totale)}</p>
      </div>
    );
  }
  if (kind === "ddt" && doc) {
    return (
      <div>
        <p>
          <strong>DDT {doc.numero}</strong> del {doc.data}
        </p>
        <p>Destinatario: {doc.destinatario || "—"}</p>
        <p>Indirizzo: {doc.indirizzo || "—"}</p>
        <p>Causale: {doc.causale || "—"}</p>
        <ul>
          {(doc.righe || []).map((r) => (
            <li key={r.id}>
              {r.descrizione} — qtà {r.qty}
            </li>
          ))}
        </ul>
        {doc.note ? <p>Note: {doc.note}</p> : null}
      </div>
    );
  }
  return <pre className="sa-print-pre">{JSON.stringify(doc, null, 2)}</pre>;
}
