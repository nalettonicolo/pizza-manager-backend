import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/app/contexts/TenantContext";
import { resolveMenuTheme } from "@/utils/tenantMenuTheme";
import "@/styles/webappPreview.css"

export default function WebAppPreview() {
  const { tenantData } = useTenant();
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [debug, setDebug] = useState(null)

  const menuTheme = resolveMenuTheme(tenantData?.parametri_operativi);
  const themeStyle = menuTheme ? {
    "--menu-primary": menuTheme.primary,
    "--menu-accent": menuTheme.accent,
    "--menu-background": menuTheme.background,
    "--menu-card-background": menuTheme.cardBackground,
  } : {};

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      console.log("DEBUG ENV:", import.meta.env.VITE_SUPABASE_URL)

      const catRes = await supabase
        .from("categories")
        .select("*")
        .order("order_index")

      const prodRes = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("order_index")

      console.log("CATEGORIES RESPONSE:", catRes)
      console.log("PRODUCTS RESPONSE:", prodRes)

      setCategories(catRes.data || [])
      setProducts(prodRes.data || [])

      setDebug({
        env: import.meta.env.VITE_SUPABASE_URL,
        categoriesStatus: catRes.status,
        categoriesError: catRes.error,
        categoriesCount: catRes.data?.length || 0,
        productsStatus: prodRes.status,
        productsError: prodRes.error,
        productsCount: prodRes.data?.length || 0,
      })

    } catch (err) {
      console.error("FATAL ERROR:", err)
      setDebug({ fatal: err.message })
    }
  }

  const getProductsByCategory = (categoryId) =>
    products.filter((p) => p.category_id === categoryId)

  return (
    <div className="preview-wrapper" style={themeStyle}>

      {/* DEBUG PANEL */}
      {debug && (
        <div style={{
          background: "#111",
          color: "#00ff00",
          padding: "10px",
          fontSize: "12px",
          maxHeight: "250px",
          overflow: "auto"
        }}>
          <strong>DEBUG INFO</strong>
          <pre>{JSON.stringify(debug, null, 2)}</pre>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="preview-navbar">
        <div className="logo">PizzaManager</div>
        <div className="nav-links">
          {categories.map((cat) => (
            <a key={cat.id} href={`#cat-${cat.id}`}>
              {cat.name}
            </a>
          ))}
        </div>
      </nav>

      {/* HERO */}
      <section className="preview-hero">
        <div className="hero-overlay">
          <h1>La vera pizza artigianale</h1>
          <p>Tutti i prezzi sono IVA inclusa</p>
          <div className="hero-buttons">
            <button className="cta-primary">Ordina Online</button>
            <button className="cta-secondary">Chiama Ora</button>
          </div>
        </div>
      </section>

      {/* MENU */}
      <section className="preview-menu">
        {categories.map((cat) => (
          <div key={cat.id} id={`cat-${cat.id}`} className="category-section">
            <h2>{cat.name}</h2>

            <div className="menu-grid">
              {getProductsByCategory(cat.id).map((prod) => (
                <div key={prod.id} className="menu-card">
                  <h3>{prod.name}</h3>
                  {prod.description && (
                    <p className="description">{prod.description}</p>
                  )}
                  <div className="price">
                    € {Number(prod.price).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* CHI SIAMO */}
      <section className="about-section">
        <h2>Chi Siamo</h2>
        <p>
          Da oltre 20 anni portiamo a casa tua la vera pizza italiana,
          preparata con ingredienti freschi e selezionati.
        </p>
      </section>

      {/* FOOTER */}
      <footer className="preview-footer">
        <div>© 2026 Nome Pizzeria</div>
        <div>Via Roma 123 - Tel: 0123 456789</div>
      </footer>

    </div>
  )
}
