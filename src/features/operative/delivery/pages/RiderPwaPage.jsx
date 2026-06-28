import { useEffect } from "react"
import DeliveryDashboard from "@/features/operative/delivery/pages/DeliveryDashboard"

/**
 * Vista rider mobile-first: stesso flusso delivery, layout ottimizzato per smartphone / PWA.
 */
export default function RiderPwaPage() {
  useEffect(() => {
    const prev = document.body.style.background
    document.body.style.background = "#f1f5f9"
    const link = document.createElement("link")
    link.rel = "manifest"
    link.href = "/manifest-rider.webmanifest"
    document.head.appendChild(link)
    return () => {
      document.body.style.background = prev
      link.remove()
    }
  }, [])

  return (
    <div
      style={{
        minHeight: "100dvh",
        maxWidth: 480,
        margin: "0 auto",
        background: "#f8fafc",
        boxShadow: "0 0 0 1px #e2e8f0",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding: "12px 16px",
          background: "#0f172a",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <strong style={{ fontSize: 16 }}>Rider</strong>
        <span style={{ fontSize: 11, opacity: 0.85 }}>PWA</span>
      </header>
      <DeliveryDashboard />
    </div>
  )
}
