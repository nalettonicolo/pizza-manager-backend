import { Link } from "react-router-dom"

export default function OrdineConfermato() {
  return (
    <div style={{ padding: "40px" }}>
      <h1>✅ Ordine Confermato</h1>
      <p>L'ordine è stato registrato correttamente.</p>

      <Link to="/">
        <button
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Torna alla Home
        </button>
      </Link>
    </div>
  )
}
