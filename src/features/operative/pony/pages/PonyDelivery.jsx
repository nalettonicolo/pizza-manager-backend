import { useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"

export default function PonyDelivery() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const token = new URLSearchParams(location.search).get("token")

    if (!token) {
      navigate("/")
    }
  }, [location, navigate])

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Gestione Consegna</h1>
      <p>Caricamento ordine...</p>
    </div>
  )
}
