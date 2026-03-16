export default function SearchBar({ value, onChange, placeholder = "Cerca..." }) {
  return (
    <div className="dashboard-search-wrap">
      <input
        type="search"
        className="dashboard-search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
