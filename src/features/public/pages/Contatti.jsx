import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import "../../../styles/landing.css";

const DEFAULT_EMAIL = "info@pizzamanager.it";

export default function Contatti() {
  const location = useLocation();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    azienda: "",
    telefono: "",
    messaggio: "",
  });

  useEffect(() => {
    if (location.hash !== "#prova-gratuita") return;
    const el = document.getElementById("prova-gratuita");
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [location.pathname, location.hash]);

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
      <section className="hero" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div className="hero-text" style={{ maxWidth: 560, margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.75rem", marginBottom: 8 }}>Contattaci</h1>
          <p className="hero-desc" style={{ marginBottom: 24 }}>
            Richiedi informazioni sul servizio, una demo o la licenza di prova. Compila il modulo e apri il messaggio in posta per inviarci una email.
          </p>

          <div
            id="prova-gratuita"
            className="dashboard-box"
            style={{
              marginBottom: 28,
              padding: 20,
              textAlign: "left",
              borderColor: "rgba(192, 57, 43, 0.25)",
              background: "linear-gradient(145deg, #fff8f6 0%, #fff 100%)",
            }}
          >
            <h2 style={{ fontSize: "1.125rem", margin: "0 0 10px", color: "#0f172a" }}>
              Prova 14 giorni (licenza di prova)
            </h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#475569" }}>
              Non esiste un piano free permanente: l’ingresso è una <strong>prova di 14 giorni</strong> sul <strong>piano scelto</strong>, poi si attiva un <strong>piano a pagamento</strong>.
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#475569" }}>
              Per entrare in prova <strong>non basta registrarsi da soli</strong>: l’<strong>amministratore della piattaforma</strong> abilita il tenant e ti invia <strong>email e password</strong> (o invito).
            </p>
            <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#475569" }}>
              Scrivici qui sotto con <strong>“Richiesta prova 14 giorni”</strong> nel messaggio e indica il piano desiderato: ti rispondiamo con i passaggi e, se previsto, le credenziali.
            </p>
          </div>

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
                  placeholder="Es. Richiesta licenza di prova per il mio locale…"
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
