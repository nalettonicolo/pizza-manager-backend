import { supabase } from "@/lib/supabaseClient"

export const generaDeliveryToken = async (ordineId) => {
  const { data, error } = await supabase.rpc("genera_delivery_token", {
    p_ordine_id: ordineId
  })

  if (error) throw error

  return data
}
