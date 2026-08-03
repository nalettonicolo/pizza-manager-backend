import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { resolveTenantIdForRequest } from '../common/resolve-tenant'
import { PuntiVenditaService } from './punti-vendita.service'
import { TenantService } from './tenant.service'

type JwtUser = { sub?: string; tenantId?: string; ruolo?: string }

@ApiTags('tenant')
@Controller('tenant')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly puntiVenditaService: PuntiVenditaService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Riga tenant corrente (JWT o override SA)',
    description:
      'Usa `tenantId` nel payload JWT. Super Admin può passare `?tenantId=` (Sala QA).',
  })
  me(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam?: string,
  ) {
    const tenantId = resolveTenantIdForRequest(req.user, tenantIdParam)
    return this.tenantService.getTenantRowForJwtTenantId(tenantId)
  }

  @Get('punti-vendita')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Punti vendita del tenant (JWT o override SA)',
    description:
      'Legge `core.punti_vendita`. Super Admin: `?tenantId=` per il tenant in assistenza.',
  })
  puntiVendita(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam?: string,
  ) {
    const tenantId = resolveTenantIdForRequest(req.user, tenantIdParam)
    return this.puntiVenditaService.listForJwtTenant(tenantId)
  }
}
