/**
 * Serializza un oggetto JSON-LD per l'iniezione in <script type="application/ld+json"> via
 * dangerouslySetInnerHTML.
 *
 * JSON.stringify() da solo NON basta: non fa escape della sequenza "</script>". Se un campo
 * editabile da admin (titolo articolo, domanda FAQ, ecc.) contenesse "</script><script>...",
 * il tag verrebbe chiuso in anticipo e il markup successivo eseguito come script reale sulla
 * pagina pubblica — stored XSS su ogni visitatore (OWASP A03).
 *
 * Fix: sostituiamo "<" con la sequenza di escape unicode "<". Il parser JSON la
 * ridecodifica correttamente in "<" (il significato JSON-LD non cambia), ma nel sorgente HTML
 * non compare mai un "<" letterale: "</script>" non può più chiudere il tag in anticipo.
 */
export function safeJsonLdString(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c")
}
