import { formatPrice } from "@/utils/format";

export default function PizzaMenuPreview({ items = [] }) {
  return (
    <div style={{ padding: 20 }}>
      <h2>Anteprima Menu</h2>
      {items.length === 0 ? (
        <p>Nessun prodotto.</p>
      ) : (
        items.map((item) => (
          <div key={item.id}>
            {item.nome} - € {formatPrice(item.prezzo)}
          </div>
        ))
      )}
    </div>
  )
}
