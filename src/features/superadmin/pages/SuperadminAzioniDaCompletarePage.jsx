import { useCallback, useEffect, useState } from "react";
import {
  getAgenteConfigurazione,
  updateAgenteConfigurazione,
  getAlertErroriConfigurazione,
  updateAlertErroriConfigurazione,
} from "@/features/superadmin/services/superadminService";

const PROJECT_REF = "flfhrwzlrftuhkrfwzse";

function CodeBlock({ children }) {
  return (
    <pre
      style={{
        background: "#0f172a",
        color: "#e2e8f0",
        borderRadius: 8,
        padding: "12px 14px",
        fontSize: 12.5,
        overflowX: "auto",
        margin: "8px 0 0",
        lineHeight: 1.6,
      }}
    >
      {children}
    </pre>
  );
}

function Step({ n, title, children }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <div
        style={{
          flexShrink: 0,
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "#0f172a",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{title}</p>
        <div style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

function Section({ title, badge, children }) {
  return (
    <section className="dashboard-box dashboard-settings-section" style={{ marginBottom: 20, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>{title}</h2>
        {badge ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#fef2f2",
              color: "#b91c1c",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function SuperadminAzioniDaCompletarePage() {
  const [config, setConfig] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState(null);

  const [alertConfig, setAlertConfig] = useState(null);
  const [alertDraft, setAlertDraft] = useState(null);
  const [alertLoading, setAlertLoading] = useState(true);
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertErrore, setAlertErrore] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrore(null);
    try {
      const data = await getAgenteConfigurazione();
      setConfig(data);
      setDraft(data);
    } catch (err) {
      setErrore(err?.message || "Impossibile caricare la configurazione dell'agente.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlert = useCallback(async () => {
    setAlertLoading(true);
    setAlertErrore(null);
    try {
      const data = await getAlertErroriConfigurazione();
      const normalized = data || { email_supporto: "", attivo: false };
      setAlertConfig(normalized);
      setAlertDraft(normalized);
    } catch (err) {
      setAlertErrore(err?.message || "Impossibile caricare la configurazione degli alert.");
    } finally {
      setAlertLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadAlert();
  }, [load, loadAlert]);

  async function handleSaveAlert() {
    if (!alertDraft) return;
    setAlertSaving(true);
    setAlertErrore(null);
    try {
      await updateAlertErroriConfigurazione({
        emailSupporto: alertDraft.email_supporto,
        attivo: alertDraft.attivo,
      });
      await loadAlert();
      alert("Configurazione alert salvata.");
    } catch (err) {
      setAlertErrore(err?.message || "Salvataggio non riuscito.");
    } finally {
      setAlertSaving(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setErrore(null);
    try {
      await updateAgenteConfigurazione({
        modello: draft.modello,
        attivo: draft.attivo,
        temperatura: draft.temperatura,
        max_token_risposta: draft.max_token_risposta,
        system_prompt_marketing: draft.system_prompt_marketing,
        system_prompt_supporto: draft.system_prompt_supporto,
        system_prompt_cliente: draft.system_prompt_cliente,
        costo_input_per_milione_eur: draft.costo_input_per_milione_eur,
        costo_output_per_milione_eur: draft.costo_output_per_milione_eur,
      });
      await load();
      alert("Configurazione salvata.");
    } catch (err) {
      setErrore(err?.message || "Salvataggio non riuscito.");
    } finally {
      setSaving(false);
    }
  }

  const textareaStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    fontSize: 13,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontFamily: "inherit",
    resize: "vertical",
  };

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Azioni da completare</h1>
      <p className="dashboard-settings-section-desc" style={{ marginBottom: 20 }}>
        Riepilogo di tutto ciò che serve fare fuori dal codice (chiavi, secret, verifica) prima che l'agente AI e le
        notifiche email funzionino davvero in produzione. Ogni sezione dice <strong>dove</strong> andare,{" "}
        <strong>cosa</strong> inserire e il <strong>comando</strong> da incollare quando serve.
      </p>

      <Section title="1 · Email (SMTP) per le notifiche" badge="Non fatto">
        <p style={{ fontSize: 13.5, color: "#475569", marginTop: 0 }}>
          Senza questo, le notifiche (es. le proposte settimanali di calibrazione AI) restano accodate in{" "}
          <code>notifiche_outbox</code> senza mai uscire. Va configurato uno di questi due modi:
        </p>

        <Step n="A" title="Opzione consigliata: SMTP di un provider">
          <p>
            Serve un account email con SMTP attivo. Alcuni esempi pratici (i valori vanno sostituiti con i tuoi):
          </p>
          <p style={{ margin: "10px 0 2px", fontWeight: 600 }}>Gmail / Google Workspace</p>
          <p style={{ margin: 0 }}>
            Host <code>smtp.gmail.com</code>, porta <code>587</code>. Serve una{" "}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
              password per le app
            </a>{" "}
            (non la password normale dell'account).
          </p>
          <p style={{ margin: "10px 0 2px", fontWeight: 600 }}>Aruba / Register.it</p>
          <p style={{ margin: 0 }}>
            Host tipicamente <code>smtps.aruba.it</code> (Aruba) o quello indicato nel pannello del tuo provider,
            porta <code>465</code> (SSL) o <code>587</code> (STARTTLS) — controlla la pagina "Configura client di
            posta" del tuo provider.
          </p>
          <p style={{ margin: "10px 0 0" }}>
            Una volta ottenuti host/porta/utente/password, apri un terminale nella cartella del progetto ed esegui
            (sostituendo i valori tra <code>&lt;&gt;</code>):
          </p>
          <CodeBlock>{`supabase secrets set NOTIFY_SMTP_HOST=<smtp.tuoprovider.it> --project-ref ${PROJECT_REF}
supabase secrets set NOTIFY_SMTP_PORT=<587> --project-ref ${PROJECT_REF}
supabase secrets set NOTIFY_SMTP_USER=<tuoindirizzo@dominio.it> --project-ref ${PROJECT_REF}
supabase secrets set NOTIFY_SMTP_PASS=<password-o-app-password> --project-ref ${PROJECT_REF}
supabase secrets set NOTIFY_FROM_EMAIL=<no-reply@pizzamanager.it> --project-ref ${PROJECT_REF}`}</CodeBlock>
        </Step>

        <Step n="B" title="Alternativa: relay HTTP interno">
          <p>
            Se in futuro avrai un endpoint proprio che invia email (es. un backend Nest), basta un solo secret invece
            dei cinque sopra:
          </p>
          <CodeBlock>{`supabase secrets set NOTIFY_EMAIL_RELAY_URL=<https://tuo-endpoint/internal/notifications/email> --project-ref ${PROJECT_REF}`}</CodeBlock>
        </Step>

        <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 10 }}>
          Nessun riavvio necessario: le Edge Function leggono i secret alla chiamata successiva. Il worker che invia
          le email in coda (<code>notifiche-outbox-processor</code>) è già schedulato ogni 10 minuti.
        </p>
      </Section>

      <Section title="2 · Chiave Anthropic (motore AI)" badge="Non fatto">
        <Step n="1" title="Crea la chiave">
          <p>
            Vai su{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
              console.anthropic.com → Settings → API Keys
            </a>{" "}
            e crea una nuova chiave (account/costo separato da Claude Code — le richieste dell'agente ai clienti si
            pagano lì, a consumo).
          </p>
        </Step>
        <Step n="2" title="Impostala come secret">
          <CodeBlock>{`supabase secrets set ANTHROPIC_API_KEY=<sk-ant-...> --project-ref ${PROJECT_REF}`}</CodeBlock>
        </Step>
      </Section>

      <Section title="3 · Verifica il modello prima di attivare" badge="Da controllare">
        <p style={{ fontSize: 13.5, color: "#475569", marginTop: 0 }}>
          I nomi dei modelli Claude cambiano nel tempo: un id sbagliato fa fallire ogni chiamata con un errore 4xx.
          Prima di attivare l'agente, controlla su{" "}
          <a href="https://console.anthropic.com/settings/models" target="_blank" rel="noopener noreferrer">
            console.anthropic.com → Models
          </a>{" "}
          che il modello impostato qui sotto sia ancora disponibile — puoi correggerlo direttamente nel pannello
          della sezione 4.
        </p>
      </Section>

      <Section title="4 · Configurazione dell'agente AI" badge={config?.attivo ? "Attivo" : "Spento"}>
        {loading ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>Caricamento…</p>
        ) : errore ? (
          <p style={{ fontSize: 13, color: "#b91c1c" }}>{errore}</p>
        ) : draft ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={draft.attivo === true}
                onChange={(e) => setDraft((d) => ({ ...d, attivo: e.target.checked }))}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>Agente attivo</strong>
                <br />
                <span style={{ fontSize: 12.5, color: "#64748b" }}>
                  Con questo spento (default), ogni chiamata risponde "Agente non attivo" senza consumare nulla su
                  Anthropic. Attivalo solo dopo aver impostato ANTHROPIC_API_KEY e verificato il modello sopra.
                </span>
              </span>
            </label>

            <label>
              <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Modello</span>
              <input
                type="text"
                value={draft.modello || ""}
                onChange={(e) => setDraft((d) => ({ ...d, modello: e.target.value }))}
                style={{ ...textareaStyle, maxWidth: 420 }}
                placeholder="es. claude-sonnet-4-5-20250929"
              />
            </label>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label>
                <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Temperatura</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={draft.temperatura ?? 0.3}
                  onChange={(e) => setDraft((d) => ({ ...d, temperatura: Number(e.target.value) }))}
                  style={{ ...textareaStyle, width: 100 }}
                />
              </label>
              <label>
                <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Max token risposta
                </span>
                <input
                  type="number"
                  min={100}
                  step={50}
                  value={draft.max_token_risposta ?? 800}
                  onChange={(e) => setDraft((d) => ({ ...d, max_token_risposta: Number(e.target.value) }))}
                  style={{ ...textareaStyle, width: 120 }}
                />
              </label>
              <label>
                <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Costo input (€/1M token)
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={draft.costo_input_per_milione_eur ?? 3}
                  onChange={(e) => setDraft((d) => ({ ...d, costo_input_per_milione_eur: Number(e.target.value) }))}
                  style={{ ...textareaStyle, width: 120 }}
                />
              </label>
              <label>
                <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                  Costo output (€/1M token)
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={draft.costo_output_per_milione_eur ?? 15}
                  onChange={(e) => setDraft((d) => ({ ...d, costo_output_per_milione_eur: Number(e.target.value) }))}
                  style={{ ...textareaStyle, width: 120 }}
                />
              </label>
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
              I due costi per token servono a stimare la spesa reale in{" "}
              <code>agente_utilizzo_mensile</code> (solo modalità cliente, l'add-on a pagamento) —
              verificali su{" "}
              <a href="https://console.anthropic.com/settings/plans" target="_blank" rel="noopener noreferrer">
                console.anthropic.com/settings/plans
              </a>{" "}
              per il modello scelto sopra: cambiano nel tempo e per modello.
            </p>

            <label>
              <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                Prompt — modalità marketing (sito pubblico PizzaManager)
              </span>
              <textarea
                rows={3}
                value={draft.system_prompt_marketing || ""}
                onChange={(e) => setDraft((d) => ({ ...d, system_prompt_marketing: e.target.value }))}
                style={textareaStyle}
              />
            </label>

            <label>
              <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                Prompt — modalità supporto (staff tenant loggato)
              </span>
              <textarea
                rows={3}
                value={draft.system_prompt_supporto || ""}
                onChange={(e) => setDraft((d) => ({ ...d, system_prompt_supporto: e.target.value }))}
                style={textareaStyle}
              />
            </label>

            <label>
              <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                Prompt — modalità cliente (vetrina pubblica del tenant)
              </span>
              <textarea
                rows={3}
                value={draft.system_prompt_cliente || ""}
                onChange={(e) => setDraft((d) => ({ ...d, system_prompt_cliente: e.target.value }))}
                style={textareaStyle}
              />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                Il segnaposto <code>{"{NOME_LOCALE}"}</code> viene sostituito automaticamente col nome del tenant.
              </span>
            </label>

            <div>
              <button type="button" className="btn-primary-dashboard" onClick={handleSave} disabled={saving}>
                {saving ? "Salvataggio…" : "Salva configurazione"}
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="5 · Quota AI per tenant (add-on a pagamento)">
        <p style={{ fontSize: 13.5, color: "#475569", marginTop: 0 }}>
          Ogni tenant ha una quota di richieste incluse nel mese (default <strong>400</strong> se non
          impostata): oltre soglia l'agente smette di chiamare Anthropic e risponde con un messaggio
          statico, senza generare costo scoperto. Per cambiare la quota di un tenant specifico (es. un
          piano con più richieste incluse), da SQL Editor:
        </p>
        <CodeBlock>{`update admin.tenants
set parametri_operativi = parametri_operativi || jsonb_build_object('agente_quota_richieste_mese', 800)
where slug = '<slug-del-tenant>';`}</CodeBlock>
        <p style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 8 }}>
          Il consumo reale (richieste, token, costo stimato) è in{" "}
          <code>agente_utilizzo_mensile</code>, un record per tenant per mese.
        </p>
      </Section>

      <Section title="6 · Ricalibrazione AI dei tempi (per tenant)">
        <p style={{ fontSize: 13.5, color: "#475569", marginTop: 0 }}>
          Non è globale: va attivata per ogni tenant che la vuole, dal suo Admin → Impostazioni → Parametri operativi
          → <em>"Ricalibrazione AI settimanale della capacità forno"</em>. Gira già ogni lunedì notte, non serve
          altro lato server.
        </p>
      </Section>

      <Section title="7 · Alert email al supporto per errori nei tenant" badge={alertConfig?.attivo ? "Attivo" : "Spento"}>
        <p style={{ fontSize: 13.5, color: "#475569", marginTop: 0 }}>
          Quando un tenant ha errori operativi (pagamenti Stripe falliti, rimborsi rifiutati da Stripe,
          eccezioni JS nel browser di admin/cassa/cliente), il sistema li accumula in{" "}
          <code>log_errori_operativi</code> e ogni 15 minuti invia <strong>una sola email di riepilogo per
          tenant</strong> all'indirizzo qui sotto — non un'email per ogni singolo errore, altrimenti la
          casella si riempie di rumore. Richiede l'SMTP della sezione 1 già configurato: usa lo stesso
          worker <code>notifiche-outbox-processor</code>.
        </p>
        {alertLoading ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>Caricamento…</p>
        ) : alertErrore ? (
          <p style={{ fontSize: 13, color: "#b91c1c" }}>{alertErrore}</p>
        ) : alertDraft ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label>
              <span style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>
                Email di supporto
              </span>
              <input
                type="email"
                value={alertDraft.email_supporto || ""}
                onChange={(e) => setAlertDraft((d) => ({ ...d, email_supporto: e.target.value }))}
                style={{ ...textareaStyle, maxWidth: 420 }}
                placeholder="supporto@tuodominio.it"
              />
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={alertDraft.attivo === true}
                onChange={(e) => setAlertDraft((d) => ({ ...d, attivo: e.target.checked }))}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>Alert attivo</strong>
                <br />
                <span style={{ fontSize: 12.5, color: "#64748b" }}>
                  Con questo spento (default), gli errori restano registrati per consultazione ma non
                  viene inviata nessuna email.
                </span>
              </span>
            </label>
            <div>
              <button type="button" className="btn-primary-dashboard" onClick={handleSaveAlert} disabled={alertSaving}>
                {alertSaving ? "Salvataggio…" : "Salva configurazione alert"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
              Copertura attuale: rimborsi e webhook Stripe (edge function), più i crash JS non gestiti nel
              browser (bucket "critici" e "medio"). Non ancora ogni singolo errore applicativo minore del
              codebase — infrastruttura estendibile, non iniettata automaticamente ovunque.
            </p>
          </div>
        ) : null}
      </Section>

      <Section title="8 · Test end-to-end prima di darla ai clienti">
        <p style={{ fontSize: 13.5, color: "#475569", marginTop: 0 }}>
          Dopo aver fatto i punti 1-4, prova su un tenant demo (es. Demo Rossi) prima di un cliente vero:
        </p>
        <ol style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.7, paddingLeft: 20 }}>
          <li>Apri la vetrina pubblica del tenant demo (bolla chat in basso a destra).</li>
          <li>Chiedi qualcosa in tema (es. "a che ora posso avere 2 pizze?") — deve rispondere con un orario reale.</li>
          <li>Chiedi qualcosa fuori tema (es. una domanda generica) — deve rifiutare gentilmente, non rispondere.</li>
          <li>Controlla che la conversazione compaia in <code>agente_conversazioni</code> con modalita "cliente".</li>
        </ol>
      </Section>
    </div>
  );
}
