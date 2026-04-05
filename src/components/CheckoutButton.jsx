import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabaseClient"

function parseOrarioRitiroToDate(orarioStr) {
  if (!orarioStr || typeof orarioStr !== "string") return null
  const [hStr, mStr] = orarioStr.trim().split(":")
  const h = Number(hStr)
  const m = Number(mStr)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0)
  return d
}

export default function CheckoutButton({ ordineId }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  const handleCheckout = async () => {
    if (!ordineId) {
      setErrorMessage("Ordine non valido")
      return
    }

    if (loading) return // blocca doppio click

    setLoading(true)
    setErrorMessage(null)

    try {
      // 1) Legge orario_ritiro per applicare il vincolo dei 30 minuti
      const { data: ordine, error: fetchErr } = await supabase
        .from("Ordine")
        .select("orario_ritiro, tipo_ordine")
        .eq("id", ordineId)
        .single()

      if (fetchErr) {
        console.error("Errore lettura ordine per checkout:", fetchErr)
        setErrorMessage("Errore nel controllo dell'orario di consegna. Riprova tra poco.")
        setLoading(false)
        return
      }

      const orarioStr = ordine?.orario_ritiro
      const orarioDate = parseOrarioRitiroToDate(orarioStr)

      if (orarioDate) {
        const now = new Date()
        const diffMs = orarioDate.getTime() - now.getTime()
        const diffMin = diffMs / (60 * 1000)

        if (diffMin < 30) {
          setErrorMessage(
            "Per gli ordini online non è possibile confermare negli ultimi 30 minuti rispetto all'orario di consegna selezionato. Scegli un orario più avanti."
          )
          setLoading(false)
          return
        }
      }

      // 2) Se il controllo è superato, effettua il checkout
      const { error } = await supabase.rpc("checkout_ordine", {
        p_ordine_id: ordineId,
      })

      if (error) {
        console.error("Errore checkout:", error)
        setErrorMessage(error.message)
        setLoading(false)
        return
      }

      setLoading(false)
      navigate("/ordine-confermato")
    } catch (err) {
      console.error("Eccezione checkout:", err)
      setErrorMessage("Errore imprevisto durante il checkout. Riprova più tardi.")
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        style={{
          padding: "10px 20px",
          backgroundColor: loading ? "#9ca3af" : "#16a34a",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Conferma in corso..." : "Conferma Ordine"}
      </button>

      {errorMessage && (
        <div
          style={{
            marginTop: "15px",
            padding: "10px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            borderRadius: "6px",
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  )
}
