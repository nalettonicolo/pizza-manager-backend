# API pubbliche OAuth (stub enterprise)

Stato: **schema DB + roadmap**; endpoint OAuth2 non ancora esposti in Nest.

## Tabella

`public.api_oauth_clients` (modulo SQL 25):

- `client_id`, `client_secret_hash`, `tenant_id`, `scopes[]`, `attivo`
- RLS: solo superadmin

## Scopes previsti

- `read:ordini`, `write:ordini` (webhook partner)
- `read:catalogo`

## Implementazione consigliata

1. **Nest** (`server/pizzeria-backend`): module `OAuthModule` con Authorization Code + PKCE.
2. Oppure **Supabase JWT custom** con claim `tenant_id` + `scope` per client machine-to-machine.
3. Rate limit per `client_id` + audit in `core.audit_log`.

## Prossimo passo

- Generare client da Super Admin UI
- Esporre `/oauth/token` e `/api/v1/ordini` con Bearer token
