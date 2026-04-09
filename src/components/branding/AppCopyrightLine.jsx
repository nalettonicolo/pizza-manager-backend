export const PM_COPYRIGHT_TEXT = "© 2026 PizzaManager di Naletto Nicolò";

export default function AppCopyrightLine({ className }) {
  return (
    <p className={className} role="contentinfo">
      {PM_COPYRIGHT_TEXT}
    </p>
  );
}
