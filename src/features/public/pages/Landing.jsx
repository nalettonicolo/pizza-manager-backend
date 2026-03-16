import { Link } from "react-router-dom"
import "../../../styles/landing.css"

export default function Landing() {
  return (
    <div className="landing-wrapper">

      {/* NAVBAR */}
      <nav className="landing-nav">
        <div className="logo">🍕 PizzaManager</div>
        <div className="nav-links">
          <Link to="/login" className="btn-outline">Accedi</Link>
          <Link to="/home" className="btn-primary">Prova gratuita</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-text">
          <p className="hero-badge">Gestionale per pizzerie e delivery</p>
          <h1>
            Ordini, cucina e cassa <span>sempre in sync</span>
          </h1>
          <p className="hero-desc">
            Un’unica piattaforma per sala, cucina, bancone e asporto. Aggiornamenti in tempo reale, multi-sede e ruoli integrati. Niente più fogli e ritardi.
          </p>

          <div className="hero-buttons">
            <Link to="/contatti" className="btn-primary big">
              Inizia ora →
            </Link>
            <Link to="/login" className="btn-outline big">
              Accedi
            </Link>
          </div>
          <p className="hero-hint">Niente carta di credito. Setup in pochi minuti.</p>
        </div>

        <div className="hero-card">
          <div className="dashboard-mock">
            <div className="mock-header">
              <span className="mock-dot" /><span className="mock-dot" /><span className="mock-dot" />
            </div>
            <div className="mock-content">
              <div className="mock-line w80" />
              <div className="mock-line w60" />
              <div className="mock-line w90" />
              <div className="mock-line w50" />
              <div className="mock-line w70" />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features">
        <div className="feature">
          <div className="feature-icon">📍</div>
          <h3>Multi punto vendita</h3>
          <p>Gestisci più sedi da un solo account. Ruoli per cassa, cucina, bancone e delivery.</p>
        </div>
        <div className="feature">
          <div className="feature-icon">⚡</div>
          <h3>Ordini in tempo reale</h3>
          <p>La cucina vede gli ordini subito. Niente attese, niente errori di trascrizione.</p>
        </div>
        <div className="feature">
          <div className="feature-icon">☁️</div>
          <h3>Cloud e scalabile</h3>
          <p>Architettura SaaS pronta per crescere. Dati al sicuro, sempre disponibili.</p>
        </div>
      </section>

      {/* PIANI E PREZZI */}
      <section className="pricing-section">
        <p className="pricing-badge">Piani flessibili</p>
        <h2 className="pricing-title">
          Un piano per ogni fase del tuo locale
        </h2>
        <p className="pricing-subtitle">
          Prezzi chiari, niente sorprese. Scala quando serve, senza vincoli.
        </p>
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-card-header">
              <span className="pricing-name">Free</span>
              <div className="pricing-price">
                <span className="pricing-amount">0€</span>
                <span className="pricing-period">/mese</span>
              </div>
              <p className="pricing-desc">Per provare senza impegno</p>
            </div>
            <ul className="pricing-features">
              <li>1 punto vendita</li>
              <li>Ordini e cucina base</li>
              <li>Supporto community</li>
            </ul>
            <Link to="/home" className="pricing-cta secondary">Inizia gratis</Link>
          </div>

          <div className="pricing-card featured">
            <div className="pricing-card-header">
              <span className="pricing-tag">Più scelto</span>
              <span className="pricing-name">Pro</span>
              <div className="pricing-price">
                <span className="pricing-amount">29€</span>
                <span className="pricing-period">/mese</span>
              </div>
              <p className="pricing-desc">Per locali in crescita</p>
            </div>
            <ul className="pricing-features">
              <li>Punti vendita illimitati</li>
              <li>Ruoli e permessi avanzati</li>
              <li>Report e analisi</li>
              <li>Supporto prioritario</li>
            </ul>
            <Link to="/home" className="pricing-cta primary">Prova Pro</Link>
          </div>

          <div className="pricing-card">
            <div className="pricing-card-header">
              <span className="pricing-name">Enterprise</span>
              <div className="pricing-price">
                <span className="pricing-amount">Su misura</span>
              </div>
              <p className="pricing-desc">Per gruppi e franchising</p>
            </div>
            <ul className="pricing-features">
              <li>Tutto di Pro</li>
              <li>API e integrazioni</li>
              <li>Account manager</li>
              <li>SLA dedicato</li>
            </ul>
            <Link to="/contatti" className="pricing-cta secondary">Contattaci</Link>
          </div>
        </div>
        <p className="pricing-note">
          Tutti i piani includono aggiornamenti e backup. Puoi cambiare piano in qualsiasi momento.
        </p>
      </section>

      {/* CTA finale */}
      <section className="cta-block">
        <h2>Pronto a semplificare il tuo locale?</h2>
        <p>Unisciti alle pizzerie che usano PizzaManager ogni giorno.</p>
        <Link to="/contatti" className="btn-primary big">Prova ora</Link>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        © {new Date().getFullYear()} PizzaManager — Gestionale per pizzerie
      </footer>

    </div>
  )
}