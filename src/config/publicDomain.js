/** Target CNAME consigliato (stesso hosting della webapp, es. Firebase). */
export const PUBLIC_DOMAIN_CNAME_TARGET =
  import.meta.env.VITE_PUBLIC_DOMAIN_CNAME_TARGET || "pizzamanager.it";

/** URL guida Firebase Hosting (domini personalizzati) — opzionale */
export const PUBLIC_DOMAIN_FIREBASE_DOCS_URL =
  import.meta.env.VITE_PUBLIC_DOMAIN_FIREBASE_DOCS_URL ||
  "https://firebase.google.com/docs/hosting/custom-domain";

/** Piattaforma SaaS (landing / login) per riferimento in UI */
export const PUBLIC_SAAS_BASE_URL =
  import.meta.env.VITE_PUBLIC_SAAS_BASE_URL || "https://pizzamanager.it";
