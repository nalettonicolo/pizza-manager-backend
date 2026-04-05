import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/app/contexts/AuthContext";
import { useBranding } from "@/branding/BrandingContext";

function isSaaSHost() {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return (
    h === "pizzamanager.it" ||
    h.startsWith("app.") ||
    h.includes("localhost") ||
    h.includes("127.0.0.1")
  );
}

export default function HeroSection() {
  const { branding } = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  if (!branding) return null;

  const safe = {
    nome: branding.nome ?? branding.nomePizzeria,
    logo_url: branding.logo_url ?? branding.logoUrl,
    indirizzo: branding.indirizzo,
    ordinazione_attiva: branding.ordinazione_attiva !== false,
  };

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

      <h1 style={{ fontSize: 40 }}>{safe.nome}</h1>

      <p style={{ marginTop: 20 }}>
        Ordina le nostre pizze artigianali online
      </p>

      {safe.ordinazione_attiva !== false && (
        <button
          type="button"
          className="button-primary"
          style={{ marginTop: 30 }}
          onClick={() => {
            if (!user) {
              navigate("/login", {
                state: { from: `${location.pathname}${location.search || ""}` },
              });
              return;
            }
            if (isSaaSHost()) {
              document.getElementById("public-menu")?.scrollIntoView({ behavior: "smooth" });
            } else {
              navigate("/ordine");
            }
          }}
        >
          Ordina Online
        </button>
      )}
    </section>
  );
}
