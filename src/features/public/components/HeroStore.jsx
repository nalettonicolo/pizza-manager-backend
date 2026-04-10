import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/app/contexts/AuthContext";

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

export default function HeroStore({ branding, menuTheme, ordiniOnlineVetrinaOk }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const safe = branding ?? {};
  /**
   * `ordiniOnlineVetrinaOk` viene da PublicStore (readOrdiniOnlineVetrinaAllowed) — fonte unica.
   * Fallback su branding solo per compatibilità.
   */
  const vetrinaOk =
    typeof ordiniOnlineVetrinaOk === "boolean"
      ? ordiniOnlineVetrinaOk
      : branding != null && safe.ordinazione_attiva !== false;
  const showHeroOrderCtas = branding != null && vetrinaOk;
  const heroBackground = menuTheme
    ? `linear-gradient(90deg, ${menuTheme.primary} 0%, ${menuTheme.accent} 50%, ${menuTheme.accent} 100%)`
    : "var(--color-primary)";

  return (
    <section
      className="public-store-hero"
      style={{
        background: heroBackground,
        color: "white",
        textAlign: "center",
      }}
    >
      {safe.logo_url && (
        <img
          src={safe.logo_url}
          alt={safe.nome ? `Logo ${safe.nome}` : "Logo"}
          className="public-store-hero-logo"
          style={{ marginBottom: 20 }}
        />
      )}

      <h1 className="public-store-hero-title">{safe.nome ?? "Pizzeria"}</h1>

      {safe.indirizzo && (
        <p className="public-store-hero-address">{safe.indirizzo}</p>
      )}

      {showHeroOrderCtas && (
        <div className="public-store-hero-actions">
          <button
            type="button"
            className="button-primary"
            style={menuTheme ? { background: menuTheme.accent, borderColor: menuTheme.accent } : undefined}
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
                navigate("/ordina");
              }
            }}
          >
            Ordina Online
          </button>
          <button
            type="button"
            style={{
              background: "transparent",
              border: "1px solid white",
              padding: "12px 20px",
              borderRadius: 8,
              color: "white",
              cursor: "pointer",
            }}
            onClick={() =>
              navigate("/login", {
                state: { from: `${location.pathname}${location.search || ""}` },
              })
            }
          >
            Login
          </button>
        </div>
      )}
    </section>
  );
}
