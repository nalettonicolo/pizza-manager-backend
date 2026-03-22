import { Link } from "react-router-dom"
import "../../../styles/landing.css"

export default function Landing() {
  return (
    <div className="landing-wrapper">

      <div className="landing-bg" aria-hidden="true" />

      <nav className="landing-nav">
        <Link to="/" className="logo">PizzaManager</Link>
        <div className="nav-center">
          <a href="#perche" className="nav-anchor">Perché noi</a>
          <a href="#funzionalita" className="nav-anchor">Funzionalità</a>
          <a href="#piani" className="nav-anchor">Piani</a>
        </div>
        <div className="nav-links">
          <Link to="/login" className="btn-outline">Accedi</Link>
          <Link to="/home" className="btn-primary">Prova gratuita</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-text">
          <p className="hero-badge">SaaS verticale per pizzerie e delivery</p>
          <h1>
            Il tuo locale, <span className="hero-gradient">una sola regia</span>
          </h1>
          <p className="hero-desc">
            Ordini, cucina, cassa e consegne aggiornati in tempo reale. Multi-sede, ruoli operativi e dati isolati per tenant: meno errori, più coperti, meno stress in sala.
          </p>

          <div className="hero-buttons">
            <Link to="/contatti" className="btn-primary big">
              Parla con noi
            </Link>
            <Link to="/login" className="btn-outline big">
              Accedi al pannello
            </Link>
          </div>
          <p className="hero-hint">Nessuna carta richiesta per iniziare. Onboarding guidato in pochi minuti.</p>

          <ul className="hero-trust" aria-label="Punti di forza">
            <li><span className="trust-dot" /> Multi-tenant pronto</li>
            <li><span className="trust-dot" /> Ruoli cucina / cassa / delivery</li>
            <li><span className="trust-dot" /> Menu e ordini sempre allineati</li>
          </ul>
        </div>

        <div className="hero-visual">
          <div className="hero-card hero-card-float">
            <div className="mock-kpi-row">
              <div className="mock-kpi">
                <span className="mock-kpi-label">Ordini live</span>
                <span className="mock-kpi-value">24</span>
              </div>
              <div className="mock-kpi mock-kpi-accent">
                <span className="mock-kpi-label">In coda cucina</span>
                <span className="mock-kpi-value">7</span>
              </div>
            </div>
            <div className="mock-pipeline">
              <div className="mock-stage">
                <span className="mock-stage-title">Ricezione</span>
                <div className="mock-chip">#1042 Bancone</div>
                <div className="mock-chip dim">#1043 Asporto</div>
              </div>
              <div className="mock-stage mock-stage-hot">
                <span className="mock-stage-title">Cucina</span>
                <div className="mock-chip">3 in lavorazione</div>
              </div>
              <div className="mock-stage">
                <span className="mock-stage-title">Pronto</span>
                <div className="mock-chip ok">2 da ritirare</div>
              </div>
            </div>
            <div className="mock-footer-bar">
              <span className="mock-sync">Sync attivo</span>
              <span className="mock-dots" aria-hidden="true"><i /><i /><i /></span>
            </div>
          </div>
          <p className="hero-visual-caption">Anteprima concettuale del flusso ordini</p>
        </div>
      </section>

      <section id="perche" className="section-stats">
        <div className="stat-strip">
          <div className="stat-strip-item">
            <strong>Tempo reale</strong>
            <span>Stati ordine sincronizzati tra postazioni</span>
          </div>
          <div className="stat-strip-item">
            <strong>Multi-sede</strong>
            <span>Punti vendita e permessi sotto controllo</span>
          </div>
          <div className="stat-strip-item">
            <strong>Cloud</strong>
            <span>Dati strutturati, backup e aggiornamenti inclusi</span>
          </div>
        </div>
      </section>

      <section id="funzionalita" className="section-bento">
        <div className="section-head">
          <p className="section-eyebrow">Tutto ciò che serve al giorno d’oggi</p>
          <h2 className="section-title">Dalla comanda alla consegna, senza fratture</h2>
          <p className="section-lead">
            Un’unica piattaforma per coordinare team, menu e operatività: pensata per chi vuole scalare senza perdere il controllo sul servizio.
          </p>
        </div>

        <div className="bento-grid">
          <article className="bento bento-large">
            <h3>Ordini e cucina sempre d’accordo</h3>
            <p>La cucina vede le comande nel momento giusto; meno richiami, meno errori di trascrizione, più fluidità in punta di serata.</p>
          </article>
          <article className="bento">
            <h3>Cassa e bancone</h3>
            <p>Flussi dedicati per incasso e ritiro, con visibilità su prodotti e disponibilità.</p>
          </article>
          <article className="bento">
            <h3>Delivery e rider</h3>
            <p>Area consegne per seguire lo stato delle uscite e ridurre i tempi morti.</p>
          </article>
          <article className="bento bento-wide">
            <h3>Menu ricco e configurabile</h3>
            <p>Categorie, formati, ingredienti, allergeni e impasti: struttura pronta per menu complessi e multi-formato.</p>
          </article>
          <article className="bento">
            <h3>Report</h3>
            <p>Quadro su vendite e andamenti per decidere con i numeri sotto mano.</p>
          </article>
          <article className="bento">
            <h3>Ruoli e permessi</h3>
            <p>Ogni figura vede solo ciò che le serve: meno rumore, più focus operativo.</p>
          </article>
        </div>
      </section>

      <section className="section-roles">
        <div className="section-head">
          <p className="section-eyebrow">Un prodotto, più livelli</p>
          <h2 className="section-title">Costruito per piattaforma, locale e squadra</h2>
        </div>
        <div className="roles-grid">
          <div className="role-card">
            <span className="role-tag">Piattaforma</span>
            <h3>Super Admin</h3>
            <p>Visione d’insieme su tenant, piani e abbonamenti: ideale per chi gestisce il SaaS.</p>
          </div>
          <div className="role-card role-card-highlight">
            <span className="role-tag">Pizzeria</span>
            <h3>Admin tenant</h3>
            <p>Menu, report, impostazioni e ruoli del personale: il centro di comando del locale.</p>
          </div>
          <div className="role-card">
            <span className="role-tag">Sala &amp; cucina</span>
            <h3>Operatori</h3>
            <p>Cassa, cucina, bancone e delivery con interfacce pensate per la velocità.</p>
          </div>
        </div>
      </section>

      <section id="piani" className="pricing-section">
        <p className="pricing-badge">Piani chiari</p>
        <h2 className="pricing-title">
          Scala quando sei pronto
        </h2>
        <p className="pricing-subtitle">
          Prezzi trasparenti, nessuna sorpresa in fattura. Passa al piano superiore quando il volume lo richiede.
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
          Tutti i piani includono aggiornamenti continui e strategie di backup. Cambi piano quando vuoi.
        </p>
      </section>

      <section className="cta-block">
        <div className="cta-inner">
          <h2>Porta ordine e cucina sulla stessa frequenza</h2>
          <p>Scopri come PizzaManager può adattarsi al tuo locale: dalla singola sede al modello multi-punto.</p>
          <div className="cta-buttons">
            <Link to="/contatti" className="btn-primary big">Richiedi una demo</Link>
            <Link to="/home" className="btn-ghost big">Esplora l’area pubblica</Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-inner">
          <span className="footer-brand">PizzaManager</span>
          <span className="footer-copy">© {new Date().getFullYear()} — Gestionale e SaaS per pizzerie</span>
          <Link to="/login" className="footer-link">Accedi</Link>
        </div>
      </footer>

    </div>
  )
}
