import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import CheckoutButton from "@/components/CheckoutButton"

export default function OrdinePage() {
  const [ordine, setOrdine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)

  useEffect(() => {
    fetchOrdine()
    subscribeRealtime()

    return () => {
      supabase.removeAllChannels()
    }
  }, [])

  const fetchOrdine = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from("Ordine")
      .select("*")
      .eq("stato", "bozza")
      .limit(1)
      .single()

    if (error) {
      setErrorMessage("Errore caricamento ordine")
      setLoading(false)
      return
    }

    setOrdine(data)
    setLoading(false)
  }

  const subscribeRealtime = () => {
    supabase
      .channel("ordini-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ordini",
        },
        (payload) => {
          console.log("Ordine aggiornato:", payload)

          setOrdine(payload.new)
        }
      )
      .subscribe()
  }

  if (loading) return <p style={{ padding: "40px" }}>Caricamento...</p>

  if (errorMessage)
    return (
      <p style={{ padding: "40px", color: "red" }}>
        {errorMessage}
      </p>
    )

  if (!ordine)
    return (
      <p style={{ padding: "40px" }}>
        Nessun ordine trovato
      </p>
    )

  return (
    <div style={{ padding: "40px" }}>
      <h2>Dettaglio Ordine</h2>

      <p><strong>ID:</strong> {ordine.id}</p>
      <p><strong>Stato:</strong> {ordine.stato}</p>

      {ordine.stato === "bozza" && (
        <CheckoutButton ordineId={ordine.id} />
      )}

      {ordine.stato === "confermato" && (
        <div
          style={{
            marginTop: "20px",
            padding: "10px",
            backgroundColor: "#dcfce7",
            borderRadius: "6px",
          }}
        >
          Ordine già confermato
        </div>
      )}
    </div>
  )
}
