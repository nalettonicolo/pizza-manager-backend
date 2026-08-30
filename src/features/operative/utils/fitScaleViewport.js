/**
 * Scala un viewport di design (es. 1280×800) dentro un contenitore, senza deformare.
 * @returns {{ scale: number, x: number, y: number }}
 */
export function fitScaleViewport(containerW, containerH, designW, designH) {
  const cw = Number(containerW)
  const ch = Number(containerH)
  const dw = Number(designW)
  const dh = Number(designH)
  if (!(cw > 0) || !(ch > 0) || !(dw > 0) || !(dh > 0)) {
    return { scale: 0, x: 0, y: 0 }
  }
  const scale = Math.min(cw / dw, ch / dh)
  return {
    scale,
    x: (cw - dw * scale) / 2,
    y: (ch - dh * scale) / 2,
  }
}
