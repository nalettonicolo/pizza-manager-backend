import DOMPurify from "dompurify"

/**
 * Sanifica l'HTML personalizzato delle pagine legali del tenant (privacy/cookie policy),
 * inserito da un admin locale e mostrato in vetrina pubblica a tutti i visitatori.
 *
 * Senza sanificazione, un admin (o chiunque comprometta quel campo) potrebbe salvare
 * <script>/on*=/javascript: e ottenere uno stored XSS su ogni visitatore della vetrina.
 * Consentiamo solo tag/attributi di formattazione statica: niente script, iframe, form,
 * event handler inline o URL javascript:.
 */
const LEGAL_HTML_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "hr", "strong", "b", "em", "i", "u", "small", "sub", "sup",
    "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
    "a", "span", "div", "blockquote",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
  ],
  ALLOWED_ATTR: ["href", "title", "class", "colspan", "rowspan", "scope"],
  ALLOW_DATA_ATTR: false,
  // Blocca protocolli pericolosi (javascript:, data:) lasciando http/https/mailto/tel e ancore.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#|\/)/i,
}

let hardenedHooks = false
function ensureHooks() {
  if (hardenedHooks) return
  hardenedHooks = true
  // Ogni link esterno risultante viene forzato a target sicuro (no window.opener hijack).
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("href")) {
      node.setAttribute("target", "_blank")
      node.setAttribute("rel", "noopener noreferrer nofollow")
    }
  })
}

/**
 * @param {string} html HTML grezzo (già con i segnaposto sostituiti)
 * @returns {string} HTML sicuro da usare in dangerouslySetInnerHTML
 */
export function sanitizeLegalHtml(html) {
  if (html == null || typeof html !== "string") return ""
  ensureHooks()
  return DOMPurify.sanitize(html, LEGAL_HTML_CONFIG)
}
