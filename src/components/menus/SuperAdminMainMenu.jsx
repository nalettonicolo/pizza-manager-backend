import { Link } from "react-router-dom"

export default function SuperAdminMainMenu() {
  return (
    <nav style={styles.menu}>
      <Link to="/superadmin">Dashboard</Link>
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
