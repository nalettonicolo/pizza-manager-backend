import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import Loader from "@/components/feedback/Loader";
import { getTenant, getTenants } from "@/features/superadmin/services/superadminService";
import { loadServicesCatalog } from "@/features/superadmin/catalog/servicesStorage";
import { resolveServiziIdsForTenant } from "@/app/hooks/useTenantServizi";
import {
  getFornitoreConfig,
  getTenantDatiFiscali,
  listTenantDocumenti,
  creaBozzaDocumento,
  firmaEDepositaDocumento,
  getDocumentoSignedUrl,
} from "@/features/admin/services/tenantDocumentiService";
import {
  listAttrezzatureCatalogo,
  listTenantNoleggi,
  createTenantNoleggio,
  updateTenantNoleggio,
  createAttrezzaturaCatalogo,
  updateAttrezzaturaCatalogo,
} from "@/features/superadmin/services/noleggiAttrezzatureService";

const CATEGORIE_ATTREZZATURA = ["tablet", "stampante", "pos", "router", "lettore_barcode", "kit_completo", "altro"];
import { buildContrattoCommercialeParagrafi } from "@/features/superadmin/utils/buildContrattoCommercialeParagrafi";
import { generaPdfBlob } from "@/utils/contrattoPdfBuilder";
import { formatEuroMonth } from "@/features/superadmin/catalog/servicesStorage";

const boxStyle = {
  padding: 18,
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  marginBottom: 20,
};
const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
  fontSize: 14,
};
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "#475569" };

