// Servizio documenti contrattuali (area Superadmin): ToS/Privacy/Contratto/DPA e
// preventivi/contratti commerciali. Firma su tablet e invio email al cliente.
// Vedi sql/modules/76_tenant_documenti_firma.sql e 130_contratti_solo_superadmin_e_email.sql.
import { supabase } from "@/lib/supabaseClient"
import { logSupabaseError } from "@/utils/logSupabaseError"

const CONTRATTI_BUCKET = "contratti"

export const TIPI_DOCUMENTO = Object.freeze([
  { value: "termini_servizio", label: "Termini di Servizio" },
  { value: "privacy_policy", label: "Privacy Policy" },
  { value: "contratto_abbonamento", label: "Contratto di Abbonamento" },
  { value: "dpa", label: "DPA (Data Processing Agreement)" },
])

export const TIPI_DOCUMENTO_ARCHIVIO = Object.freeze([
  { value: "pagamento", label: "Pagamento / ricevuta" },
  { value: "comunicazione", label: "Comunicazione" },
])

export const SEZIONI_ARCHIVIO_DOCUMENTI = Object.freeze([
  {
    id: "contratti",
    title: "Contratti",
    tipi: ["contratto_commerciale", "contratto_abbonamento", "addendum_noleggio"],
  },
  {
    id: "preventivi",
    title: "Preventivi",
    tipi: ["preventivo_commerciale"],
  },
  {
    id: "pagamenti",
    title: "Pagamenti",
    tipi: ["pagamento"],
  },
  {
    id: "comunicazioni",
    title: "Comunicazioni",
    tipi: ["comunicazione"],
  },
  {
    id: "legali",
    title: "Documenti legali",
    tipi: ["termini_servizio", "privacy_policy", "dpa"],
  },
])

const LABEL_TIPO = Object.freeze({
  termini_servizio: "Termini di servizio",
  privacy_policy: "Informativa privacy",
  contratto_abbonamento: "Contratto di abbonamento",
  dpa: "Accordo sul trattamento dei dati (DPA)",
  addendum_noleggio: "Addendum noleggio",
  contratto_commerciale: "Contratto commerciale",
  preventivo_commerciale: "Preventivo",
  pagamento: "Pagamento",
  comunicazione: "Comunicazione",
})

export function labelTipoDocumento(tipo, snapshot) {
  const titolo = typeof snapshot?.titolo === "string" ? snapshot.titolo.trim() : ""
  if (titolo) return titolo
  return LABEL_TIPO[tipo] || tipo || "Documento"
}

export function labelStatoDocumento(doc) {
  if (!doc) return ""
  if (doc.stato === "annullato") return "Annullato"
  if (doc.stato === "firmato") return "Firmato"
  if (doc.tipo_documento === "preventivo_commerciale") return "Inviato"
  if (doc.tipo_documento === "pagamento" || doc.tipo_documento === "comunicazione") {
    return doc.inviato_email_at ? "Inviato" : "Depositato"
  }
  if (doc.tipo_documento === "contratto_commerciale" || doc.tipo_documento === "contratto_abbonamento") {
    return "Da firmare"
  }
  return "Disponibile"
}

export async function getFornitoreConfig() {
  const { data, error } = await supabase.from("fornitore_config").select("*").maybeSingle()
  if (error) {
    logSupabaseError("tenantDocumentiService.getFornitoreConfig", error)
    throw error
  }
  return data || null
}

/**
 * Salva i dati fissi del Fornitore (PizzaManager) usati per precompilare tutti i documenti
 * contrattuali — riga singleton, solo superadmin (RLS). Senza questa non esiste alcuna UI per
 * popolare fornitore_config: era vuota da quando esiste la tabella.
 */
export async function saveFornitoreConfig(payload) {
  const { data: existing } = await supabase.from("fornitore_config").select("id").maybeSingle()
  if (existing?.id) {
    const { data, error } = await supabase
      .from("fornitore_config")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single()
    if (error) {
      logSupabaseError("tenantDocumentiService.saveFornitoreConfig:update", error)
      throw error
    }
    return data
  }
  const { data, error } = await supabase.from("fornitore_config").insert(payload).select().single()
  if (error) {
    logSupabaseError("tenantDocumentiService.saveFornitoreConfig:insert", error)
    throw error
  }
  return data
}

