/**
 * Verifica rapida del deploy hosting: GET della home e estrazione del nome del bundle JS principale.
 * Uso: npm run check:live
 * Opzionale: CHECK_URL=https://altro.dominio.tld npm run check:live
 *
 * Evita curl in PowerShell (dove `curl` è Invoke-WebRequest e non accetta -sI).
 */
const url = process.env.CHECK_URL || "https://pizzamanager.it/"

async function main() {
  const res = await fetch(url, { redirect: "follow" })
  const status = res.status
  const cache = res.headers.get("cache-control") || "—"
  const ct = res.headers.get("content-type") || "—"
  console.log(`URL:   ${url}`)
  console.log(`HTTP:  ${status}`)
  console.log(`Cache-Control (risposta): ${cache}`)
  console.log(`Content-Type: ${ct}`)

  const html = await res.text()
  const m = html.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/)
  if (m) {
    console.log(`Bundle principale: /assets/${m[1]}`)
  } else {
    console.log("Bundle principale: non trovato (pattern index-*.js)")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
