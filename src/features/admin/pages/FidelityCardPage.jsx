import { useCallback, useEffect, useMemo, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import {
  getTenantSettings,
  updateTenantSettings,
  getFidelitySaldi,
  enrollFidelityCliente,
  applyFidelityMovimento,
  getFidelityMovimenti,
  searchAnagraficaClienti,
  updateFidelitySaldoNomeNegozio,
} from "@/features/admin/services/adminService"
import FidelityVirtualCard from "@/components/fidelity/FidelityVirtualCard"
import {
  buildFidelityCardTheme,
  fidelityCardThemeKeysForSave,
  nextFidelityCardTheme,
  FIDELITY_CARD_VARIANTS,
  FIDELITY_CARD_PATTERNS,
} from "@/utils/fidelityCardTheme"
import {
  parseFidelityPremi,
  readConsegnaDomicilioAttiva,
  readFidelityAbilitaClientiDomicilio,
  readFidelityProgramSlice,
  readFidelityModalitaAccredito,
} from "@/utils/fidelityProgramConfig"

function anagraficaLabel(row) {
  const a = row?.anagrafica_clienti
  if (!a) return "—"
  return [a.nome, a.telefono].filter(Boolean).join(" · ") || "—"
}

function clienteNomeBreve(row) {
  const a = row?.anagrafica_clienti
  if (!a) return "Cliente"
  if (a.nome && String(a.nome).trim()) return String(a.nome).trim()
  if (a.telefono) return a.telefono
  return "Cliente"
}

export default function FidelityCardPage() {
  const { tenantId, tenantData } = useTenant()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saldi, setSaldi] = useState([])
  const [nomeProgramma, setNomeProgramma] = useState("Fidelity Card")
  const [puntiPerEuro, setPuntiPerEuro] = useState("1")
  const [accreditoEuroOn, setAccreditoEuroOn] = useState(true)
  const [accreditoPizzaOn, setAccreditoPizzaOn] = useState(false)
  const [puntiPerPizza, setPuntiPerPizza] = useState("1")
  const [timbriSchedaTotale, setTimbriSchedaTotale] = useState("0")
  const [premiRows, setPremiRows] = useState(() => [])
  const [attivo, setAttivo] = useState(true)
  const [consegnaDomicilioAttiva, setConsegnaDomicilioAttiva] = useState(true)
  const [fidelityClientiDomicilio, setFidelityClientiDomicilio] = useState(true)
  const [savingCfg, setSavingCfg] = useState(false)

  const [enrollOpen, setEnrollOpen] = useState(false)
  const [searchQ, setSearchQ] = useState("")
  const [searchHits, setSearchHits] = useState([])
  const [searching, setSearching] = useState(false)

  const [detailId, setDetailId] = useState(null)
  const [movimenti, setMovimenti] = useState([])
  const [loadingMov, setLoadingMov] = useState(false)
  const [adjustDelta, setAdjustDelta] = useState("")
  const [adjustNote, setAdjustNote] = useState("")
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [nomeNegozioDraft, setNomeNegozioDraft] = useState("")
  const [savingNomeNegozio, setSavingNomeNegozio] = useState(false)

  const [cardTheme, setCardTheme] = useState(() => buildFidelityCardTheme({}))
  const [tesseraModalRow, setTesseraModalRow] = useState(null)

  const loadSaldi = useCallback(async () => {
    if (!tenantId) return
    const data = await getFidelitySaldi(tenantId)
    setSaldi(data)
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) {
      setLoading(false)
      setError("Nessun tenant associato.")
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const settings = await getTenantSettings(tenantId)
        const po = settings?.parametri_operativi && typeof settings.parametri_operativi === "object"
          ? settings.parametri_operativi
          : {}
        if (!cancelled) {
          setNomeProgramma(String(po.fidelity_nome_programma || "Fidelity Card"))
          setPuntiPerEuro(String(po.fidelity_punti_per_euro ?? "1"))
          const fp = readFidelityProgramSlice(po)
          setPuntiPerPizza(String(fp.timbriPerPizza ?? "1"))
          const mod = readFidelityModalitaAccredito(po)
          if (mod === "pizza") {
            setAccreditoEuroOn(false)
            setAccreditoPizzaOn(true)
          } else if (mod === "nessuno") {
            setAccreditoEuroOn(false)
            setAccreditoPizzaOn(false)
          } else {
            setAccreditoEuroOn(true)
            setAccreditoPizzaOn(false)
          }
          setTimbriSchedaTotale(String(fp.timbriSchedaTotale))
          setPremiRows(
            fp.premi.length > 0
              ? fp.premi.map((p) => ({ soglia: String(p.soglia), descrizione: p.descrizione }))
              : [],
          )
          setAttivo(po.fidelity_attivo !== false && po.fidelity_attivo !== "false")
          setConsegnaDomicilioAttiva(readConsegnaDomicilioAttiva(po))
          setFidelityClientiDomicilio(readFidelityAbilitaClientiDomicilio(po))
          setCardTheme(buildFidelityCardTheme(po))
        }
        await loadSaldi()
      } catch (e) {
        console.error(e)
        if (!cancelled) {
          const msg = e?.message || ""
          if (msg.includes("fidelity_saldi") || e?.code === "42P01" || msg.includes("does not exist")) {
            setError(
              "Tabelle fidelity non trovate: esegui `sql/sql_upgrade.sql` (o la migration `20260406100000_post_remote_schema_unified.sql`) su Supabase e riprova.",
            )
          } else {
            setError("Impossibile caricare i dati fidelity.")
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, loadSaldi])

  async function saveConfig() {
    if (!tenantId) return
    try {
      setSavingCfg(true)
      const settings = await getTenantSettings(tenantId)
      const prev = settings?.parametri_operativi && typeof settings.parametri_operativi === "object"
        ? settings.parametri_operativi
        : {}
      const pe = Math.max(0, Math.min(100, Number(puntiPerEuro) || 0))
      const tpp = Math.max(0, Math.min(100, Number(puntiPerPizza) || 0))
      const tst = Math.max(0, Math.min(48, Number(timbriSchedaTotale) || 0))
      const premiParsed = parseFidelityPremi(
        premiRows.map((r) => ({ soglia: r.soglia, descrizione: r.descrizione })),
      )
      await updateTenantSettings(tenantId, {
        parametri_operativi: {
          ...prev,
          fidelity_nome_programma: nomeProgramma.trim() || "Fidelity Card",
          fidelity_punti_per_euro: pe,
          fidelity_modalita_accredito: accreditoPizzaOn
            ? "pizza"
            : accreditoEuroOn
              ? "euro"
              : "nessuno",
          fidelity_timbri_per_pizza: tpp,
          fidelity_timbri_scheda_totale: tst,
          fidelity_premi: premiParsed,
          fidelity_attivo: Boolean(attivo),
          consegna_domicilio_attiva: Boolean(consegnaDomicilioAttiva),
          fidelity_abilita_clienti_domicilio:
            Boolean(consegnaDomicilioAttiva) && Boolean(fidelityClientiDomicilio),
          ...fidelityCardThemeKeysForSave(cardTheme),
        },
      })
      alert("Impostazioni salvate.")
    } catch (e) {
      console.error(e)
      alert("Errore salvataggio. " + (e?.message || ""))
    } finally {
      setSavingCfg(false)
    }
  }

  useEffect(() => {
    if (!enrollOpen || !tenantId) return
    let cancelled = false
    const t = setTimeout(() => {
      ;(async () => {
        try {
          setSearching(true)
          const list = await searchAnagraficaClienti(tenantId, searchQ)
          const enrolled = new Set(saldi.map((s) => s.anagrafica_cliente_id))
          const free = list.filter((c) => !enrolled.has(c.id))
          if (!cancelled) setSearchHits(free)
        } catch (e) {
          console.error(e)
          if (!cancelled) setSearchHits([])
        } finally {
          if (!cancelled) setSearching(false)
        }
      })()
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [enrollOpen, searchQ, tenantId, saldi])

  async function onEnroll(clienteId) {
    if (!tenantId) return
    try {
      await enrollFidelityCliente(tenantId, clienteId)
      setEnrollOpen(false)
      setSearchQ("")
      await loadSaldi()
    } catch (e) {
      alert(e?.message || "Iscrizione non riuscita.")
    }
  }

  const detailRow = saldi.find((s) => s.id === detailId)

  async function openDetail(row) {
    setDetailId(row.id)
    setMovimenti([])
    setAdjustDelta("")
    setAdjustNote("")
    if (!tenantId) return
    try {
      setLoadingMov(true)
      const m = await getFidelityMovimenti(tenantId, row.anagrafica_cliente_id)
      setMovimenti(m)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMov(false)
    }
  }

  useEffect(() => {
    if (!detailRow) {
      setNomeNegozioDraft("")
      return
    }
    setNomeNegozioDraft(String(detailRow.nome_negozio || ""))
  }, [detailRow?.id, detailRow?.nome_negozio])

  const premiCorrenti = useMemo(
    () => parseFidelityPremi(premiRows.map((r) => ({ soglia: r.soglia, descrizione: r.descrizione }))),
    [premiRows],
  )
  const timbriTotCorrente = Math.max(0, Math.min(48, Number(timbriSchedaTotale) || 0))

  async function saveNomeNegozioCliente() {
    if (!tenantId || !detailRow) return
    try {
      setSavingNomeNegozio(true)
      await updateFidelitySaldoNomeNegozio(tenantId, detailRow.id, nomeNegozioDraft)
      await loadSaldi()
    } catch (e) {
      alert(e?.message || "Salvataggio non riuscito.")
    } finally {
      setSavingNomeNegozio(false)
    }
  }

  async function submitAdjust() {
    if (!tenantId || !detailRow) return
    const d = Number(adjustDelta)
    if (!Number.isFinite(d) || d === 0) {
      alert("Inserisci punti diversi da zero (es. 10 oppure -5).")
      return
    }
    try {
      setAdjustBusy(true)
      await applyFidelityMovimento(tenantId, detailRow.anagrafica_cliente_id, d, "manuale", adjustNote.trim() || null)
      setAdjustDelta("")
      setAdjustNote("")
      await loadSaldi()
      const m = await getFidelityMovimenti(tenantId, detailRow.anagrafica_cliente_id)
      setMovimenti(m)
    } catch (e) {
      alert(e?.message || "Operazione non riuscita.")
    } finally {
      setAdjustBusy(false)
    }
  }

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} />

  const tenantNome = tenantData?.nome || "Il tuo locale"
  const logoUrl = tenantData?.logo_url || null

  return (
    <div style={styles.wrapper}>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .fidelity-print-root, .fidelity-print-root * { visibility: visible !important; }
        .fidelity-print-root { position: absolute; left: 0; top: 0; width: 100%; display: flex; justify-content: center; padding: 32px 0; background: #fff; }
        .fidelity-print-hide { display: none !important; }
      }`}</style>
      <h1 className="dashboard-page-title" style={styles.pageTitle}>
        {nomeProgramma}
      </h1>
      <p style={styles.hint}>
        Programma punti collegato ai <strong>clienti anagrafica</strong> (creati dalla cassa). Abilita il servizio nel
        piano dal Super Admin (<code>fidelity_card</code>), poi iscrivi i clienti e gestisci i punti da qui.         Attiva <strong>o</strong> l’accredito da euro <strong>o</strong> quello da pizze (mai entrambi insieme). Poi
        imposta timbri in scheda, premi a soglia e nome al bancone. L’accredito automatico in cassa userà queste regole.
      </p>

      <section style={styles.card}>
        <h2 style={styles.h2}>Configurazione</h2>
        <label style={styles.label}>
          Nome programma (mostrato in questa pagina)
          <input
            type="text"
            value={nomeProgramma}
            onChange={(e) => setNomeProgramma(e.target.value)}
            style={styles.input}
          />
        </label>
        <div style={styles.accreditoRow}>
          <div style={{ ...styles.accreditoCol, opacity: accreditoEuroOn ? 1 : 0.72 }}>
            <label style={styles.switchRow}>
              <input
                type="checkbox"
                checked={accreditoEuroOn}
                onChange={(e) => {
                  const on = e.target.checked
                  if (on) {
                    setAccreditoEuroOn(true)
                    setAccreditoPizzaOn(false)
                  } else {
                    setAccreditoEuroOn(false)
                  }
                }}
              />
              On — accredito da euro
            </label>
            <span style={styles.accreditoColTitle}>Punti per ogni euro speso</span>
            <span style={styles.accreditoColHint}>(base per regole automatiche in cassa)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={puntiPerEuro}
              onChange={(e) => setPuntiPerEuro(e.target.value)}
              disabled={!accreditoEuroOn}
              style={{
                ...styles.input,
                marginTop: 8,
                maxWidth: "100%",
                background: accreditoEuroOn ? "#fff" : "#f1f5f9",
              }}
            />
          </div>
          <div style={{ ...styles.accreditoCol, opacity: accreditoPizzaOn ? 1 : 0.72 }}>
            <label style={styles.switchRow}>
              <input
                type="checkbox"
                checked={accreditoPizzaOn}
                onChange={(e) => {
                  const on = e.target.checked
                  if (on) {
                    setAccreditoPizzaOn(true)
                    setAccreditoEuroOn(false)
                  } else {
                    setAccreditoPizzaOn(false)
                  }
                }}
              />
              On — accredito da pizze
            </label>
            <span style={styles.accreditoColTitle}>Punti per ogni pizza ordinata</span>
            <span style={styles.accreditoColHint}>(stesso saldo punti/timbri in scheda)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={puntiPerPizza}
              onChange={(e) => setPuntiPerPizza(e.target.value)}
              disabled={!accreditoPizzaOn}
              style={{
                ...styles.input,
                marginTop: 8,
                maxWidth: "100%",
                background: accreditoPizzaOn ? "#fff" : "#f1f5f9",
              }}
            />
          </div>
        </div>
        <p style={styles.small}>
          Solo una colonna può restare «On»: attivando l’una si spegne l’altra. Puoi spegnere entrambe (nessun accredito
          automatico da euro/pizze; solo movimenti manuali). I premi sotto restano in timbri sulla scheda.
        </p>

        <h3 style={styles.h3}>Timbri e premi</h3>
        <p style={styles.small}>
          Il saldo è un unico numero (punti/timbri). Sulla tessera, la griglia mostra l’avanzamento sulla{" "}
          <strong>scheda corrente</strong> (es. 10 caselle); al completamento ricomincia da capo. Le soglie premio si
          intendono sempre in <strong>timbri sulla scheda</strong> (es. 6 e 10), indipendentemente se accumuli da euro o
          da pizze.
        </p>
        <label style={styles.label}>
          Timbri totali nella scheda sulla tessera (0 = nascondi griglia; consigliato 8–12)
          <input
            type="number"
            min={0}
            max={48}
            step={1}
            value={timbriSchedaTotale}
            onChange={(e) => setTimbriSchedaTotale(e.target.value)}
            style={styles.input}
          />
        </label>
        <div style={{ marginBottom: 16 }}>
          <span style={styles.labelText}>Premi personalizzabili (a X timbri sulla scheda corrente)</span>
          {premiRows.length === 0 ? (
            <p style={styles.muted}>Nessun premio. Aggiungi una riga oppure lascia vuoto.</p>
          ) : (
            premiRows.map((row, idx) => (
              <div key={idx} style={styles.premioRow}>
                <label style={styles.premioField}>
                  Al timbro n.
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={row.soglia}
                    onChange={(e) => {
                      const next = [...premiRows]
                      next[idx] = { ...next[idx], soglia: e.target.value }
                      setPremiRows(next)
                    }}
                    style={styles.inputSmall}
                  />
                </label>
                <label style={{ ...styles.premioField, flex: 1, minWidth: 140 }}>
                  Descrizione premio
                  <input
                    type="text"
                    value={row.descrizione}
                    onChange={(e) => {
                      const next = [...premiRows]
                      next[idx] = { ...next[idx], descrizione: e.target.value }
                      setPremiRows(next)
                    }}
                    placeholder="es. Pizza margherita omaggio"
                    style={styles.inputFlex}
                  />
                </label>
                <button
                  type="button"
                  style={styles.btnPremioRemove}
                  onClick={() => setPremiRows(premiRows.filter((_, j) => j !== idx))}
                >
                  Rimuovi
                </button>
              </div>
            ))
          )}
          <button
            type="button"
            style={styles.btnGhost}
            onClick={() => setPremiRows([...premiRows, { soglia: "", descrizione: "" }])}
          >
            + Aggiungi premio
          </button>
        </div>

        <label style={{ ...styles.label, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} />
          Programma attivo
        </label>

        <h3 style={{ ...styles.h3, marginTop: 20 }}>Consegna a domicilio e area cliente</h3>
        <p style={styles.small}>
          Controlla se il locale offre la consegna e se il programma fedeltà vale anche per chi ordina a domicilio
          (area cliente e futuri accrediti automatici sugli ordini in consegna).
        </p>
        <label style={{ ...styles.label, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <input
            type="checkbox"
            checked={consegnaDomicilioAttiva}
            onChange={(e) => {
              const on = e.target.checked
              setConsegnaDomicilioAttiva(on)
              if (!on) setFidelityClientiDomicilio(false)
            }}
          />
          Servizio consegna a domicilio attivo
        </label>
        <label
          style={{
            ...styles.label,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            opacity: consegnaDomicilioAttiva ? 1 : 0.55,
          }}
        >
          <input
            type="checkbox"
            checked={fidelityClientiDomicilio}
            onChange={(e) => setFidelityClientiDomicilio(e.target.checked)}
            disabled={!consegnaDomicilioAttiva}
          />
          Fidelity valida anche per clienti che ordinano a domicilio
        </label>
        {!consegnaDomicilioAttiva ? (
          <p style={styles.muted}>Con consegna disattivata la fidelity sul canale domicilio resta spenta.</p>
        ) : null}

        <button type="button" style={styles.btnPrimary} onClick={() => void saveConfig()} disabled={savingCfg}>
          {savingCfg ? "Salvataggio…" : "Salva configurazione"}
        </button>

        <h2 style={{ ...styles.h2, marginTop: 28 }}>Aspetto tessera virtuale</h2>
        <p style={styles.themeHint}>
          Personalizza colori, pattern e testi: l’anteprima si aggiorna subito. Salva la configurazione per applicare al
          dettaglio cliente e alla modale «Tessera».
        </p>
        <div style={styles.themeSplit}>
          <div style={styles.themeControls}>
            <label style={styles.label}>
              Stile predefinito
              <select
                value={cardTheme.variant}
                onChange={(e) =>
                  setCardTheme((t) => nextFidelityCardTheme(t, { fidelity_card_variant: e.target.value }))
                }
                style={styles.select}
              >
                {FIDELITY_CARD_VARIANTS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <div style={styles.colorRow}>
              <label style={styles.colorLab}>
                Primario
                <input
                  type="color"
                  value={cardTheme.primary}
                  onChange={(e) =>
                    setCardTheme((t) =>
                      nextFidelityCardTheme(t, { fidelity_card_colore_primario: e.target.value }),
                    )
                  }
                />
              </label>
              <label style={styles.colorLab}>
                Secondario
                <input
                  type="color"
                  value={cardTheme.secondary}
                  onChange={(e) =>
                    setCardTheme((t) =>
                      nextFidelityCardTheme(t, { fidelity_card_colore_secondario: e.target.value }),
                    )
                  }
                />
              </label>
              <label style={styles.colorLab}>
                Accento
                <input
                  type="color"
                  value={cardTheme.accent}
                  onChange={(e) =>
                    setCardTheme((t) =>
                      nextFidelityCardTheme(t, { fidelity_card_colore_accents: e.target.value }),
                    )
                  }
                />
              </label>
            </div>
            <label style={styles.label}>
              Contrasto testo
              <select
                value={cardTheme.contrast}
                onChange={(e) =>
                  setCardTheme((t) =>
                    nextFidelityCardTheme(t, { fidelity_card_testo_contrasto: e.target.value }),
                  )
                }
                style={styles.select}
              >
                <option value="chiaro">Chiaro su sfondo scuro</option>
                <option value="scuro">Scuro su sfondo chiaro</option>
              </select>
            </label>
            <label style={styles.label}>
              Texture di sfondo
              <select
                value={cardTheme.pattern}
                onChange={(e) =>
                  setCardTheme((t) => nextFidelityCardTheme(t, { fidelity_card_pattern: e.target.value }))
                }
                style={styles.select}
              >
                {FIDELITY_CARD_PATTERNS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.label}>
              Angoli arrotondati (px)
              <input
                type="number"
                min={6}
                max={32}
                value={cardTheme.radius}
                onChange={(e) =>
                  setCardTheme((t) =>
                    nextFidelityCardTheme(t, {
                      fidelity_card_angolo_bordo: Math.min(32, Math.max(6, Number(e.target.value) || 18)),
                    }),
                  )
                }
                style={styles.input}
              />
            </label>
            <label style={styles.label}>
              Sottotitolo (sotto il nome programma)
              <input
                type="text"
                value={cardTheme.subtitle}
                onChange={(e) =>
                  setCardTheme((t) => nextFidelityCardTheme(t, { fidelity_card_sottotitolo: e.target.value }))
                }
                placeholder="es. Grazie per la tua fedeltà"
                style={styles.inputWide}
              />
            </label>
            <label style={styles.label}>
              Etichetta punti
              <input
                type="text"
                value={cardTheme.labelPunti}
                onChange={(e) =>
                  setCardTheme((t) => nextFidelityCardTheme(t, { fidelity_card_label_punti: e.target.value }))
                }
                style={styles.inputWide}
              />
            </label>
            <label style={styles.label}>
              Etichetta codice
              <input
                type="text"
                value={cardTheme.labelCodice}
                onChange={(e) =>
                  setCardTheme((t) => nextFidelityCardTheme(t, { fidelity_card_label_codice: e.target.value }))
                }
                style={styles.inputWide}
              />
            </label>
            <div style={styles.checkRow}>
              <label style={styles.checkLab}>
                <input
                  type="checkbox"
                  checked={cardTheme.mostraLogo}
                  onChange={(e) =>
                    setCardTheme((t) => nextFidelityCardTheme(t, { fidelity_card_mostra_logo: e.target.checked }))
                  }
                />
                Logo locale
              </label>
              <label style={styles.checkLab}>
                <input
                  type="checkbox"
                  checked={cardTheme.mostraQr}
                  onChange={(e) =>
                    setCardTheme((t) => nextFidelityCardTheme(t, { fidelity_card_mostra_qr: e.target.checked }))
                  }
                />
                QR codice
              </label>
              <label style={styles.checkLab}>
                <input
                  type="checkbox"
                  checked={cardTheme.ombraForte}
                  onChange={(e) =>
                    setCardTheme((t) => nextFidelityCardTheme(t, { fidelity_card_ombra: e.target.checked }))
                  }
                />
                Ombra elegante
              </label>
              <label style={styles.checkLab}>
                <input
                  type="checkbox"
                  checked={cardTheme.bordoSottile}
                  onChange={(e) =>
                    setCardTheme((t) => nextFidelityCardTheme(t, { fidelity_card_bordo: e.target.checked }))
                  }
                />
                Bordo sottile
              </label>
            </div>
          </div>
          <div style={styles.previewCol}>
            <div style={styles.previewLabel}>Anteprima</div>
            <div style={styles.previewWell}>
              <FidelityVirtualCard
                theme={cardTheme}
                tenantNome={tenantNome}
                logoUrl={logoUrl}
                programmaNome={nomeProgramma}
                clienteNome="Rossi Mario"
                nomeNegozio="Mario al bancone"
                punti={7}
                codiceCarta="PM-DEMO-01"
                timbriSchedaTotale={timbriTotCorrente}
                premi={premiCorrenti}
                scale={1}
              />
            </div>
          </div>
        </div>
      </section>

      <div style={styles.toolbar}>
        <button type="button" style={styles.btnPrimary} onClick={() => setEnrollOpen(true)}>
          Iscrivi cliente
        </button>
        <span style={styles.muted}>{saldi.length} iscritti</span>
      </div>

      <div style={styles.split}>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Codice carta</th>
                <th style={styles.th}>Cliente</th>
                <th style={styles.th}>Nome in negozio</th>
                <th style={styles.th}>Punti</th>
                <th style={styles.th}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {saldi.length === 0 ? (
                <tr>
                  <td colSpan={5} style={styles.tdEmpty}>
                    Nessun iscritto. Usa «Iscrivi cliente» e scegli un’anagrafica dalla cassa.
                  </td>
                </tr>
              ) : (
                saldi.map((row) => (
                  <tr key={row.id} style={detailId === row.id ? styles.trActive : undefined}>
                    <td style={styles.td}>
                      <code>{row.codice_carta}</code>
                    </td>
                    <td style={styles.td}>{anagraficaLabel(row)}</td>
                    <td style={styles.td}>{row.nome_negozio ? <em>{row.nome_negozio}</em> : "—"}</td>
                    <td style={styles.td}>
                      <strong>{row.punti}</strong>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionBtns}>
                        <button type="button" style={styles.btnLink} onClick={() => void openDetail(row)}>
                          Dettaglio
                        </button>
                        <button type="button" style={styles.btnLink} onClick={() => setTesseraModalRow(row)}>
                          Tessera
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {detailRow && (
          <aside style={styles.aside}>
            <h3 style={styles.h3}>Dettaglio</h3>
            <div style={styles.asideCardWrap}>
              <FidelityVirtualCard
                theme={cardTheme}
                tenantNome={tenantNome}
                logoUrl={logoUrl}
                programmaNome={nomeProgramma}
                clienteNome={clienteNomeBreve(detailRow)}
                nomeNegozio={detailRow.nome_negozio}
                punti={detailRow.punti}
                codiceCarta={detailRow.codice_carta}
                timbriSchedaTotale={timbriTotCorrente}
                premi={premiCorrenti}
                scale={0.92}
              />
            </div>
            <p style={styles.small}>
              <code>{detailRow.codice_carta}</code>
              <br />
              {anagraficaLabel(detailRow)}
            </p>
            <div style={styles.nomeNegozioBox}>
              <span style={styles.labelText}>Nome in negozio (alias al bancone, collegato a questo codice)</span>
              <input
                type="text"
                value={nomeNegozioDraft}
                onChange={(e) => setNomeNegozioDraft(e.target.value)}
                placeholder="es. Mario del tavolo 3"
                style={{ ...styles.input, maxWidth: "100%", width: "100%", boxSizing: "border-box" }}
              />
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={() => void saveNomeNegozioCliente()}
                disabled={savingNomeNegozio}
              >
                {savingNomeNegozio ? "Salvataggio…" : "Salva nome in negozio"}
              </button>
            </div>
            <div style={styles.adjustBox}>
              <span style={styles.labelText}>Variazione punti (es. +10 o -3)</span>
              <input
                type="number"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                placeholder="± punti"
                style={styles.input}
              />
              <input
                type="text"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Motivo (opzionale)"
                style={styles.input}
              />
              <button
                type="button"
                style={styles.btnSecondary}
                onClick={() => void submitAdjust()}
                disabled={adjustBusy}
              >
                {adjustBusy ? "…" : "Registra movimento"}
              </button>
            </div>
            <h4 style={styles.h4}>Ultimi movimenti</h4>
            {loadingMov ? (
              <p style={styles.muted}>Caricamento…</p>
            ) : movimenti.length === 0 ? (
              <p style={styles.muted}>Nessun movimento.</p>
            ) : (
              <ul style={styles.movList}>
                {movimenti.map((m) => (
                  <li key={m.id} style={styles.movItem}>
                    <span style={m.punti >= 0 ? styles.movPos : styles.movNeg}>
                      {m.punti >= 0 ? "+" : ""}
                      {m.punti}
                    </span>
                    <span style={styles.movMeta}>
                      {m.tipo}
                      {m.note ? ` — ${m.note}` : ""}
                      <br />
                      <small>{new Date(m.created_at).toLocaleString("it-IT")}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" style={styles.btnGhost} onClick={() => setDetailId(null)}>
              Chiudi pannello
            </button>
          </aside>
        )}
      </div>

      {tesseraModalRow && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Tessera fidelity">
          <div style={{ ...styles.modal, maxWidth: 420 }}>
            <h3 className="fidelity-print-hide" style={styles.h3}>
              Tessera — {clienteNomeBreve(tesseraModalRow)}
            </h3>
            <div className="fidelity-print-root" style={styles.tesseraModalInner}>
              <FidelityVirtualCard
                theme={cardTheme}
                tenantNome={tenantNome}
                logoUrl={logoUrl}
                programmaNome={nomeProgramma}
                clienteNome={clienteNomeBreve(tesseraModalRow)}
                nomeNegozio={tesseraModalRow.nome_negozio}
                punti={tesseraModalRow.punti}
                codiceCarta={tesseraModalRow.codice_carta}
                timbriSchedaTotale={timbriTotCorrente}
                premi={premiCorrenti}
                scale={1.05}
              />
            </div>
            <div className="fidelity-print-hide" style={styles.modalActions}>
              <button type="button" style={styles.btnSecondary} onClick={() => window.print()}>
                Stampa
              </button>
              <button type="button" style={styles.btnGhost} onClick={() => setTesseraModalRow(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {enrollOpen && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true">
          <div style={styles.modal}>
            <h3 style={styles.h3}>Iscrivi cliente</h3>
            <p style={styles.small}>Cerca tra le anagrafiche cassa (già iscritti nascosti).</p>
            <input
              type="search"
              placeholder="Nome, telefono, indirizzo…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              style={styles.input}
              autoFocus
            />
            {searching ? (
              <p style={styles.muted}>Ricerca…</p>
            ) : (
              <ul style={styles.hitList}>
                {searchHits.map((c) => (
                  <li key={c.id} style={styles.hitItem}>
                    <div>
                      <strong>{c.nome || "—"}</strong>
                      {c.telefono && <span style={styles.muted}> · {c.telefono}</span>}
                      {c.indirizzo && (
                        <div style={styles.smallDim}>{c.indirizzo}</div>
                      )}
                    </div>
                    <button type="button" style={styles.btnPrimary} onClick={() => void onEnroll(c.id)}>
                      Iscrivi
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" style={styles.btnGhost} onClick={() => setEnrollOpen(false)}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrapper: { maxWidth: 1100 },
  pageTitle: { marginBottom: 8 },
  hint: { fontSize: 14, color: "#555", lineHeight: 1.5, marginBottom: 20 },
  accreditoRow: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "stretch",
    marginBottom: 12,
  },
  accreditoCol: {
    flex: "1 1 280px",
    minWidth: 260,
    maxWidth: 420,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 16,
    background: "#fafafa",
    boxSizing: "border-box",
  },
  switchRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a",
    cursor: "pointer",
  },
  accreditoColTitle: { display: "block", fontSize: 14, fontWeight: 700, color: "#334155" },
  accreditoColHint: { display: "block", fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.4 },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    background: "#fff",
  },
  h2: { margin: "0 0 16px", fontSize: 17 },
  h3: { margin: "0 0 12px", fontSize: 16 },
  h4: { margin: "16px 0 8px", fontSize: 14 },
  label: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, fontSize: 14, fontWeight: 600 },
  labelText: { fontSize: 13, fontWeight: 600, marginBottom: 6, display: "block" },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    maxWidth: 360,
  },
  btnPrimary: {
    padding: "10px 18px",
    background: "#1565c0",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  btnSecondary: {
    padding: "8px 14px",
    background: "#374151",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    marginTop: 8,
  },
  btnGhost: {
    marginTop: 12,
    padding: "8px 12px",
    background: "transparent",
    border: "1px solid #ccc",
    borderRadius: 8,
    cursor: "pointer",
  },
  btnLink: {
    background: "none",
    border: "none",
    color: "#1565c0",
    cursor: "pointer",
    textDecoration: "underline",
    fontSize: 13,
  },
  toolbar: { display: "flex", alignItems: "center", gap: 16, marginBottom: 14 },
  muted: { fontSize: 13, color: "#64748b" },
  split: { display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" },
  tableWrap: { flex: "1 1 520px", minWidth: 280, overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: { textAlign: "left", padding: "10px 8px", borderBottom: "2px solid #e2e8f0", color: "#475569" },
  td: { padding: "10px 8px", borderBottom: "1px solid #f1f5f9" },
  tdEmpty: { padding: 24, textAlign: "center", color: "#64748b" },
  trActive: { background: "#eff6ff" },
  aside: {
    flex: "0 1 320px",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: 16,
    background: "#f8fafc",
  },
  small: { fontSize: 13, color: "#334155", lineHeight: 1.45 },
  smallDim: { fontSize: 12, color: "#64748b", marginTop: 4 },
  adjustBox: { marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0" },
  movList: { listStyle: "none", padding: 0, margin: 0, maxHeight: 280, overflowY: "auto" },
  movItem: { display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #e2e8f0", fontSize: 13 },
  movPos: { color: "#15803d", fontWeight: 700, minWidth: 40 },
  movNeg: { color: "#b91c1c", fontWeight: 700, minWidth: 40 },
  movMeta: { flex: 1, color: "#475569" },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    maxWidth: 480,
    width: "100%",
    maxHeight: "85vh",
    overflow: "auto",
    boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
  },
  hitList: { listStyle: "none", padding: 0, margin: "12px 0 0" },
  hitItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #eee",
  },
  themeHint: { fontSize: 13, color: "#64748b", lineHeight: 1.5, margin: "0 0 16px" },
  themeSplit: {
    display: "flex",
    gap: 28,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  themeControls: { flex: "1 1 320px", minWidth: 260, maxWidth: 440 },
  previewCol: { flex: "0 1 360px", minWidth: 280 },
  previewLabel: { fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10, letterSpacing: "0.04em" },
  previewWell: {
    borderRadius: 14,
    padding: "20px 16px 24px",
    background: "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)",
    border: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "center",
  },
  select: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    maxWidth: "100%",
    background: "#fff",
  },
  inputWide: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    maxWidth: "100%",
    width: "100%",
    boxSizing: "border-box",
  },
  colorRow: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 },
  colorLab: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 },
  checkRow: { display: "flex", flexWrap: "wrap", gap: "12px 20px", marginTop: 8 },
  checkLab: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" },
  actionBtns: { display: "flex", flexWrap: "wrap", gap: "6px 12px" },
  asideCardWrap: { display: "flex", justifyContent: "center", marginBottom: 14 },
  tesseraModalInner: { display: "flex", justifyContent: "center", padding: "8px 0 16px" },
  modalActions: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 },
  premioRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "flex-end",
    marginBottom: 10,
  },
  premioField: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 },
  inputSmall: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    width: 88,
    boxSizing: "border-box",
  },
  inputFlex: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  },
  btnPremioRemove: {
    padding: "8px 10px",
    background: "transparent",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    color: "#64748b",
  },
  nomeNegozioBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid #e2e8f0",
  },
}
