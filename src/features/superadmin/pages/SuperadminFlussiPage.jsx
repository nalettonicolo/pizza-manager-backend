import { Link } from "react-router-dom"
import SuperadminGateChrome from "@/features/superadmin/components/SuperadminGateChrome"
import {
  FLUSSI_CONSEGNA,
  FLUSSI_MISMATCH,
  FLUSSI_PERCORSI,
  FLUSSI_REPARTI,
  FLUSSI_STATI,
  FLUSSI_SYNC,
} from "@/features/superadmin/data/flussiOperativi"
import "./SuperadminFlussiPage.css"

const SEZIONI = [
  { id: "flussi-sync", label: "Comunicazione" },
  { id: "flussi-percorsi", label: "Percorsi" },
  { id: "flussi-reparti", label: "Reparti" },
  { id: "flussi-stati", label: "Stati" },
  { id: "flussi-mismatch", label: "Correzioni applicate" },
]

export default function SuperadminFlussiPage() {
  return (
    <SuperadminGateChrome
      className="sa-gate--doc"
      extra={
        <>
          <Link to="/superadmin/ingresso" className="sa-gate-navlink">
            Ingresso
          </Link>
          <Link to="/superadmin/dashboard" className="sa-gate-navlink">
            Console
          </Link>
        </>
      }
    >
      <main className="sa-gate-main">
        <p className="sa-gate-kicker">Piattaforma</p>
        <h1 className="sa-gate-title">Flussi</h1>
        <p className="sa-gate-lede">
          Come i reparti sono programmati oggi: chi vede l’ordine, quale tasto lo fa avanzare, dove
          sparisce. In fondo trovi le correzioni già applicate al flusso ordini.
        </p>

        <nav className="sa-flussi-toc" aria-label="Sezioni Flussi">
          {SEZIONI.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.label}
            </a>
          ))}
        </nav>

        <section id="flussi-sync" className="sa-flussi-box sa-flussi-sync">
          <h2>{FLUSSI_SYNC.titolo}</h2>
          <ul>
            {FLUSSI_SYNC.punti.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <h2 id="flussi-percorsi" className="sa-flussi-heading">
          Percorsi ordine
        </h2>
        <div className="sa-flussi-grid">
          {FLUSSI_PERCORSI.map((percorso) => (
            <article key={percorso.id} className="sa-flussi-box sa-flussi-percorso">
              <h3>{percorso.titolo}</h3>
              <ol>
                {percorso.passi.map((passo) => (
                  <li key={passo}>{passo}</li>
                ))}
              </ol>
            </article>
          ))}
        </div>

        <h2 id="flussi-reparti" className="sa-flussi-heading">
          Cosa fa ogni schermata
        </h2>
        <div className="sa-flussi-grid">
          {FLUSSI_REPARTI.map((r) => (
            <article key={r.id} className={`sa-flussi-box sa-flussi-reparto sa-flussi-reparto--${r.id}`}>
              <h3>{r.nome}</h3>
              <p className="sa-flussi-path">
                {r.schermata} · {r.percorso}
              </p>
              <dl>
                <dt>Vede</dt>
                <dd>{r.vede}</dd>
                <dt>Fa</dt>
                <dd>{r.fa}</dd>
                <dt>Passaggio</dt>
                <dd>{r.passaggio}</dd>
              </dl>
            </article>
          ))}
        </div>

        <h2 id="flussi-stati" className="sa-flussi-heading">
          Stati dell’ordine
        </h2>
        <div className="sa-flussi-table-wrap">
          <table className="sa-flussi-table">
            <thead>
              <tr>
                <th>Da</th>
                <th>Può diventare</th>
                <th>Chi lo fa</th>
              </tr>
            </thead>
            <tbody>
              {FLUSSI_STATI.map((row) => (
                <tr key={row.da}>
                  <td>{row.da}</td>
                  <td>{row.a}</td>
                  <td>{row.chi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="sa-flussi-heading">Cosa fa ogni tasto</h2>
        <div className="sa-flussi-table-wrap">
          <table className="sa-flussi-table">
            <thead>
              <tr>
                <th>Tasto</th>
                <th>Effetto</th>
              </tr>
            </thead>
            <tbody>
              {FLUSSI_CONSEGNA.map((row) => (
                <tr key={row.tasto}>
                  <td>{row.tasto}</td>
                  <td>{row.effetto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 id="flussi-mismatch" className="sa-flussi-heading">
          Correzioni applicate
        </h2>
        <p className="sa-flussi-intro">
          I punti che prima «non combaciavano» sono stati allineati al flusso richiesto. Per ognuno:
          com’era prima e com’è adesso.
        </p>
        {FLUSSI_MISMATCH.map((item) => (
          <article key={item.id} className="sa-flussi-box sa-flussi-mismatch">
            <h3>{item.titolo}</h3>
            <p>{item.fatto}</p>
            <p className="sa-flussi-hint">{item.attesoHint}</p>
          </article>
        ))}
      </main>
    </SuperadminGateChrome>
  )
}
