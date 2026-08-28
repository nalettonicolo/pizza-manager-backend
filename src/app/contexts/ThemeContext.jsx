import { createContext, useContext, useEffect, useState } from "react"

const ThemeContext = createContext()

/** Nessuna preferenza salvata: chiaro di giorno (7-20), scuro di notte — stessa regola dello
 * script anti-flash in index.html, per restare coerenti al primo render. */
function themeFromTimeOfDay() {
  const h = new Date().getHours()
  return h >= 7 && h < 20 ? "light" : "dark"
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("app_theme")
    return saved === "light" || saved === "dark" ? saved : themeFromTimeOfDay()
  })

  // =====================================
  // APPLY THEME
  // =====================================

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("app_theme", theme)
  }, [theme])

  // =====================================
  // CHANGE THEME
  // =====================================

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"))
  }

  const setCustomTheme = (value) => {
    setTheme(value)
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme: setCustomTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
