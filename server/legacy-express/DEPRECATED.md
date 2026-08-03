# Backend Express legacy — NON SUPPORTATO

Questo materiale è **archiviato** e **non va avviato, deployato o manutenuto**.

| Stato | Dettaglio |
|--------|-----------|
| Backend ufficiale | `server/pizzeria-backend` (NestJS + Prisma) |
| File storico | `server.js.bak` (ex `server/server.js`) |
| Problema | Importava `./src/...` da una cartella `server/src` **inesistente** |

## Cosa usare

```bash
cd server/pizzeria-backend
npm ci
npm run start:prod   # o start:dev in locale
```

Variabili: `server/pizzeria-backend/.env` (non in git). Frontend: `VITE_API_URL`.

Hardening già previsti in Nest: Helmet, CORS esplicito (obbligatorio in production), Throttler globale + limiti più stretti su login/API pubbliche, Swagger solo se `SWAGGER_ENABLED=true`.
