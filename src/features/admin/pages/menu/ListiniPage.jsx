import { useCallback, useEffect, useMemo, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import { getCategories, getProducts, updateTenantSettings, updateProduct } from "@/features/admin/services/adminService"
import { sortByOrdine } from "@/utils/sortByOrdine"
import { openListinoPdfPrint } from "@/utils/listinoPdfExport"
import Loader from "@/components/feedback/Loader"

export default function ListiniPage() {
  const { tenantId, tenantData, refreshTenant } = useTenant()
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [saving, setSaving] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(null)

  const po =
    tenantData?.parametri_operativi && typeof tenantData.parametri_operativi === "object"
      ? tenantData.parametri_operativi
      : {}
  const multiOk = po.abilita_gestione_listini_multipli === true
  const backup = Array.isArray(po.listini_backup_json) ? po.listini_backup_json : []

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [cats, prods] = await Promise.all([getCategories(tenantId), getProducts(tenantId)])
      setCategories(sortByOrdine(cats || []))
      setProducts(sortByOrdine(prods || []))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const righePdf = useMemo(() => {
    const catMap = new Map((categories || []).map((c) => [String(c.id), c.nome || ""]))
    return (products || []).map((p) => ({
      categoria: catMap.get(String(p.categoria_id)) || "—",
      nome: p.nome || "",
      prezzo: `€ ${Number(p.prezzo || 0).toFixed(2)}`,
    }))
  }, [categories, products])

  const exportPdf = () => {
    openListinoPdfPrint({
      localeNome: tenantData?.nome || "Listino",
      righe: righePdf,
    })
  }

  function dryRunRipristino(b) {
    const snap = b?.snapshot
    const rows = Array.isArray(snap?.prodotti) ? snap.prodotti : []
    const byId = new Map((products || []).map((p) => [String(p.id), p]))
    let cambi = 0
    for (const r of rows) {
      const cur = byId.get(String(r.id))
      if (!cur) continue
      const a = Number(r.prezzo) || 0
      const b0 = Number(cur.prezzo) || 0
      if (Math.abs(a - b0) > 0.009) cambi += 1
    }
    return { cambi, totali: rows.length }
  }

  const ripristinaPrezziDaBackup = async (b) => {
    const snap = b?.snapshot
    const rows = Array.isArray(snap?.prodotti) ? snap.prodotti : []
    if (!rows.length) {
      window.alert("Snapshot senza prodotti.")
      return
    }
    const { cambi } = dryRunRipristino(b)
    if (
      !window.confirm(
        `Ripristinare i prezzi dal backup "${b.label || b.id}"?\n` +
          `Righe nel backup: ${rows.length}. Prezzi diversi da aggiornare: ${cambi}.\n` +
          `Solo i prodotti ancora esistenti con lo stesso id verranno aggiornati.`,
      )
    ) {
      return
    }
    const ids = new Set((products || []).map((p) => String(p.id)))
    setRestoreBusy(b.id)
    try {
      let n = 0
      for (const r of rows) {
        if (!ids.has(String(r.id))) continue
        await updateProduct(r.id, { prezzo: Number(r.prezzo) || 0 })
        n += 1
      }
      await load()
      window.alert(`Aggiornati ${n} prodotti (prezzi dal backup).`)
    } catch (e) {
      console.error(e)
      window.alert(e?.message || "Ripristino non riuscito.")
    } finally {
      setRestoreBusy(null)
    }
  }

  const salvaBackupJson = async () => {
    if (!tenantId) return
    const snapshot = {
      creato_il: new Date().toISOString(),
      locale: tenantData?.nome || "",
      categorie: categories.map((c) => ({ id: c.id, nome: c.nome, ordine: c.ordine })),
      prodotti: products.map((p) => ({
        id: p.id,
        nome: p.nome,
        categoria_id: p.categoria_id,
        prezzo: p.prezzo,
        ordine: p.ordine,
      })),
    }
    const nextBackup = [
      {
        id: `bk_${Date.now()}`,
        label: `Backup ${new Date().toLocaleString("it-IT")}`,
        snapshot,
      },
      ...backup,
    ].slice(0, 25)
    try {
      setSaving(true)
      const nextPo = {
        ...po,
        listini_backup_json: nextBackup,
      }
      await updateTenantSettings(tenantId, { parametri_operativi: nextPo })
      await refreshTenant()
      window.alert("Snapshot salvato nei parametri (listini_backup_json).")
    } catch (e) {
      console.error(e)
      window.alert(e?.message || "Errore salvataggio")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loader />

  return (
    <div className="dashboard-settings-page">
      <h1 className="dashboard-page-title">Listini e backup</h1>
      <p style={{ fontSize: 14, color: "#64748b", maxWidth: 720, lineHeight: 1.55 }}>
        Il <strong>listino attivo</strong> è sempre quello dei prodotti nel database (un solo listino operativo alla volta). Qui puoi
        esportare una copia in PDF e, se abilitato, archiviare snapshot JSON.
      </p>

      <section className="dashboard-box dashboard-settings-section" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Esporta PDF</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
          Genera una tabella stampabile: dal dialogo di stampa del browser scegli &quot;Salva come PDF&quot;.
        </p>
        <button type="button" className="btn-primary-dashboard" onClick={exportPdf}>
          Scarica / stampa listino (PDF)
        </button>
      </section>

      <section className="dashboard-box dashboard-settings-section" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Gestione archivio multi-listino</h2>
        {!multiOk ? (
          <p style={{ fontSize: 14, color: "#92400e", background: "#fffbeb", padding: 12, borderRadius: 8, border: "1px solid #fde68a" }}>
            Attiva l&apos;opzione <strong>«Consenti gestione listini multipli (archivio)»</strong> in{" "}
            <strong>Impostazioni → Parametri</strong> per salvare snapshot JSON di backup oltre al PDF.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
              Snapshot leggeri (categorie + prodotti + prezzi) salvati in <code>parametri_operativi.listini_backup_json</code>.
              Ripristino massivo da snapshot non è automatico: usare come riferimento o reimport manuale.
            </p>
            <button type="button" className="btn-primary-dashboard" onClick={() => void salvaBackupJson()} disabled={saving}>
              {saving ? "Salvataggio…" : "Salva snapshot listino attuale (JSON)"}
            </button>
            {backup.length > 0 ? (
              <ul style={{ marginTop: 16, fontSize: 13, listStyle: "none", paddingLeft: 0 }}>
                {backup.map((b) => {
                  const dr = dryRunRipristino(b)
                  return (
                    <li
                      key={b.id || b.label}
                      style={{
                        marginBottom: 12,
                        padding: 12,
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        background: "#fff",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{b.label || b.id}</div>
                      <span style={{ color: "#64748b" }}>
                        {b.snapshot?.prodotti?.length ?? "?"} prodotti nel backup · prezzi da cambiare (dry-run):{" "}
                        <strong>{dr.cambi}</strong>
                      </span>
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn-primary-dashboard"
                          style={{ fontSize: 13, padding: "6px 12px" }}
                          disabled={restoreBusy === b.id || dr.cambi === 0}
                          onClick={() => void ripristinaPrezziDaBackup(b)}
                        >
                          {restoreBusy === b.id ? "Ripristino…" : "Ripristina prezzi da questo backup"}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p style={{ marginTop: 12, fontSize: 13, color: "#94a3b8" }}>Nessuno snapshot ancora.</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
