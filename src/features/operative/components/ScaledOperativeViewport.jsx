import { useLayoutEffect, useRef, useState } from "react"
import { fitScaleViewport } from "@/features/operative/utils/fitScaleViewport"

/** Viewport operativo tipico (tablet/POS landscape): le pagine si adattano a questa misura, poi si riducono nel riquadro. */
export const OPERATIVE_DESIGN_WIDTH = 1280
export const OPERATIVE_DESIGN_HEIGHT = 800

export default function ScaledOperativeViewport({
  children,
  designWidth = OPERATIVE_DESIGN_WIDTH,
  designHeight = OPERATIVE_DESIGN_HEIGHT,
}) {
  const clipRef = useRef(null)
  const [fit, setFit] = useState({ scale: 1, x: 0, y: 0 })

  useLayoutEffect(() => {
    const el = clipRef.current
    if (!el) return

    const update = () => {
      setFit(fitScaleViewport(el.clientWidth, el.clientHeight, designWidth, designHeight))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [designWidth, designHeight])

  return (
    <div ref={clipRef} className="reparti-quad-scale-clip">
      <div
        className="reparti-quad-scale-stage"
        style={{
          width: designWidth,
          height: designHeight,
          transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
