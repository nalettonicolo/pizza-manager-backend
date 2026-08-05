import { useCallback, useEffect, useMemo, useState } from "react"
import {
  updateOrder,
  replaceOrderItems,
  getOrderDetail,
  enrichOrdineDetailIngredientiSummaries,
} from "@/features/operative/cassa/services/cassaOrdiniService"
import { getProducts, getProdottiByIds, enrichProductsWithPrezzoCalcolato } from "@/features/admin/services/adminService"
import { applyPromoCalendarioToProducts } from "@/utils/promozioniCalendario"
import { newLocalId } from "@/features/admin/hooks/useTenantLocalJson"
import {
  ordineNomeCliente,
  ordineTelefonoRitiro,
  ordineIndirizzoConsegna,
  ordineOrarioRitiro,
  ordineIsDelivery,
} from "@/features/operative/cassa/utils/ordineFieldHelpers"
import { splitNomeDaIndirizzoConsegna } from "@/features/operative/cassa/utils/cassaDeliveryNomeIndirizzo"

const EMPTY_FORM = {
  nome_cliente: "",
  telefono_ritiro: "",
  orario_ritiro: "",
  note: "",
  tipo_pagamento: "Da pagare",
  indirizzo_consegna: "",
}

/**
 * Stato e azioni del modale «Modifica ordine» in Cassa.
 */
export function useCassaModificaOrdine({
  tenantId,
  tenantData,
  ordineDetail,
  setOrdineDetail,
  loadOrdini,
}) {
  const [modificaOrdineModal, setModificaOrdineModal] = useState(null)
  const [modificaForm, setModificaForm] = useState(EMPTY_FORM)
  const [modificaOrdineSaving, setModificaOrdineSaving] = useState(false)
  const [modificaRighe, setModificaRighe] = useState([])
  const [modificaProdottiList, setModificaProdottiList] = useState([])

  const closeModificaOrdine = useCallback(() => {
    setModificaOrdineModal(null)
  }, [])

  const openModificaOrdine = useCallback((detail) => {
    if (!detail?.id) return
    setModificaOrdineModal(detail)
    const nomeSaved = ordineNomeCliente(detail)
    const indirizzoSaved = ordineIndirizzoConsegna(detail)
    const splitLegacy =
      !nomeSaved && indirizzoSaved ? splitNomeDaIndirizzoConsegna(indirizzoSaved) : null
    setModificaForm({
      nome_cliente: nomeSaved || splitLegacy?.nomePart || "",
      telefono_ritiro: ordineTelefonoRitiro(detail),
      orario_ritiro: ordineOrarioRitiro(detail),
      note: detail.note ?? "",
      tipo_pagamento: detail.tipo_pagamento ?? "Da pagare",
      indirizzo_consegna: splitLegacy?.addrPart || indirizzoSaved || "",
    })
    setModificaRighe(
      (detail.righe || []).map((r, i) => {
        const pid = r.prodottoId ?? r.prodotto_id
        return {
          key: r.id ? String(r.id) : `tmp-${i}-${newLocalId()}`,
          prodotto_id: pid,
          nome: detail.productNames?.[pid] ?? "—",
          quantita: Math.max(1, Number(r.quantita) || 1),
          prezzo: Number(r.prezzo) || 0,
          formato_nome: r.formatoNome ?? r.formato_nome ?? "",
          ingredienti_cottura_summary:
            r.ingredientiCotturaSummary ?? r.ingredienti_cottura_summary ?? "",
        }
      }),
    )
  }, [])

  useEffect(() => {
    if (!tenantId || !modificaOrdineModal?.id) {
      setModificaProdottiList([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const raw = await getProducts(tenantId)
        const withPrezzo = await enrichProductsWithPrezzoCalcolato(tenantId, raw)
        const po = tenantData?.parametri_operativi
        const list = applyPromoCalendarioToProducts(withPrezzo, po, new Date())
        const active = (list || []).filter((p) => p.attivo !== false)
        if (!cancelled) setModificaProdottiList(active)
      } catch (e) {
        console.warn("Modifica ordine: catalogo prodotti", e)
        if (!cancelled) setModificaProdottiList([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, modificaOrdineModal?.id, tenantData?.parametri_operativi])

  const handleSalvaModificaOrdine = useCallback(async () => {
    if (!modificaOrdineModal?.id) return
    if (!modificaRighe.length) {
      alert("Aggiungi almeno una riga all'ordine.")
      return
    }
    const totaleRighe = modificaRighe.reduce(
      (s, r) => s + Number(r.prezzo || 0) * Math.max(1, Number(r.quantita) || 1),
      0,
    )
    const ordineId = modificaOrdineModal.id
    setModificaOrdineSaving(true)
    try {
      await updateOrder(ordineId, {
        nome_cliente: modificaForm.nome_cliente || null,
        telefono_ritiro: ordineIsDelivery(modificaOrdineModal)
          ? undefined
          : modificaForm.telefono_ritiro?.trim() || null,
        orario_ritiro: modificaForm.orario_ritiro || null,
        note: modificaForm.note || null,
        tipo_pagamento: modificaForm.tipo_pagamento || null,
        indirizzo_consegna: modificaForm.indirizzo_consegna || null,
      })
      await replaceOrderItems(
        ordineId,
        totaleRighe,
        modificaRighe.map((r) => ({
          prodotto_id: r.prodotto_id,
          quantita: r.quantita,
          prezzo: r.prezzo,
          formato_nome: r.formato_nome || null,
          ingredienti_cottura_summary: r.ingredienti_cottura_summary || null,
        })),
      )
      setModificaOrdineModal(null)
      if (ordineDetail?.id === ordineId && setOrdineDetail) {
        const detail = await getOrderDetail(ordineId)
        const ids = (detail.righe || []).map((r) => r.prodottoId ?? r.prodotto_id).filter(Boolean)
        const prodotti = ids.length ? await getProdottiByIds(tenantId, ids) : []
        const productNames = (prodotti || []).reduce(
          (acc, p) => ({ ...acc, [p.id]: p.nome || "—" }),
          {},
        )
        const enriched = await enrichOrdineDetailIngredientiSummaries(tenantId, {
          ...detail,
          productNames,
        })
        setOrdineDetail(enriched)
      }
      loadOrdini?.()
    } catch (e) {
      console.error(e)
      alert("Errore durante la modifica ordine. " + (e?.message || ""))
    } finally {
      setModificaOrdineSaving(false)
    }
  }, [
    modificaOrdineModal,
    modificaForm,
    modificaRighe,
    ordineDetail?.id,
    loadOrdini,
    tenantId,
    setOrdineDetail,
  ])

  const modificaTotaleAnteprima = useMemo(
    () =>
      modificaRighe.reduce(
        (s, r) => s + Number(r.prezzo || 0) * Math.max(1, Number(r.quantita) || 1),
        0,
      ),
    [modificaRighe],
  )

  return {
    modificaOrdineModal,
    modificaForm,
    setModificaForm,
    modificaOrdineSaving,
    modificaRighe,
    setModificaRighe,
    modificaProdottiList,
    modificaTotaleAnteprima,
    openModificaOrdine,
    closeModificaOrdine,
    handleSalvaModificaOrdine,
  }
}