export default function SuperadminPreventiviContrattiPage() {
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [error, setError] = useState(null);

  const [fornitore, setFornitore] = useState(null);
  const [tenantFull, setTenantFull] = useState(null);
  const [tenantFiscale, setTenantFiscale] = useState(null);
  const [catalogServices, setCatalogServices] = useState([]);
  const [catalogoAttrezzature, setCatalogoAttrezzature] = useState([]);
  const [noleggi, setNoleggi] = useState([]);
  const [documenti, setDocumenti] = useState([]);
  const [loadingTenantData, setLoadingTenantData] = useState(false);

  const [nuovoNoleggio, setNuovoNoleggio] = useState({ attrezzaturaId: "", quantita: 1, canone: "", cauzione: "" });
  const [savingNoleggio, setSavingNoleggio] = useState(false);

  const [nuovaAttrezzatura, setNuovaAttrezzatura] = useState({
    nome: "",
    categoria: "tablet",
    canone_noleggio_mensile: "",
    cauzione: "",
    descrizione: "",
  });
  const [savingAttrezzatura, setSavingAttrezzatura] = useState(false);

  const [paragrafi, setParagrafi] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [firmatoDa, setFirmatoDa] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const sigRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [list, forn] = await Promise.all([getTenants(), getFornitoreConfig()]);
        setTenants(list || []);
        setFornitore(forn);
      } catch (err) {
        setError(err?.message || "Impossibile caricare l'elenco clienti.");
      } finally {
        setLoadingTenants(false);
      }
    })();
  }, []);

  useEffect(() => {
    setCatalogServices(loadServicesCatalog());
  }, []);

  const loadCatalogoAttrezzature = useCallback(async () => {
    try {
      const cat = await listAttrezzatureCatalogo({});
      setCatalogoAttrezzature(cat);
    } catch (err) {
      setError(err?.message || "Impossibile caricare il catalogo attrezzature.");
    }
  }, []);

  useEffect(() => {
    void loadCatalogoAttrezzature();
  }, [loadCatalogoAttrezzature]);

  const loadTenantData = useCallback(async (id) => {
    if (!id) return;
    setLoadingTenantData(true);
    setError(null);
    setParagrafi(null);
    setPreviewUrl("");
    try {
      const [full, fiscale, nol, docs] = await Promise.all([
        getTenant(id),
        getTenantDatiFiscali(id),
        listTenantNoleggi(id),
        listTenantDocumenti(id),
      ]);
      setTenantFull(full);
      setTenantFiscale(fiscale);
      setNoleggi(nol);
      setDocumenti((docs || []).filter((d) => d.tipo_documento === "contratto_commerciale"));
    } catch (err) {
      setError(err?.message || "Impossibile caricare i dati del cliente.");
    } finally {
      setLoadingTenantData(false);
    }
  }, []);

  useEffect(() => {
    if (tenantId) void loadTenantData(tenantId);
  }, [tenantId, loadTenantData]);

  const serviziSelezionati = useMemo(() => {
    if (!tenantFull) return [];
    const ids = resolveServiziIdsForTenant(tenantFull);
    return catalogServices.filter((s) => ids.has(s.id));
  }, [tenantFull, catalogServices]);

  const attrezzatureAttive = useMemo(
    () => noleggi.filter((n) => n.stato === "attivo" || n.stato === "in_attesa"),
    [noleggi],
  );

  const totaleServizi = serviziSelezionati.reduce((s, r) => s + (Number(r.prezzoMensile) || 0), 0);
  const totaleNoleggio = attrezzatureAttive.reduce((s, r) => s + (Number(r.canone_mensile) || 0), 0);

  async function handleAggiungiNoleggio() {
    const att = catalogoAttrezzature.find((a) => a.id === nuovoNoleggio.attrezzaturaId);
    if (!att) {
      setError("Seleziona un'attrezzatura dal catalogo.");
      return;
    }
    const quantita = Math.max(1, Number(nuovoNoleggio.quantita) || 1);
    const canone = nuovoNoleggio.canone !== "" ? Number(nuovoNoleggio.canone) : Number(att.canone_noleggio_mensile) * quantita;
    const cauzione = nuovoNoleggio.cauzione !== "" ? Number(nuovoNoleggio.cauzione) : Number(att.cauzione || 0) * quantita;
    setSavingNoleggio(true);
    setError(null);
    try {
      await createTenantNoleggio({
        tenant_id: tenantId,
        stato: "attivo",
        elenco_attrezzature: `${att.nome} (${att.categoria})`,
        quantita_totale: quantita,
        canone_mensile: canone,
        cauzione,
      });
      setNuovoNoleggio({ attrezzaturaId: "", quantita: 1, canone: "", cauzione: "" });
      await loadTenantData(tenantId);
    } catch (err) {
      setError(err?.message || "Impossibile aggiungere l'attrezzatura.");
    } finally {
      setSavingNoleggio(false);
    }
  }

  async function handleRimuoviNoleggio(id) {
    if (!window.confirm("Segnare questa attrezzatura come conclusa/annullata? Il contratto andrà rigenerato e rifirmato.")) return;
    try {
      await updateTenantNoleggio(id, { stato: "annullato" });
      await loadTenantData(tenantId);
    } catch (err) {
      setError(err?.message || "Operazione non riuscita.");
    }
  }

  async function handleAggiungiAttrezzaturaCatalogo() {
    const nome = nuovaAttrezzatura.nome.trim();
    const canone = Number(nuovaAttrezzatura.canone_noleggio_mensile);
    if (!nome || !Number.isFinite(canone) || canone < 0) {
      setError("Nome e canone mensile (≥ 0) sono obbligatori per aggiungere un'attrezzatura al catalogo.");
      return;
    }
    setSavingAttrezzatura(true);
    setError(null);
    try {
      await createAttrezzaturaCatalogo({
        nome,
        categoria: nuovaAttrezzatura.categoria,
        canone_noleggio_mensile: canone,
        cauzione: nuovaAttrezzatura.cauzione !== "" ? Number(nuovaAttrezzatura.cauzione) : 0,
        descrizione: nuovaAttrezzatura.descrizione.trim() || null,
        disponibile: true,
      });
      setNuovaAttrezzatura({ nome: "", categoria: "tablet", canone_noleggio_mensile: "", cauzione: "", descrizione: "" });
      await loadCatalogoAttrezzature();
    } catch (err) {
      setError(err?.message || "Impossibile aggiungere l'attrezzatura al catalogo.");
    } finally {
      setSavingAttrezzatura(false);
    }
  }

  async function handleToggleDisponibileCatalogo(item) {
    try {
      await updateAttrezzaturaCatalogo(item.id, { disponibile: !item.disponibile });
      await loadCatalogoAttrezzature();
    } catch (err) {
      setError(err?.message || "Operazione non riuscita.");
    }
  }

  function generaAnteprima() {
    const p = buildContrattoCommercialeParagrafi({
      fornitore,
      tenant: tenantFiscale,
      serviziSelezionati,
      attrezzatureAttive,
      nomePiano: tenantFull?.parametri_operativi?.piano_listino_nome || tenantFull?.piano || "",
    });
    setParagrafi(p);
    void (async () => {
      const blob = await generaPdfBlob({ titolo: `Contratto commerciale — ${tenantFiscale?.nome || ""}`, paragrafi: p });
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    })();
  }

  async function handleFirma() {
    if (!paragrafi) return;
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setSaveError(new Error("Disegna la firma prima di confermare."));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const bozza = await creaBozzaDocumento({
        tenantId,
        tipoDocumento: "contratto_commerciale",
        fornitore,
        tenant: tenantFiscale,
        extra: {
          servizi: serviziSelezionati,
          attrezzature: attrezzatureAttive,
          paragrafi,
          totale_mensile: totaleServizi + totaleNoleggio,
        },
      });
      const firmaDataUrl = sigRef.current.toDataURL("image/png");
      const pdfBlob = await generaPdfBlob({
        titolo: `Contratto commerciale — ${tenantFiscale?.nome || ""}`,
        paragrafi,
        firmaDataUrl,
        firmatoDa,
      });
      await firmaEDepositaDocumento({ documentoId: bozza.id, tenantId, pdfBlob, firmaDataUrl, firmatoDa });
      setParagrafi(null);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return "";
      });
      setFirmatoDa("");
      sigRef.current?.clear();
      await loadTenantData(tenantId);
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  async function apriDocumentoFirmato(doc) {
    if (!doc?.pdf_url) return;
    try {
      const url = await getDocumentoSignedUrl(doc.pdf_url);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err?.message || "Impossibile aprire il PDF.");
    }
  }

  return (
    <div className="dashboard-settings-page">
      <header className="sa-page-header" style={{ marginBottom: 20 }}>
        <p className="sa-page-kicker">Super Admin · commerciale</p>
        <h1 className="dashboard-page-title sa-page-title">Preventivi e contratti</h1>
        <p className="sa-page-lede" style={{ maxWidth: 820 }}>
          Compila il contratto con i <strong>servizi</strong> e le <strong>attrezzature a noleggio</strong> reali del
          cliente, genera l&apos;anteprima e fai firmare su tablet. Ogni modifica a servizi o attrezzature richiede
          una nuova firma: il contratto già firmato non è mai modificabile, solo sostituibile con uno nuovo.
        </p>
        <p style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 8 }}>
          ⚠️ Le clausole legali generali (durata, recesso, foro competente) restano testo placeholder non validato
          da un legale — vedi <Link to="/admin/documenti">Documenti</Link>. Solo la parte economica (servizi/
          attrezzature) è compilata con dati reali.
        </p>
      </header>

      {error ? <div className="dashboard-error" style={{ marginBottom: 16 }}>{error}</div> : null}

      <details style={{ ...boxStyle, padding: 0 }}>
        <summary style={{ cursor: "pointer", padding: 18, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
          Catalogo attrezzature a noleggio ({catalogoAttrezzature.length})
        </summary>
        <div style={{ padding: "0 18px 18px" }}>
          {catalogoAttrezzature.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748b" }}>Catalogo vuoto: aggiungi la prima attrezzatura qui sotto.</p>
          ) : (
            <ul style={{ margin: "0 0 14px", padding: 0, listStyle: "none" }}>
              {catalogoAttrezzature.map((a) => (
                <li key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid #e2e8f0", fontSize: 13.5, opacity: a.disponibile ? 1 : 0.5 }}>
                  <strong>{a.nome}</strong> ({a.categoria}) — {formatEuroMonth(Number(a.canone_noleggio_mensile) || 0)}/mese
                  {Number(a.cauzione) > 0 ? `, cauzione ${formatEuroMonth(Number(a.cauzione))}` : ""}
                  <button
                    type="button"
                    onClick={() => handleToggleDisponibileCatalogo(a)}
                    style={{ marginLeft: 10, background: "none", border: "none", color: "#962d22", cursor: "pointer", fontSize: 12.5, textDecoration: "underline" }}
                  >
                    {a.disponibile ? "Rendi non disponibile" : "Rendi disponibile"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
            <div style={{ minWidth: 160 }}>
              <label style={labelStyle}>Nome</label>
              <input type="text" value={nuovaAttrezzatura.nome} onChange={(e) => setNuovaAttrezzatura((n) => ({ ...n, nome: e.target.value }))} style={inputStyle} placeholder="es. Tablet Samsung 10&quot;" />
            </div>
            <div style={{ width: 150 }}>
              <label style={labelStyle}>Categoria</label>
              <select value={nuovaAttrezzatura.categoria} onChange={(e) => setNuovaAttrezzatura((n) => ({ ...n, categoria: e.target.value }))} style={inputStyle}>
                {CATEGORIE_ATTREZZATURA.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ width: 140 }}>
              <label style={labelStyle}>Canone (€/mese)</label>
              <input type="number" step="0.01" value={nuovaAttrezzatura.canone_noleggio_mensile} onChange={(e) => setNuovaAttrezzatura((n) => ({ ...n, canone_noleggio_mensile: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ width: 130 }}>
              <label style={labelStyle}>Cauzione (€)</label>
              <input type="number" step="0.01" value={nuovaAttrezzatura.cauzione} onChange={(e) => setNuovaAttrezzatura((n) => ({ ...n, cauzione: e.target.value }))} style={inputStyle} />
            </div>
            <button type="button" className="btn-primary-dashboard" disabled={savingAttrezzatura} onClick={handleAggiungiAttrezzaturaCatalogo}>
              {savingAttrezzatura ? "Aggiungo…" : "+ Aggiungi al catalogo"}
            </button>
          </div>
        </div>
      </details>

      <div style={boxStyle}>
        <label style={labelStyle}>Cliente (tenant)</label>
        {loadingTenants ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>Caricamento…</p>
        ) : (
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} style={{ ...inputStyle, maxWidth: 420 }}>
            <option value="">— Seleziona un cliente —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome} {t.slug ? `(${t.slug})` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {tenantId && loadingTenantData ? <Loader /> : null}

      {tenantId && !loadingTenantData && tenantFull ? (
        <>
          <div style={boxStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Servizi inclusi</h2>
            <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 10px" }}>
              Per cambiare i servizi vai su{" "}
              <Link to="/superadmin/tenants">Clienti (tenant) → Modifica → Contratto e servizi</Link>, poi torna qui e
              rigenera l&apos;anteprima.
            </p>
            {serviziSelezionati.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>Nessun servizio aggiuntivo oltre al piano base.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
                {serviziSelezionati.map((s) => (
                  <li key={s.id}>
                    {s.nome} — {formatEuroMonth(Number(s.prezzoMensile) || 0)}
                  </li>
                ))}
              </ul>
            )}
            <p style={{ marginTop: 10, fontWeight: 700, fontSize: 13.5 }}>Totale servizi: {formatEuroMonth(totaleServizi)}</p>
          </div>

          <div style={boxStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Attrezzature a noleggio</h2>
            {attrezzatureAttive.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>Nessuna attrezzatura a noleggio attiva.</p>
            ) : (
              <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 13.5 }}>
                {attrezzatureAttive.map((a) => (
                  <li key={a.id} style={{ marginBottom: 4 }}>
                    {a.elenco_attrezzature} (x{a.quantita_totale}) — {formatEuroMonth(Number(a.canone_mensile) || 0)}
                    {Number(a.cauzione) > 0 ? ` · cauzione ${formatEuroMonth(Number(a.cauzione))}` : ""}{" "}
                    <button
                      type="button"
                      onClick={() => handleRimuoviNoleggio(a.id)}
                      style={{ marginLeft: 8, background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: 12.5 }}
                    >
                      Rimuovi
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 14 }}>
              Totale noleggio: {formatEuroMonth(totaleNoleggio)}
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
              <div style={{ minWidth: 220 }}>
                <label style={labelStyle}>Aggiungi attrezzatura dal catalogo</label>
                <select
                  value={nuovoNoleggio.attrezzaturaId}
                  onChange={(e) => setNuovoNoleggio((n) => ({ ...n, attrezzaturaId: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">— Scegli —</option>
                  {catalogoAttrezzature.filter((a) => a.disponibile !== false).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} — {formatEuroMonth(Number(a.canone_noleggio_mensile) || 0)}/mese
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ width: 90 }}>
                <label style={labelStyle}>Quantità</label>
                <input
                  type="number"
                  min={1}
                  value={nuovoNoleggio.quantita}
                  onChange={(e) => setNuovoNoleggio((n) => ({ ...n, quantita: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div style={{ width: 130 }}>
                <label style={labelStyle}>Canone (€/mese)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="auto"
                  value={nuovoNoleggio.canone}
                  onChange={(e) => setNuovoNoleggio((n) => ({ ...n, canone: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div style={{ width: 130 }}>
                <label style={labelStyle}>Cauzione (€)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="auto"
                  value={nuovoNoleggio.cauzione}
                  onChange={(e) => setNuovoNoleggio((n) => ({ ...n, cauzione: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <button type="button" className="btn-primary-dashboard" disabled={savingNoleggio} onClick={handleAggiungiNoleggio}>
                {savingNoleggio ? "Aggiungo…" : "+ Aggiungi"}
              </button>
            </div>
          </div>

          <div style={boxStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Genera contratto</h2>
            <p style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>
              Totale mensile complessivo: {formatEuroMonth(totaleServizi + totaleNoleggio)}
            </p>
            <button type="button" className="btn-primary-dashboard" onClick={generaAnteprima}>
              Genera anteprima
            </button>

            {previewUrl ? (
              <div style={{ marginTop: 16 }}>
                <iframe title="Anteprima contratto" src={previewUrl} style={{ width: "100%", height: 480, border: "1px solid #e2e8f0", borderRadius: 8 }} />

                <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                  <label style={labelStyle}>Nome di chi firma (il cliente)</label>
                  <input
                    type="text"
                    value={firmatoDa}
                    onChange={(e) => setFirmatoDa(e.target.value)}
                    placeholder="Nome e cognome"
                    style={{ ...inputStyle, maxWidth: 320, marginBottom: 12 }}
                  />
                  <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 6px" }}>Firma (disegna con dito o mouse)</p>
                  <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", touchAction: "none" }}>
                    <SignatureCanvas ref={sigRef} penColor="#0f172a" canvasProps={{ width: 500, height: 160, style: { width: "100%", height: 160 } }} />
                  </div>
                  <button type="button" onClick={() => sigRef.current?.clear()} style={{ marginTop: 6, fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                    Cancella firma
                  </button>
                  {saveError ? <p style={{ color: "#b91c1c", fontSize: 13, margin: "8px 0" }}>{saveError.message}</p> : null}
                  <div style={{ marginTop: 10 }}>
                    <button type="button" className="btn-primary-dashboard" disabled={saving} onClick={handleFirma}>
                      {saving ? "Salvataggio…" : "Firma e conferma contratto"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div style={boxStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Storico contratti commerciali</h2>
            {documenti.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>Nessun contratto commerciale generato finora per questo cliente.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {documenti.map((d) => (
                  <li key={d.id} style={{ padding: "10px 0", borderBottom: "1px solid #e2e8f0", fontSize: 13.5 }}>
                    <strong>{d.stato === "firmato" ? "✓ Firmato" : d.stato === "annullato" ? "Annullato" : "Bozza"}</strong>
                    {" · "}
                    {new Date(d.created_at).toLocaleString("it-IT")}
                    {d.firmato_da ? ` · firmato da ${d.firmato_da}` : ""}
                    {d.stato === "firmato" && d.pdf_url ? (
                      <button
                        type="button"
                        onClick={() => apriDocumentoFirmato(d)}
                        style={{ marginLeft: 10, background: "none", border: "none", color: "#962d22", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
                      >
                        Apri PDF
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
