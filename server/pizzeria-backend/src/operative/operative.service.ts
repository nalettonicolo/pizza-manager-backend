import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class OperativeService {
  private readonly logger = new Logger(OperativeService.name)

  constructor(private readonly prisma: PrismaService) {}

  private jwtTenantRequired(jwtTenant: string | undefined) {
    if (!jwtTenant) throw new UnauthorizedException('Tenant non nel token')
    return jwtTenant
  }

  /** Allinea alla forma client `Ordine` (camelCase dove richiesto dalla SPA). */
  private mapOrdineRow(r: Record<string, unknown>) {
    const o = this.serializeRow(r)
    return {
      ...o,
      tenantId: o.tenant_id ?? o['tenantId'],
      createdAt: o.created_at ?? o['createdAt'],
      updatedAt: o.updated_at ?? o['updatedAt'],
      deletedAt: o.deleted_at ?? o['deletedAt'],
    }
  }

  private serializeRow(row: Record<string, unknown>) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) out[k] = v.toISOString()
      else if (v !== null && typeof v === 'object' && !(v instanceof Date)) out[k] = v
      else out[k] = v
    }
    return out
  }

  async listOrdini(
    jwtTenant: string | undefined,
    opts: {
      fromIso?: string
      toIso?: string
      limit?: number
      stato?: string
    },
  ) {
    const tenantId = this.jwtTenantRequired(jwtTenant)
    const limit = Math.min(500, Math.max(1, Number(opts.limit) || 50))
    const stato = opts.stato && String(opts.stato).trim() ? String(opts.stato).trim() : null

    let rows: Record<string, unknown>[]
    if (opts.fromIso && opts.toIso) {
      rows = stato
        ? await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
            SELECT o.*
            FROM core.ordini o
            WHERE o.tenant_id = ${tenantId}::uuid
              AND o.created_at >= ${opts.fromIso}::timestamptz
              AND o.created_at < ${opts.toIso}::timestamptz
              AND o.stato::text = ${stato}
            ORDER BY o.created_at DESC
            LIMIT ${limit}
          `)
        : await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
            SELECT o.*
            FROM core.ordini o
            WHERE o.tenant_id = ${tenantId}::uuid
              AND o.created_at >= ${opts.fromIso}::timestamptz
              AND o.created_at < ${opts.toIso}::timestamptz
            ORDER BY o.created_at DESC
            LIMIT ${limit}
          `)
    } else {
      rows = stato
        ? await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
            SELECT o.*
            FROM core.ordini o
            WHERE o.tenant_id = ${tenantId}::uuid
              AND o.stato::text = ${stato}
            ORDER BY o.created_at DESC
            LIMIT ${limit}
          `)
        : await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
            SELECT o.*
            FROM core.ordini o
            WHERE o.tenant_id = ${tenantId}::uuid
            ORDER BY o.created_at DESC
            LIMIT ${limit}
          `)
    }
    return rows.map((r) => this.mapOrdineRow(r))
  }

  async listCategorie(jwtTenant: string | undefined) {
    const tenantId = this.jwtTenantRequired(jwtTenant)
    try {
      const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT *
        FROM core.categorie
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY ordine ASC NULLS LAST, lower(nome) ASC
      `)
      return rows.map((r) => this.serializeRow(r))
    } catch (e) {
      this.logger.warn(`listCategorie: ${String(e)}`)
      return []
    }
  }

  async listIngredienti(jwtTenant: string | undefined) {
    const tenantId = this.jwtTenantRequired(jwtTenant)
    try {
      const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT *
        FROM core.ingredienti
        WHERE tenant_id = ${tenantId}::uuid
        ORDER BY nome ASC
      `)
      return rows.map((r) => this.serializeRow(r))
    } catch (e) {
      this.logger.warn(`listIngredienti: ${String(e)}`)
      return []
    }
  }

  async listProdotti(jwtTenant: string | undefined, categoriaId?: string) {
    const tenantId = this.jwtTenantRequired(jwtTenant)

    try {
      if (categoriaId && String(categoriaId).trim() !== '') {
        const cid = String(categoriaId).trim()
        const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
          SELECT
            id,
            nome,
            descrizione,
            prezzo,
            attivo,
            ordine,
            immagine_url,
            visibile_online,
            prep_cucina,
            tenant_id,
            categoria_id,
            created_at AS "createdAt",
            updated_at AS "updatedAt",
            deleted_at AS "deletedAt"
          FROM core.prodotti
          WHERE tenant_id = ${tenantId}::uuid
            AND categoria_id = ${cid}::uuid
            AND COALESCE(attivo, true) = true
          ORDER BY ordine ASC NULLS LAST, nome ASC
        `)
        return rows.map((r) => this.serializeRow(r))
      }

      const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT
          id,
          nome,
          descrizione,
          prezzo,
          attivo,
          ordine,
          immagine_url,
          visibile_online,
          prep_cucina,
          tenant_id,
          categoria_id,
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          deleted_at AS "deletedAt"
        FROM core.prodotti
        WHERE tenant_id = ${tenantId}::uuid
          AND COALESCE(attivo, true) = true
        ORDER BY ordine ASC NULLS LAST, nome ASC
      `)
      return rows.map((r) => this.serializeRow(r))
    } catch (e) {
      this.logger.warn(`listProdotti fallback SELECT * (${String(e)})`)
      try {
        const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
          SELECT *
          FROM core.prodotti
          WHERE tenant_id = ${tenantId}::uuid
          ORDER BY nome ASC
        `)
        return rows.map((r) => this.serializeRow(r))
      } catch (e2) {
        this.logger.warn(`listProdotti failed: ${String(e2)}`)
        return []
      }
    }
  }

  async getConfigurazioneCosti(jwtTenant: string | undefined) {
    const tenantId = this.jwtTenantRequired(jwtTenant)
    try {
      const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT *
        FROM core.configurazione_costi
        WHERE tenant_id = ${tenantId}::uuid
        LIMIT 1
      `)
      if (!rows?.length) return null
      return this.serializeRow(rows[0])
    } catch {
      return null
    }
  }

  /**
   * Stessa forma utile alla SPA di `getProductIngredientiBatch` (oggetti per prodotto con costi).
   */
  async batchProdottoIngredientiMerged(
    jwtTenant: string | undefined,
    productIds: string[],
  ): Promise<Record<string, unknown>> {
    const tenantId = this.jwtTenantRequired(jwtTenant)
    const uniqueIds = [...new Set((productIds || []).filter(Boolean).map(String))]
    const emptyOut = (): Record<string, unknown> =>
      Object.fromEntries(uniqueIds.map((id) => [id, []]))

    if (!uniqueIds.length) return {}

    try {
      const piRows = await this.prisma.$queryRaw<
        Array<{ prodotto_id: string; ingrediente_id: string | null; ordine: number | null }>
      >(Prisma.sql`
        SELECT prodotto_id, ingrediente_id, ordine
        FROM core.prodotto_ingrediente
        WHERE tenant_id = ${tenantId}::uuid
          AND prodotto_id IN (${Prisma.join(uniqueIds.map((id) => Prisma.sql`${id}::uuid`))})
        ORDER BY prodotto_id ASC, ordine ASC NULLS LAST
      `)

      const byProd: Record<string, typeof piRows> = {}
      for (const r of piRows) {
        const pid = r.prodotto_id
        if (!byProd[pid]) byProd[pid] = []
        byProd[pid].push(r)
      }

      const ingIds = [
        ...new Set(piRows.map((r) => r.ingrediente_id).filter(Boolean).map(String)),
      ] as string[]

      if (!ingIds.length) return emptyOut()

      const ingRows = await this.prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT *
        FROM core.ingredienti
        WHERE tenant_id = ${tenantId}::uuid
          AND id IN (${Prisma.join(ingIds.map((id) => Prisma.sql`${id}::uuid`))})
      `)

      const byIng = new Map(ingRows.map((ing) => [String(ing.id), ing]))

      const out: Record<string, unknown> = {}
      for (const pid of uniqueIds) {
        const prRows = byProd[pid]
        if (!prRows?.length) {
          out[pid] = []
          continue
        }
        const ids = prRows.map((row) => row.ingrediente_id).filter(Boolean) as string[]
        let ordered = ids.map((id) => byIng.get(id)).filter(Boolean) as Record<string, unknown>[]

        if (prRows[0] && prRows[0].ordine === null) {
          ordered = [...ordered].sort((a, b) =>
            String(a?.nome ?? '').localeCompare(String(b?.nome ?? ''), 'it'),
          )
        }

        out[pid] = ordered.map((ing) => {
          const cu = ing.costo_unitario ?? ing.costoUnitario ?? ing.costo
          return {
            id: ing.id,
            nome: ing.nome ?? '',
            vaInCottura: ing.va_in_cottura === true,
            prepCucina: ing.prep_cucina === true,
            categoria: ing.categoria ?? ing.Categoria ?? undefined,
            colore: ing.colore ?? undefined,
            costo_unitario: ing.costo_unitario,
            costoUnitario: ing.costo_unitario,
            costo: cu,
          }
        })
      }
      return out
    } catch (e) {
      this.logger.warn(`batchProdottoIngredientiMerged: ${String(e)}`)
      return emptyOut()
    }
  }
}
