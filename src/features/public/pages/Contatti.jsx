import { useState } from "react";
import { Link } from "react-router-dom";
import "../../../styles/landing.css";

const DEFAULT_EMAIL = "info@pizzamanager.it";

export default function Contatti() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    azienda: "",
    telefono: "",
    messaggio: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Richiesta informazioni PizzaManager - ${form.azienda || "Nuovo contatto"}`);
    const body = encodeURIComponent(
      `Nome: ${form.nome}\nEmail: ${form.email}\nAzienda: ${form.azienda || "-"}\nTelefono: ${form.telefono || "-"}\n\nMessaggio:\n${form.messaggio}`
    );
    window.location.href = `mailto:${DEFAULT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="landing-wrapper">
      <nav className="landing-nav">
        <Link to="/" className="logo">🍕 PizzaManager</Link>
        <div className="nav-links">
          <Link to="/login" className="btn-outline">Accedi</Link>
          <Link to="/home" className="btn-primary">Prova gratuita</Link>
        </div>
      </nav>

      <section className="hero" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div className="hero-text" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.75rem", marginBottom: 8 }}>Contattaci</h1>
          <p className="hero-desc" style={{ marginBottom: 24 }}>
            Richiedi informazioni sul servizio, prezzi o supporto. Compila il modulo e ti risponderemo via email.
          </p>

          {sent ? (
            <div className="dashboard-box" style={{ padding: 24, background: "#f0fdf4", borderColor: "#86efac" }}>
              <p style={{ margin: 0, color: "#166534" }}>
                Aprendo il client email con i dati inseriti. Invia il messaggio per contattarci.
              </p>
              <button
                type="button"
                className="btn-outline"
                style={{ marginTop: 16 }}
                onClick={() => setSent(false)}
              >
                Invia un altro messaggio
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Nome *</span>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Il tuo nome"
                  style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Email *</span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="tua@email.it"
                  style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Azienda / Pizzeria</span>
                <input
                  type="text"
                  value={form.azienda}
                  onChange={(e) => setForm((f) => ({ ...f, azienda: e.target.value }))}
                  placeholder="Nome locale (opzionale)"
                  style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Telefono</span>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="Opzionale"
                  style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Messaggio *</span>
                <textarea
                  required
                  rows={4}
                  value={form.messaggio}
                  onChange={(e) => setForm((f) => ({ ...f, messaggio: e.target.value }))}
                  placeholder="Descrivi la tua richiesta..."
                  style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, resize: "vertical" }}
                />
              </label>
              <button type="submit" className="btn-primary big">
                Invia richiesta via email
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="landing-footer">
        <Link to="/" style={{ marginRight: 16 }}>Torna alla home</Link>
        © {new Date().getFullYear()} PizzaManager
      </footer>
    </div>
  );
}
