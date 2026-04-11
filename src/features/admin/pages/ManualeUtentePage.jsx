import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import manualeUtenteMd from "@/content/manualeUtente.md?raw"
import { buildGuidaToc } from "@/utils/guidaMarkdownToc"
import { getManualeRoadmapNav, getManualeMacroCards } from "@/content/manualeRoadmap"

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  try {
    history.replaceState(null, "", `#${id}`)
  } catch {
    /* ignore */
  }
}

function RoadmapNav({ onNavigate }) {
  const blocks = useMemo(() => getManualeRoadmapNav(), [])

  return (
    <nav className="manuale-roadmap-nav" aria-label="Roadmap del manuale">
      {blocks.map((block) => (
        <div key={block.macroId} className="manuale-roadmap-block">
          <button
            type="button"
            className="manuale-roadmap-macro"
            onClick={() => onNavigate(block.macroId)}
          >
            {block.macroTitle}
          </button>
          {block.items.length > 0 ? (
            <ul className="manuale-roadmap-micro-list">
              {block.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.sub ? "manuale-roadmap-micro manuale-roadmap-micro--sub" : "manuale-roadmap-micro"}
                    onClick={() => onNavigate(item.id)}
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </nav>
  )
}

function ConceptMap({ onNavigate }) {
  const cards = useMemo(() => getManualeMacroCards(), [])
  return (
    <section className="manuale-concept-map" aria-label="Mappa concettuale delle macro-sezioni">
      <h2 className="manuale-concept-map-title">Mappa concettuale</h2>
      <p className="manuale-concept-map-lead">
        Macro-categorie del manuale: clic per aprire la sezione corrispondente nel testo.
      </p>
      <div className="manuale-concept-map-grid">
        {cards.map((c) => (
          <button key={c.id} type="button" className="manuale-concept-card" onClick={() => onNavigate(c.id)}>
            <span className="manuale-concept-card-title">{c.title}</span>
            <span className="manuale-concept-card-hint">{c.hint}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

/**
 * Manuale titolare/staff: `manualeUtente.md` + roadmap macro/micro (`manualeRoadmap.js`).
 */
export default function ManualeUtentePage() {
  const cleanedMd = useMemo(() => manualeUtenteMd.replace(/<!--[\s\S]*?-->/g, "").trim(), [])
  const { h2List, h3List, h4List } = useMemo(() => buildGuidaToc(cleanedMd), [cleanedMd])

  let h2i = 0
  let h3i = 0
  let h4i = 0

  const onNavigate = (id) => scrollToId(id)

  return (
    <div className="guida-utente guida-utente-with-toc manuale-utente-page">
      <div className="guida-utente-toc-wrap">
        <aside className="guida-utente-toc" aria-label="Roadmap macro e micro">
          <p className="guida-utente-toc-title">Roadmap</p>
          <p className="guida-utente-toc-sub">
            Macro-categorie e argomenti. Non è il menu dell’app: serve solo a trovare velocemente un tema nel manuale.
          </p>
          <RoadmapNav onNavigate={onNavigate} />
        </aside>
      </div>

      <div className="guida-utente-main">
        <h1 className="dashboard-page-title">Manuale operativo</h1>
        <p className="guida-utente-lead">
          Riferimento per titolare e staff: struttura a <strong>macro</strong> (temi grandi) e <strong>micro</strong> (singoli
          argomenti). Usa la colonna sinistra per saltare al punto che ti serve; la <strong>mappa concettuale</strong> qui
          sotto riassume le macro. Il link in barra è <strong>Manuale</strong>.
        </p>

        <ConceptMap onNavigate={onNavigate} />

        <div className="guida-utente-body">
          <ReactMarkdown
            components={{
              a: ({ href, children, ...props }) => {
                const ext =
                  href &&
                  (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//"))
                return (
                  <a href={href} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...props}>
                    {children}
                  </a>
                )
              },
              h2: ({ children, ...props }) => {
                const meta = h2List[h2i++]
                return (
                  <h2 id={meta?.id} {...props}>
                    {children}
                  </h2>
                )
              },
              h3: ({ children, ...props }) => {
                const meta = h3List[h3i++]
                return (
                  <h3 id={meta?.id} {...props}>
                    {children}
                  </h3>
                )
              },
              h4: ({ children, ...props }) => {
                const meta = h4List[h4i++]
                return (
                  <h4 id={meta?.id} {...props}>
                    {children}
                  </h4>
                )
              },
              table: ({ children }) => (
                <div className="guida-utente-table-wrap">
                  <table>{children}</table>
                </div>
              ),
            }}
          >
            {cleanedMd}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
