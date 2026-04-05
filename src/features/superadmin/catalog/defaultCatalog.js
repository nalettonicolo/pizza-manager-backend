/**
 * Catalogo predefinito servizi (Super Admin).
 * Fonte dati: `src/config/serviziAppRegistro.js` — aggiornare quel file quando si aggiunge un servizio.
 * I prezzi qui esposti come `prezzoMensile` sono i default; sono modificabili in UI (localStorage).
 */

import {
  IDS_BASE,
  IDS_ENTERPRISE,
  IDS_FULL,
  IDS_PRO,
  catalogoDefaultDaRegistro,
} from "@/config/serviziAppRegistro";

export const STORAGE_KEY_SERVICES_V2 = "pizzamanager_superadmin_services_v2";
export const STORAGE_KEY_SERVICES_V1 = "pizzamanager_superadmin_services_v1";

export const DEFAULT_SERVICES_CATALOG = catalogoDefaultDaRegistro();

export { IDS_BASE, IDS_ENTERPRISE, IDS_FULL, IDS_PRO };
