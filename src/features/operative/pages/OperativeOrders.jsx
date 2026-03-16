import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export default function OperativeOrders() {
  const [ordini, setOrdini] = useState([])

  useEffect(() => {
    fetchOrdini()
  }, [])

  const fetchOrdini = async () => {
    const { data, error } = await supabase
      .from("v_ordini_stato_live")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setOrdini(data || [])
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Ordini Operativi</h1>

      {ordini.map((ordine) => (
        <div
          key={ordine.id}
          className="border rounded p-3 mb-3 shadow-sm bg-white"
        >
          <div className="flex justify-between">
            <span>Ordine #{ordine.numero_ordine}</span>
            <span className="font-semibold">{ordine.stato}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
