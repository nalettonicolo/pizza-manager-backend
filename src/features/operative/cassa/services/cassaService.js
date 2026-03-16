import { supabase } from "@/lib/supabaseClient"

export async function createOrder(order) {
  const { data, error } = await supabase
    .from("Ordine")
    .insert(order)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createOrderItems(items) {
  const { error } = await supabase
    .from("ordini_items")
    .insert(items)

  if (error) throw error
}
