import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/app/contexts/ThemeContext"

/**
 * Switch tema chiaro/scuro per il sito pubblico. Di default segue l'ora del giorno (chiaro 7-20,
 * scuro di notte — vedi ThemeContext e lo script anti-flash in index.html); questo pulsante
 * permette di scegliere manualmente, salvando la preferenza per le visite successive.
 */
export default function ThemeToggle({ className = "" }) {
  const themeCtx = useTheme()
  if (!themeCtx) return null
  const { theme, toggleTheme } = themeCtx
  const isDark = theme === "dark"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn${className ? ` ${className}` : ""}`}
      title={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
      aria-label={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
      aria-pressed={isDark}
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  )
}
