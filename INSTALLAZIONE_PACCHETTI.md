# Comandi per installare i pacchetti – PizzaManager

Esegui questi comandi **da Cursor** (terminale integrato) nella root del progetto o nelle cartelle indicate.

---

## 1) Root progetto (frontend React + dipendenze condivise)

```bash
cd d:\APP_PIZZERIA\PizzaManagerApp
npm install
```

Se vuoi solo il frontend e non usi NestJS/Prisma in root, va bene così. Se invece in root hai anche backend, tieni le dipendenze che hai già.

---

## 2) Backend NestJS + Prisma (pizzeria-backend)

```bash
cd d:\APP_PIZZERIA\PizzaManagerApp\server\pizzeria-backend
npm install
```

Pacchetti già presenti qui: `@prisma/client`, `prisma`, `argon2`, `@nestjs/jwt`, `bcrypt`, ecc.

**Dopo aver modificato lo schema Prisma:**

```bash
npx prisma generate
npx prisma migrate dev --name enterprise_saas
npx prisma db seed
```

---

## 3) Pacchetti opzionali per SaaS enterprise (stesso folder backend)

Se vuoi aggiungere **Stripe** (billing) e **validazione**:

```bash
cd d:\APP_PIZZERIA\PizzaManagerApp\server\pizzeria-backend
npm install stripe
npm install class-validator class-transformer
```

(`class-validator` e `class-transformer` sono già nel package.json del backend; stripe va aggiunto quando fai billing.)

---

## 4) Server Express (se usi `server/` con Express)

```bash
cd d:\APP_PIZZERIA\PizzaManagerApp\server
npm install
```

Qui di solito ci sono: `express`, `cors`, `dotenv`, `pg`. Se usi Prisma anche da Express, aggiungi:

```bash
npm install @prisma/client
npm install prisma -D
```

E nella root del progetto (dove c’è il `schema.prisma` del backend Nest), genera il client da lì (vedi punto 2).

---

## 5) Riepilogo rapido (solo ciò che serve per andare online)

**Solo frontend (Vite + React):**
```bash
cd d:\APP_PIZZERIA\PizzaManagerApp
npm install
npm run build
```

**Backend Nest (API + DB):**
```bash
cd d:\APP_PIZZERIA\PizzaManagerApp\server\pizzeria-backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run build
npm run start:prod
```

**Variabili d’ambiente:**  
Crea `.env` in `server/pizzeria-backend` con almeno:
- `DATABASE_URL` (PostgreSQL / Supabase)
- `JWT_SECRET` (per il login)

---

## 6) Dove eseguire i comandi in Cursor

1. Apri il terminale in Cursor (`` Ctrl+` `` o View → Terminal).
2. Scegli la cartella corretta con `cd` (es. `d:\APP_PIZZERIA\PizzaManagerApp` o `...\server\pizzeria-backend`).
3. Incolla e lancia i comandi sopra.

Dopo aver installato e configurato `.env`, puoi andare online (build + deploy del frontend e avvio del backend su un host Node).
