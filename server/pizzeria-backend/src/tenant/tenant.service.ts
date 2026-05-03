import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, Tenant } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Riga tenant come la consuma la SPA (snake_case, allineata a `public.tenants` / admin).
   * Prima `admin.tenants` (denormalizzato per SaaS), poi fallback `core.tenants` via Prisma.
   */
  async getTenantRowForJwtTenantId(tenantId: string | undefined) {
    if (!tenantId) {
      throw new NotFoundException('Tenant non nel token')
    }

    try {
      const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`SELECT * FROM admin.tenants WHERE id = ${tenantId}::uuid LIMIT 1`,
      )
      if (rows.length > 0) {
        return this.serializeRow(rows[0])
      }
    } catch {
      /* tabella assente, permessi, ecc. → fallback core */
    }

    const core = await this.prisma.tenant.findFirst({
      where: { id: tenantId, deletedAt: null },
    })
    if (!core) {
      throw new NotFoundException('Tenant non trovato')
    }
    return this.mapCoreTenant(core)
  }

  private serializeRow(row: Record<string, unknown>) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) out[k] = v.toISOString()
      else out[k] = v
    }
    return out
  }

  private mapCoreTenant(t: Tenant) {
    return {
      id: t.id,
      nome: t.nome,
      slug: t.slug,
      piano: t.piano.toLowerCase(),
      attivo: t.attivo,
      created_at: t.createdAt.toISOString(),
      stripe_customer_id: null,
      stripe_subscription_id: null,
      logo_url: null,
      email: null,
      telefono: null,
      indirizzo: null,
      lat: null,
      lng: null,
      parametri_operativi: {},
      orari_settimana: null,
      partita_iva: t.partitaIva ?? null,
      email_fatturazione: t.emailFatturazione ?? null,
      pec: t.pec ?? null,
      codice_univoco_sdi: t.codiceUnivocoSdi ?? null,
      addebito_automatico_mensile: t.addebitoAutomaticoMensile,
      data_attivazione_abbonamento: t.dataAttivazioneAbbonamento
        ? t.dataAttivazioneAbbonamento.toISOString().slice(0, 10)
        : null,
      sconto_percentuale:
        t.scontoPercentuale != null ? Number(t.scontoPercentuale) : null,
    }
  }
}
