import { useState } from "react"

/**
 * Dialog foto + nota (entrambe opzionali) prima di segnare CONSEGNATO.
 * La firma su schermo è stata rimossa su richiesta: rallentava senza portare valore reale
 * (il cliente non firma davvero, era solo un passaggio in più prima del tasto Consegnato).
 */
export default function ConsegnaProofDialog({ open, ordineNumero, onCancel, onConfirm, busy }) {
  const [photoDataUrl, setPhotoDataUrl] = useState(null)
  const [note, setNote] = useState("")

  if (!open) return null

  const onPhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoDataUrl(typeof reader.result === "string" ? reader.result : null)
    reader.readAsDataURL(file)
  }

  const handleConfirm = () => {
    const prove = []
    if (photoDataUrl) {
      prove.push({ tipo: "foto", payload: { dataUrl: photoDataUrl } })
    }
    const n = note.trim()
    if (n) prove.push({ tipo: "note", payload: { testo: n } })
    onConfirm(prove)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 17 }}>Conferma consegna #{ordineNumero ?? "—"}</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
          Foto di prova (opzionale). Immagini salvate nello Storage del locale (non in chiaro nel DB).
        </p>
        <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 4px" }}>Foto (opzionale)</p>
        <input type="file" accept="image/*" capture="environment" onChange={onPhoto} />
        {photoDataUrl ? (
          <img src={photoDataUrl} alt="Anteprima consegna" style={{ marginTop: 8, maxHeight: 80, borderRadius: 6 }} />
        ) : null}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note consegna (opzionale)"
          rows={2}
          style={{ width: "100%", marginTop: 10, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "none", background: "#2196f3", color: "#fff", fontWeight: 700, cursor: busy ? "default" : "pointer" }}
          >
            {busy ? "Salvo…" : "Consegnato"}
          </button>
        </div>
      </div>
    </div>
  )
}
