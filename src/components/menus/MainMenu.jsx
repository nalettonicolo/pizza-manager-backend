import { Link } from "react-router-dom"
import { useAuth } from "@/app/contexts/AuthContext"

export default function MainMenu() {
  const { role } = useAuth()

  return (
    <nav style={styles.menu}>
      {role === "cassa" && <Link to="/operative/cassa">Cassa</Link>}
      {role === "bancone" && <Link to="/operative/bancone">Bancone</Link>}
      {role === "cucina" && <Link to="/operative/cucina">Cucina</Link>}
      {role === "pizzaiolo" && <Link to="/operative/pizzaioli">Pizzaiolo</Link>}
      {role === "delivery" && <Link to="/operative/delivery">Delivery</Link>}
    </nav>
  )
}

const styles = {
  menu: {
    display: "flex",
    gap: "20px",
    padding: "20px",
  },
}
