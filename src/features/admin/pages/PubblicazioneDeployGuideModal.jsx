import { useEffect, useId } from "react";
import {
  PUBLIC_DOMAIN_CNAME_TARGET,
  PUBLIC_DOMAIN_FIREBASE_DOCS_URL,
  PUBLIC_SAAS_BASE_URL,
} from "@/config/publicDomain";
import DnsHostGuidesPanel from "@/features/pubblicazione/DnsHostGuidesPanel";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  overflowY: "auto",
};

const panelStyle = {
  width: "100%",
  maxWidth: 880,
  maxHeight: "min(92vh, 960px)",
  overflow: "auto",
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
  border: "1px solid #e2e8f0",
};

const stepHead = {
  fontSize: 15,
  fontWeight: 700,
  color: "#0f172a",
  margin: "0 0 8px",
};

const pText = { margin: "0 0 10px", fontSize: 14, lineHeight: 1.7, color: "#334155" };

const codeBlock = {
  display: "block",
  margin: "8px 0 12px",
  padding: "12px 14px",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "ui-monospace, monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

/**
 * Guida operativa: stesso frontend PizzaManager sul dominio del cliente + impostazioni tenant (Super Admin).
 */
export default function PubblicazioneDeployGuideModal({ open, onClose }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={panelStyle}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 1,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "18px 20px",
            borderBottom: "1px solid #e2e8f0",
            background: "#fafafa",
            borderRadius: "14px 14px 0 0",
          }}
        >
          <div>
            <h2 id={titleId} style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>
              Guida — Go-live sul dominio del cliente
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
              Sul dominio del cliente si pubblica il <strong>frontend</strong> della webapp (stesso codice di{" "}
              {PUBLIC_SAAS_BASE_URL}). Menu, logo, colori e orari sono quelli del <strong>tenant</strong> risolti
              automaticamente in base al dominio. Non serve un deploy per ogni nuovo hostname.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi guida"
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              color: "#64748b",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "20px 22px 24px" }}>
          <section style={{ marginBottom: 22 }}>
            <p style={pText}>
              <strong>Come funziona:</strong> non serve una build separata per ogni pizzeria. Dopo il deploy, l&apos;app
              legge l&apos;hostname (es. <code>menu.tuosito.it</code> o <code>tuouslug.pizzamanager.it</code>) e
              carica i dati del tenant corretto da Supabase. Le impostazioni che modifichi in Admin (layout, orari,
              menu) si riflettono sul dominio del cliente dopo aggiornamento dati e cache browser.
            </p>
          </section>

          <ol style={{ margin: 0, paddingLeft: 22, fontSize: 14, color: "#334155", lineHeight: 1.75 }}>
            <li style={{ marginBottom: 18 }}>
              <p style={stepHead}>1. Prepara il tenant (anagrafica + Admin locale)</p>
              <p style={pText}>
                L&apos;admin del tenant compila <strong>Admin → Impostazioni</strong> (dati pizzeria, layout, orari) e il
                menu. In <strong>Super Admin → Go-live cliente</strong> verifica lo <strong>slug</strong>, salva il{" "}
                <strong>dominio menu</strong> (<code>public_domain</code>) e usa «sito web cliente» solo se esiste un sito
                marketing esterno diverso. Aggiorna lo <strong>stato pubblicazione</strong> durante il go-live.
              </p>
            </li>

            <li style={{ marginBottom: 18 }}>
              <p style={stepHead}>2. Database Supabase (una tantum per la piattaforma)</p>
              <p style={pText}>
                Assicurati che sia applicata la migrazione con dominio pubblico e funzioni RPC (es.{" "}
                <code>20260323120000_tenants_public_domain_and_rpc.sql</code>). Da Supabase: SQL Editor → incolla
                migrazione oppure <code>supabase db push</code> dal progetto.
              </p>
            </li>

            <li style={{ marginBottom: 18 }}>
              <p style={stepHead}>3. Firebase Hosting — collega il dominio del cliente</p>
              <p style={pText}>
                Nel progetto Firebase che ospita il sito (es. <code>pizzamanager.it</code>):{" "}
                <strong>Hosting → Aggiungi dominio personalizzato</strong> → inserisci lo stesso hostname salvato in
                Pubblicazione. Segui la verifica (record TXT o file) fino allo stato &quot;Connesso&quot;. Poi il
                certificato SSL sarà emesso automaticamente.
              </p>
              <a
                href={PUBLIC_DOMAIN_FIREBASE_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#c0392b", fontWeight: 600, fontSize: 14 }}
              >
                Documentazione Firebase: dominio personalizzato →
              </a>
            </li>

            <li style={{ marginBottom: 18 }}>
              <p style={stepHead}>4. DNS presso il registrar del cliente</p>
              <p style={pText}>
                Nel pannello DNS del dominio crea i record che Firebase ti mostra (di solito <strong>CNAME</strong> sul
                sottodominio). Target generico di riferimento:
              </p>
              <code style={codeBlock}>{PUBLIC_DOMAIN_CNAME_TARGET}</code>
              <p style={pText}>
                Attendi la propagazione (minuti–48 ore) e tieni lo stato su <em>DNS / Firebase in configurazione</em>{" "}
                finché HTTPS non è verde. Sotto trovi la guida dettagliata per ogni host.
              </p>
            </li>

            <li style={{ marginBottom: 18 }}>
              <p style={stepHead}>5. Deploy del frontend (solo aggiornamenti prodotto)</p>
              <p style={pText}>
                Il bundle pubblicato è <strong>unico</strong> per tutti i tenant. Aggiungere un dominio cliente{" "}
                <strong>non</strong> richiede un nuovo deploy: basta host Firebase + DNS. Per release di codice:
              </p>
              <code style={codeBlock}>npm run deploy:full:ci</code>
              <p style={pText}>
                Dopo ogni deploy, <strong>tutti i domini collegati</strong> (incluso quello del cliente) servono
                l&apos;ultima versione della webapp. Finché non lo chiedi esplicitamente, non eseguire deploy Firebase
                «di routine» solo per aggiungere un hostname.
              </p>
            </li>

            <li style={{ marginBottom: 18 }}>
              <p style={stepHead}>6. Verifica sul dominio del cliente</p>
              <p style={pText}>
                Apri <code>https://</code> + dominio salvato (o il subdominio <code>slug.pizzamanager.it</code>). Controlla:
                nome/logo, orari, menu, link privacy/cookie se previsti. Imposta lo stato su <strong>Live</strong> quando
                tutto è ok.
              </p>
            </li>
          </ol>

          <div
            style={{
              marginTop: 8,
              marginBottom: 22,
              paddingTop: 20,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <DnsHostGuidesPanel />
          </div>

          <div
            style={{
              marginTop: 8,
              padding: "14px 16px",
              borderRadius: 10,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              fontSize: 13,
              color: "#1e3a8a",
              lineHeight: 1.6,
            }}
          >
            <strong>Suggerimento:</strong> se il sito non si aggiorna, prova una finestra anonima o svuota la cache. Per
            sole modifiche a menu e impostazioni tenant non serve un nuovo deploy frontend.
          </div>
        </div>
      </div>
    </div>
  );
}
