/**
 * Campo ricerca coerente per elenchi Super Admin (tabelle, card, liste).
 */
export default function SaListSearchField({
  id = "sa-list-search",
  value,
  onChange,
  placeholder = "Cerca nell'elenco…",
  resultsCount,
  totalCount,
  className = "",
}) {
  const showMeta =
    typeof resultsCount === "number" && typeof totalCount === "number" && totalCount > 0;

  return (
    <div className={`sa-list-search-field${className ? ` ${className}` : ""}`}>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="sa-list-search-input"
        autoComplete="off"
        spellCheck={false}
        aria-label="Cerca nell'elenco"
      />
      {showMeta ? (
        <span className="sa-list-search-meta" aria-live="polite">
          {resultsCount === totalCount ? `${totalCount} voci` : `${resultsCount} su ${totalCount}`}
        </span>
      ) : null}
    </div>
  );
}
