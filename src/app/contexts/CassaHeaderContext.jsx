import { createContext, useContext } from "react"

const CassaHeaderContext = createContext(null)

export function useCassaHeader() {
  return useContext(CassaHeaderContext)
}

export { CassaHeaderContext }
