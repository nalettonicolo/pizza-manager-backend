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
  salvaPdfPreventivo,
  annullaDocumento,
  enqueueDocumentoEmail,
  getDocumentoSignedUrl,
  depositaDocumentoArchivio,
  TIPI_DOCUMENTO_ARCHIVIO,
  labelTipoDocumento,
} from "@/features/admin/services/tenantDocumentiService";
import {
  listAttrezzatureCatalogo,
  listTenantNoleggi,
  createTenantNoleggio,
  updateTenantNoleggio,
} from "@/features/superadmin/services/noleggiAttrezzatureService";
import CatalogoHardwareManager from "@/features/superadmin/components/CatalogoHardwareManager";
import { buildContrattoCommercialeDati } from "@/features/superadmin/utils/buildContrattoCommercialeDati";
import { generaContrattoCommercialePdfBlob } from "@/utils/contrattoCommercialePdfBuilder";
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

function formatEuro(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
}

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
  const [contratti, setContratti] = useState([]);
  const [preventivi, setPreventivi] = useState([]);
  const [archivioDocs, setArchivioDocs] = useState([]);
  const [loadingTenantData, setLoadingTenantData] = useState(false);

  const [nuovoNoleggio, setNuovoNoleggio] = useState({ attrezzaturaId: "", quantita: 1, modalita: "noleggio" });
  const [savingNoleggio, setSavingNoleggio] = useState(false);

  const [datiContratto, setDatiContratto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [firmatoDa, setFirmatoDa] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPreventivo, setSavingPreventivo] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [emailDest, setEmailDest] = useState("");
  const [emailInfo, setEmailInfo] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [archivioDraft, setArchivioDraft] = useState({ tipo: "comunicazione", titolo: "", note: "" });
  const [archivioFile, setArchivioFile] = useState(null);
  const [savingArchivio, setSavingArchivio] = useState(false);
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
      setError(err?.message || "Impossibile caricare il catalogo hardware.");
    }
  }, []);

  useEffect(() => {
    void loadCatalogoAttrezzature();
  }, [loadCatalogoAttrezzature]);

  const loadTenantData = useCallback(async (id) => {
    if (!id) return;
    setLoadingTenantData(true);
    setError(null);
    setDatiContratto(null);
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
      setContratti((docs || []).filter((d) => d.tipo_documento === "contratto_commerciale"));
      setPreventivi((docs || []).filter((d) => d.tipo_documento === "preventivo_commerciale"));
      setArchivioDocs((docs || []).filter((d) => d.tipo_documento === "pagamento" || d.tipo_documento === "comunicazione"));
      setEmailDest((prev) => prev || fiscale?.email_fatturazione || fiscale?.pec || "");
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
  const noleggiAttivi = useMemo(() => attrezzatureAttive.filter((a) => (a.tipo || "noleggio") === "noleggio"), [attrezzatureAttive]);
  const venditeAttive = useMemo(() => attrezzatureAttive.filter((a) => a.tipo === "vendita"), [attrezzatureAttive]);

  const totaleServizi = serviziSelezionati.reduce((s, r) => s + (Number(r.prezzoMensile) || 0), 0);
  const totaleNoleggio = noleggiAttivi.reduce((s, r) => s + (Number(r.canone_mensile) || 0), 0);
  const totaleVenditaUnaTantum = venditeAttive.reduce((s, r) => s + (Number(r.prezzo_vendita_totale) || 0), 0);

  const attrezzaturaSelezionata = catalogoAttrezzature.find((a) => a.id === nuovoNoleggio.attrezzaturaId) || null;

  function buildDatiCorrenti() {
    return buildContrattoCommercialeDati({
      fornitore,
      tenant: tenantFiscale,
      serviziSelezionati,
      attrezzatureAttive,
      nomePiano: tenantFull?.parametri_operativi?.piano_listino_nome || tenantFull?.piano || "",
    });
  }

  async function handleAggiungiNoleggio() {
    const att = attrezzaturaSelezionata;
    if (!att) {
      setError("Seleziona un prodotto dal catalogo hardware.");
      return;
    }
    const quantita = Math.max(1, Number(nuovoNoleggio.quantita) || 1);
    const modalita = nuovoNoleggio.modalita === "vendita" ? "vendita" : "noleggio";
    if (modalita === "vendita" && !(Number(att.prezzo_vendita) > 0)) {
      setError("Questo prodotto non ha un prezzo di vendita impostato nel catalogo: aggiungilo qui sotto oppure scegli \"Noleggio\".");
      return;
    }
    if (modalita === "noleggio" && !(Number(att.canone_noleggio_mensile) > 0)) {
      setError("Questo prodotto non ha un canone di noleggio impostato nel catalogo: aggiungilo qui sotto oppure scegli \"Vendita\".");
      return;
    }
    setSavingNoleggio(true);
    setError(null);
    try {
      await createTenantNoleggio({
        tenant_id: tenantId,
        stato: "attivo",
        tipo: modalita,
        elenco_attrezzature: `${att.nome} (${att.categoria})`,
        quantita_totale: quantita,
        canone_mensile: modalita === "noleggio" ? Number(att.canone_noleggio_mensile || 0) * quantita : 0,
        cauzione: modalita === "noleggio" ? Number(att.cauzione || 0) * quantita : 0,
        prezzo_vendita_totale: modalita === "vendita" ? Number(att.prezzo_vendita || 0) * quantita : null,
      });
      setNuovoNoleggio({ attrezzaturaId: "", quantita: 1, modalita: "noleggio" });
      await loadTenantData(tenantId);
    } catch (err) {
      setError(err?.message || "Impossibile aggiungere il prodotto.");
    } finally {
      setSavingNoleggio(false);
    }
  }

  async function handleRimuoviNoleggio(id) {
    if (!window.confirm("Segnare questo prodotto come concluso/annullato? Il contratto andrà rigenerato e rifirmato.")) return;
    try {
      await updateTenantNoleggio(id, { stato: "annullato" });
      await loadTenantData(tenantId);
    } catch (err) {
      setError(err?.message || "Operazione non riuscita.");
    }
  }

  function generaAnteprima() {
    const d = buildDatiCorrenti();
    setDatiContratto(d);
    void (async () => {
      const blob = await generaContrattoCommercialePdfBlob({ dati: d });
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    })();
  }

  async function handleSalvaPreventivo(inviaEmail = false) {
    setSavingPreventivo(true);
    setError(null);
    if (inviaEmail) setEmailInfo(null);
    try {
      const d = buildDatiCorrenti();
      const bozza = await creaBozzaDocumento({
        tenantId,
        tipoDocumento: "preventivo_commerciale",
        fornitore,
        tenant: tenantFiscale,
        extra: { servizi: serviziSelezionati, attrezzature: attrezzatureAttive, dati: d },
      });
      const pdfBlob = await generaContrattoCommercialePdfBlob({ dati: d, titolo: "PREVENTIVO" });
      await salvaPdfPreventivo({ documentoId: bozza.id, tenantId, pdfBlob });
      if (inviaEmail) {
        const res = await enqueueDocumentoEmail({
          documentoId: bozza.id,
          variante: "preventivo",
          destinatario: emailDest,
        });
        setEmailInfo(`Preventivo accodato per ${res?.destinatario || emailDest}.`);
      }
      await loadTenantData(tenantId);
    } catch (err) {
      setError(err?.message || "Impossibile salvare il preventivo.");
    } finally {
      setSavingPreventivo(false);
    }
  }

  async function handleAnnullaPreventivo(doc) {
    if (!window.confirm("Annullare questo preventivo? Resta nello storico ma segnato come non più valido.")) return;
    try {
      await annullaDocumento(doc.id);
      await loadTenantData(tenantId);
    } catch (err) {
      setError(err?.message || "Operazione non riuscita.");
    }
  }

  async function handleInviaEmail(doc, variante) {
    setSendingEmailId(doc.id);
    setError(null);
    setEmailInfo(null);
    try {
      const res = await enqueueDocumentoEmail({
        documentoId: doc.id,
        variante,
        destinatario: emailDest,
      });
      setEmailInfo(`Email accodata per ${res?.destinatario || emailDest}. L’invio parte dalla coda notifiche (SMTP di piattaforma).`);
      await loadTenantData(tenantId);
    } catch (err) {
      setError(err?.message || "Impossibile accodare l’email.");
    } finally {
      setSendingEmailId(null);
    }
  }

  async function handleInviaContrattoDaFirmare() {
    setSaving(true);
    setError(null);
    setEmailInfo(null);
    try {
      const d = buildDatiCorrenti();
      const bozza = await creaBozzaDocumento({
        tenantId,
        tipoDocumento: "contratto_commerciale",
        fornitore,
        tenant: tenantFiscale,
        extra: {
          servizi: serviziSelezionati,
          attrezzature: attrezzatureAttive,
          dati: d,
          totale_mensile: totaleServizi + totaleNoleggio,
        },
      });
      const pdfBlob = await generaContrattoCommercialePdfBlob({ dati: d });
      await salvaPdfPreventivo({ documentoId: bozza.id, tenantId, pdfBlob });
      const res = await enqueueDocumentoEmail({
        documentoId: bozza.id,
        variante: "contratto_da_firmare",
        destinatario: emailDest,
      });
      setEmailInfo(`Contratto da firmare accodato per ${res?.destinatario || emailDest}. Il cliente può firmarlo e rinviarlo via email.`);
      await loadTenantData(tenantId);
    } catch (err) {
      setError(err?.message || "Impossibile inviare il contratto da firmare.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFirma() {
    if (!datiContratto) return;
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
          dati: datiContratto,
          totale_mensile: totaleServizi + totaleNoleggio,
        },
      });
      const firmaDataUrl = sigRef.current.toDataURL("image/png");
      const pdfBlob = await generaContrattoCommercialePdfBlob({
        dati: datiContratto,
        firmaDataUrl,
        firmatoDa,
      });
      const firmato = await firmaEDepositaDocumento({ documentoId: bozza.id, tenantId, pdfBlob, firmaDataUrl, firmatoDa });
      try {
        const res = await enqueueDocumentoEmail({
          documentoId: firmato.id,
          variante: "contratto_firmato",
          destinatario: emailDest,
        });
        setEmailInfo(`Copia firmata accodata per ${res?.destinatario || emailDest}.`);
      } catch (mailErr) {
        setEmailInfo(null);
        setSaveError(new Error(`Contratto salvato, ma email non accodata: ${mailErr?.message || mailErr}`));
      }
      setDatiContratto(null);
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

  async function handleDepositaArchivio(inviaEmail) {
    if (!archivioFile) {
      setError("Seleziona un file PDF da depositare.");
      return;
    }
    setSavingArchivio(true);
    setError(null);
    setEmailInfo(null);
    try {
      const doc = await depositaDocumentoArchivio({
        tenantId,
        tipoDocumento: archivioDraft.tipo,
        titolo: archivioDraft.titolo,
        note: archivioDraft.note,
        pdfBlob: archivioFile,
      });
      if (inviaEmail) {
        const res = await enqueueDocumentoEmail({
          documentoId: doc.id,
          variante: "documento",
          destinatario: emailDest,
        });
        setEmailInfo(`Documento accodato per ${res?.destinatario || emailDest}. Compare anche in Documenti del locale.`);
      } else {
        setEmailInfo("Documento depositato. Il cliente lo vede in Documenti.");
      }
      setArchivioDraft({ tipo: "comunicazione", titolo: "", note: "" });
      setArchivioFile(null);
      await loadTenantData(tenantId);
    } catch (err) {
      setError(err?.message || "Impossibile depositare il documento.");
    } finally {
      setSavingArchivio(false);
    }
  }

  async function apriDocumentoPdf(doc) {
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
          Compila preventivo e contratto con i <strong>servizi</strong> e l&apos;<strong>hardware</strong> del cliente.
          Puoi inviare il preventivo via email, mandare il contratto da firmare a un cliente distante, oppure
          far firmare su tablet: in ogni caso la copia parte via email al cliente. Ogni modifica a servizi o
          hardware richiede una nuova firma: il contratto già firmato non è modificabile, solo sostituibile.
        </p>
        <p style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 8 }}>
          Le clausole generali (durata, recesso, foro) restano testo placeholder — vedi{" "}
          <Link to="/superadmin/documenti-legali">ToS, Privacy e DPA</Link>. Solo la parte economica è compilata
          con dati reali.
        </p>
      </header>

      {error ? <div className="dashboard-error" style={{ marginBottom: 16 }}>{error}</div> : null}

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

      <details style={{ ...boxStyle, padding: 0 }}>
        <summary style={{ cursor: "pointer", padding: 18, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
          Catalogo Hardware ({catalogoAttrezzature.length}) — vedi anche{" "}
          <Link to="/superadmin/catalogo-hardware" onClick={(e) => e.stopPropagation()}>pagina dedicata</Link>
        </summary>
        <div style={{ padding: "0 18px 18px" }}>
          <CatalogoHardwareManager catalogo={catalogoAttrezzature} onReload={loadCatalogoAttrezzature} />
        </div>
      </details>

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
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Hardware nel preventivo di questo cliente</h2>
            <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 10px" }}>
              Questa sezione aggiunge il prodotto al preventivo del cliente selezionato sopra — diversa dal
              &quot;Catalogo Hardware&quot; qui sopra, che gestisce solo il listino generale.
            </p>
            {attrezzatureAttive.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>Nessun prodotto hardware in questo preventivo.</p>
            ) : (
              <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 13.5 }}>
                {attrezzatureAttive.map((a) => (
                  <li key={a.id} style={{ marginBottom: 4 }}>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "1px 7px",
                        borderRadius: 999,
                        marginRight: 6,
                        background: a.tipo === "vendita" ? "#fef3c7" : "#e0f2fe",
                        color: a.tipo === "vendita" ? "#92400e" : "#075985",
                      }}
                    >
                      {a.tipo === "vendita" ? "Vendita" : "Noleggio"}
                    </span>
                    {a.elenco_attrezzature} (x{a.quantita_totale}) —{" "}
                    {a.tipo === "vendita"
                      ? `€ ${formatEuro(a.prezzo_vendita_totale)} una tantum`
                      : formatEuroMonth(Number(a.canone_mensile) || 0)}
                    {a.tipo !== "vendita" && Number(a.cauzione) > 0 ? ` · cauzione € ${formatEuro(a.cauzione)}` : ""}{" "}
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
              {totaleVenditaUnaTantum > 0 ? ` · Totale vendita: € ${formatEuro(totaleVenditaUnaTantum)} (una tantum)` : ""}
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
              <div style={{ minWidth: 220 }}>
                <label style={labelStyle}>Aggiungi prodotto dal catalogo</label>
                <select
                  value={nuovoNoleggio.attrezzaturaId}
                  onChange={(e) => setNuovoNoleggio((n) => ({ ...n, attrezzaturaId: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">— Scegli —</option>
                  {catalogoAttrezzature.filter((a) => a.disponibile !== false).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ width: 150 }}>
                <label style={labelStyle}>Modalità</label>
                <select
                  value={nuovoNoleggio.modalita}
                  onChange={(e) => setNuovoNoleggio((n) => ({ ...n, modalita: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="noleggio">
                    Noleggio{attrezzaturaSelezionata ? ` — ${formatEuroMonth(Number(attrezzaturaSelezionata.canone_noleggio_mensile) || 0)}` : ""}
                  </option>
                  <option value="vendita">
                    Vendita{attrezzaturaSelezionata ? ` — € ${formatEuro(attrezzaturaSelezionata.prezzo_vendita)}` : ""}
                  </option>
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
              <button type="button" className="btn-primary-dashboard" disabled={savingNoleggio} onClick={handleAggiungiNoleggio}>
                {savingNoleggio ? "Aggiungo…" : "+ Aggiungi"}
              </button>
            </div>
          </div>

          <div style={boxStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Preventivi e contratto</h2>
            <p style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>
              Totale canone mensile: {formatEuroMonth(totaleServizi + totaleNoleggio)}
              {totaleVenditaUnaTantum > 0 ? ` + € ${formatEuro(totaleVenditaUnaTantum)} hardware una tantum` : ""}
            </p>
            <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 12px" }}>
              Salva e invia il preventivo via email. Se il cliente è in sede, genera l&apos;anteprima e fai firmare su
              tablet (la copia firmata parte automaticamente via email). Se è distante, invia il contratto da firmare
              e rinviare.
            </p>
            <div style={{ marginBottom: 12, maxWidth: 420 }}>
              <label style={labelStyle}>Email del cliente</label>
              <input
                type="email"
                value={emailDest}
                onChange={(e) => setEmailDest(e.target.value)}
                placeholder="email@cliente.it"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="sa-btn-outline" disabled={savingPreventivo} onClick={() => handleSalvaPreventivo(false)}>
                {savingPreventivo ? "Salvataggio…" : "Salva come preventivo"}
              </button>
              <button type="button" className="sa-btn-outline" disabled={savingPreventivo} onClick={() => handleSalvaPreventivo(true)}>
                {savingPreventivo ? "Invio…" : "Salva e invia preventivo via email"}
              </button>
              <button type="button" className="btn-primary-dashboard" onClick={generaAnteprima}>
                Anteprima e firma su tablet
              </button>
              <button type="button" className="sa-btn-outline" disabled={saving} onClick={handleInviaContrattoDaFirmare}>
                {saving ? "Invio…" : "Invia contratto da firmare via email"}
              </button>
            </div>
            {emailInfo ? <p style={{ color: "#166534", fontSize: 13, margin: "10px 0 0" }}>{emailInfo}</p> : null}

            {preventivi.length > 0 ? (
              <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0, borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
                {preventivi.map((d) => (
                  <li key={d.id} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13.5, opacity: d.stato === "annullato" ? 0.55 : 1 }}>
                    <strong>{d.stato === "annullato" ? "Annullato" : "Preventivo"}</strong>
                    {" · "}
                    {new Date(d.created_at).toLocaleString("it-IT")}
                    {d.pdf_url ? (
                      <button
                        type="button"
                        onClick={() => apriDocumentoPdf(d)}
                        style={{ marginLeft: 10, background: "none", border: "none", color: "#962d22", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
                      >
                        Apri PDF
                      </button>
                    ) : null}
                    {d.stato !== "annullato" && d.pdf_url ? (
                      <button
                        type="button"
                        onClick={() => handleInviaEmail(d, "preventivo")}
                        disabled={sendingEmailId === d.id}
                        style={{ marginLeft: 10, background: "none", border: "none", color: "#0f172a", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
                      >
                        {sendingEmailId === d.id ? "Invio…" : "Invia via email"}
                      </button>
                    ) : null}
                    {d.inviato_email_at ? (
                      <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b" }}>
                        inviato {new Date(d.inviato_email_at).toLocaleString("it-IT")}
                        {d.inviato_email_a ? ` a ${d.inviato_email_a}` : ""}
                      </span>
                    ) : null}
                    {d.stato !== "annullato" ? (
                      <button
                        type="button"
                        onClick={() => handleAnnullaPreventivo(d)}
                        style={{ marginLeft: 10, background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: 12.5 }}
                      >
                        Annulla
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

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
                      {saving ? "Salvataggio…" : "Firma su tablet e invia copia al cliente"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div style={boxStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Storico contratti commerciali</h2>
            {contratti.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>Nessun contratto commerciale generato finora per questo cliente.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {contratti.map((d) => (
                  <li key={d.id} style={{ padding: "10px 0", borderBottom: "1px solid #e2e8f0", fontSize: 13.5 }}>
                    <strong>{d.stato === "firmato" ? "✓ Firmato" : d.stato === "annullato" ? "Annullato" : "Bozza"}</strong>
                    {" · "}
                    {new Date(d.created_at).toLocaleString("it-IT")}
                    {d.firmato_da ? ` · firmato da ${d.firmato_da}` : ""}
                    {d.pdf_url ? (
                      <button
                        type="button"
                        onClick={() => apriDocumentoPdf(d)}
                        style={{ marginLeft: 10, background: "none", border: "none", color: "#962d22", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
                      >
                        Apri PDF
                      </button>
                    ) : null}
                    {d.pdf_url && d.stato !== "annullato" ? (
                      <button
                        type="button"
                        onClick={() => handleInviaEmail(d, d.stato === "firmato" ? "contratto_firmato" : "contratto_da_firmare")}
                        disabled={sendingEmailId === d.id}
                        style={{ marginLeft: 10, background: "none", border: "none", color: "#0f172a", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
                      >
                        {sendingEmailId === d.id ? "Invio…" : "Invia via email"}
                      </button>
                    ) : null}
                    {d.inviato_email_at ? (
                      <span style={{ marginLeft: 8, fontSize: 12, color: "#64748b" }}>
                        inviato {new Date(d.inviato_email_at).toLocaleString("it-IT")}
                        {d.inviato_email_a ? ` a ${d.inviato_email_a}` : ""}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={boxStyle}>
            <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Pagamenti e comunicazioni</h2>
            <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 12px" }}>
              Deposita ricevute, fatture di canone o comunicazioni importanti. Il cliente le trova in{" "}
              <strong>Documenti</strong> nella console del locale. Puoi anche mandarle via email.
            </p>
            <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select
                  value={archivioDraft.tipo}
                  onChange={(e) => setArchivioDraft((d) => ({ ...d, tipo: e.target.value }))}
                  style={inputStyle}
                >
                  {TIPI_DOCUMENTO_ARCHIVIO.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Titolo (visibile al cliente)</label>
                <input
                  type="text"
                  value={archivioDraft.titolo}
                  onChange={(e) => setArchivioDraft((d) => ({ ...d, titolo: e.target.value }))}
                  placeholder="Es. Ricevuta canone agosto 2026"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>File PDF</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setArchivioFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <button type="button" className="sa-btn-outline" disabled={savingArchivio} onClick={() => handleDepositaArchivio(false)}>
                {savingArchivio ? "Salvataggio…" : "Deposita in Documenti"}
              </button>
              <button type="button" className="btn-primary-dashboard" disabled={savingArchivio} onClick={() => handleDepositaArchivio(true)}>
                {savingArchivio ? "Invio…" : "Deposita e invia via email"}
              </button>
            </div>
            {archivioDocs.length > 0 ? (
              <ul style={{ listStyle: "none", margin: "16px 0 0", padding: 0, borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
                {archivioDocs.map((d) => (
                  <li key={d.id} style={{ padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13.5, opacity: d.stato === "annullato" ? 0.55 : 1 }}>
                    <strong>{labelTipoDocumento(d.tipo_documento, d.dati_snapshot)}</strong>
                    {" · "}
                    {new Date(d.created_at).toLocaleString("it-IT")}
                    {d.pdf_url ? (
                      <button
                        type="button"
                        onClick={() => apriDocumentoPdf(d)}
                        style={{ marginLeft: 10, background: "none", border: "none", color: "#962d22", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
                      >
                        Apri PDF
                      </button>
                    ) : null}
                    {d.pdf_url && d.stato !== "annullato" ? (
                      <button
                        type="button"
                        onClick={() => handleInviaEmail(d, "documento")}
                        disabled={sendingEmailId === d.id}
                        style={{ marginLeft: 10, background: "none", border: "none", color: "#0f172a", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
                      >
                        {sendingEmailId === d.id ? "Invio…" : "Invia via email"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
