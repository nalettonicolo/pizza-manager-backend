import { useNavigate } from "react-router-dom";

export default function HeroStore({ branding }) {
  const navigate = useNavigate();
  const safe = branding ?? {};

  return (
    <section
      style={{
        background: "var(--color-primary)",
        color: "white",
        padding: "80px 20px",
        textAlign: "center",
      }}
    >
      {safe.logo_url && (
        <img
          src={safe.logo_url}
          alt="Logo"
          style={{ width: 120, marginBottom: 20 }}
        />
      )}

      <h1 style={{ fontSize: 40 }}>{safe.nome ?? "Pizzeria"}</h1>

      {safe.indirizzo && (
        <p style={{ marginTop: 15 }}>{safe.indirizzo}</p>
      )}

      <div style={{ marginTop: 30, display: "flex", gap: 15, justifyContent: "center", flexWrap: "wrap" }}>
        
        {safe.ordinazione_attiva !== false && (
          <button
            className="button-primary"
            onClick={() => navigate("/ordina")}
          >
            Ordina Online
          </button>
        )}

        <button
          style={{
            background: "transparent",
            border: "1px solid white",
            padding: "12px 20px",
            borderRadius: 8,
            color: "white",
            cursor: "pointer",
          }}
          onClick={() => navigate("/login")}
        >
          Login
        </button>
      </div>
    </section>
  );
}
