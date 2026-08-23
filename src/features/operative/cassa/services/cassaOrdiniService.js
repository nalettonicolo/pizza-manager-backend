/**
 * Facade ordini cassa / operativo.
 * Implementazione attuale in adminService (Nest fallback + Supabase); Cassa importa da qui.
 */
export {
  getOrders,
  createOrder,
  getOrderDetail,
  updateOrder,
  updateOrderStato,
  updateOrderTipoPagamento,
  updateOrderCucinaPrepStato,
  replaceOrderItems,
  enrichOrdineDetailIngredientiSummaries,
  getRigheAggregateByOrdineIds,
  getRigheByOrdineIds,
  chiudiGiornata,
  logCassaAuditEvent,
  staffAccettaOrdineWeb,
  staffRifiutaOrdineWeb,
  upsertCarrelloSospeso,
  getCarrelloSospesoCliente,
  deleteCarrelloSospeso,
} from "@/features/admin/services/adminService"
