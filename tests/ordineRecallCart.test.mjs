import test from "node:test"
import assert from "node:assert/strict"
import {
  emailsMatchLoose,
  phonesMatchLoose,
  orderLineToPublicCartItem,
  orderLinesToPublicCartItems,
  ordineStatoIncompleto,
} from "../src/utils/ordineRecallCart.js"

test("phonesMatchLoose normalizza e confronta suffissi", () => {
  assert.equal(phonesMatchLoose("049 1234567", "0491234567"), true)
  assert.equal(phonesMatchLoose("+39 333 1112233", "3331112233"), true)
  assert.equal(phonesMatchLoose("111", "222"), false)
})

test("emailsMatchLoose case-insensitive", () => {
  assert.equal(emailsMatchLoose("A@B.it", "a@b.it"), true)
  assert.equal(emailsMatchLoose("", "a@b.it"), false)
})

test("orderLineToPublicCartItem mappa summary e qty", () => {
  const item = orderLineToPublicCartItem({
    prodotto_id: "p1",
    prodotto_nome: "Margherita",
    quantita: 2,
    prezzo: 7.5,
    formato_nome: "Normale",
    ingredienti_cottura_summary: "senza cipolla",
  })
  assert.equal(item.id, "p1")
  assert.equal(item.qty, 2)
  assert.equal(item.formatoNome, "Normale")
  assert.equal(item.ingredientiCotturaSummary, "senza cipolla")
})

test("orderLinesToPublicCartItems ignora righe senza prodotto", () => {
  const items = orderLinesToPublicCartItems([
    { prodotto_id: "a", prodotto_nome: "A", quantita: 1, prezzo: 1 },
    { prodotto_nome: "no-id", quantita: 1, prezzo: 1 },
  ])
  assert.equal(items.length, 1)
})

test("ordineStatoIncompleto riconosce IN_ATTESA e pagamento in attesa", () => {
  assert.equal(ordineStatoIncompleto({ stato: "IN_ATTESA" }), true)
  assert.equal(ordineStatoIncompleto({ stato: "PRONTO", tipo_pagamento: "Carta (Stripe — in attesa)" }), true)
  assert.equal(ordineStatoIncompleto({ stato: "CONSEGNATO", tipo_pagamento: "Contanti" }), false)
})
