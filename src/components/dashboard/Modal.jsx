import { useEffect } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  closeOnOverlayClick = false,
  wide = false,
  /** Modale alta/larga (cassa modifica pizza): meno scroll interno su desktop */
  tall = false,
}) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = closeOnOverlayClick ? onClose : undefined;

  return (
    <div
      className={`dashboard-modal-overlay${tall ? " dashboard-modal-overlay--tall" : ""}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={[
          "dashboard-modal",
          wide ? "dashboard-modal--wide" : "",
          tall ? "dashboard-modal--tall" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dashboard-modal-header">
          <h3 className="dashboard-modal-title">{title}</h3>
          <button type="button" className="dashboard-modal-close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </div>
        <div className="dashboard-modal-body">{children}</div>
      </div>
    </div>
  );
}
