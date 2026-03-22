import ReactMarkdown from "react-markdown"
import guidaUtenteMd from "@/content/guidaUtente.md?raw"

/**
 * Guida per l’utente finale (titolare/staff): contenuto da src/content/guidaUtente.md
 */
export default function GuidaUtentePage() {
  return (
    <div className="guida-utente">
      <h1 className="dashboard-page-title">Guida utente</h1>
      <p className="guida-utente-lead">
        Manuale di riferimento per l’uso quotidiano della piattaforma. Puoi tornare qui quando serve
        dalla barra in alto (<strong>Guida</strong>).
      </p>
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
            table: ({ children }) => (
              <div className="guida-utente-table-wrap">
                <table>{children}</table>
              </div>
            ),
          }}
        >
          {guidaUtenteMd.replace(/<!--[\s\S]*?-->/g, "").trim()}
        </ReactMarkdown>
      </div>
    </div>
  )
}
