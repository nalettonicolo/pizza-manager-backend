import { useRef, useState } from "react"

/**
 * Dialog firma + foto opzionale prima di segnare CONSEGNATO.
 */
export default function ConsegnaProofDialog({ open, ordineNumero, onCancel, onConfirm, busy }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [photoDataUrl, setPhotoDataUrl] = useState(null)
  const [note, setNote] = useState("")

  if (!open) return null

  const pos = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches?.[0]?.clientX ?? e.clientX
    const clientY = e.touches?.[0]?.clientY ?? e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startDraw = (e) => {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = "#0f172a"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.stroke()
  }

  const endDraw = () => {
    drawing.current = false
  }

  const clearSig = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const onPhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhotoDataUrl(typeof reader.result === "string" ? reader.result : null)
    reader.readAsDataURL(file)
  }

  const handleConfirm = () => {
    const prove = []
    const canvas = canvasRef.current
    if (canvas) {
      prove.push({ tipo: "firma", payload: { dataUrl: canvas.toDataURL("image/png") } })
    }
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
          Firma del cliente (opzionale) e foto di prova. Immagini salvate nello Storage del locale (non in chiaro nel DB).
        </p>
        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Firma</p>
        <canvas
          ref={canvasRef}
          width={360}
          height={120}
          style={{ width: "100%", height: 120, border: "1px solid #cbd5e1", borderRadius: 8, touchAction: "none" }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <button type="button" onClick={clearSig} style={{ marginTop: 6, fontSize: 12, color: "#64748b", background: "none", border: "none", cursor: "pointer" }}>
          Cancella firma
        </button>
        <p style={{ fontSize: 12, fontWeight: 600, margin: "12px 0 4px" }}>Foto (opzionale)</p>
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
