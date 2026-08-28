import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  getTenant,
  updateTenantPublicDomain,
  getGoLiveChecklist,
  upsertGoLiveChecklist,
} from "@/features/superadmin/services/superadminService";
import {
  PUBLIC_DOMAIN_CNAME_TARGET,
  PUBLIC_DOMAIN_FIREBASE_DOCS_URL,
} from "@/config/publicDomain";
import {
  isPlausibleHostname,
  normalizeClienteSitoWebUrl,
  normalizePublicDomainHostname,
} from "@/utils/publicDomain";
import {
  GO_LIVE_CHECK_ITEMS,
  buildAuthRedirectUrlsForHostname,
  emptyGoLiveChecks,
  mergeGoLiveChecks,
} from "@/features/superadmin/utils/goLiveHelpers";
import DnsHostGuidesPanel from "@/features/pubblicazione/DnsHostGuidesPanel";

const DOMAIN_STATUS = [
  { value: "none", label: "Non configurato" },
  { value: "requested", label: "Richiesta salvata in piattaforma" },
  { value: "dns_pending", label: "DNS / Firebase in configurazione" },
  { value: "live", label: "Dominio online" },
];

/** Console Firebase reale del progetto — link diretto, non solo doc generica. */
const FIREBASE_CONSOLE_HOSTING_URL = "https://console.firebase.google.com/project/pizzeria-da-nicolo/hosting/sites/pizzeria-da-nicolo";

/** Registrar consigliato per chi non ha ancora un dominio — lo gestiamo noi fin dall'acquisto. */
const REGISTRAR_ACQUISTO_URL = "https://www.register.it/";

/**
 * 9 step, ognuno corrisponde a una voce di GO_LIVE_CHECK_ITEMS (checklist condivisa già
 * persistita su DB) tranne "dominio" (form) e "riepilogo" (fine wizard). Non introduce
 * nuovo stato locale non salvato: ogni "Avanti" scrive sullo stesso backend già usato da
 * PubblicazioneSitoWorkspace / SuperadminGoLivePage.
 */
const STEPS = [
  { key: "anagrafica", checkId: "anagrafica", title: "Anagrafica e slug" },
  { key: "dominio", checkId: null, title: "Dominio del cliente" },
  { key: "firebase_host", checkId: "firebase_host", title: "Firebase Hosting" },
  { key: "dns", checkId: "dns", title: "DNS del cliente" },
  { key: "auth_redirects", checkId: "auth_redirects", title: "Redirect Auth Supabase" },
  { key: "menu", checkId: "menu", title: "Verifica menu / vetrina" },
  { key: "legali", checkId: "legali", title: "Privacy / Cookie / Termini" },
  { key: "smoke_test", checkId: "smoke_test", title: "Smoke test" },
  { key: "riepilogo", checkId: null, title: "Riepilogo" },
];

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(15, 23, 42, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  overflowY: "auto",
};

const panelStyle = {
  width: "100%",
  maxWidth: 720,
  maxHeight: "min(92vh, 880px)",
  display: "flex",
  flexDirection: "column",
  background: "#fff",
  borderRadius: 14,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
  border: "1px solid #e2e8f0",
  overflow: "hidden",
};

const btnPrimary = {
  padding: "10px 20px",
  borderRadius: 8,
  border: "none",
  background: "#c0392b",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const btnSecondary = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const btnDisabled = { opacity: 0.5, cursor: "not-allowed" };

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 };

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 15,
};

