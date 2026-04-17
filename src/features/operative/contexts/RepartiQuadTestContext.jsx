import { createContext, useContext } from "react"

/** True quando il reparto è mostrato nel test a 4 riquadri (senza titoli interni né testi esplicativi). */
const RepartiQuadTestContext = createContext(false)

export function RepartiQuadTestProvider({ children }) {
  return <RepartiQuadTestContext.Provider value={true}>{children}</RepartiQuadTestContext.Provider>
}

export function useRepartiQuadTest() {
  return useContext(RepartiQuadTestContext)
}
