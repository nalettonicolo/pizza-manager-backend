import { Link } from "react-router-dom"

export default function AdminMainMenu() {
  return (
    <nav style={styles.menu}>
      <Link to="/admin">Dashboard</Link>
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
