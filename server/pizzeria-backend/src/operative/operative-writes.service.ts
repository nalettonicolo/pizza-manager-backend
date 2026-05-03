import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { ReplaceOrderItemsDto } from './dto/replace-order-items.dto'
import { UpdateOrderPatchDto } from './dto/patch-order.dto'

export type JwtOperativeUser = {
  sub?: string
  tenantId?: string
  ruolo?: string
  email?: string
}

@Injectable()
export class OperativeWritesService {
  private readonly logger = new Logger(OperativeWritesService.name)

  constructor(private readonly prisma: PrismaService) {}

  private jwtTenant(jwt: JwtOperativeUser) {
    if (!jwt.tenantId) throw new UnauthorizedException('Tenant non nel token')
    return jwt.tenantId
  }

  assertTenantParam(jwtTenant: string, queryTenant?: string) {
    if (queryTenant && queryTenant !== jwtTenant) {
      throw new ForbiddenException('tenantId non coerente col token')
    }
  }

  /** Staff che può usare cassa / ordini (allineato a utenti piattaforma Nest). */
  private canCassaMutate(ruolo?: string) {
    const r = String(ruolo ?? '').toUpperCase()
    return ['SUPERADMIN', 'OWNER', 'ADMIN', 'OPERATORE'].includes(r)
  }

  private mapCoreRuoloToUi(ruolo: string) {
    const u = String(ruolo ?? '').toUpperCase()
    if (u === 'SUPERADMIN') return 'superadmin'
    if (u === 'OWNER') return 'owner'
    if (u === 'ADMIN') return 'admin'
    if (u === 'OPERATORE') return 'operatore'
    return String(ruolo ?? '').toLowerCase()
  }

