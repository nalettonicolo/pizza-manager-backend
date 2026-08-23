import { useEffect, useState } from "react"

/**
 * Orologio HH:mm che si aggiorna da solo. Per ora è solo informativo (nessuna azione al tocco) —
 * il comportamento cliccabile per uscire arriverà in un secondo momento, su indicazione esplicita.
 * @param {{ className?: string, style?: object }} props
 */
export default function LiveClock({ className, style }) {
  const [label, setLabel] = useState(() =>
    new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
  )
  useEffect(() => {
    const id = window.setInterval(() => {
      setLabel(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }))
    }, 15000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <span className={className ?? "pizzaiolo-clock"} style={style} aria-label="Orario attuale">
      {label}
    </span>
  )
}
