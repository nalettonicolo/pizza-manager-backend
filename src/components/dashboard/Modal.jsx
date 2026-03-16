import { useEffect } from "react";

export default function Modal({ open, onClose, title, children, closeOnOverlayClick = false, wide = false }) {
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
      className="dashboard-modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={wide ? "dashboard-modal dashboard-modal--wide" : "dashboard-modal"}
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
