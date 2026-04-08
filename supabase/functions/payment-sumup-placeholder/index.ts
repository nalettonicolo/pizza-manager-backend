import { corsHeaders, jsonResponse } from "../_shared/cors"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  return jsonResponse(
    {
      error: "sumup_not_implemented",
      message:
        "SumUp: predisposizione tenant (sumup_merchant_public_id) presente; serve integrazione API Checkout o Reader lato server. Vedere documentazione SumUp Payments.",
    },
    501,
  )
})