/** Bolla di stato — un pallino per step, cliccabile solo se già raggiunto. */
function StepDots({ steps, current, maxReached, onJump }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 24px 14px" }}>
      {steps.map((s, i) => {
        const reached = i <= maxReached;
        const active = i === current;
        return (
          <button
            key={s.key}
            type="button"
            disabled={!reached}
            onClick={() => reached && onJump(i)}
            title={s.title}
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: active ? "2px solid #c0392b" : "1px solid #cbd5e1",
              background: active ? "#fff7ed" : reached ? "#f1f5f9" : "#fff",
              color: active ? "#9a3412" : "#64748b",
              fontSize: 11,
              fontWeight: 700,
              cursor: reached ? "pointer" : "not-allowed",
              flexShrink: 0,
            }}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

export default function GoLiveWizardModal({ open, onClose, tenantId }) {
  const titleId = useId();
  const [stepIndex, setStepIndex] = useState(0);
  const [maxReached, setMaxReached] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");

  const [domainInput, setDomainInput] = useState("");
  const [sitoWebClienteInput, setSitoWebClienteInput] = useState("");
  const [status, setStatus] = useState("none");
  const [savedDomain, setSavedDomain] = useState("");
  /** null = non ancora chiesto, true = ha già un dominio suo, false = lo acquistiamo noi. */
  const [haDominio, setHaDominio] = useState(null);

  const [checks, setChecks] = useState(() => emptyGoLiveChecks());

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [row, checkRow] = await Promise.all([
        getTenant(tenantId),
        getGoLiveChecklist(tenantId).catch(() => null),
      ]);
      setNome(String(row?.nome || ""));
      setSlug(String(row?.slug || ""));
      setDomainInput(row?.public_domain ? String(row.public_domain) : "");
      setSitoWebClienteInput(row?.sito_web_cliente ? String(row.sito_web_cliente) : "");
      setStatus(
        row?.public_domain_status && DOMAIN_STATUS.some((s) => s.value === row.public_domain_status)
          ? row.public_domain_status
          : "none",
      );
      setSavedDomain(row?.public_domain ? String(row.public_domain) : "");
      setHaDominio(row?.public_domain ? true : null);
      setChecks(mergeGoLiveChecks(checkRow));
    } catch (e) {
      setError(e?.message || "Impossibile caricare i dati del cliente.");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
      setMaxReached(0);
      setError(null);
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
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

  const authUrls = useMemo(
    () => buildAuthRedirectUrlsForHostname(savedDomain || (slug ? `${slug}.pizzamanager.it` : "")),
    [savedDomain, slug],
  );

  if (!open) return null;

  const step = STEPS[stepIndex];

  const goTo = (i) => {
    setStepIndex(i);
    setMaxReached((m) => Math.max(m, i));
  };
  const next = () => {
    if (stepIndex < STEPS.length - 1) goTo(stepIndex + 1);
  };
  const back = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const toggleCheck = async (checkId, confirmAndAdvance = true) => {
    if (!tenantId || !checkId) {
      if (confirmAndAdvance) next();
      return;
    }
    const nextChecks = { ...checks, [checkId]: true };
    setChecks(nextChecks);
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertGoLiveChecklist(tenantId, nextChecks);
      const merged = mergeGoLiveChecks(saved);
      setChecks(merged);
      // Ultimo tassello della checklist confermato → flag "Live" automatico, schematico,
      // senza bisogno di un pulsante separato.
      const allDone = GO_LIVE_CHECK_ITEMS.every((i) => merged[i.id]);
      if (allDone && status !== "live") {
        try {
          await updateTenantPublicDomain(tenantId, { public_domain_status: "live" });
          setStatus("live");
        } catch {
          // Non bloccante: la checklist resta comunque salvata, il flag Live si può
          // correggere manualmente dal riepilogo.
        }
      }
      if (confirmAndAdvance) next();
    } catch (e) {
      setError(e?.message || "Salvataggio checklist non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const saveDomainStep = async () => {
    const normalized = normalizePublicDomainHostname(domainInput);
    if (domainInput.trim() && !isPlausibleHostname(normalized)) {
      setError("Inserisci un dominio valido (es. demo-rossi.pizzamanager.it) senza https://");
      return;
    }
    const normalizedSitoWeb = normalizeClienteSitoWebUrl(sitoWebClienteInput);
    if (sitoWebClienteInput.trim() && !normalizedSitoWeb) {
      setError("URL del sito web non valido (es. https://sites.google.com/view/...)");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nowIso = new Date().toISOString();
      const payload = {
        public_domain: normalized,
        public_domain_status: normalized ? status || "requested" : "none",
        public_domain_requested_at: normalized ? nowIso : null,
        sito_web_cliente: normalizedSitoWeb,
      };
      await updateTenantPublicDomain(tenantId, payload);
      setSavedDomain(normalized || "");
      next();
    } catch (e) {
      setError(e?.message || "Salvataggio dominio non riuscito.");
    } finally {
      setSaving(false);
    }
  };

  const finishLive = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateTenantPublicDomain(tenantId, { public_domain_status: "live" });
      setStatus("live");
    } catch (e) {
      setError(e?.message || "Impossibile impostare lo stato Live.");
    } finally {
      setSaving(false);
    }
  };

  const checkedCount = GO_LIVE_CHECK_ITEMS.filter((i) => checks[i.id]).length;
  const pct = Math.round((checkedCount / GO_LIVE_CHECK_ITEMS.length) * 100);

  function ConfirmFooter({ checkId, disabled }) {
    return (
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button type="button" onClick={back} disabled={stepIndex === 0} style={{ ...btnSecondary, ...(stepIndex === 0 ? btnDisabled : {}) }}>
          ← Indietro
        </button>
        <button
          type="button"
          onClick={() => toggleCheck(checkId)}
          disabled={saving || disabled}
          style={{ ...btnPrimary, ...(saving || disabled ? btnDisabled : {}) }}
        >
          {saving ? "Salvataggio…" : checks[checkId] ? "Confermato — Avanti →" : "Confermo — Avanti →"}
        </button>
      </div>
    );
  }

  function renderStepBody() {
    switch (step.key) {
      case "anagrafica":
        return (
          <>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65 }}>
              Cliente: <strong>{nome || "—"}</strong> · slug: <strong>{slug || "—"}</strong>
            </p>
            <p style={{ fontSize: 14, color: "#475569" }}>
              Anteprima sempre disponibile, senza dominio dedicato:{" "}
              <code style={{ background: "#f1f5f9", padding: "4px 8px", borderRadius: 6 }}>
                {slug ? `https://${slug}.pizzamanager.it` : "https://{slug}.pizzamanager.it"}
              </code>
            </p>
            {!slug ? (
              <p style={{ fontSize: 13, color: "#b45309", marginTop: 10 }}>
                ⚠️ Slug mancante: completa l'anagrafica del cliente prima di proseguire.
              </p>
            ) : null}
            <ConfirmFooter checkId="anagrafica" disabled={!nome || !slug} />
          </>
        );

      case "dominio": {
        const normalizedPreview = normalizePublicDomainHostname(domainInput);

        if (haDominio === null) {
          return (
            <>
              <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65, marginBottom: 16 }}>
                Il cliente ha già un dominio proprio (es. comprato in precedenza per il suo sito), oppure parte da
                zero?
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button type="button" onClick={() => setHaDominio(true)} style={{ ...btnPrimary, flex: "1 1 220px" }}>
                  Sì, ha già un dominio suo
                </button>
                <button type="button" onClick={() => setHaDominio(false)} style={{ ...btnSecondary, flex: "1 1 220px" }}>
                  No, lo acquistiamo noi
                </button>
              </div>
              <div style={{ marginTop: 20 }}>
                <button type="button" onClick={back} style={btnSecondary}>
                  ← Indietro
                </button>
              </div>
            </>
          );
        }

        if (haDominio === false) {
          return (
            <>
              <div
                style={{
                  marginBottom: 14,
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1e40af",
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                Il dominio si acquista <strong>per conto del cliente</strong>, gestito da noi fin dall'acquisto. Vai
                sul registrar, registra il dominio scelto, poi torna qui e inseriscilo — il resto del flusso
                prosegue identico.
              </div>
              <a
                href={REGISTRAR_ACQUISTO_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...btnPrimary, display: "inline-block", textDecoration: "none", marginBottom: 16 }}
              >
                Apri Register.it per acquistare il dominio →
              </a>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setHaDominio(null)} style={btnSecondary}>
                  ← Torna alla scelta
                </button>
                <button type="button" onClick={() => setHaDominio(true)} style={btnPrimary}>
                  Fatto, ho il dominio — inseriscilo →
                </button>
              </div>
            </>
          );
        }

        return (
          <>
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#1e40af",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              Solo l'<strong>hostname pubblico</strong> che deve aprire la webapp (senza <code>https://</code>). Deve
              coincidere con il dominio che aggiungerai in Firebase e con il record DNS.
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Dominio menu (pubblico)</label>
              <input
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="es. demo-rossi.pizzamanager.it"
                style={inputStyle}
                autoComplete="off"
              />
              {normalizedPreview ? (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>
                  Salvataggio come: <strong>{normalizedPreview}</strong>
                </p>
              ) : null}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Sito web marketing (opzionale)</label>
              <input
                type="url"
                value={sitoWebClienteInput}
                onChange={(e) => setSitoWebClienteInput(e.target.value)}
                placeholder="https://sites.google.com/view/..."
                style={inputStyle}
                autoComplete="url"
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Stato pubblicazione</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, background: "#fff" }}>
                {DOMAIN_STATUS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setHaDominio(null)} style={btnSecondary}>
                ← Indietro
              </button>
              <button type="button" onClick={saveDomainStep} disabled={saving} style={{ ...btnPrimary, ...(saving ? btnDisabled : {}) }}>
                {saving ? "Salvataggio…" : "Salva e continua →"}
              </button>
            </div>
          </>
        );
      }

      case "firebase_host":
        return (
          <>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65 }}>
              Firebase Console → Hosting → <strong>Aggiungi dominio personalizzato</strong> → inserisci esattamente:
            </p>
            <p style={{ margin: "8px 0 14px" }}>
              <code style={{ background: "#f1f5f9", padding: "6px 10px", borderRadius: 6, fontSize: 15 }}>
                {savedDomain || "(nessun dominio salvato allo step precedente)"}
              </code>
            </p>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>
              Segui la verifica proprietà (record TXT), poi annota il target CNAME mostrato da Firebase — ti serve al
              passo successivo.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
              <a
                href={FIREBASE_CONSOLE_HOSTING_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...btnPrimary, display: "inline-block", textDecoration: "none" }}
              >
                Apri Firebase Hosting →
              </a>
              <a
                href={PUBLIC_DOMAIN_FIREBASE_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...btnSecondary, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
              >
                Guida ufficiale Firebase
              </a>
            </div>
            <ConfirmFooter checkId="firebase_host" disabled={!savedDomain} />
          </>
        );

      case "dns":
        return (
          <>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65, marginBottom: 10 }}>
              Crea il record DNS presso il registrar del cliente. Target CNAME di riferimento (usa quello esatto di
              Firebase se diverso):
            </p>
            <p style={{ margin: "0 0 14px" }}>
              <code style={{ background: "#f1f5f9", padding: "6px 10px", borderRadius: 6, fontSize: 15 }}>
                {PUBLIC_DOMAIN_CNAME_TARGET}
              </code>
            </p>
            <div
              style={{
                marginBottom: 14,
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #fed7aa",
                background: "#fffbeb",
                color: "#9a3412",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <strong>Dominio "nudo" (apex, es. <code>latuapizza.online</code>) vs sottodominio:</strong> se il
              dominio è un apex (senza <code>www.</code> o altro prefisso), il DNS non può usare CNAME sulla root —
              Firebase mostra invece uno o più record <strong>A</strong> con un IP dedicato (es. <code>199.36.158.100</code>),
              da inserire così come mostrato in Firebase. Per un sottodominio (es. <code>menu.cliente.it</code>)
              resta invece CNAME come sopra. Usa sempre esattamente ciò che la console Firebase ti mostra per quel
              dominio specifico, non un valore fisso.
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
              <DnsHostGuidesPanel compact />
            </div>
            <ConfirmFooter checkId="dns" disabled={!savedDomain} />
          </>
        );

      case "auth_redirects":
        return (
          <>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65 }}>
              Supabase Dashboard → Authentication → URL configuration → Redirect URLs. Aggiungi queste voci per{" "}
              <strong>{savedDomain || slug + ".pizzamanager.it"}</strong>:
            </p>
            {authUrls.length ? (
              <>
                <pre style={{ margin: "10px 0", padding: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, overflow: "auto" }}>
                  {authUrls.join("\n")}
                </pre>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(authUrls.join("\n")).catch(() => {})}
                  style={btnSecondary}
                >
                  Copia elenco
                </button>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "#b45309" }}>Nessun dominio/slug disponibile — torna allo step precedente.</p>
            )}
            <ConfirmFooter checkId="auth_redirects" disabled={!authUrls.length} />
          </>
        );

      case "menu":
        return (
          <>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65 }}>
              Apri il dominio del cliente e verifica <strong>branding, menu, orari</strong> — che siano quelli giusti per
              questo tenant, non un residuo di un altro.
            </p>
            {savedDomain ? (
              <a href={`https://${savedDomain}`} target="_blank" rel="noopener noreferrer" style={{ color: "#c0392b", fontWeight: 600, fontSize: 14 }}>
                Apri https://{savedDomain} →
              </a>
            ) : (
              <p style={{ fontSize: 13, color: "#b45309" }}>Nessun dominio salvato: verifica su {slug}.pizzamanager.it.</p>
            )}
            <ConfirmFooter checkId="menu" disabled={false} />
          </>
        );

      case "legali":
        return (
          <>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65 }}>
              Verifica che Privacy Policy, Cookie Policy e Termini siano presenti e coerenti con i dati di questo
              tenant (non placeholder generici) prima di considerarlo pronto.
            </p>
            <ConfirmFooter checkId="legali" disabled={false} />
          </>
        );

      case "smoke_test":
        return (
          <>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65, marginBottom: 10 }}>
              Da incognito, con le credenziali di prova: login, un ordine di test, e — se ci sono altri tenant —
              verifica che <strong>non</strong> compaia alcun dato di un tenant diverso.
            </p>
            <ConfirmFooter checkId="smoke_test" disabled={false} />
          </>
        );

      case "riepilogo":
        return (
          <>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.65 }}>
              Checklist completata al <strong>{pct}%</strong> ({checkedCount}/{GO_LIVE_CHECK_ITEMS.length}).
            </p>
            <ul style={{ margin: "10px 0 16px", paddingLeft: 20, fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
              {GO_LIVE_CHECK_ITEMS.map((i) => (
                <li key={i.id} style={{ color: checks[i.id] ? "#166534" : "#b91c1c" }}>
                  {checks[i.id] ? "✓" : "✗"} {i.label}
                </li>
              ))}
            </ul>
            <p style={{ fontSize: 14, color: "#475569" }}>
              Stato pubblicazione attuale: <strong>{DOMAIN_STATUS.find((s) => s.value === status)?.label || status}</strong>
            </p>
            {status !== "live" && pct === 100 ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>
                Checklist completa ma lo stato non si è aggiornato da solo (es. sei arrivato qui saltando qualche
                step con i pallini) — puoi forzarlo qui sotto.
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
              <button type="button" onClick={back} style={btnSecondary}>
                ← Indietro
              </button>
              {status !== "live" ? (
                <button
                  type="button"
                  onClick={finishLive}
                  disabled={saving || pct < 100}
                  title={pct < 100 ? "Completa tutta la checklist prima di segnare Live" : undefined}
                  style={{ ...btnPrimary, ...(saving || pct < 100 ? btnDisabled : {}) }}
                >
                  {saving ? "Salvataggio…" : "Segna come Dominio online (Live)"}
                </button>
              ) : (
                <span style={{ fontSize: 14, color: "#166534", fontWeight: 700, alignSelf: "center" }}>✓ Live</span>
              )}
              <button type="button" onClick={onClose} style={btnSecondary}>
                Chiudi
              </button>
            </div>
          </>
        );

      default:
        return null;
    }
  }

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
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "18px 24px 4px",
          }}
        >
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#9a3412", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Go-live guidato · passo {stepIndex + 1} di {STEPS.length}
            </p>
            <h2 id={titleId} style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 18 }}
          >
            ×
          </button>
        </div>

        <StepDots steps={STEPS} current={stepIndex} maxReached={maxReached} onJump={goTo} />

        <div style={{ padding: "0 24px 24px", overflowY: "auto" }}>
          {loading ? (
            <p style={{ color: "#64748b" }}>Caricamento…</p>
          ) : (
            <>
              {error ? (
                <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 14 }}>
                  {error}
                </div>
              ) : null}
              {renderStepBody()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