export async function getTenantDatiFiscali(tenantId) {
  if (!tenantId) throw new Error("tenantId mancante")
  // "tenants" (schema public di default) è la vista SELECT su admin.tenants: lo schema "admin"
  // non è esposto via PostgREST, .schema("admin") fallisce sempre senza un fallback esplicito
  // (vedi isSchemaNotExposedError in superadminService.js, che lo gestisce da tempo).
  const { data, error } = await supabase
    .from("tenants")
    .select("id, nome, slug, partita_iva, email_fatturazione, pec")
    .eq("id", tenantId)
    .maybeSingle()
  if (error) {
    logSupabaseError("tenantDocumentiService.getTenantDatiFiscali", error)
    throw error
  }
  return data || null
}

export async function listTenantDocumenti(tenantId) {
  if (!tenantId) return []
  const { data, error } = await supabase
    .from("tenant_documenti")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
  if (error) {
    logSupabaseError("tenantDocumentiService.listTenantDocumenti", error)
    throw error
  }
  return data || []
}

/**
 * Crea una nuova bozza di documento (dati_snapshot = copia fornitore+tenant al momento della
 * generazione). `extra` (facoltativo) aggiunge altri dati allo snapshot — usato dal contratto
 * commerciale dinamico per congelare anche servizi/attrezzature/paragrafi generati in quel
 * momento, così lo storico resta leggibile anche se il catalogo cambia in seguito.
 */
export async function creaBozzaDocumento({ tenantId, tipoDocumento, fornitore, tenant, extra }) {
  if (!tenantId || !tipoDocumento) throw new Error("Parametri mancanti")
  const dati_snapshot = {
    fornitore: fornitore || null,
    tenant: tenant || null,
    generato_il: new Date().toISOString(),
    ...(extra || {}),
  }
  const { data, error } = await supabase
    .from("tenant_documenti")
    .insert({ tenant_id: tenantId, tipo_documento: tipoDocumento, stato: "bozza", dati_snapshot })
    .select()
    .single()
  if (error) {
    logSupabaseError("tenantDocumentiService.creaBozzaDocumento", error)
    throw error
  }
  return data
}

function dataUrlToBlob(dataUrl) {
  const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/i)
  if (!m) return null
  const mime = m[1]
  const bytes = atob(m[2])
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i)
  return { mime, blob: new Blob([arr], { type: mime }) }
}

/**
 * Carica il PDF (Blob) e l'immagine della firma (dataURL PNG dal canvas) nel bucket privato
 * "contratti", poi marca il documento come firmato. `${tenantId}/${documentoId}.pdf` /
 * `${tenantId}/${documentoId}-firma.png` seguono la convenzione già usata per le policy RLS.
 */
export async function firmaEDepositaDocumento({ documentoId, tenantId, pdfBlob, firmaDataUrl, firmatoDa }) {
  if (!documentoId || !tenantId || !pdfBlob) throw new Error("Parametri mancanti")

  const pdfPath = `${tenantId}/${documentoId}.pdf`
  const { error: pdfErr } = await supabase.storage.from(CONTRATTI_BUCKET).upload(pdfPath, pdfBlob, {
    cacheControl: "3600",
    upsert: true,
    contentType: "application/pdf",
  })
  if (pdfErr) {
    logSupabaseError("tenantDocumentiService.firmaEDepositaDocumento:pdf", pdfErr)
    throw pdfErr
  }

  let firmaPath = null
  const parsedFirma = dataUrlToBlob(firmaDataUrl)
  if (parsedFirma) {
    firmaPath = `${tenantId}/${documentoId}-firma.png`
    const { error: firmaErr } = await supabase.storage.from(CONTRATTI_BUCKET).upload(firmaPath, parsedFirma.blob, {
      cacheControl: "3600",
      upsert: true,
      contentType: parsedFirma.mime,
    })
    if (firmaErr) {
      logSupabaseError("tenantDocumentiService.firmaEDepositaDocumento:firma", firmaErr)
      throw firmaErr
    }
  }

  const { data, error } = await supabase
    .from("tenant_documenti")
    .update({
      stato: "firmato",
      pdf_url: pdfPath,
      firma_url: firmaPath,
      firmato_da: firmatoDa || null,
      firmato_at: new Date().toISOString(),
    })
    .eq("id", documentoId)
    .select()
    .single()
  if (error) {
    logSupabaseError("tenantDocumentiService.firmaEDepositaDocumento:update", error)
    throw error
  }
  return data
}

