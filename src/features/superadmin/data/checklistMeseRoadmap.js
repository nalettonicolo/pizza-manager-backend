/**
 * Roadmap interna (solo sviluppatori / agent): codice checklist → file e moduli.
 * NON mostrare in UI Super Admin. Usare quando il titolare cita un codice (es. «sistema DM-02»).
 */

/** @type {Readonly<Record<string, { files?: string[], sql?: string[], noteDev?: string }>>} */
export const CHECKLIST_MESE_ROADMAP = Object.freeze({
  "DM-01": {
    files: [
      "src/features/superadmin/pages/SuperadminGatePage.jsx",
      "src/utils/demoGiro.js",
      "src/layouts/OperativeLayout.jsx",
    ],
    noteDev: "Demo live: _demo_giro + support_tenant + banner operative",
  },
  "DM-02": {
    files: [
      "src/utils/demoClienteSession.js",
      "src/features/public/components/ClienteHeaderAccount.jsx",
      "src/features/operative/pages/OperativeDashboard.jsx",
      "src/layouts/PublicLayout.jsx",
      "src/app/contexts/AuthContext.jsx",
    ],
    noteDev: "openDemoClienteArea da Hub; Super Admin → /operative/dashboard; Hub demo su vetrina SA",
  },
  "DM-03": {
    files: [
      "src/app/contexts/AuthContext.jsx",
      "src/components/ClienteRoute.jsx",
      "src/components/ClienteEmailVerifiedRoute.jsx",
    ],
    noteDev: "Bootstrap demo cliente senza hang Verifica accesso",
  },
  "CL-01": {
    files: [
      "src/utils/clienteVetrinaPath.js",
      "src/features/public/pages/ClienteDashboardPage.jsx",
      "src/features/public/components/ClienteHeaderAccount.jsx",
    ],
  },
  "CL-02": {
    files: [
      "src/features/public/pages/ClienteRegistrazionePage.jsx",
      "src/features/public/services/clienteAuthService.js",
    ],
    sql: ["sql/modules/44_cliente_iscriviti_fidelity.sql"],
  },
  "CL-03": {
    files: [
      "src/utils/ordineRecallCart.js",
      "src/features/public/components/ClienteOrdineRecallModal.jsx",
      "src/features/operative/cassa/pages/CassaPage.jsx",
    ],
  },
  "CL-04": {
    files: [
      "src/layouts/PublicLayout.jsx",
      "src/features/public/pages/PublicStore.jsx",
      "src/features/public/components/PublicStoreCartSidebar.jsx",
      "src/features/public/components/HeroStore.jsx",
      "src/styles/public-layout.css",
    ],
  },
  "CL-05": {
    files: [
      "src/styles/login.css",
      "src/features/public/pages/ClienteProfiloPage.jsx",
      "src/features/public/pages/ClienteRegistrazionePage.jsx",
    ],
  },
  "CL-06": {
    files: [
      "src/features/public/components/ClienteIndirizzoMappaField.jsx",
      "src/lib/googleMapsLoader.js",
    ],
    noteDev:
      "loading=async: bootstrap = importLibrary|Map; contenitore mappa sempre montato; Riprova clears auth error",
  },
  "CL-07": {
    files: [
      "src/features/public/pages/Login.jsx",
      "src/features/public/components/ClienteHeaderAccount.jsx",
      "src/utils/demoClienteSession.js",
    ],
    noteDev: "Chrome demo solo con hasDemoSaStash; login credenziali pulisce flag/stash/URL demo",
  },
  "CL-08": {
    files: [
      "src/features/public/pages/PublicStore.jsx",
      "src/features/operative/cassa/components/ModificaPizzaModal.jsx",
      "src/app/contexts/PublicCartContext.jsx",
    ],
    sql: ["sql/modules/49_public_modifica_pizza_bundle.sql"],
    noteDev: "Modifica pizza in vetrina (RPC pubblica)",
  },
  "OW-01": {
    files: [
      "src/features/admin/pages/settings/ParametriSection.jsx",
      "src/features/operative/cassa/pages/CassaPage.jsx",
      "src/utils/webOrderNotifications.js",
    ],
    sql: [
      "sql/modules/45_ordini_web_accettazione_cassa.sql",
      "sql/modules/46_ordini_web_accettazione_public_param.sql",
    ],
  },
  "OW-02": {
    files: ["src/features/public/pages/PublicOrdineCheckoutPage.jsx"],
    sql: ["sql/modules/25_ordini_web_capacity_antifraud_delivery_proof.sql"],
  },
  "OW-03": {
    files: ["src/features/public/services/onlinePaymentService.js"],
    sql: [
      "sql/modules/42_sumup_online_checkout.sql",
      "sql/modules/43_online_payment_providers_multi.sql",
    ],
  },
  "OW-04": {
    files: ["sql/modules/25_ordini_web_capacity_antifraud_delivery_proof.sql"],
    noteDev: "Estendere capacity con pony / consegne_ogni_min — ancora da fare",
  },
  "CA-01": {
    files: [
      "src/features/operative/cassa/components/CassaPlanningBoard.jsx",
      "src/features/operative/cassa/utils/planningPonyAssign.js",
      "src/features/operative/cassa/pages/CassaPage.jsx",
    ],
  },
  "CA-02": {
    files: [
      "src/features/admin/services/adminService.js",
      "src/features/operative/cassa/components/CassaPlanningBoard.jsx",
    ],
    noteDev: "Filtrare aggregate solo categorie pizza — ancora da fare",
  },
  "CA-03": {
    files: ["src/features/operative/delivery/pages/DeliveryDashboard.jsx"],
    noteDev: "Propagare marker assegnazione manuale — ancora da fare",
  },
  "CA-04": {
    files: [
      "src/utils/stampaOperativaConfig.js",
      "src/features/operative/cassa/utils/printComanda.js",
    ],
  },
  "CA-05": {
    files: [
      "src/features/operative/cassa/pages/CassaPage.jsx",
      "src/features/operative/cassa/components/CassaPlanningBoard.jsx",
    ],
    noteDev: "Planning full-width: nasconde Ordini + Carrello",
  },
  "CA-06": {
    files: [
      "src/utils/fidelityRedeem.js",
      "src/features/operative/cassa/components/RiepilogoOrdinePage.jsx",
      "src/features/operative/cassa/pages/CassaPage.jsx",
    ],
    noteDev: "Premio raggiunto + checkbox usa premio (lead scheda/timbri)",
  },
  "CA-07": {
    files: [
      "src/features/operative/cassa/utils/printRicevuta.js",
      "src/features/operative/cassa/utils/comandaIngredientiSummary.js",
      "src/features/operative/cassa/components/CartItem.jsx",
    ],
    noteDev: "Dettaglio Senza/Aggiunta su ricevuta e carrello",
  },
  "CA-08": {
    files: [
      "src/features/operative/cassa/pages/CassaPage.jsx",
      "src/features/operative/cassa/components/RiepilogoOrdinePage.jsx",
      "src/features/operative/cassa/utils/cassaPaymentDisplay.js",
      "src/integrations/payments/unifiedPaymentLink.js",
    ],
    noteDev: "Pannello post-checkout Link anche se payment_link non abilitato",
  },
  "CA-09": {
    files: [
      "src/features/operative/cassa/components/ModificaPizzaModal.jsx",
      "src/features/admin/services/adminService.js",
    ],
    noteDev: "Prezzi unitari/varianti sempre in UI; costi in batch ingredienti",
  },
  "AD-01": {
    files: [
      "src/features/admin/pages/settings/ParametriSection.jsx",
      "src/constants/publicParametriOperativiKeys.js",
    ],
  },
  "AD-02": {
    sql: [
      "sql/modules/39_public_tenant_by_id.sql",
      "sql/modules/40_public_parametri_whitelist.sql",
    ],
  },
  "AD-03": {
    files: [
      "src/features/superadmin/pages/SuperadminTenantArchivioPasswordPage.jsx",
      "src/features/superadmin/pages/Tenants.jsx",
    ],
    sql: ["sql/modules/48_utenti_ruoli_select_superadmin.sql"],
    noteDev: "RLS utenti_ruoli SELECT per SA → archivio password staff",
  },
  "AD-04": {
    files: [
      "src/features/admin/services/adminService.js",
      "src/features/superadmin/pages/SuperadminTenantArchivioPasswordPage.jsx",
    ],
    sql: ["sql/modules/50_clienti_select_admin_sa.sql"],
    noteDev: "Merge clienti con note in archivio password",
  },
  "AD-05": {
    files: ["src/features/admin/pages/menu/IngredientiPage.jsx"],
    noteDev: "Badge cottura + categoria colorata; A fine cottura senza fill",
  },
  "UX-01": {
    files: ["src/features/public/pages/Login.jsx"],
  },
  "UX-02": {
    files: [
      "src/layouts/PublicLayout.jsx",
      "src/features/public/components/ClienteHeaderAccount.jsx",
    ],
  },
  "OP-01": {
    files: [
      "src/features/operative/cucina/utils/cucinaPrepTasks.js",
      "src/features/operative/cucina/pages/Cucina.jsx",
      "src/features/operative/bancone/utils/banconeSlotPick.js",
    ],
    noteDev: "Prep da flag/categoria/fine cottura + extras summary",
  },
  "OP-02": {
    files: [
      "src/features/operative/pizzaiolo/utils/pizzaioloUtils.js",
      "src/features/operative/pizzaiolo/pages/Dashboard.jsx",
      "src/utils/riderDeliveryConfig.js",
    ],
    noteDev: "Lead time viaggio default 10′; orario su card delivery",
  },
  "OP-03": {
    files: [
      "src/layouts/OperativeLayout.jsx",
      "src/styles/cassa-mobile.css",
    ],
    noteDev: "Drawer sidebar sempre (☰) anche desktop",
  },
  "OP-04": {
    files: [
      "src/features/operative/cucina/utils/cucinaPrepTasks.js",
      "src/features/operative/cucina/pages/Cucina.jsx",
    ],
    noteDev: "aggregatePrepTasksBySlot; UI solo conteggi, no In forno",
  },
  "OP-05": {
    files: [
      "src/utils/cucinaTabletConfig.js",
      "src/features/operative/bancone/pages/Bancone.jsx",
      "src/features/operative/bancone/utils/banconeSlotPick.js",
      "src/layouts/OperativeLayout.jsx",
      "src/features/operative/cassa/components/CassaImpostazioniPage.jsx",
    ],
    noteDev: "cucina_tablet_abilitato; prep IN_PREPARAZIONE su Bancone se OFF",
  },
  "OP-06": {
    files: [
      "src/features/operative/bancone/utils/banconeSlotPick.js",
      "src/layouts/OperativeLayout.jsx",
      "src/features/operative/cucina/pages/Cucina.jsx",
    ],
    noteDev: "Fix HMR: prep monitor locale + setMobileSidebarOpen alias; smoke Bancone",
  },
  "OP-07": {
    files: [
      "src/features/operative/bancone/pages/Bancone.jsx",
      "src/features/operative/delivery/pages/DeliveryDashboard.jsx",
      "src/features/superadmin/pages/SuperadminGatePage.jsx",
    ],
    noteDev: "Quad Test 4 reparti: Bancone tutti PRONTO oggi; Delivery empty-state",
  },
  "CA-10": {
    files: [
      "src/features/admin/pages/settings/PagamentiOnlinePage.jsx",
      "src/features/operative/cassa/components/CassaImpostazioniPage.jsx",
    ],
    noteDev: "Catalogo sistemi pagamento → Admin Pagamenti online",
  },
  "CA-11": {
    files: [
      "src/features/admin/pages/settings/StampaOperativaSection.jsx",
      "src/features/operative/cassa/components/CassaImpostazioniPage.jsx",
    ],
    noteDev: "Flusso stampa + layout comanda → Admin Stampa operativa",
  },
  "CA-12": {
    files: [
      "src/features/operative/cassa/components/CassaImpostazioniPage.jsx",
      "src/features/admin/services/adminService.js",
    ],
    noteDev: "Solo parametri operativi + audit parametri_cassa_operatore",
  },
  "CA-14": {
    files: [
      "src/features/operative/cassa/components/CassaPlanningBoard.jsx",
      "src/features/operative/cassa/pages/CassaPage.jsx",
    ],
    noteDev: "Strip pony (anche 0), ↑↓ con lettera corrente, righe vuote",
  },
  "CL-09": {
    files: [
      "src/features/operative/cassa/components/ModificaPizzaModal.jsx",
      "src/features/operative/cassa/utils/ingredientAffinity.js",
    ],
    noteDev: "sortIngredientsByPizzaAffinity in modifica pizza",
  },
  "CL-10": {
    files: [
      "src/features/public/pages/PublicOrdineCheckoutPage.jsx",
      "src/utils/geocodeAddress.js",
    ],
    noteDev: "Riepilogo profilo; Conferma non silenziosa; geocode Nominatim-first; Stripe soft",
  },
  "OW-05": {
    files: [
      "src/features/public/pages/PublicOrdineCheckoutPage.jsx",
      "src/features/admin/pages/settings/PagamentiOnlinePage.jsx",
    ],
    noteDev: "Allineato CL-10 + carte test; smoke Stripe/SumUp manuale",
  },
  "DB-01": { sql: ["sql/modules/44_cliente_iscriviti_fidelity.sql"] },
  "DB-02": {
    sql: [
      "sql/modules/45_ordini_web_accettazione_cassa.sql",
      "sql/modules/46_ordini_web_accettazione_public_param.sql",
    ],
  },
  "DB-03": { sql: ["sql/modules/25_ordini_web_capacity_antifraud_delivery_proof.sql"] },
  "DB-04": {
    sql: [
      "sql/modules/29_go_live_checklist.sql",
      "sql/modules/30_support_presence_tenant_bind.sql",
      "sql/modules/31_security_definer_search_path.sql",
      "sql/modules/36_realtime_ordini_publication.sql",
      "sql/modules/37_storage_consegna_prove.sql",
      "sql/modules/38_advisor_residuals_turni_search_path.sql",
    ],
  },
  "DB-05": {
    sql: [
      "sql/modules/48_utenti_ruoli_select_superadmin.sql",
      "sql/modules/49_public_modifica_pizza_bundle.sql",
      "sql/modules/50_clienti_select_admin_sa.sql",
    ],
  },
  "IN-01": {
    files: ["server/pizzeria-backend", "src/features/superadmin/pages/SuperadminGatePage.jsx"],
  },
  "IN-02": { noteDev: "CI keep-alive" },
  "IN-03": {
    files: ["procedere da qui.txt", "docs/PROGRAMMA_AFFIDABILITA.md"],
    noteDev: "Audit Nest + CI RLS — ancora da fare",
  },
  "SE-01": {
    sql: ["sql/modules/26_support_presence.sql", "sql/modules/30_support_presence_tenant_bind.sql"],
  },
  "SE-02": { sql: ["sql/modules/35_revoke_anon_auth_required_rpcs.sql"] },
})
