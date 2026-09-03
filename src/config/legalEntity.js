/**
 * Identità per informative legali (privacy, cookie, termini).
 * - SaaS (pizzamanager.it, …): titolare da variabili Vite (.env) — tipicamente il titolare persona / ditta.
 * - Storefront (dominio pizzeria): titolare da nome attività + referente in parametri_operativi.
 */

const KEY_TITOLARE_ESERCENTE = "titolare_esercente";

/** Nome prodotto piattaforma (testi legali SaaS). */
export const PLATFORM_PRODUCT_NAME = "PizzaManager";

function envTrim(key) {
  const v = import.meta.env[key];
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Config titolare SaaS da .env (VITE_LEGAL_*).
 * Compila .env.production con i tuoi dati reali.
 */
export function getSaaSLegalConfig() {
  const nome = envTrim("VITE_LEGAL_TITOLARE_NOME");
  const qualifica = envTrim("VITE_LEGAL_TITOLARE_QUALIFICA");
  const indirizzo = envTrim("VITE_LEGAL_TITOLARE_INDIRIZZO");
  const emailPrivacy = envTrim("VITE_LEGAL_EMAIL_PRIVACY") || "privacy@pizzamanager.it";
  const emailInfo = envTrim("VITE_LEGAL_EMAIL_INFO") || "info@pizzamanager.it";

  const titolareBreve = nome || PLATFORM_PRODUCT_NAME;
  const titolareEsteso =
    nome && qualifica
      ? `${nome} (${qualifica})`
      : nome || `${PLATFORM_PRODUCT_NAME} — configurare VITE_LEGAL_TITOLARE_NOME nel file .env`;

  return {
    mode: "saas",
    titolareBreve,
    titolareEsteso,
    titolareNome: nome,
    titolareQualifica: qualifica || null,
    titolareIndirizzo: indirizzo || "[indirizzo del titolare — da impostare in VITE_LEGAL_TITOLARE_INDIRIZZO]",
    emailPrivacy,
    emailInfo,
    siteLabel: "pizzamanager.it",
    productName: PLATFORM_PRODUCT_NAME,
    providerLegalName: PLATFORM_PRODUCT_NAME,
  };
}

function readParametri(tenant) {
  const po = tenant?.parametri_operativi;
  return po && typeof po === "object" ? po : {};
}

/**
 * Titolare per sito pubblico pizzeria (dominio dedicato): attività + titolare/referente.
 */
export function getStorefrontLegalConfig(tenant) {
  if (!tenant) {
    return {
      mode: "storefront",
      titolareBreve: "Esercente",
      titolareEsteso: "Esercente",
      titolareNome: "",
      titolareQualifica: null,
      titolareIndirizzo: "",
      emailPrivacy: "",
      emailInfo: "",
      siteLabel: typeof window !== "undefined" ? window.location.hostname : "",
      productName: "Menu online",
      nomeAttivita: "",
      titolareEsercente: "",
      providerLegalName: PLATFORM_PRODUCT_NAME,
      legalTenantSnapshot: null,
      privacy_policy_html: null,
      cookie_policy_html: null,
      legal_ragione_sociale: null,
      legal_piva: null,
      legal_pec: null,
    };
  }

  const po = readParametri(tenant);
  const nomeAttivita = (tenant.nome || "").trim() || "Attività";
  const titolareEsercente = (po[KEY_TITOLARE_ESERCENTE] || "").trim();
  const indirizzo = (tenant.indirizzo || "").trim();
  const email = (tenant.email || "").trim();

  const titolareEsteso = titolareEsercente
    ? `${nomeAttivita} — ${titolareEsercente}`
    : nomeAttivita;

  return {
    mode: "storefront",
    titolareBreve: nomeAttivita,
    titolareEsteso,
    titolareNome: titolareEsercente || nomeAttivita,
    titolareQualifica: null,
    titolareIndirizzo: indirizzo || "[indirizzo — da compilare in Impostazioni → Dati pizzeria]",
    emailPrivacy: email,
    emailInfo: email,
    siteLabel: typeof window !== "undefined" ? window.location.hostname : "",
    productName: nomeAttivita,
    nomeAttivita,
    titolareEsercente,
    providerLegalName: PLATFORM_PRODUCT_NAME,
    /** Snapshot tenant (RPC / DB) per segnaposto {{nome_attivita}}, {{piva}}, … */
    legalTenantSnapshot: tenant,
    privacy_policy_html: tenant.privacy_policy_html ?? po.privacy_policy_html ?? null,
    cookie_policy_html: tenant.cookie_policy_html ?? po.cookie_policy_html ?? null,
    legal_ragione_sociale: tenant.legal_ragione_sociale ?? null,
    legal_piva: tenant.legal_piva ?? null,
    legal_pec: tenant.legal_pec ?? null,
  };
}

export { KEY_TITOLARE_ESERCENTE };
