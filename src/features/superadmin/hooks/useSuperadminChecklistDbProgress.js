import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { loadAndMigrateChecklistProgress } from "@/features/superadmin/utils/checklistMeseProgress"

const TABLE = "superadmin_checklist_mese_progress"

function rowsToProgress(rows) {
  const out = {}
  for (const r of rows || []) {
    out[r.codice] = { done: r.done === true, note: r.note || "", updatedAt: r.updated_at }
  }
  return out
}

/**
 * Stato "fatto/nota" della checklist Chek-Sviluppi — su Supabase (tabella
 * superadmin_checklist_mese_progress, mod. 55) invece che in localStorage: condiviso tra
 * ambienti (localhost e produzione vedono lo stesso stato), non più isolato per origine.
 *
 * Stessa forma di useSuperadminLocalJson ({ data, setData, ready }) così il componente
 * pagina cambia solo l'import, non la logica di lettura/scrittura.
 */
export function useSuperadminChecklistDbProgress() {
  const [data, setDataState] = useState({})
  const [ready, setReady] = useState(false)
  const [migratedCount, setMigratedCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: rows, error } = await supabase.from(TABLE).select("codice, done, note, updated_at")
      if (cancelled) return
      if (error) {
        console.error("[useSuperadminChecklistDbProgress] load:", error)
        setReady(true)
        return
      }
      let progress = rowsToProgress(rows)

      // Migrazione una tantum: se il DB è ancora vuoto ma questo browser ha progressi salvati
      // dalla vecchia versione (localStorage, per-origine), li carica su Supabase la prima
      // volta — così diventano visibili anche dagli altri ambienti invece di andare persi.
      if (Object.keys(progress).length === 0) {
        try {
          const legacy = loadAndMigrateChecklistProgress()
          const entries = Object.entries(legacy || {}).filter(([, v]) => v && (v.done || (v.note || "").trim()))
          if (entries.length) {
            const upserts = entries.map(([codice, v]) => ({
              codice,
              done: Boolean(v.done),
              note: String(v.note || ""),
              updated_at: v.updatedAt || new Date().toISOString(),
            }))
            const { error: upErr } = await supabase.from(TABLE).upsert(upserts, { onConflict: "codice" })
            if (!upErr) {
              progress = rowsToProgress(upserts)
              setMigratedCount(entries.length)
            } else {
              console.warn("[useSuperadminChecklistDbProgress] migrazione legacy:", upErr)
            }
          }
        } catch (e) {
          console.warn("[useSuperadminChecklistDbProgress] migrazione legacy:", e)
        }
      }

      if (!cancelled) {
        setDataState(progress)
        setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setData = useCallback((updater) => {
    setDataState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      const changed = []
      for (const codice of Object.keys(next || {})) {
        const a = prev?.[codice]
        const b = next[codice]
        if (!b) continue
        if (!a || a.done !== b.done || (a.note || "") !== (b.note || "")) {
          changed.push({
            codice,
            done: Boolean(b.done),
            note: b.note || "",
            updated_at: b.updatedAt || new Date().toISOString(),
          })
        }
      }
      if (changed.length) {
        void supabase
          .from(TABLE)
          .upsert(changed, { onConflict: "codice" })
          .then(({ error }) => {
            if (error) console.error("[useSuperadminChecklistDbProgress] upsert:", error)
          })
      }
      return next
    })
  }, [])

  return { data, setData, ready, migratedCount }
}
