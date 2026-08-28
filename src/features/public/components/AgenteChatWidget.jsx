import { useEffect, useRef, useState } from "react"
import { inviaMessaggioAgente, nuovaSessioneId } from "@/features/public/services/agenteChatService"

/**
 * Bolla di chat flottante per l'agente AI. Stesso componente per sito pubblico
 * (modalita="marketing") e app tenant (modalita="supporto", con tenantId/utenteId).
 * Se l'agente non è attivo lato server (agente_configurazione.attivo = false), la prima
 * chiamata fallisce con un errore gestito e il widget mostra un messaggio "non disponibile"
 * invece di un errore tecnico.
 */
export default function AgenteChatWidget({ modalita = "marketing", tenantId = null, utenteId = null }) {
  const [open, setOpen] = useState(false)
  const [messaggi, setMessaggi] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [nonDisponibile, setNonDisponibile] = useState(false)
  const sessioneIdRef = useRef(nuovaSessioneId())
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messaggi, open])

  async function handleInvia() {
    const testo = input.trim()
    if (!testo || loading) return
    setInput("")
    const storicoPrecedente = messaggi
    const nuoviMessaggi = [...messaggi, { role: "user", content: testo, at: new Date().toISOString() }]
    setMessaggi(nuoviMessaggi)
    setLoading(true)
    try {
      const risposta = await inviaMessaggioAgente({
        modalita,
        sessioneId: sessioneIdRef.current,
        messaggio: testo,
        storico: storicoPrecedente,
        tenantId,
        utenteId,
      })
      setMessaggi((prev) => [
        ...prev,
        { role: "assistant", content: risposta?.risposta || "Non ho una risposta al momento.", at: new Date().toISOString() },
      ])
    } catch (e) {
      const msg = String(e?.message || "")
      if (/non attivo|not active|disabled/i.test(msg)) {
        setNonDisponibile(true)
      } else {
        setMessaggi((prev) => [
          ...prev,
          { role: "assistant", content: "Si è verificato un errore, riprova tra poco o contatta l'assistenza.", at: new Date().toISOString(), errore: true },
        ])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: "fixed", right: 20, bottom: 20, zIndex: 60 }}>
      {open && (
        <div
          style={{
            width: 320,
            maxWidth: "calc(100vw - 40px)",
            height: 420,
            maxHeight: "calc(100vh - 120px)",
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 12px 32px rgba(15,23,42,0.18)",
            display: "flex",
            flexDirection: "column",
            marginBottom: 12,
            overflow: "hidden",
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ padding: "12px 14px", background: "#0f172a", color: "#fff", fontWeight: 600, fontSize: 14 }}>
            {modalita === "supporto" ? "Assistenza PizzaManager" : modalita === "cliente" ? "Chiedi al locale" : "Chiedi a PizzaManager"}
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {messaggi.length === 0 && !nonDisponibile && (
              <p style={{ fontSize: 13, color: "#64748b" }}>
                {modalita === "supporto"
                  ? "Chiedimi come usare cassa, comande, delivery, magazzino, fidelity o contabilità."
                  : modalita === "cliente"
                    ? "Chiedimi orari, menu o quanto tempo ci vuole per il tuo ordine."
                    : "Chiedimi qualsiasi cosa su PizzaManager: prezzi, funzionalità, come iniziare."}
              </p>
            )}
            {nonDisponibile && (
              <p style={{ fontSize: 13, color: "#b45309" }}>
                L'assistente non è ancora disponibile. Scrivi a{" "}
                <a href="mailto:info@pizzamanager.it">info@pizzamanager.it</a>.
              </p>
            )}
            {messaggi.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "#2563eb" : "#f1f5f9",
                  color: m.role === "user" ? "#fff" : "#1e293b",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 13,
                  maxWidth: "85%",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && <div style={{ fontSize: 12, color: "#94a3b8" }}>Sta scrivendo…</div>}
          </div>
          {!nonDisponibile && (
            <div style={{ padding: 10, borderTop: "1px solid #e2e8f0", display: "flex", gap: 6 }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInvia()
                }}
                placeholder="Scrivi un messaggio…"
                style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              />
              <button
                type="button"
                onClick={handleInvia}
                disabled={loading || !input.trim()}
                style={{
                  background: "#0f172a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: loading || !input.trim() ? 0.6 : 1,
                }}
              >
                Invia
              </button>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Chiudi chat" : "Apri chat"}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#2563eb",
          color: "#fff",
          border: "none",
          boxShadow: "0 8px 20px rgba(37,99,235,0.35)",
          fontSize: 22,
          cursor: "pointer",
          float: "right",
        }}
      >
        {open ? "×" : "💬"}
      </button>
    </div>
  )
}