  private serializeRow(row: Record<string, unknown>) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) out[k] = v.toISOString()
      else out[k] = v
    }
    return out
  }

  private mapOrdineRow(r: Record<string, unknown>) {
    const o = this.serializeRow(r)
    return {
      ...o,
      tenantId: o.tenant_id ?? o.tenantId,
      createdAt: o.created_at ?? o.createdAt,
      updatedAt: o.updated_at ?? o.updatedAt,
      deletedAt: o.deleted_at ?? o.deletedAt,
    }
  }

  private mapRigaRow(r: Record<string, unknown>): Record<string, unknown> {
    const o = this.serializeRow(r)
    return {
      ...o,
      ordineId: o.ordine_id ?? o.ordineId,
      prodottoId: o.prodotto_id ?? o.prodottoId,
    }
  }

  /** Righe nella forma più vicina alla vista Supabase PostgREST (camelCase dove serve alla SPA). */
  private mapRigaCliente(r: Record<string, unknown>) {
    const m = this.mapRigaRow(r)
    const fmt = m.formato_nome ?? m.formatoNome
    const ing = m.ingredienti_cottura_summary ?? m.ingredientiCotturaSummary
    return {
      ...m,
      ordineId: m.ordine_id ?? m.ordineId,
      prodottoId: m.prodotto_id ?? m.prodottoId,
      formatoNome: fmt ?? m.formatoNome,
      formato_nome: m.formato_nome ?? m.formatoNome,
      ingredientiCotturaSummary: ing ?? m.ingredientiCotturaSummary,
      ingredienti_cottura_summary: m.ingredienti_cottura_summary ?? m.ingredientiCotturaSummary,
    }
  }

  async turnoAperto(jwt: JwtOperativeUser, queryTenant?: string) {
    const tid = this.jwtTenant(jwt)
    this.assertTenantParam(tid, queryTenant)
    if (!jwt.sub) throw new UnauthorizedException()
    if (!this.canCassaMutate(jwt.ruolo)) throw new ForbiddenException()

    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`
        SELECT id, tenant_id, user_id, punto_vendita_id, stato, aperto_il, chiuso_il,
               fondo_contato_euro, incasso_atteso_euro, delta_euro, note_chiusura
        FROM public.turni_operatori
        WHERE tenant_id = ${tid}::uuid
          AND user_id = ${jwt.sub}::uuid
          AND stato = 'aperto'
          AND chiuso_il IS NULL
        ORDER BY aperto_il DESC NULLS LAST
        LIMIT 1
      `,
    )
    if (!rows?.length) return null
    const t = rows[0]
    return {
      id: t.id,
      punto_vendita_id: t.punto_vendita_id,
      stato: t.stato,
      aperto_il: t.aperto_il,
      chiuso_il: t.chiuso_il,
      fondo_contato_euro: t.fondo_contato_euro,
      incasso_atteso_euro: t.incasso_atteso_euro,
      delta_euro: t.delta_euro,
      note_chiusura: t.note_chiusura,
    }
  }

  /**
   * `user_id` in `public.turni_operatori` deve coincidere con `sub` JWT (id utente Nest / core.users).
   * Se in deploy storici era legato solo ad `auth.users`, allineare id o migrazione dati prima di usare questo path.
   */
  async turnoApri(jwt: JwtOperativeUser, queryTenant: string | undefined, pvId: string) {
    const tid = this.jwtTenant(jwt)
    this.assertTenantParam(tid, queryTenant)
    if (!jwt.sub) throw new UnauthorizedException()
    if (!this.canCassaMutate(jwt.ruolo)) throw new ForbiddenException()

    const pvRows = await this.prisma.$queryRaw<{ ok: boolean }[]>(
      Prisma.sql`
        SELECT true AS ok
        FROM core.punti_vendita pv
        WHERE pv.id = ${pvId}::uuid
          AND pv.tenant_id = ${tid}::uuid
        LIMIT 1
      `,
    )
    if (!pvRows?.length) {
      throw new ForbiddenException('Punto vendita non valido per questo tenant')
    }

    const existing = await this.prisma.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`
        SELECT id, punto_vendita_id FROM public.turni_operatori
        WHERE user_id = ${jwt.sub}::uuid
          AND tenant_id = ${tid}::uuid
          AND stato = 'aperto'
          AND chiuso_il IS NULL
        LIMIT 1
      `,
    )

    if (existing?.length) {
      const ex = existing[0]
      const epv = ex.punto_vendita_id != null ? String(ex.punto_vendita_id) : null
      if (epv && epv !== String(pvId)) {
        throw new ForbiddenException('turno_aperto_altro_pv')
      }
      return {
        id: ex.id,
        punto_vendita_id: epv,
        stato: 'aperto',
        gia_aperto: true,
      }
    }

    const ins = await this.prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`
        INSERT INTO public.turni_operatori (user_id, tenant_id, punto_vendita_id, stato, aperto_il)
        VALUES (${jwt.sub}::uuid, ${tid}::uuid, ${pvId}::uuid, 'aperto', now())
        RETURNING id
      `,
    )
    const newId = ins[0]?.id
    return {
      id: newId,
      punto_vendita_id: pvId,
      stato: 'aperto',
      gia_aperto: false,
    }
  }

  async turnoChiudi(
    jwt: JwtOperativeUser,
    queryTenant: string | undefined,
    fondo: number,
    incassoAtteso?: number | null,
    note?: string | null,
  ) {
    const tid = this.jwtTenant(jwt)
    this.assertTenantParam(tid, queryTenant)
    if (!jwt.sub) throw new UnauthorizedException()
    if (!this.canCassaMutate(jwt.ruolo)) throw new ForbiddenException()

    const open = await this.prisma.$queryRaw<{ id: number }[]>(
      Prisma.sql`
        SELECT id FROM public.turni_operatori
        WHERE user_id = ${jwt.sub}::uuid
          AND tenant_id = ${tid}::uuid
          AND stato = 'aperto'
          AND chiuso_il IS NULL
        ORDER BY aperto_il DESC NULLS LAST
        LIMIT 1
      `,
    )
    const vId = open[0]?.id
    if (vId == null) throw new NotFoundException('nessun_turno_aperto')

    const delta =
      incassoAtteso != null && Number.isFinite(Number(incassoAtteso))
        ? Math.round((Number(fondo) - Number(incassoAtteso)) * 100) / 100
        : null

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE public.turni_operatori t
        SET
          stato = 'chiuso',
          chiuso_il = now(),
          fondo_contato_euro = ${fondo},
          incasso_atteso_euro = ${incassoAtteso ?? null},
          delta_euro = ${delta},
          note_chiusura = ${note != null && String(note).trim() ? String(note).trim() : null}
        WHERE t.id = ${vId}
      `,
    )

    return {
      id: vId,
      chiuso: true,
      fondo_contato_euro: fondo,
      incasso_atteso_euro: incassoAtteso ?? null,
      delta_euro: delta,
    }
  }

  async createOrder(jwt: JwtOperativeUser, queryTenant: string | undefined, body: CreateOrderDto) {
    const tid = this.jwtTenant(jwt)
    this.assertTenantParam(tid, queryTenant)
    if (!this.canCassaMutate(jwt.ruolo)) throw new ForbiddenException()
    if (!body.items?.length) throw new ForbiddenException('almeno_una_riga')

    const statoRaw = (body.stato && String(body.stato).trim()) || 'IN_PREPARAZIONE'

    return this.prisma.$transaction(async (tx) => {
      const maxRow = await tx.$queryRaw<{ n: number }[]>(
        Prisma.sql`SELECT COALESCE(MAX(numero), 0)::int AS n FROM core.ordini WHERE tenant_id = ${tid}::uuid`,
      )
      const nextNum = (maxRow[0]?.n ?? 0) + 1

      const pagSql =
        body.pagamento_dettaglio == null
          ? Prisma.sql`NULL::jsonb`
          : Prisma.sql`CAST(${JSON.stringify(body.pagamento_dettaglio)} AS jsonb)`
      const pvSql =
        body.punto_vendita_id != null && String(body.punto_vendita_id).trim()
          ? Prisma.sql`${String(body.punto_vendita_id).trim()}::uuid`
          : Prisma.sql`NULL::uuid`
      const turnoSql =
        body.turno_operatori_id != null && Number.isFinite(Number(body.turno_operatori_id))
          ? Prisma.sql`${Number(body.turno_operatori_id)}`
          : Prisma.sql`NULL`

      let orderId: string
      try {
        const inserted = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          INSERT INTO core.ordini (
            tenant_id, numero, stato, totale, note, tipo_pagamento, tipo_ordine,
            nome_cliente, orario_ritiro, indirizzo_consegna, consegna_lng, consegna_lat,
            pagamento_dettaglio, punto_vendita_id, turno_operatori_id, telefono_ritiro
          ) VALUES (
            ${tid}::uuid,
            ${nextNum},
            ${statoRaw}::core.stato_ordine,
            ${Number(body.totale)},
            ${body.note != null && String(body.note).trim() ? String(body.note).trim() : null},
            ${body.tipo_pagamento != null && String(body.tipo_pagamento).trim() ? String(body.tipo_pagamento).trim() : null},
            ${body.tipo_ordine != null && String(body.tipo_ordine).trim() ? String(body.tipo_ordine).trim() : null},
            ${body.nome_cliente != null && String(body.nome_cliente).trim() ? String(body.nome_cliente).trim() : null},
            ${body.orario_ritiro != null && String(body.orario_ritiro).trim() ? String(body.orario_ritiro).trim() : null},
            ${body.indirizzo_consegna != null && String(body.indirizzo_consegna).trim() ? String(body.indirizzo_consegna).trim() : null},
            ${body.consegna_lng != null && Number.isFinite(Number(body.consegna_lng)) ? Number(body.consegna_lng) : null},
            ${body.consegna_lat != null && Number.isFinite(Number(body.consegna_lat)) ? Number(body.consegna_lat) : null},
            ${pagSql},
            ${pvSql},
            ${turnoSql},
            ${body.telefono_ritiro != null && String(body.telefono_ritiro).trim() ? String(body.telefono_ritiro).trim() : null}
          )
          RETURNING id
        `)
        orderId = String(inserted[0].id)
      } catch (e) {
        this.logger.warn(`createOrder insert esteso fallito, uso minimale: ${String(e)}`)
        const inserted = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          INSERT INTO core.ordini (tenant_id, numero, stato, totale)
          VALUES (
            ${tid}::uuid,
            ${nextNum},
            ${statoRaw}::core.stato_ordine,
            ${Number(body.totale)}
          )
          RETURNING id
        `)
        orderId = String(inserted[0].id)
      }

      for (const it of body.items) {
        const pid = String(it.prodotto_id)
        const ok = await tx.$queryRaw<{ ok: boolean }[]>(
          Prisma.sql`
            SELECT true AS ok FROM core.prodotti p
            WHERE p.id = ${pid}::uuid AND p.tenant_id = ${tid}::uuid LIMIT 1
          `,
        )
        if (!ok?.length) {
          throw new ForbiddenException(`prodotto_non_valido: ${pid}`)
        }

        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO core.riga_ordine (
              tenant_id, ordine_id, prodotto_id, quantita, prezzo, formato_nome, ingredienti_cottura_summary
            ) VALUES (
              ${tid}::uuid,
              ${orderId}::uuid,
              ${pid}::uuid,
              ${Math.max(1, Math.floor(Number(it.quantita) || 1))},
              ${Number(it.prezzo) || 0},
              ${it.formato_nome != null && String(it.formato_nome).trim() ? String(it.formato_nome).trim() : null},
              ${it.ingredienti_cottura_summary != null && String(it.ingredienti_cottura_summary).trim() ? String(it.ingredienti_cottura_summary).trim() : null}
            )
          `,
        )
      }

      return orderId
    })
  }

  async getOrderDetail(jwt: JwtOperativeUser, queryTenant: string | undefined, ordineId: string) {
    const tid = this.jwtTenant(jwt)
    this.assertTenantParam(tid, queryTenant)
    if (!this.canCassaMutate(jwt.ruolo)) throw new ForbiddenException()

    const orows = await this.prisma.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`SELECT * FROM core.ordini WHERE id = ${ordineId}::uuid AND tenant_id = ${tid}::uuid LIMIT 1`,
    )
    if (!orows?.length) throw new NotFoundException('Ordine non trovato')
    const order = this.mapOrdineRow(orows[0])

    const righeRaw = await this.prisma.$queryRaw<Record<string, unknown>[]>(
      Prisma.sql`SELECT * FROM core.riga_ordine WHERE ordine_id = ${ordineId}::uuid AND tenant_id = ${tid}::uuid ORDER BY id ASC`,
    )
    const righe = (righeRaw || []).map((r) => this.mapRigaCliente(r))
    return { ...order, righe }
  }

  async updateOrderStato(
    jwt: JwtOperativeUser,
    queryTenant: string | undefined,
    ordineId: string,
    stato: string,
  ) {
    const tid = this.jwtTenant(jwt)
    this.assertTenantParam(tid, queryTenant)
    if (!this.canCassaMutate(jwt.ruolo)) throw new ForbiddenException()

    const res = await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE core.ordini SET stato = ${stato}::core.stato_ordine, updated_at = now()
        WHERE id = ${ordineId}::uuid AND tenant_id = ${tid}::uuid
      `,
    )
    if (Number(res) < 1) throw new NotFoundException()
  }

  async updateOrderTipoPagamento(
    jwt: JwtOperativeUser,
    queryTenant: string | undefined,
    ordineId: string,
    tipoPagamento: string,
  ) {
    const tid = this.jwtTenant(jwt)
    this.assertTenantParam(tid, queryTenant)
    if (!this.canCassaMutate(jwt.ruolo)) throw new ForbiddenException()

    const tp = Number(
      await this.prisma.$executeRaw(
        Prisma.sql`
        UPDATE core.ordini SET tipo_pagamento = ${tipoPagamento}, updated_at = now()
        WHERE id = ${ordineId}::uuid AND tenant_id = ${tid}::uuid
      `,
      ),
    )
    if (tp < 1) throw new NotFoundException()
  }

  async updateOrderPatch(
    jwt: JwtOperativeUser,
    queryTenant: string | undefined,
    ordineId: string,
    updates: UpdateOrderPatchDto,
  ) {
    const tid = this.jwtTenant(jwt)
    this.assertTenantParam(tid, queryTenant)
    if (!this.canCassaMutate(jwt.ruolo)) throw new ForbiddenException()

    const parts: Prisma.Sql[] = []
    if (updates.nome_cliente !== undefined) {
      parts.push(Prisma.sql`nome_cliente = ${updates.nome_cliente ?? null}`)
    }
    if (updates.telefono_ritiro !== undefined) {
      parts.push(Prisma.sql`telefono_ritiro = ${updates.telefono_ritiro ?? null}`)
    }
    if (updates.orario_ritiro !== undefined) {
      parts.push(Prisma.sql`orario_ritiro = ${updates.orario_ritiro ?? null}`)
    }
    if (updates.note !== undefined) {
      parts.push(Prisma.sql`note = ${updates.note ?? null}`)
    }
    if (updates.tipo_pagamento !== undefined) {
      parts.push(Prisma.sql`tipo_pagamento = ${updates.tipo_pagamento ?? null}`)
    }
    if (updates.indirizzo_consegna !== undefined) {
      parts.push(Prisma.sql`indirizzo_consegna = ${updates.indirizzo_consegna ?? null}`)
    }
    if (updates.tipo_ordine !== undefined) {
      parts.push(Prisma.sql`tipo_ordine = ${updates.tipo_ordine ?? null}`)
    }
    if (updates.stato_consegna !== undefined) {
      parts.push(Prisma.sql`stato_consegna = ${updates.stato_consegna ?? null}`)
    }
    if (updates.consegna_lng !== undefined) {
      const v = updates.consegna_lng
      parts.push(
        Prisma.sql`consegna_lng = ${v != null && Number.isFinite(Number(v)) ? Number(v) : null}`,
      )
    }
    if (updates.consegna_lat !== undefined) {
      const v = updates.consegna_lat
      parts.push(
        Prisma.sql`consegna_lat = ${v != null && Number.isFinite(Number(v)) ? Number(v) : null}`,
      )
    }
    if (updates.punto_vendita_id !== undefined) {
      const raw = updates.punto_vendita_id
      parts.push(
        raw != null && String(raw).trim()
          ? Prisma.sql`punto_vendita_id = ${String(raw).trim()}::uuid`
          : Prisma.sql`punto_vendita_id = NULL::uuid`,
      )
    }
    if (updates.pagamento_dettaglio !== undefined) {
      if (updates.pagamento_dettaglio == null) {
        parts.push(Prisma.sql`pagamento_dettaglio = NULL::jsonb`)
      } else {
        parts.push(
          Prisma.sql`pagamento_dettaglio = CAST(${JSON.stringify(updates.pagamento_dettaglio)} AS jsonb)`,
        )
      }
    }

    if (!parts.length) return

    const setSql = Prisma.join(parts, ', ')
    await this.prisma.$executeRaw(
      Prisma.sql`UPDATE core.ordini SET ${setSql}, updated_at = now() WHERE id = ${ordineId}::uuid AND tenant_id = ${tid}::uuid`,
    )
  }

  async replaceOrderItems(
    jwt: JwtOperativeUser,
    queryTenant: string | undefined,
    ordineId: string,
    body: ReplaceOrderItemsDto,
  ) {
    const tid = this.jwtTenant(jwt)
    this.assertTenantParam(tid, queryTenant)
    if (!this.canCassaMutate(jwt.ruolo)) throw new ForbiddenException()
    const { totale, items } = body
    if (!items?.length) throw new ForbiddenException('almeno_una_riga')

    await this.prisma.$transaction(async (tx) => {
      const orows = await tx.$queryRaw<{ stato: string }[]>(
        Prisma.sql`SELECT stato::text AS stato FROM core.ordini WHERE id = ${ordineId}::uuid AND tenant_id = ${tid}::uuid LIMIT 1`,
      )
      if (!orows?.length) throw new NotFoundException('ordine_non_trovato')
      if (String(orows[0].stato).toUpperCase() === 'ANNULLATO') {
        throw new ForbiddenException('ordine_annullato_non_modificabile')
      }

      await tx.$executeRaw(
        Prisma.sql`DELETE FROM core.riga_ordine WHERE ordine_id = ${ordineId}::uuid AND tenant_id = ${tid}::uuid`,
      )

      for (const it of items) {
        const pid = String(it.prodotto_id)
        const ok = await tx.$queryRaw<{ ok: boolean }[]>(
          Prisma.sql`SELECT true AS ok FROM core.prodotti p WHERE p.id = ${pid}::uuid AND p.tenant_id = ${tid}::uuid LIMIT 1`,
        )
        if (!ok?.length) throw new ForbiddenException('prodotto_non_valido')

        const qty = Math.max(1, Math.floor(Number(it.quantita) || 1))
        const prezzo = Number(it.prezzo ?? 0)
        const fmt = it.formato_nome ?? ''
        const ing = it.ingredienti_cottura_summary ?? ''

        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO core.riga_ordine (
              tenant_id, ordine_id, prodotto_id, quantita, prezzo, formato_nome, ingredienti_cottura_summary
            ) VALUES (
              ${tid}::uuid,
              ${ordineId}::uuid,
              ${pid}::uuid,
              ${qty},
              ${prezzo},
              ${typeof fmt === 'string' && fmt.trim() ? fmt.trim() : null},
              ${typeof ing === 'string' && ing.trim() ? ing.trim() : null}
            )
          `,
        )
      }

      try {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE core.ordini
            SET totale = ${Number(totale)}, updated_at = now(), cucina_prep_stato = '{}'::jsonb
            WHERE id = ${ordineId}::uuid AND tenant_id = ${tid}::uuid
          `,
        )
      } catch {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE core.ordini
            SET totale = ${Number(totale)}, updated_at = now()
            WHERE id = ${ordineId}::uuid AND tenant_id = ${tid}::uuid
          `,
        )
      }
    })
  }

  async listRuoliPizzeriaCore(jwt: JwtOperativeUser, queryTenant?: string) {
    const tid = this.jwtTenant(jwt)
    this.assertTenantParam(tid, queryTenant)
    if (!this.canCassaMutate(jwt.ruolo)) throw new ForbiddenException()

    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          user_id: string
          email: string | null
          ruolo: string
          attivo: boolean | null
        }>
      >(
        Prisma.sql`
          SELECT id AS user_id, email, ruolo::text AS ruolo, attivo
          FROM core.users
          WHERE tenant_id = ${tid}::uuid AND deleted_at IS NULL
          ORDER BY email ASC NULLS LAST
        `,
      )
      return (rows || []).map((u) => {
        const rr = String(u.ruolo || '').toUpperCase()
        const puoAdmin = rr === 'SUPERADMIN' || rr === 'OWNER' || rr === 'ADMIN'
        return {
          user_id: u.user_id,
          email: u.email ?? '',
          ruolo: this.mapCoreRuoloToUi(u.ruolo),
          tenant_id: tid,
          puo_modificare_parametri: puoAdmin,
          attivo: u.attivo !== false,
          nome_visualizzato: null,
          accesso_riepilogo: true,
          accesso_cassa: true,
          accesso_cucina: true,
          accesso_bancone: true,
          accesso_delivery: true,
          accesso_pony: true,
          accesso_pizzaiolo: true,
        }
      })
    } catch (e) {
      this.logger.warn(`listRuoliPizzeriaCore: ${String(e)}`)
      return []
    }
  }

  async righeAggregate(
    jwt: JwtOperativeUser,
    queryTenant: string | undefined,
    ordineIds: string[],
  ) {
    const tid = this.jwtTenant(jwt)
    this.assertTenantParam(tid, queryTenant)
    if (!this.canCassaMutate(jwt.ruolo)) throw new ForbiddenException()
    const ids = [...new Set((ordineIds || []).filter(Boolean).map(String))]
    if (!ids.length) return {}

    const rows = await this.prisma.$queryRaw<Array<{ ordine_id: string; qty: number }>>(
      Prisma.sql`
        SELECT ordine_id::text AS ordine_id, COALESCE(SUM(quantita), 0)::int AS qty
        FROM core.riga_ordine
        WHERE tenant_id = ${tid}::uuid
          AND ordine_id IN (${Prisma.join(
            ids.map((id) => Prisma.sql`${id}::uuid`),
            ', ',
          )})
        GROUP BY ordine_id
      `,
    )
    const out: Record<string, number> = {}
    for (const r of rows || []) {
      out[String(r.ordine_id)] = Number(r.qty) || 0
    }
    return out
  }
}
