import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Tenant } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

/** Slug vetrina: lettere, cifre, trattino, lunghezza ragionevole. */
const SLUG_RE = /^[a-z0-9-]{1,80}$/i

@Injectable()
export class PublicTenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dati tenant esposti in vetrina (nessun segreto). Allineato a ciò che la SPA legge da `tenants` in sola lettura.
   */
  private toPublicDto(t: Tenant) {
    return {
      id: t.id,
      nome: t.nome,
      slug: t.slug,
      attivo: t.attivo,
      piano: String(t.piano),
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
    }
  }

  async bySlug(raw: string) {
    const slug = String(raw || '').trim()
    if (!slug || !SLUG_RE.test(slug)) {
      throw new BadRequestException('Slug non valido')
    }
    const t = await this.prisma.tenant.findFirst({
      where: {
        slug: { equals: slug, mode: 'insensitive' },
        deletedAt: null,
        attivo: true,
      },
    })
    if (!t) {
      throw new NotFoundException('Tenant non trovato')
    }
    return this.toPublicDto(t)
  }

  async byId(raw: string) {
    const id = String(raw || '').trim()
    if (!id) {
      throw new BadRequestException('Id mancante')
    }
    const t = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null, attivo: true },
    })
    if (!t) {
      throw new NotFoundException('Tenant non trovato')
    }
    return this.toPublicDto(t)
  }
}
