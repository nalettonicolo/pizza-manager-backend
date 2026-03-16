import { useState, useEffect, useRef } from "react"
import { UtensilsCrossed, ListOrdered, Flame, Wine, Cake, ChevronDown } from "lucide-react"

const FIXED_SLUGS = ["fritti", "bibite", "dolci"]

/** Categorie da mostrare nel dropdown "Categorie" (solo pizze: classiche, speciali, bianche, chiuse) */
const PIZZA_CATEGORY_SLUGS = ["classiche", "speciali", "bianche", "chiuse"]

const FIXED_STYLE = {
  fritti: { Icon: Flame, color: "#e65100" },
  bibite: { Icon: Wine, color: "#1565c0" },
  dolci: { Icon: Cake, color: "#7b1fa2" },
}

function getCategoryKey(nome) {
  return (nome || "").toLowerCase().trim()
}

export default function CategoryTabs({
  categories = [],
  activeCategory,
  onSelect,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dropdownOpen])

  if (!categories.length) {
    return null
  }

  const fixedCats = FIXED_SLUGS.map((slug) => categories.find((c) => getCategoryKey(c.nome) === slug)).filter(Boolean)
  const pizzaCategories = categories.filter((c) => PIZZA_CATEGORY_SLUGS.includes(getCategoryKey(c.nome)))
  const dropdownCategories = pizzaCategories.length > 0 ? pizzaCategories : categories.filter((c) => !FIXED_SLUGS.includes(getCategoryKey(c.nome)))

  return (
    <div style={styles.section}>
      <div style={styles.menuTitle}>
        <UtensilsCrossed size={20} style={{ color: "#e65100", flexShrink: 0 }} />
        <span style={styles.menuTitleText}>Menú</span>
      </div>
      <div style={styles.wrapper}>
        {/* Tasto Categorie: apre elenco categorie esistenti */}
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button
            type="button"
            style={{
              ...styles.tab,
              ...(activeCategory ? {} : styles.tabActiveCategorie),
              minWidth: 140,
            }}
            onClick={() => setDropdownOpen((v) => !v)}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
          >
            <ListOrdered size={18} style={{ color: "#2e7d32", flexShrink: 0 }} />
            <span>Categorie</span>
            <ChevronDown size={16} style={{ marginLeft: 4, opacity: dropdownOpen ? 1 : 0.7 }} />
          </button>
          {dropdownOpen && (
            <ul
              role="listbox"
              style={styles.dropdown}
              aria-label="Categorie pizze"
            >
              {dropdownCategories.map((cat) => {
                const isSelected = activeCategory === cat.id
                return (
                  <li
                    key={cat.id}
                    role="option"
                    aria-selected={isSelected}
                    style={{
                      ...styles.dropdownItem,
                      ...(isSelected ? styles.dropdownItemActive : {}),
                    }}
                    onClick={() => {
                      onSelect(cat.id)
                      setDropdownOpen(false)
                    }}
                  >
                    {cat.nome}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Fritti, Bibite, Dolci solo se abilitati (presenti nelle categorie) */}
        {fixedCats.map((cat) => {
          const key = getCategoryKey(cat.nome)
          const style = FIXED_STYLE[key] || { Icon: ListOrdered, color: "#616161" }
          const { Icon, color } = style
          const isActive = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              style={{
                ...styles.tab,
                ...(isActive ? { ...styles.tabActive, borderColor: color, background: color } : {}),
              }}
              onClick={() => onSelect(cat.id)}
            >
              <Icon size={18} style={{ color: isActive ? "#fff" : color, flexShrink: 0 }} />
              <span>{cat.nome}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  section: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "1px solid #eee",
  },
  menuTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  menuTitleText: {
    fontSize: 16,
    fontWeight: 600,
    color: "#e65100",
  },
  wrapper: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  tab: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#ddd",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
    fontSize: 14,
    color: "#424242",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  tabActiveCategorie: {
    borderColor: "#2e7d32",
    background: "#2e7d32",
    color: "#fff",
  },
  tabActive: {
    color: "#fff",
    boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 4,
    padding: 4,
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    listStyle: "none",
    minWidth: 180,
    maxHeight: 280,
    overflowY: "auto",
    zIndex: 50,
  },
  dropdownItem: {
    padding: "10px 12px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    color: "#424242",
  },
  dropdownItemActive: {
    background: "#e8f5e9",
    color: "#2e7d32",
    fontWeight: 600,
  },
}
