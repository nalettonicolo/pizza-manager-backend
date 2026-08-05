/**
 * Stub legacy — non usare per create ordine cassa (bypassava RPC).
 * Preferire `cassaOrdiniService.js` → `createOrder(tenantId, payload)` via RPC.
 * @deprecated
 */
export {
  createOrder,
  getOrderDetail,
  updateOrder,
  replaceOrderItems,
} from "./cassaOrdiniService.js"

/** @deprecated Usare replaceOrderItems RPC via cassaOrdiniService */
export async function createOrderItems() {
  throw new Error(
    "createOrderItems diretto non supportato: usare createOrder / replaceOrderItems (RPC) da cassaOrdiniService",
  )
}
