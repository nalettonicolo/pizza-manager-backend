/**
 * Registro delle funzionalità che il Super Admin vede/usa sempre (per continuare a testare e
 * sviluppare) ma che NON sono ancora garantite abbastanza da mostrare così com'è a un tenant
 * cliente del SaaS. Un tenant vede "Presto disponibile" al posto della funzionalità finché la
 * voce qui sotto non passa a stato "stabile" — a quel punto torna visibile a tutti senza toccare
 * il codice della pagina.
 *
 * Aggiungere una voce qui è la parte facile; il lavoro vero è deciderla insieme (cosa è
 * davvero pronto per un cliente pagante) — vedi la checklist go-live per il contesto.
 */
export const FEATURE_READINESS = {
  test_4_reparti: {
    label: "Test 4 reparti",
    stato: "beta",
    motivo:
      "Strumento di verifica interno (confronta 4 reparti in parallelo per collaudo), non una " +
      "funzionalità operativa pensata per l'uso quotidiano del locale.",
  },
  delivery_ricalcolo_automatico: {
    label: "Ricalcolo automatico consegne",
    stato: "beta",
    motivo: "Il modulo di ricalcolo automatico dei percorsi non è ancora attivo: oggi il ricalcolo resta manuale in cassa.",
  },
  notifiche_automatiche_staff: {
    label: "Notifiche automatiche staff (email/SMS/WhatsApp)",
    stato: "beta",
    motivo: "Gli invii automatici richiedono ancora le API del provider scelto — non ancora collegati.",
  },
  pagamento_link_whatsapp: {
    label: "Link di pagamento (WhatsApp/SMS)",
    stato: "beta",
    motivo: "Funzionalità appena costruita: verificato il codice, non ancora un pagamento reale end-to-end con un cliente.",
  },
}

/** true se la funzionalità è considerata pronta per qualsiasi tenant (non solo Super Admin). */
export function isFeatureStable(key) {
  return FEATURE_READINESS[key]?.stato === "stabile"
}

/** Dettagli della voce (label/motivo), o null se la chiave non è registrata (= trattata come stabile). */
export function featureReadinessInfo(key) {
  return FEATURE_READINESS[key] || null
}

/**
 * true se `ruolo` deve vedere la funzionalità com'è (Super Admin sempre; un tenant solo se la
 * voce è "stabile" o non è nemmeno registrata qui, cioè non è mai stata segnata come beta).
 */
export function isFeatureVisibleForRuolo(key, ruolo) {
  if (ruolo === "superadmin") return true
  const info = FEATURE_READINESS[key]
  if (!info) return true
  return info.stato === "stabile"
}
