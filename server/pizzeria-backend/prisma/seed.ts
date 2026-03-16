/**
 * PIZZAMANAGER – Seed completo
 * - Crea tenant, configurazione, ingredienti base (Pomodoro, Mozzarella), prodotti demo.
 * - Sincronizza utenti da Auth (auth.users) in core.users e public.utenti_ruoli.
 * - Costo base pizza = già comprensivo costi pizzeria; costo impasto si aggiunge al prezzo base + ingredienti.
 *
 * Routing: dominio pizzamanager.it → landing; SUPERADMIN → sue pagine; ADMIN/OPERATORE → area tenant.
 * Utenti operativi: stesso dominio @pizzamanager.it → ruolo OPERATORE (se non mappati da UUID/email).
 */

import { PrismaClient, Ruolo } from '@prisma/client'

const prisma = new PrismaClient()

// ---------- Utenti Auth verificati (UUID e email da Supabase Dashboard) ----------
// 0683a615-d08a-488d-b9df-3a486b35a461 → admin@pizzamanager.it     → SUPERADMIN
// 9bad7fd3-d2c2-409b-9402-adedbb4f196f → admin.puntovendita1@pizzamanager.it → ADMIN (punto vendita 1)
// Operativi PizzaManager Pizzeria Demo (@pizzamanager.it, password 21LuglioFra!)
const AUTH_USER_UUID_TO_ROLE: Record<string, Ruolo> = {
  '0683a615-d08a-488d-b9df-3a486b35a461': Ruolo.SUPERADMIN,
  '9bad7fd3-d2c2-409b-9402-adedbb4f196f': Ruolo.ADMIN,
  'a573dc82-7779-4e34-8e06-3ae4d5af081a': Ruolo.OPERATORE, // pizzaioli
  '64e4379c-3434-412e-8dcf-03d68455e2d2': Ruolo.OPERATORE, // bancone
  '07027829-66f0-4516-95c8-82a259c3f3bb': Ruolo.OPERATORE, // cassa
  'a9dbeebe-e24c-4336-9cf9-1adc1d92291c': Ruolo.OPERATORE, // cucina
  '9332986e-51cf-47b3-8f66-a01d39ffdf4c': Ruolo.OPERATORE, // pony1
  '9a3e9bc4-93c3-42af-8515-f3cdd7709ef7': Ruolo.OPERATORE, // pony2
}

/** Fallback email → ruolo (coerente con UUID sopra). Altri @pizzamanager.it → OPERATORE. */
const EMAIL_TO_ROLE: Record<string, Ruolo> = {
  'admin@pizzamanager.it': Ruolo.SUPERADMIN,
  'admin.puntovendita1@pizzamanager.it': Ruolo.ADMIN,
}

const PIZZAMANAGER_DOMAIN = '@pizzamanager.it'

type AuthUser = { id: string; email: string | null; raw_user_meta_data: unknown }

function getNomeFromMeta(meta: unknown): string | null {
  if (meta && typeof meta === 'object' && 'full_name' in meta) return (meta as { full_name: string }).full_name as string
  if (meta && typeof meta === 'object' && 'name' in meta) return (meta as { name: string }).name as string
  return null
}

function ruoloToUtentiRuoliText(ruolo: Ruolo): string {
  const map: Record<Ruolo, string> = {
    [Ruolo.SUPERADMIN]: 'superadmin',
    [Ruolo.OWNER]: 'owner',
    [Ruolo.ADMIN]: 'admin',
    [Ruolo.OPERATORE]: 'operatore',
  }
  return map[ruolo] ?? 'operatore'
}

/** Ruolo: prima UUID (verificati), poi email, poi operativi @pizzamanager.it → OPERATORE. */
function resolveRuolo(authUserId: string, email: string): Ruolo {
  const byUuid = AUTH_USER_UUID_TO_ROLE[authUserId]
  if (byUuid) return byUuid
  const byEmail = EMAIL_TO_ROLE[email]
  if (byEmail) return byEmail
  if (email.endsWith(PIZZAMANAGER_DOMAIN)) return Ruolo.OPERATORE
  return Ruolo.OPERATORE
}

