import { useEffect, useState } from "react"
import { useTenant } from "@/app/contexts/TenantContext"
import Loader from "@/components/feedback/Loader"
import ErrorState from "@/components/feedback/ErrorState"
import {
  getTenantUsers,
  updateUserRole,
  toggleUserActive,
} from "@/features/admin/services/adminService"

const ROLES = [
  "admin",
  "cassa",
  "bancone",
  "cucina",
  "pizzaiolo",
  "delivery",
]

export default function UserManager() {
  const { tenantId } = useTenant()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function loadUsers() {
    try {
      setLoading(true)
      const data = await getTenantUsers(tenantId)
      setUsers(data)
    } catch (err) {
      console.error(err)
      setError("Errore nel caricamento utenti.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantId) loadUsers()
  }, [tenantId])

  async function handleRoleChange(userId, ruolo) {
    await updateUserRole(userId, ruolo)
    loadUsers()
  }

  async function handleToggle(userId, current) {
    await toggleUserActive(userId, !current)
    loadUsers()
  }

  if (loading) return <Loader />
  if (error) return <ErrorState message={error} />

  return (
    <div style={styles.wrapper}>
      <h1>Gestione Utenti</h1>

      {users.length === 0 ? (
        <p>Nessun utente presente.</p>
      ) : (
        users.map((user) => (
          <div key={user.id} style={styles.userRow}>
            <div>
              <strong>{user.nome}</strong>
              <div style={styles.email}>{user.email}</div>
            </div>

            <select
              value={user.ruolo}
              onChange={(e) =>
                handleRoleChange(user.id, e.target.value)
              }
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <button
              onClick={() =>
                handleToggle(user.id, user.attivo)
              }
              style={{
                background: user.attivo ? "#4caf50" : "#f44336",
                color: "white",
                border: "none",
                padding: "6px 10px",
                borderRadius: "4px",
              }}
            >
              {user.attivo ? "Attivo" : "Disattivato"}
            </button>
          </div>
        ))
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    padding: "30px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  userRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px",
    border: "1px solid #eee",
    borderRadius: "8px",
  },
  email: {
    fontSize: "12px",
    opacity: 0.6,
  },
}
