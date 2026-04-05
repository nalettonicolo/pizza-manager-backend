import { QRCodeSVG } from "qrcode.react"
import { buildFidelityCardTheme } from "@/utils/fidelityCardTheme"
import { prossimoPremioSuScheda, timbriSuSchedaCorrente } from "@/utils/fidelityProgramConfig"

function patternOverlayCss(pattern, contrast) {
  const light = contrast === "chiaro"
  const a = light ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)"
  const b = light ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"
  switch (pattern) {
    case "grid":
      return {
        backgroundImage: `
          linear-gradient(${a} 1px, transparent 1px),
          linear-gradient(90deg, ${a} 1px, transparent 1px)
        `,
        backgroundSize: "18px 18px",
      }
    case "waves":
      return {
        backgroundImage: `repeating-radial-gradient(circle at 0% 120%, ${b} 0 2px, transparent 2px 28px)`,
        opacity: 0.9,
      }
    case "dots":
      return {
        backgroundImage: `radial-gradient(circle, ${a} 1px, transparent 1.5px)`,
        backgroundSize: "14px 14px",
      }
    default:
      return {}
  }
}

/**
 * Tessera fidelity virtuale (anteprima / dettaglio cliente).
 * @param {object} props
 * @param {object} [props.theme] — risultato di buildFidelityCardTheme; se assente usa default da `parametriSlice`
 * @param {object} [props.parametriSlice] — sottoinsieme parametri_operativi per costruire il tema
 * @param {string} props.tenantNome
 * @param {string|null} [props.logoUrl]
 * @param {string} props.programmaNome
 * @param {string} props.clienteNome
 * @param {number} props.punti
 * @param {string} props.codiceCarta
 * @param {number} [props.scale] — scala visuale (es. 0.92 nel pannello laterale)
 * @param {string} [props.className]
 * @param {string} [props.nomeNegozio] — alias bancone (se valorizzato ha priorità visiva sull’anagrafica)
 * @param {number} [props.timbriSchedaTotale] — slot timbri sulla tessera (0 = nascondi griglia)
 * @param {{ soglia: number, descrizione: string }[]} [props.premi] — premi a X timbri (sulla scheda corrente)
 */
