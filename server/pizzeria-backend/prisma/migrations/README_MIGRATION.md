# Migrazioni Prisma – PizzaManager Enterprise

Dopo aver aggiornato lo schema:

1. **Genera il client e crea la migrazione**
   ```bash
   cd server/pizzeria-backend
   npx prisma generate
   npx prisma migrate dev --name enterprise_saas
   ```

2. **Se il DB ha già tabelle senza slug/piano/subscriptions**
   - Creare una migrazione manuale che aggiunga le colonne (slug, piano, updatedAt su tenants; last_login, attivo, deletedAt su users; tabella subscriptions; tabella audit_logs; deleted_at sulle altre tabelle) oppure
   - Reset solo in dev: `npx prisma migrate reset` (cancella i dati)

3. **Seed**
   ```bash
   npx prisma db seed
   ```

Credenziali seed: `admin@pizzeria.it` / `password123`
