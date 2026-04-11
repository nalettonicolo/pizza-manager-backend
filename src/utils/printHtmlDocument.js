/**
 * Stampa un documento HTML completo senza document.write (evita [Violation] Chrome).
 * Prova prima iframe nascosto con srcdoc, poi finestra con URL blob.
 *
 * @param {string} html Documento completo (DOCTYPE + html…)
 * @param {{ title?: string, alertPopupBlocked?: string }} [opts]
 * @returns {boolean}
 */
export function printHtmlDocument(html, opts = {}) {
  const title = opts.title ?? "Stampa"
  const alertMsg =
    opts.alertPopupBlocked ??
    "Impossibile stampare (popup bloccato). Consenti i popup per questo sito e riprova."

  try {
    const iframe = document.createElement("iframe")
    iframe.setAttribute("title", title)
    iframe.setAttribute("aria-hidden", "true")
    iframe.style.cssText =
      "position:fixed;width:0;height:0;border:0;left:0;top:0;opacity:0;pointer-events:none;visibility:hidden"
    iframe.srcdoc = html
    iframe.addEventListener(
      "load",
      () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
          } catch (e) {
            console.warn("[printHtmlDocument]", e)
          }
        }, 150)
      },
      { once: true },
    )
    document.body.appendChild(iframe)
    setTimeout(() => {
      try {
        iframe.remove()
      } catch {
        /* ignore */
      }
    }, 90_000)
    return true
  } catch {
    /* fallback blob */
  }

  let url = ""
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    url = URL.createObjectURL(blob)
    const w = window.open(url, "_blank", "noopener,noreferrer")
    if (!w) {
      URL.revokeObjectURL(url)
      window.alert(alertMsg)
      return false
    }
    w.addEventListener(
      "load",
      () => {
        setTimeout(() => {
          try {
            w.focus()
            w.print()
          } catch (e) {
            console.warn("[printHtmlDocument popup]", e)
          }
        }, 150)
      },
      { once: true },
    )
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* ignore */
      }
    }, 120_000)
    return true
  } catch (e) {
    console.error(e)
    if (url) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* ignore */
      }
    }
    window.alert(alertMsg)
    return false
  }
}
