/**
 * Helper condivisi per la creazione in blocco di account staff (RuoliPage.jsx in Admin, e la tab
 * "Account attivi" in Superadmin → Tenants — quest'ultima aggiunta perché il superadmin non aveva
 * alcun modo di creare account per un tenant senza entrare come admin di quel tenant, un blocco
 * reale trovato testando dal vivo il pannello superadmin).
 */

export const RUOLO_BASE_OPTIONS = [
  { value: "admin", label: "Amministratore" },
  { value: "operatore", label: "Operatore (multi-reparto)" },
  { value: "cassa", label: "Cassa" },
  { value: "bancone", label: "Bancone" },
  { value: "cucina", label: "Cucina" },
  { value: "pizzaiolo", label: "Pizzaiolo" },
  { value: "delivery", label: "Delivery" },
  { value: "pony", label: "Pony" },
];

/** Set "standard" proposto in "Crea account standard": i reparti tipici di un locale, non tutti i ruoli possibili. */
export const STAFF_STANDARD_RUOLI = ["admin", "cassa", "bancone", "cucina", "pizzaiolo", "delivery"];

let staffRowSeq = 0;
function nextStaffRowId() {
  staffRowSeq += 1;
  return `staff-row-${staffRowSeq}`;
}

/** Password leggibile ma casuale (crypto, non Math.random) — l'admin la vede e la consegna allo staff. */
export function generateStaffPassword() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += alfabeto[bytes[i] % alfabeto.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function nuovaStaffRow(ruolo, selezionata = true) {
  return {
    id: nextStaffRowId(),
    ruolo,
    email: "",
    password: generateStaffPassword(),
    nomeVisualizzato: "",
    selezionata,
  };
}

/**
 * Righe standard proposte, con il flag di selezione già impostato in base al tenant: un ruolo che
 * ha già almeno un account collegato parte deselezionato (di solito non serve ricrearlo — e il
 * reset password di un account esistente è comunque riservato al superadmin), gli altri partono
 * selezionati. L'admin/superadmin può comunque flaggare/sflaggare liberamente prima di creare.
 */
export function nuoveStaffRowsStandard(ruoliEsistenti = []) {
  const ruoliGiaPresenti = new Set((ruoliEsistenti || []).map((r) => r.ruolo));
  return STAFF_STANDARD_RUOLI.map((r) => nuovaStaffRow(r, !ruoliGiaPresenti.has(r)));
}