/**
 * Carica il PDF di un preventivo (tipo_documento = 'preventivo_commerciale') senza passare dalla
 * firma: un preventivo non è mai firmato, resta sempre stato='bozza' — è solo uno snapshot
 * salvabile e consultabile, tenant può richiederne quanti ne vuole prima di scegliere quale far
 * diventare contratto vero e proprio.
 */
export async function salvaPdfPreventivo({ documentoId, tenantId, pdfBlob }) {
  if (!documentoId || !tenantId || !pdfBlob) throw new Error("Parametri mancanti")
  const pdfPath = `${tenantId}/${documentoId}.pdf`
  const { error: pdfErr } = await supabase.storage.from(CONTRATTI_BUCKET).upload(pdfPath, pdfBlob, {
    cacheControl: "3600",
    upsert: true,
    contentType: "application/pdf",
  })
  if (pdfErr) {
    logSupabaseError("tenantDocumentiService.salvaPdfPreventivo:pdf", pdfErr)
    throw pdfErr
  }
  const { data, error } = await supabase
    .from("tenant_documenti")
    .update({ pdf_url: pdfPath })
    .eq("id", documentoId)
    .select()
    .single()
  if (error) {
    logSupabaseError("tenantDocumentiService.salvaPdfPreventivo:update", error)
    throw error
  }
  return data
}

/** Segna un documento (tipicamente un preventivo non più valido) come annullato. Mai un documento firmato. */
export async function annullaDocumento(documentoId) {
  if (!documentoId) throw new Error("documentoId mancante")
  const { error } = await supabase.from("tenant_documenti").update({ stato: "annullato" }).eq("id", documentoId)
  if (error) {
    logSupabaseError("tenantDocumentiService.annullaDocumento", error)
    throw error
  }
}

/**
 * Superadmin: deposita un PDF (pagamento o comunicazione) nell'archivio del locale.
 */
export async function depositaDocumentoArchivio({ tenantId, tipoDocumento, titolo, note, pdfBlob }) {
  if (!tenantId || !tipoDocumento || !pdfBlob) throw new Error("Parametri mancanti")
  const bozza = await creaBozzaDocumento({
    tenantId,
    tipoDocumento,
    extra: {
      titolo: titolo?.trim() || null,
      note: note?.trim() || null,
    },
  })
  return salvaPdfPreventivo({ documentoId: bozza.id, tenantId, pdfBlob })
}

/**
 * Accoda email al cliente con il PDF in allegato (coda notifiche_outbox).
 * `variante`: preventivo | contratto_da_firmare | contratto_firmato | documento
 */
export async function enqueueDocumentoEmail({ documentoId, variante, destinatario }) {
  if (!documentoId || !variante) throw new Error("Parametri mancanti")
  const { data, error } = await supabase.rpc("sa_enqueue_documento_email", {
    p_documento_id: documentoId,
    p_variante: variante,
    p_destinatario: destinatario?.trim() || null,
  })
  if (error) {
    logSupabaseError("tenantDocumentiService.enqueueDocumentoEmail", error)
    throw error
  }
  return data
}

export async function getDocumentoSignedUrl(storagePath, expiresSec = 3600) {
  if (!storagePath) return ""
  const { data, error } = await supabase.storage.from(CONTRATTI_BUCKET).createSignedUrl(storagePath, expiresSec)
  if (error) {
    logSupabaseError("tenantDocumentiService.getDocumentoSignedUrl", error)
    throw error
  }
  return data?.signedUrl || ""
}
