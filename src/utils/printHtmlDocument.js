/**
 * Stampa un documento HTML senza aprire una scheda di anteprima.
 * Usa un iframe nascosto e chiama print() una sola volta (niente popup = niente “seconda conferma” a schermo).
 * Il dialogo di sistema del browser/OS resta obbligatorio senza flag Chrome `--kiosk-printing`.
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

  const runPrint = (win) => {
    if (!win) return
    try {
      win.focus()
    } catch {
      /* ignore */
    }
    try {
      win.print()
    } catch (e) {
      console.warn("[printHtmlDocument]", e)
    }
  }

  try {
    const iframe = document.createElement("iframe")
    iframe.setAttribute("title", title)
    iframe.setAttribute("aria-hidden", "true")
    iframe.setAttribute("data-pm-print", "1")
    iframe.style.cssText =
      "position:fixed;width:1px;height:1px;border:0;left:0;top:0;opacity:0;pointer-events:none;"
    // Evita popup/scheda: solo iframe. Una sola chiamata print al load.
    iframe.addEventListener(
      "load",
      () => {
        const win = iframe.contentWindow
        if (!win) return
        try {
          win.onafterprint = () => {
            try {
              iframe.remove()
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
        // requestAnimationFrame: layout pronto, evita doppio print su alcuni browser
        requestAnimationFrame(() => {
          setTimeout(() => runPrint(win), 40)
        })
        setTimeout(() => {
          try {
            if (iframe.isConnected) iframe.remove()
          } catch {
            /* ignore */
          }
        }, 120_000)
      },
      { once: true },
    )
    iframe.srcdoc = html
    document.body.appendChild(iframe)
    return true
  } catch (e) {
    console.warn("[printHtmlDocument] iframe fallito", e)
  }

  // Fallback raro: ancora senza scheda visibile se possible via blob in iframe
  let url = ""
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    url = URL.createObjectURL(blob)
    const iframe = document.createElement("iframe")
    iframe.setAttribute("title", title)
    iframe.setAttribute("aria-hidden", "true")
    iframe.style.cssText =
      "position:fixed;width:1px;height:1px;border:0;left:0;top:0;opacity:0;pointer-events:none;"
    iframe.addEventListener(
      "load",
      () => {
        requestAnimationFrame(() => {
          setTimeout(() => runPrint(iframe.contentWindow), 40)
        })
        setTimeout(() => {
          try {
            iframe.remove()
            URL.revokeObjectURL(url)
          } catch {
            /* ignore */
          }
        }, 120_000)
      },
      { once: true },
    )
    iframe.src = url
    document.body.appendChild(iframe)
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
