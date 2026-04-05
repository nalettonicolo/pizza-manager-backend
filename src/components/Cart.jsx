import PropTypes from "prop-types"

function Cart({ items, onRemove, onClear, onCheckout }) {
  const total = items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  )

  return (
    <div className="bg-white shadow-md rounded-xl p-4 w-full">
      <h2 className="text-xl font-bold mb-4">Carrello</h2>

      {items.length === 0 ? (
        <p className="text-gray-500">Nessun prodotto nel carrello</p>
      ) : (
        <>
          <ul className="space-y-3 mb-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex justify-between items-center border-b pb-2"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    € {item.price.toFixed(2)} x {item.quantity}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  Rimuovi
                </button>
              </li>
            ))}
          </ul>

          <div className="flex justify-between font-bold text-lg mb-4">
            <span>Totale:</span>
            <span>€ {total.toFixed(2)}</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClear}
              className="flex-1 bg-gray-200 hover:bg-gray-300 py-2 rounded-lg"
            >
              Svuota
            </button>

            <button
              type="button"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={typeof onCheckout !== "function"}
              title={typeof onCheckout !== "function" ? "Checkout non collegato in questa vista" : undefined}
              onClick={() => onCheckout?.()}
            >
              Pagamento
            </button>
          </div>
        </>
      )}
    </div>
  )
}

Cart.propTypes = {
  items: PropTypes.array.isRequired,
  onRemove: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  onCheckout: PropTypes.func,
}

export default Cart