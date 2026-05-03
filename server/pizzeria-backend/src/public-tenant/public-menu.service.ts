import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertUuid(id: string, label: string) {
  if (!UUID_RE.test(String(id || '').trim())) {
    throw new BadRequestException(`${label} non valido`)
  }
  return String(id).trim()
}

@Injectable()
export class PublicMenuService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeRow(row: Record<string, unknown>) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) out[k] = v.toISOString()
      else out[k] = v
    }
    return out
  }

  async menuForTenant(tenantIdRaw: string) {
    const tenantId = assertUuid(tenantIdRaw, 'tenantId')
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`SELECT * FROM public.get_public_menu_for_tenant(${tenantId}::uuid)`,
    )
    return rows.map((r) => this.serializeRow(r))
  }

  async menuForDomain(hostRaw: string) {
    const host = String(hostRaw || '')
      .trim()
      .toLowerCase()
    if (!host || host.length > 253) {
      throw new BadRequestException('host non valido')
    }
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`SELECT * FROM public.get_public_menu_for_domain(${host})`,
    )
    return rows.map((r) => this.serializeRow(r))
  }

  async categoriesForTenant(tenantIdRaw: string) {
    const tenantId = assertUuid(tenantIdRaw, 'tenantId')
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`SELECT * FROM public.get_public_categories_for_tenant(${tenantId}::uuid)`,
    )
    return rows.map((r) => this.serializeRow(r))
  }

  async ingredientNames(tenantIdRaw: string, productIds: string[]) {
    const tenantId = assertUuid(tenantIdRaw, 'tenantId')
    if (!productIds?.length) {
      return {}
    }
    const ids = productIds.map((id) => assertUuid(id, 'productId'))
    const parts = ids.map((id) => Prisma.sql`${id}::uuid`)
    const rows = await this.prisma.$queryRaw<
      { prodotto_id: string; nomi: string[] }[]
    >(
      Prisma.sql`SELECT * FROM public.get_public_menu_ingredient_names(${tenantId}::uuid, ARRAY[${Prisma.join(parts)}]::uuid[])`,
    )
    const map: Record<string, string[]> = {}
    for (const row of rows) {
      if (row.prodotto_id) {
        map[row.prodotto_id] = Array.isArray(row.nomi) ? row.nomi : []
      }
    }
    return map
  }
}
