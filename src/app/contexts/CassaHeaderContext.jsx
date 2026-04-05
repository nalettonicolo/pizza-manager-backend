import { createContext, useContext } from "react"

const CassaHeaderContext = createContext({
  setContent: () => {},
  setSidebar: () => {},
})

export function useCassaHeader() {
  return useContext(CassaHeaderContext)
}

export { CassaHeaderContext }
