import { describe, it, expect } from "vitest"
import {
  computeRegistroMonitor,
  dayKeyFromIso,
  filterRegistroRighe,
  formatRegistroDayLabel,
  groupRegistroByDay,
} from "@/features/superadmin/utils/registroAttivita"

const NOW = new Date("2026-08-28T19:00:00.000Z").getTime()

const righe = [
  {
    id: "1",
    richiesta: "Aggiornare il registro",
    azioni: "Pagina in diretta e note superadmin",
    area: "audit",
    fonte: "cursor",
    stato: "completato",
    creato_il: "2026-08-28T18:30:00.000Z",
    branch: "cursor/registro-attivita-monitor-d176",
  },
  {
    id: "2",
    richiesta: "Deploy hosting",
    azioni: "Manca il token Firebase",
    area: "infrastruttura",
    fonte: "cursor",
    stato: "bloccato",
    creato_il: "2026-08-27T10:00:00.000Z",
  },
  {
    id: "3",
    richiesta: "Stress test",
    azioni: "Ancora da personalizzare",
    area: "ui",
    fonte: "claude",
    stato: "parziale",
    creato_il: "2026-08-20T10:00:00.000Z",
  },
]

describe("registroAttivita", () => {
  it("filtra per testo, area, fonte, stato e periodo", () => {
    expect(filterRegistroRighe(righe, { query: "firebase" }, NOW)).toHaveLength(1)
    expect(filterRegistroRighe(righe, { area: "audit" }, NOW)).toHaveLength(1)
    expect(filterRegistroRighe(righe, { fonte: "claude" }, NOW)).toHaveLength(1)
    expect(filterRegistroRighe(righe, { stato: "bloccato" }, NOW)).toHaveLength(1)
    expect(filterRegistroRighe(righe, { period: "24h" }, NOW)).toHaveLength(1)
    expect(filterRegistroRighe(righe, { period: "7d" }, NOW)).toHaveLength(2)
  })

  it("raggruppa per giorno e etichetta oggi", () => {
    const groups = groupRegistroByDay(righe)
    expect(groups[0].day).toBe("2026-08-28")
    expect(groups[0].items).toHaveLength(1)
    expect(formatRegistroDayLabel("2026-08-28", new Date(NOW))).toBe("Oggi")
    expect(formatRegistroDayLabel("2026-08-27", new Date(NOW))).toBe("Ieri")
  })

  it("calcola KPI di monitoraggio e silenzio", () => {
    const m = computeRegistroMonitor(righe, NOW)
    expect(m.ultime24h).toBe(1)
    expect(m.bloccati).toBe(1)
    expect(m.parziali).toBe(1)
    expect(m.silenzioLungo).toBe(false)
    expect(dayKeyFromIso("2026-08-28T18:30:00.000Z")).toBe("2026-08-28")
  })

  it("segnala silenzio se lo storico è vuoto", () => {
    expect(computeRegistroMonitor([], NOW).silenzioLungo).toBe(true)
  })
})