async function main() {
  // ---------- 1) Tenant e dati operativi demo ----------
  let tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        nome: 'Pizzeria Demo',
        slug: 'pizzeria-demo',
        piano: 'PRO',
        attivo: true,
      },
    })
    console.log('✅ Tenant creato:', tenant.nome)
  }

  // Costo base pizza = già comprensivo costi pizzeria; costo impasto si aggiunge al prezzo (base + impasto + ingredienti)
  if (!(await prisma.configurazioneCosti.findUnique({ where: { tenantId: tenant.id } }))) {
    await prisma.configurazioneCosti.create({
      data: {
        tenantId: tenant.id,
        costoImpasto: 0.45,  // aggiunto al prezzo base + ingredienti
        costoEnergia: 0.3,
      },
    })
    console.log('✅ Configurazione costi creata (costo impasto aggiunto a base + ingredienti)')
  }

  const mozzarella = await prisma.ingrediente.findFirst({
    where: { tenantId: tenant.id, nome: 'Mozzarella', deletedAt: null },
  })
  if (!mozzarella) {
    // Prezzo ingredienti = unitario (in creazione). In admin calcolo costi/margini si mostra prezzo al chilo (unita_misura kg).
    const [m, p] = await Promise.all([
      prisma.ingrediente.create({
        data: { nome: 'Mozzarella', costoUnitario: 0.8, unitaMisura: 'kg', tenantId: tenant.id },
      }),
      prisma.ingrediente.create({
        data: { nome: 'Pomodoro', costoUnitario: 0.4, unitaMisura: 'kg', tenantId: tenant.id },
      }),
    ])
    // costo_base_produzione = base pizza già comprensiva dei costi pizzeria; impasto da configurazione si somma
    const margherita = await prisma.prodotto.create({
      data: {
        nome: 'Margherita',
        prezzo: 8.0,
        costoBaseProduzione: 2.5,  // base pizza comprensiva; + impasto + ingredienti = costo totale
        tenantId: tenant.id,
      },
    })
    await prisma.prodottoIngrediente.createMany({
      data: [
        { tenantId: tenant.id, prodottoId: margherita.id, ingredienteId: m.id, quantita: 1 },
        { tenantId: tenant.id, prodottoId: margherita.id, ingredienteId: p.id, quantita: 1 },
      ],
    })
    console.log('✅ Ingredienti base (Pomodoro, Mozzarella) e prodotto Margherita creati')
  }

  // ---------- 2) Sync da Auth: auth.users → core.users + public.utenti_ruoli ----------
  let authUsers: AuthUser[] = []
  try {
    authUsers = await prisma.$queryRaw<AuthUser[]>`
      SELECT id, email, raw_user_meta_data FROM auth.users
    `
  } catch (e) {
    console.warn('⚠️ Lettura auth.users non disponibile (schema auth assente o permessi). Salto sync utenti da Auth.')
  }

  for (const au of authUsers) {
    const email = au.email ?? ''
    if (!email) continue
    const ruolo = resolveRuolo(au.id, email)
    const nome = getNomeFromMeta(au.raw_user_meta_data) ?? 'Utente'

    await prisma.user.upsert({
      where: { id: au.id },
      create: {
        id: au.id,
        email,
        password: '',
        nome,
        ruolo,
        tenantId: tenant.id,
        attivo: true,
      },
      update: {
        email,
        nome,
        ruolo,
        tenantId: tenant.id,
        updatedAt: new Date(),
      },
    })

    const ruoloText = ruoloToUtentiRuoliText(ruolo)
    await prisma.$executeRaw`
      INSERT INTO public.utenti_ruoli (user_id, ruolo, tenant_id)
      VALUES (${au.id}::uuid, ${ruoloText}, ${tenant.id}::uuid)
      ON CONFLICT (user_id) DO UPDATE SET ruolo = EXCLUDED.ruolo, tenant_id = EXCLUDED.tenant_id
    `
  }
  if (authUsers.length > 0) {
    console.log(`✅ Sincronizzati ${authUsers.length} utenti da Auth in core.users e public.utenti_ruoli`)
    const superadmin = authUsers.find((u) => u.id === '0683a615-d08a-488d-b9df-3a486b35a461')
    const adminPv1 = authUsers.find((u) => u.id === '9bad7fd3-d2c2-409b-9402-adedbb4f196f')
    if (superadmin) console.log('   → Superadmin:', superadmin.email)
    if (adminPv1) console.log('   → Admin Punto Vendita 1:', adminPv1.email)
  }

  console.log('✅ Seed completato.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
