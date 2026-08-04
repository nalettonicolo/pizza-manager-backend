import { Component } from "react"

/**
 * Evita schermo body vuoto (#efe4d8) se una pagina operativa crasha in render.
 */
export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error("[RouteErrorBoundary]", error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (error) {
      const message = error?.message || String(error)
      return (
        <div
          role="alert"
          style={{
            maxWidth: 560,
            margin: "48px auto",
            padding: 24,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ margin: "0 0 12px", fontSize: 18 }}>Errore di caricamento</h1>
          <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.5, color: "#334155" }}>
            La pagina non è riuscita a renderizzarsi. Ricarica o torna indietro; se il problema resta,
            apri la console (F12) e segnala il messaggio sotto.
          </p>
          <pre
            style={{
              margin: 0,
              padding: 12,
              background: "#fef2f2",
              borderRadius: 8,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {message}
          </pre>
          <button
            type="button"
            style={{
              marginTop: 16,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "#c0392b",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => {
              this.setState({ error: null })
              window.location.reload()
            }}
          >
            Ricarica
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
