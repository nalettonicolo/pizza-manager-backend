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
          <Link to="/negozio" className="nav-anchor">Menu online</Link>
        </div>
        <div className="nav-links">
          <Link to="/login" className="btn-outline">Accedi</Link>
          <Link to="/contatti#prova-gratuita" className="btn-primary">Prova gratuita</Link>
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
            <Link to="/contatti#prova-gratuita" className="btn-primary big">
              Richiedi prova gratuita
            </Link>
            <Link to="/login" className="btn-outline big">
              Accedi al pannello
            </Link>
            <Link to="/negozio" className="btn-ghost big landing-hero-menu-btn">
              Home menu pizzeria
            </Link>
          </div>
          <p className="hero-hint">
            La licenza di prova si attiva contattando l’admin: ricevi credenziali dedicate per entrare in app. Apri il menu pubblico della pizzeria con il pulsante sopra.
          </p>

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
          <p className="section-eyebrow">Il tuo locale e la squadra</p>
          <h2 className="section-title">Due livelli: chi gestisce e chi opera</h2>
          <p className="section-lead section-lead-roles">
            <strong>Cosa sono i «tenant»?</strong> In pratica, ogni <strong>pizzeria iscritta</strong> (o ogni marchio che usi il servizio) ha uno <strong>spazio riservato</strong>: menu, ordini e impostazioni restano <strong>separati</strong> da quelli degli altri locali. È il modo in cui il software tiene i dati al sicuro e ordinati, locale per locale.
          </p>
        </div>
        <div className="roles-grid roles-grid-two">
          <div className="role-card role-card-highlight">
            <span className="role-tag">Gestione</span>
            <h3>Titolare e amministratori</h3>
            <p>
              Chi gestisce il locale: menu, listini, report, orari, dati della pizzeria e chi può accedere alle varie aree (cassa, cucina, …). È il pannello di comando del <strong>tuo</strong> spazio — quello della tua attività, non mescolato con altri clienti.
            </p>
          </div>
          <div className="role-card">
            <span className="role-tag">Sala &amp; cucina</span>
            <h3>Operatori</h3>
            <p>
              Cassa, cucina, bancone e delivery: schermate pensate per velocità e meno errori in servizio. Ogni operatore vede solo ciò che serve al proprio ruolo.
            </p>
          </div>
        </div>
      </section>

      <section id="piani" className="pricing-section">
        <p className="pricing-badge">Piani chiari</p>
        <h2 className="pricing-title">
          Scala quando sei pronto
        </h2>
        <p className="pricing-subtitle">
          Nessun piano “free” permanente: inizi con <strong>7 giorni di prova</strong>, poi scegli l’abbonamento tra i piani che offriamo (definiti lato piattaforma). Contattaci per i dettagli.
        </p>
        <div className="pricing-grid">
          <div className="pricing-card featured">
            <div className="pricing-card-header">
              <span className="pricing-tag">Per iniziare</span>
              <span className="pricing-name">Prova 7 giorni</span>
              <div className="pricing-price">
                <span className="pricing-amount">7 giorni</span>
              </div>
              <p className="pricing-desc">Per conoscere la piattaforma</p>
            </div>
            <ul className="pricing-features">
              <li>Accesso completo per valutare il servizio</li>
              <li>Non è un piano a tempo indeterminato: serve per decidere</li>
              <li>Al termine attivi un piano a pagamento con l’admin</li>
            </ul>
            <Link to="/contatti#prova-gratuita" className="pricing-cta primary">Richiedi la prova</Link>
          </div>

          <div className="pricing-card">
            <div className="pricing-card-header">
              <span className="pricing-name">Piani Pro / Business</span>
              <div className="pricing-price">
                <span className="pricing-amount">Da concordare</span>
              </div>
              <p className="pricing-desc">Funzioni e limiti per sede</p>
            </div>
            <ul className="pricing-features">
              <li>Piani commerciali definiti dalla piattaforma (es. Pro)</li>
              <li>Ogni piano elenca cosa include (punti vendita, report, …)</li>
              <li>Gestione da area Super Admin</li>
            </ul>
            <Link to="/contatti#prova-gratuita" className="pricing-cta secondary">Chiedi un preventivo</Link>
          </div>

          <div className="pricing-card">
            <div className="pricing-card-header">
              <span className="pricing-name">Enterprise</span>
              <div className="pricing-price">
                <span className="pricing-amount">Su misura</span>
              </div>
              <p className="pricing-desc">Gruppi e franchising</p>
            </div>
            <ul className="pricing-features">
              <li>Integrazioni e volumi dedicati</li>
              <li>Account e SLA concordati</li>
              <li>Personalizzazioni sul modello</li>
            </ul>
            <Link to="/contatti" className="pricing-cta secondary">Contattaci</Link>
          </div>
        </div>
        <p className="pricing-note">
          Gli abbonamenti includono aggiornamenti del prodotto. I dettagli economici e le funzioni per piano sono gestiti in piattaforma insieme all’amministratore.
        </p>
      </section>

      <section className="cta-block">
        <div className="cta-inner">
          <h2>Porta ordine e cucina sulla stessa frequenza</h2>
          <p>Scopri come PizzaManager può adattarsi al tuo locale: dalla singola sede al modello multi-punto.</p>
          <div className="cta-buttons">
            <Link to="/contatti#prova-gratuita" className="btn-primary big">Richiedi prova o demo</Link>
            <Link to="/negozio" className="btn-ghost big">Vedi home menu pizzeria</Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-inner">
          <span className="footer-brand">PizzaManager</span>
          <span className="footer-copy">© {new Date().getFullYear()} — Gestionale e SaaS per pizzerie</span>
          <nav className="footer-legal" aria-label="Informative legali">
            <Link to="/privacy">Privacy</Link>
            <Link to="/cookie">Cookie</Link>
            <Link to="/termini">Termini</Link>
          </nav>
          <Link to="/login" className="footer-link">Accedi</Link>
        </div>
      </footer>

    </div>
  )
}
