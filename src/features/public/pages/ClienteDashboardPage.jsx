import { Link } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"
import { getPublicTenantInfo } from "@/features/services/publicService"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  readConsegnaDomicilioAttiva,
  readFidelityAbilitaClientiDomicilio,
} from "@/utils/fidelityProgramConfig"
import { readOrdiniOnlineVetrinaAllowed } from "@/utils/ordiniOnlineAttivi"

export default function ClienteDashboardPage() {
  const { user, logout } = useAuth()
  const [nomePizzeria, setNomePizzeria] = useState("")
  const [mostraFidelityDomicilio, setMostraFidelityDomicilio] = useState(false)
  const [vetrinaTenant, setVetrinaTenant] = useState(null)

  useEffect(() => {
    getPublicTenantInfo().then((t) => {
      setNomePizzeria((t?.nome || "").trim())
      setVetrinaTenant(t && typeof t === "object" ? t : null)
    })
  }, [])

  useEffect(() => {
    if (!user?.id) return
    let c = false
    supabase
      .from("tenants")
      .select("parametri_operativi")
      .maybeSingle()
      .then(({ data, error }) => {
        if (c || error) return
        const po = data?.parametri_operativi && typeof data.parametri_operativi === "object"
          ? data.parametri_operativi
          : {}
        const programmaOn = po.fidelity_attivo !== false && po.fidelity_attivo !== "false"
        const consegna = readConsegnaDomicilioAttiva(po)
        const fidDom = readFidelityAbilitaClientiDomicilio(po)
        setMostraFidelityDomicilio(Boolean(programmaOn && consegna && fidDom))
      })
    return () => {
      c = true
    }
  }, [user?.id])

  const parametriVetrina =
    vetrinaTenant?.parametri_operativi && typeof vetrinaTenant.parametri_operativi === "object"
      ? vetrinaTenant.parametri_operativi
      : {}
  const mostraLinkOrdineVetrina = readOrdiniOnlineVetrinaAllowed(parametriVetrina, vetrinaTenant)

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 16px 48px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Il tuo account</h1>
      <p style={{ color: "#64748b", marginBottom: 24, fontSize: 14 }}>
        {nomePizzeria ? <>Collegato a <strong>{nomePizzeria}</strong>.</> : "Area riservata clienti."}
      </p>
      <p style={{ fontSize: 14, marginBottom: 20 }}>
        Accesso come <strong>{user?.email}</strong>
      </p>
      {mostraFidelityDomicilio ? (
        <div
          style={{
            marginBottom: 20,
            padding: 14,
            borderRadius: 10,
            background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
            border: "1px solid #ddd6fe",
            fontSize: 14,
            lineHeight: 1.5,
            color: "#4c1d95",
          }}
        >
          <strong>Programma fedeltà</strong>
          <p style={{ margin: "8px 0 0", color: "#5b21b6" }}>
            Questo locale applica la fidelity anche agli ordini a domicilio. I punti restano gestiti dalla pizzeria
            (iscrizione e tessera); qui troverai presto il riepilogo sul tuo profilo.
          </p>
        </div>
      ) : null}

      <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Link
          to="/"
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "#0f172a",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Vai al menù
        </Link>
        {mostraLinkOrdineVetrina ? (
          <Link
            to="/ordina"
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              background: "#0f766e",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            Carrello / Ordine consegna
          </Link>
        ) : null}
        <Link
          to="/cliente/ordini"
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            color: "#0f172a",
            textDecoration: "none",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          I miei ordini
        </Link>
        <Link
          to="/cliente/profilo"
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            color: "#0f172a",
            textDecoration: "none",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Profilo
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Esci
        </button>
      </nav>
    </div>
  )
}
