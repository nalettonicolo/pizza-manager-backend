/**
 * Pulsanti toolbar header area cassa (OperativeLayout).
 * Usare gli stessi valori su ogni pagina che monta la toolbar (Cassa, Prodotti esauriti, …).
 */

export const cassaTipoOrdineBtn = {
  padding: "5px 10px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ddd",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
  boxSizing: "border-box",
  lineHeight: 1.2,
}

export const cassaTipoOrdineBtnActive = {
  background: "#2e7d32",
  color: "#fff",
  borderColor: "#2e7d32",
}

export const cassaNuovoClienteBtn = {
  padding: "5px 10px",
  background: "#1976d2",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  lineHeight: 1.2,
}

/** Ordini, Planning e azioni secondarie nella stessa riga della cassa */
export const cassaToolbarCompactBtn = {
  padding: "5px 9px",
  border: "none",
  borderRadius: 6,
  fontSize: 12,
  boxSizing: "border-box",
  lineHeight: 1.2,
  cursor: "pointer",
}
