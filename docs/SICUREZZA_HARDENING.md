# Hardening sicurezza — PizzaManager

Obiettivo: avvicinare il perimetro a **“blindato”** in senso ingegneristico: difesa in profondità, minimo privilegio, verificabilità. **Nessun sistema è inviolabile**; l’obiettivo è ridurre superficie e avere **evidenze** (log, test, review).

## 1. Modello attuale (Supabase)

- **RLS** multi-tenant su tabelle esposte.
- **RPC `SECURITY DEFINER`** per operazioni transazionali (ordini, sostituzione righe, turni dove applicabile).
- **Auth** centralizzata; ruoli operativi in `utenti_ruoli`.

### Controlli continui

- [ ] Ogni nuova tabella in `public` / `core` esposta a PostgREST: **RLS + policy** documentate.
- [ ] Nessun `GRANT ALL` anonimo su tabelle tenant.
- [ ] Chiavi **Google Maps** / Stripe: solo env, referrer / restrizioni in produzione.
- [ ] **Secrets** mai in repo (`.env` in `.gitignore`, CI secrets).
- [ ] Log applicativi: niente PII completi in console produzione.

## 2. Crittografia database (chiarimento)

| Livello | Cosa significa | Quando |
|--------|----------------|--------|
| TLS | Traffico cifrato client↔Supabase / app↔DB | Sempre |
| At-rest (provider) | Disco cifrato lato cloud | Default su molti provider |
| TDE / volume | Cifratura storage DB | Enterprise / VPS curato |
| Colonna (AES) | Campo sensibile cifrato in cella | Token, note cliniche, ecc. — **complesso** |

**“Crittografia completa” del DB** in produzione significa di solito: **TLS + at-rest + backup cifrati** + gestione chiavi. La cifratura **per colonna di tutte le tabelle** è raramente praticabile per performance e query.

## 3. Verifica RLS in staging

Vedi `sql/scripts/README_VERIFY_RLS.md` (query guida + principi).

## 4. Future migrazione MySQL

Con MySQL **non** c’è RLS nativo: la “blindatura” si sposta su:

- API con **autorizzazione centralizzata** (per tenant, per ruolo).
- **Audit** append-only.
- **Least privilege** utente DB (solo stored procedure per scritture sensibili, opzionale).
- **Pen test** periodico da fornitore esterno (già citato in backlog).

## 5. Checklist release (minimo)

1. Diff SQL rivisto da due persone per patch sensibili.
2. Smoke su staging: login tenant A **non** vede dati tenant B.
3. Webhook pagamenti: verifica firma / idempotenza.
4. Dipendenze: `npm audit` / aggiornamenti pianificati.
