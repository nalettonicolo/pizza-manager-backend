import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getConfigurazioneGenerale,
  updateConfigurazioneGenerale,
} from "@/features/superadmin/services/superadminService";
import { getFornitoreConfig, saveFornitoreConfig } from "@/features/admin/services/tenantDocumentiService";

const FORNITORE_VUOTO = {
  ragione_sociale: "",
  indirizzo: "",
  piva: "",
  legale_rappresentante: "",
  email_contatto: "",
  email_privacy: "",
  foro_competente: "",
  iban: "",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ddd",
  borderRadius: 6,
  boxSizing: "border-box",
  fontSize: 14,
};
const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#333" };

export default function Settings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const [fornitore, setFornitore] = useState(null);
  const [loadingFornitore, setLoadingFornitore] = useState(true);
  const [savingFornitore, setSavingFornitore] = useState(false);
  const [fornitoreError, setFornitoreError] = useState(null);
  const [fornitoreSaved, setFornitoreSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getConfigurazioneGenerale();
      setConfig(
        data || { nome_applicazione: "PizzaManager", email_supporto: "", url_supporto: "" },
      );
    } catch (err) {
      setError(err?.message || "Impossibile caricare la configurazione generale.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFornitore = useCallback(async () => {
    setLoadingFornitore(true);
    setFornitoreError(null);
    try {
      const data = await getFornitoreConfig();
      setFornitore(data || FORNITORE_VUOTO);
    } catch (err) {
      setFornitoreError(err?.message || "Impossibile caricare i dati fornitore.");
    } finally {
      setLoadingFornitore(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadFornitore();
  }, [load, loadFornitore]);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateConfigurazioneGenerale({
        nomeApplicazione: config.nome_applicazione,
        emailSupporto: config.email_supporto,
        urlSupporto: config.url_supporto,
      });
      setSaved(true);
      await load();
    } catch (err) {
      setError(err?.message || "Salvataggio non riuscito.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveFornitore() {
    if (!fornitore) return;
    const obbligatori = ["ragione_sociale", "indirizzo", "piva", "legale_rappresentante", "email_contatto", "email_privacy", "foro_competente"];
    const mancanti = obbligatori.filter((k) => !String(fornitore[k] || "").trim());
    if (mancanti.length) {
      setFornitoreError(`Campi obbligatori mancanti: ${mancanti.join(", ")}`);
      return;
    }
    setSavingFornitore(true);
    setFornitoreSaved(false);
    setFornitoreError(null);
    try {
      await saveFornitoreConfig(fornitore);
      setFornitoreSaved(true);
      await loadFornitore();
    } catch (err) {
      setFornitoreError(err?.message || "Salvataggio non riuscito.");
    } finally {
      setSavingFornitore(false);
    }
  }

  return (
    <>
      <h1 className="dashboard-page-title">Impostazioni</h1>
      <p style={{ margin: "0 0 24px 0", fontSize: 15, color: "#555", maxWidth: "100%" }}>
        Configura i parametri globali della piattaforma PizzaManager. Le modifiche si applicano a tutti i clienti (pizzerie) che usano il servizio.
      </p>

      <div className="dashboard-box" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Configurazione generale</h2>
        <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#666" }}>
          Nome e contatti di supporto mostrati ai clienti (es. pagina{" "}
          <Link to="/support" style={{ color: "#c0392b" }}>
            /support
          </Link>
          ).
        </p>
        {loading ? (
          <p style={{ fontSize: 14, color: "#64748b" }}>Caricamento…</p>
        ) : error ? (
          <p style={{ fontSize: 14, color: "#b91c1c" }}>{error}</p>
        ) : config ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nome applicazione</label>
              <input
                type="text"
                value={config.nome_applicazione || ""}
                onChange={(e) => setConfig((c) => ({ ...c, nome_applicazione: e.target.value }))}
                style={inputStyle}
                placeholder="PizzaManager"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>URL pagina supporto</label>
                <input
                  type="url"
                  value={config.url_supporto || ""}
                  onChange={(e) => setConfig((c) => ({ ...c, url_supporto: e.target.value }))}
                  placeholder="https://support.pizzamanager.it"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Email supporto</label>
                <input
                  type="email"
                  value={config.email_supporto || ""}
                  onChange={(e) => setConfig((c) => ({ ...c, email_supporto: e.target.value }))}
                  placeholder="support@pizzamanager.it"
                  style={inputStyle}
                />
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#94a3b8" }}>
                  Sostituisce l&apos;email mostrata nella pagina Supporto pubblica. Diversa dall&apos;email che riceve
                  gli alert automatici sugli errori dei tenant (quella si imposta in{" "}
                  <Link to="/superadmin/azioni-da-completare" style={{ color: "#94a3b8", textDecoration: "underline" }}>
                    Azioni da completare
                  </Link>
                  ).
                </p>
              </div>
            </div>
            <button type="button" className="btn-primary-dashboard" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Salvataggio…" : "Salva impostazioni"}
            </button>
            {saved && <span style={{ marginLeft: 12, fontSize: 14, color: "#2e7d32" }}>Salvato.</span>}
          </>
        ) : null}
      </div>

      <div className="dashboard-box" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Dati Fornitore (per contratti e documenti)</h2>
        <p style={{ margin: "0 0 20px 0", fontSize: 14, color: "#666" }}>
          Dati fissi di PizzaManager usati per precompilare Contratti, Preventivi, ToS, Privacy e DPA — vuoti finché
          non li imposti qui: senza questi, ogni documento generato in{" "}
          <Link to="/superadmin/preventivi-contratti" style={{ color: "#c0392b" }}>
            Preventivi e contratti
          </Link>{" "}
          mostra segnaposto al posto della ragione sociale.
        </p>
        {loadingFornitore ? (
          <p style={{ fontSize: 14, color: "#64748b" }}>Caricamento…</p>
        ) : fornitore ? (
          <>
            {fornitoreError ? <p style={{ fontSize: 13, color: "#b91c1c", margin: "0 0 12px" }}>{fornitoreError}</p> : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Ragione sociale *</label>
                <input type="text" value={fornitore.ragione_sociale || ""} onChange={(e) => setFornitore((f) => ({ ...f, ragione_sociale: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Indirizzo *</label>
                <input type="text" value={fornitore.indirizzo || ""} onChange={(e) => setFornitore((f) => ({ ...f, indirizzo: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>P.IVA *</label>
                <input type="text" value={fornitore.piva || ""} onChange={(e) => setFornitore((f) => ({ ...f, piva: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Legale rappresentante *</label>
                <input type="text" value={fornitore.legale_rappresentante || ""} onChange={(e) => setFornitore((f) => ({ ...f, legale_rappresentante: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email contatto *</label>
                <input type="email" value={fornitore.email_contatto || ""} onChange={(e) => setFornitore((f) => ({ ...f, email_contatto: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email privacy *</label>
                <input type="email" value={fornitore.email_privacy || ""} onChange={(e) => setFornitore((f) => ({ ...f, email_privacy: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Foro competente *</label>
                <input type="text" value={fornitore.foro_competente || ""} onChange={(e) => setFornitore((f) => ({ ...f, foro_competente: e.target.value }))} style={inputStyle} placeholder="es. Tribunale di..." />
              </div>
              <div>
                <label style={labelStyle}>IBAN (facoltativo)</label>
                <input type="text" value={fornitore.iban || ""} onChange={(e) => setFornitore((f) => ({ ...f, iban: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <button type="button" className="btn-primary-dashboard" disabled={savingFornitore} onClick={() => void handleSaveFornitore()}>
              {savingFornitore ? "Salvataggio…" : "Salva dati fornitore"}
            </button>
            {fornitoreSaved && <span style={{ marginLeft: 12, fontSize: 14, color: "#2e7d32" }}>Salvato.</span>}
          </>
        ) : null}
      </div>

      <div className="dashboard-box" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Piani di abbonamento</h2>
        <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "#666" }}>
          Da <strong>Piani</strong> apri una finestra per ogni piano: nome, canone mensile (somma servizi),{" "}
          <strong>validità listino in mesi di calendario</strong> (di norma 1 mese),{" "}
          <strong>sconto opzionale sull&apos;abbonamento annuale</strong>{" "}
          (anticipo 12 mensilità), abilitazione, descrizione e <strong>servizi inclusi</strong>. Non esiste un piano free
          permanente: i nuovi clienti partono con la <strong>prova di 14 giorni</strong>. Il ciclo mensile/annuale sul
          cliente si imposta in <strong>Clienti → Abbonamento</strong>.
        </p>
        <Link to="/superadmin/piani" className="btn-primary-dashboard" style={{ display: "inline-block", textDecoration: "none" }}>
          Vai a Piani di abbonamento →
        </Link>
      </div>

      <div className="dashboard-box" style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Navigazione</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#555", lineHeight: 1.65 }}>
          Le altre aree della console (clienti, piani, abbonamenti, documentazione, ecc.) sono raggiungibili dalla{" "}
          <strong>barra in alto</strong>, senza ripetere qui l&apos;elenco delle voci.
        </p>
      </div>
    </>
  );
}