export default function FidelityVirtualCard({
  theme: themeProp,
  parametriSlice,
  tenantNome,
  logoUrl,
  programmaNome,
  clienteNome,
  punti,
  codiceCarta,
  scale = 1,
  className = "",
  nomeNegozio = "",
  timbriSchedaTotale = 0,
  premi = [],
}) {
  const theme = themeProp || buildFidelityCardTheme(parametriSlice || {})
  const isLightText = theme.contrast === "chiaro"
  const fg = isLightText ? "#f8fafc" : "#0f172a"
  const fgMuted = isLightText ? "rgba(248,250,252,0.72)" : "rgba(15,23,42,0.55)"
  const fgSoft = isLightText ? "rgba(248,250,252,0.5)" : "rgba(15,23,42,0.38)"
  const glassBg = isLightText ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.65)"
  const glassBorder = isLightText ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.08)"
  const qrValue = `pizzamanager:fidelity:${String(codiceCarta || "").trim()}`

  const timbriTot = Math.max(0, Math.min(48, Math.floor(Number(timbriSchedaTotale) || 0)))
  const suScheda = timbriSuSchedaCorrente(punti, timbriTot)
  const listaPremi = Array.isArray(premi) ? premi : []
  const nextPr = timbriTot > 0 ? prossimoPremioSuScheda(listaPremi, suScheda) : null
  const aliasBancone = String(nomeNegozio || "").trim()
  const nomeUfficiale = String(clienteNome || "").trim()
  const titoloIntestatario = aliasBancone || nomeUfficiale || "—"
  const sottoIntestatario =
    aliasBancone && nomeUfficiale && aliasBancone !== nomeUfficiale ? nomeUfficiale : ""

  const gradient = `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 55%, ${theme.primary} 110%)`
  const patternStyle = patternOverlayCss(theme.pattern, theme.contrast)

  const boxShadow = theme.ombraForte
    ? isLightText
      ? "0 22px 50px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset"
      : "0 20px 44px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.06)"
    : "0 8px 24px rgba(0,0,0,0.08)"

  const borderOuter =
    theme.bordoSottile && !isLightText
      ? "1px solid rgba(15,23,42,0.08)"
      : theme.bordoSottile && isLightText
        ? "1px solid rgba(255,255,255,0.12)"
        : "none"

  return (
    <div
      className={className}
      style={{
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top center",
        width: 340,
        maxWidth: "100%",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          ...(timbriTot > 0 ? { minHeight: 232 } : { aspectRatio: "1.586 / 1" }),
          borderRadius: theme.radius,
          background: gradient,
          boxShadow,
          border: borderOuter,
          overflow: "hidden",
          fontFamily: 'system-ui, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            ...patternStyle,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -30,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: theme.accent,
            opacity: isLightText ? 0.22 : 0.14,
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -50,
            left: -20,
            width: 140,
            height: 140,
            borderRadius: "50%",
            background: theme.accent,
            opacity: isLightText ? 0.15 : 0.1,
            filter: "blur(4px)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            height: "100%",
            padding: "18px 20px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxSizing: "border-box",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  {theme.mostraLogo && logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      style={{
                        width: 36,
                        height: 36,
                        objectFit: "contain",
                        borderRadius: 8,
                        background: isLightText ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.9)",
                        padding: 4,
                      }}
                    />
                  ) : null}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: fgMuted,
                      }}
                    >
                      {tenantNome || "Locale"}
                    </div>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 800,
                        color: fg,
                        lineHeight: 1.2,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {programmaNome || "Fidelity"}
                    </div>
                  </div>
                </div>
                {theme.subtitle ? (
                  <div style={{ fontSize: 12, color: fgSoft, marginTop: 2, lineHeight: 1.35 }}>{theme.subtitle}</div>
                ) : null}
              </div>
              <div
                style={{
                  textAlign: "right",
                  flexShrink: 0,
                  padding: "8px 12px",
                  borderRadius: Math.max(10, theme.radius - 6),
                  background: glassBg,
                  border: `1px solid ${glassBorder}`,
                  backdropFilter: "blur(10px)",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, color: fgMuted, letterSpacing: "0.06em" }}>
                  {theme.labelPunti}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: theme.accent, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
                  {Number.isFinite(Number(punti)) ? punti : 0}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: fgMuted, marginBottom: 4 }}>Intestatario</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: fg, letterSpacing: "0.01em" }}>
                {titoloIntestatario}
              </div>
              {sottoIntestatario ? (
                <div style={{ fontSize: 12, color: fgSoft, marginTop: 4, lineHeight: 1.35 }}>
                  Anagrafica: {sottoIntestatario}
                </div>
              ) : null}
            </div>

            {timbriTot > 0 ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: fgMuted, letterSpacing: "0.08em", marginBottom: 8 }}>
                  Scheda timbri ({suScheda}/{timbriTot})
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    maxWidth: "100%",
                  }}
                >
                  {Array.from({ length: timbriTot }, (_, i) => {
                    const filled = i < suScheda
                    return (
                      <div
                        key={i}
                        title={filled ? "Timbro" : "Vuoto"}
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: "50%",
                          boxSizing: "border-box",
                          background: filled ? theme.accent : "transparent",
                          border: filled ? `1px solid ${theme.accent}` : `1.5px dashed ${fgSoft}`,
                          opacity: filled ? 1 : 0.55,
                        }}
                      />
                    )
                  })}
                </div>
                {nextPr ? (
                  <div style={{ fontSize: 11, color: fgMuted, marginTop: 10, lineHeight: 1.4 }}>
                    Prossimo premio a <strong style={{ color: fg }}>{nextPr.soglia}</strong> timbri: {nextPr.descrizione}
                    {suScheda > 0 && nextPr.soglia > suScheda ? (
                      <span>
                        {" "}
                        (mancano {nextPr.soglia - suScheda})
                      </span>
                    ) : null}
                  </div>
                ) : listaPremi.length > 0 ? (
                  <div style={{ fontSize: 11, color: fgSoft, marginTop: 8, lineHeight: 1.4 }}>
                    Tutti i premi di questa scheda sono stati raggiunti; al completamento riparti da una nuova scheda.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                padding: "12px 14px",
                borderRadius: Math.max(8, theme.radius - 8),
                background: glassBg,
                border: `1px solid ${glassBorder}`,
                backdropFilter: "blur(12px)",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: fgMuted, letterSpacing: "0.1em", marginBottom: 6 }}>
                {theme.labelCodice}
              </div>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 800,
                  letterSpacing: "0.28em",
                  color: fg,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {(codiceCarta || "········").slice(0, 12)}
              </div>
            </div>
            {theme.mostraQr ? (
              <div
                style={{
                  background: "#fff",
                  padding: 6,
                  borderRadius: 10,
                  flexShrink: 0,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                }}
              >
                <QRCodeSVG value={qrValue} size={64} level="M" marginSize={0} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
