import { createContext, useContext, useEffect, useState } from "react"

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("app_theme") || "light"
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
