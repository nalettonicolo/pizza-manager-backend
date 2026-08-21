const SUMUP_API = "https://api.sumup.com"

export type SumUpCheckout = {
  id?: string
  status?: string
  hosted_checkout_url?: string
  transaction_id?: string
  transaction_code?: string
  transactions?: Array<{ id?: string; transaction_code?: string; status?: string }>
}

export async function sumupApi<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T | null; raw: string }> {
  const res = await fetch(`${SUMUP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  })
  const raw = await res.text()
  let data: T | null = null
  if (raw) {
    try {
      data = JSON.parse(raw) as T
    } catch {
      data = null
    }
  }
  return { ok: res.ok, status: res.status, data, raw }
}

export function isSumUpCheckoutPaid(checkout: SumUpCheckout | null | undefined): boolean {
  if (!checkout) return false
  if (checkout.transaction_id && checkout.transaction_code) return true
  const txs = checkout.transactions
  if (!Array.isArray(txs)) return false
  return txs.some((t) => String(t?.status || "").toUpperCase() === "SUCCESSFUL")
}

export function pickSumUpTransaction(checkout: SumUpCheckout | null | undefined): {
  transactionId: string
  transactionCode: string
} {
  const topId = String(checkout?.transaction_id || "").trim()
  const topCode = String(checkout?.transaction_code || "").trim()
  if (topId || topCode) {
    return { transactionId: topId, transactionCode: topCode }
  }
  const txs = checkout?.transactions
  if (Array.isArray(txs)) {
    const ok = txs.find((t) => String(t?.status || "").toUpperCase() === "SUCCESSFUL") || txs[0]
    return {
      transactionId: String(ok?.id || "").trim(),
      transactionCode: String(ok?.transaction_code || "").trim(),
    }
  }
  return { transactionId: "", transactionCode: "" }
}
