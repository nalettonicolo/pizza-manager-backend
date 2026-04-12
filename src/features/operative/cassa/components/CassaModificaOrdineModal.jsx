import { newLocalId } from "@/features/admin/hooks/useTenantLocalJson"
import {
  ordineIsDelivery,
  ordineIndirizzoConsegna,
  ordineNomeCliente,
  ordineOrarioRitiro,
} from "@/features/operative/cassa/utils/ordineFieldHelpers"

/**
 * Modale "Modifica ordine" (metadati + righe prodotto).
 * Stato e persistenza restano nel parent (CassaPage); qui solo presentazione e callback.
 */
export default function CassaModificaOrdineModal({
  styles,
  ordine,
  saving,
  modificaForm,
  setModificaForm,
  modificaRighe,
  setModificaRighe,
  modificaProdottiList,
  modificaTotaleAnteprima,
  tipiPagamento,
  onClose,
  onSave,
}) {
  if (!ordine) return null

  return (
    <div style={styles.modalOverlay} onClick={() => !saving && onClose()} role="dialog" aria-modal="true">
      <div
        style={{ ...styles.detailModal, maxWidth: 520, maxHeight: "min(92vh, 720px)", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Modifica ordine #{ordine.numero ?? ordine.id}</h3>
          <button type="button" style={styles.planningBarClose} onClick={() => !saving && onClose()} disabled={saving} aria-label="Chiudi">
            ✕
          </button>
        </div>

        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #eee" }}>
          <p style={{ margin: "0 0 8px", color: "#666", fontSize: 14 }}>
            {ordineIsDelivery(ordine) ? "Consegna a domicilio" : "Ritiro in negozio"}
          </p>
          {ordineIsDelivery(ordine) && ordineIndirizzoConsegna(ordine) ? (
            <p style={{ margin: "0 0 8px", fontWeight: 500, fontSize: 14 }}>
              Indirizzo: {ordineIndirizzoConsegna(ordine)}
            </p>
          ) : null}
          {ordineNomeCliente(ordine) ? (
            <p style={{ margin: "0 0 4px", fontWeight: 500, fontSize: 14 }}>Cliente: {ordineNomeCliente(ordine)}</p>
          ) : null}
          {ordineOrarioRitiro(ordine) ? (
            <p style={{ margin: "0 0 12px", color: "#555", fontSize: 14 }}>Orario: {ordineOrarioRitiro(ordine)}</p>
          ) : null}

          <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>Prodotti</p>
          {modificaProdottiList.length === 0 ? (
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#888" }}>Caricamento listino…</p>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
            {modificaRighe.map((row) => {
              const sub = Number(row.prezzo || 0) * Math.max(1, Number(row.quantita) || 1)
              const inList = modificaProdottiList.some((p) => String(p.id) === String(row.prodotto_id))
              return (
                <div
                  key={row.key}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid #f0f0f0",
                    fontSize: 14,
                  }}
                >
                  <select
                    value={String(row.prodotto_id)}
                    disabled={saving || modificaProdottiList.length === 0}
                    onChange={(e) => {
                      const pid = e.target.value
                      const p = modificaProdottiList.find((x) => String(x.id) === pid)
                      if (!p) return
                      setModificaRighe((rows) =>
                        rows.map((r) =>
                          r.key === row.key
                            ? {
                                ...r,
                                prodotto_id: p.id,
                                nome: p.nome ?? "—",
                                prezzo: Number(p.prezzo) || 0,
                                ingredienti_cottura_summary: "",
                              }
                            : r,
                        ),
                      )
                    }}
                    style={{ flex: "1 1 200px", minWidth: 0, padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                  >
                    {!inList ? (
                      <option value={String(row.prodotto_id)}>
                        {row.nome ?? "—"} (attuale, € {Number(row.prezzo || 0).toFixed(2)})
                      </option>
                    ) : null}
                    {modificaProdottiList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome ?? "—"} — € {Number(p.prezzo || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        setModificaRighe((rows) =>
                          rows.map((r) =>
                            r.key === row.key ? { ...r, quantita: Math.max(1, (Number(r.quantita) || 1) - 1) } : r,
                          ),
                        )
                      }
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #ccc", cursor: "pointer" }}
                      aria-label="Diminuisci quantità"
                    >
                      −
                    </button>
                    <span style={{ minWidth: 22, textAlign: "center" }}>{row.quantita}</span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        setModificaRighe((rows) =>
                          rows.map((r) => (r.key === row.key ? { ...r, quantita: (Number(r.quantita) || 1) + 1 } : r)),
                        )
                      }
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #ccc", cursor: "pointer" }}
                      aria-label="Aumenta quantità"
                    >
                      +
                    </button>
                  </div>
                  <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>€ {sub.toFixed(2)}</span>
                  <button
                    type="button"
                    disabled={saving || modificaRighe.length <= 1}
                    onClick={() => setModificaRighe((rows) => rows.filter((r) => r.key !== row.key))}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid #c62828",
                      color: "#c62828",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Rimuovi riga
                  </button>
                  {row.formato_nome || row.ingredienti_cottura_summary ? (
                    <div style={{ width: "100%", fontSize: 12, color: "#666" }}>
                      {row.formato_nome ? <div>Formato: {row.formato_nome}</div> : null}
                      {row.ingredienti_cottura_summary ? (
                        <div style={{ marginTop: row.formato_nome ? 4 : 0 }}>{row.ingredienti_cottura_summary}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <button
            type="button"
            disabled={saving || modificaProdottiList.length === 0}
            onClick={() => {
              const p0 = modificaProdottiList[0]
              if (!p0) return
              setModificaRighe((rows) => [
                ...rows,
                {
                  key: `new-${newLocalId()}`,
                  prodotto_id: p0.id,
                  nome: p0.nome ?? "—",
                  quantita: 1,
                  prezzo: Number(p0.prezzo) || 0,
                  formato_nome: "",
                  ingredienti_cottura_summary: "",
                },
              ])
            }}
            style={{ ...styles.planningBarToggle, marginBottom: 12 }}
          >
            Aggiungi prodotto
          </button>
          <p style={{ fontWeight: 600, margin: 0, fontSize: 14 }}>
            Totale da salvare: € {modificaTotaleAnteprima.toFixed(2)}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#555" }}>Pagamento attuale: {ordine.tipo_pagamento || "—"}</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 500 }}>Nome cliente</span>
            <input
              type="text"
              value={modificaForm.nome_cliente}
              onChange={(e) => setModificaForm((f) => ({ ...f, nome_cliente: e.target.value }))}
              placeholder="Nome per l'ordine"
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
            />
          </label>
          {!ordineIsDelivery(ordine) ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 500 }}>Telefono (ritiro, facoltativo)</span>
              <input
                type="tel"
                value={modificaForm.telefono_ritiro}
                onChange={(e) => setModificaForm((f) => ({ ...f, telefono_ritiro: e.target.value }))}
                placeholder="Es. +39…"
                style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
              />
            </label>
          ) : null}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 500 }}>Orario ritiro o consegna</span>
            <input
              type="text"
              value={modificaForm.orario_ritiro}
              onChange={(e) => setModificaForm((f) => ({ ...f, orario_ritiro: e.target.value }))}
              placeholder="Es. 18:30"
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
            />
          </label>
          {ordineIsDelivery(ordine) ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 500 }}>Indirizzo di consegna</span>
              <input
                type="text"
                value={modificaForm.indirizzo_consegna}
                onChange={(e) => setModificaForm((f) => ({ ...f, indirizzo_consegna: e.target.value }))}
                placeholder="Via, numero civico, note accesso"
                style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
              />
            </label>
          ) : null}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 500 }}>Note ordine</span>
            <textarea
              value={modificaForm.note}
              onChange={(e) => setModificaForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Istruzioni per cucina o consegna"
              rows={2}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", resize: "vertical" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontWeight: 500 }}>Tipo di pagamento</span>
            <select
              value={modificaForm.tipo_pagamento}
              onChange={(e) => setModificaForm((f) => ({ ...f, tipo_pagamento: e.target.value }))}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
            >
              {(tipiPagamento || []).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button type="button" style={styles.impostazioniBtn} onClick={onSave} disabled={saving}>
            {saving ? "Salvataggio in corso…" : "Salva modifiche"}
          </button>
          <button type="button" style={styles.planningBarToggle} onClick={() => !saving && onClose()} disabled={saving}>
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}
