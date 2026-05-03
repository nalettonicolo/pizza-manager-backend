import { Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PuntiVenditaService {
  private readonly logger = new Logger(PuntiVenditaService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Elenco punti vendita del tenant nel JWT (`core.punti_vendita`).
   * Allinea la SPA che oggi legge `public.punti_vendita` via PostgREST.
   */
  async listForJwtTenant(tenantId: string | undefined) {
    if (!tenantId) return []

    try {
      const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(
        Prisma.sql`
          SELECT *
          FROM core.punti_vendita
          WHERE tenant_id = ${tenantId}::uuid
          ORDER BY nome ASC NULLS LAST
        `,
      )
      return rows.map((row) => this.serializeRow(row))
    } catch (err: unknown) {
      this.logger.warn(
        `listForJwtTenant fallita (tenant=${tenantId}): ${err instanceof Error ? err.message : String(err)}`,
      )
      return []
    }
  }

  private serializeRow(row: Record<string, unknown>) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) out[k] = v.toISOString()
      else out[k] = v
    }
    return out
  }
}
