/**
 * Pulsanti toolbar header area cassa (OperativeLayout).
 * Usare gli stessi valori su ogni pagina che monta la toolbar (Cassa, Prodotti esauriti, …).
 */

export const cassaTipoOrdineBtn = {
  padding: "10px 20px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ddd",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 500,
  boxSizing: "border-box",
  lineHeight: 1.25,
}

export const cassaTipoOrdineBtnActive = {
  background: "#2e7d32",
  color: "#fff",
  borderColor: "#2e7d32",
}

export const cassaNuovoClienteBtn = {
  padding: "10px 16px",
  background: "#1976d2",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  lineHeight: 1.25,
}

/** Ordini, Planning e azioni secondarie nella stessa riga della cassa */
export const cassaToolbarCompactBtn = {
  padding: "8px 14px",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  boxSizing: "border-box",
  lineHeight: 1.25,
  cursor: "pointer",
}
