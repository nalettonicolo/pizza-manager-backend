import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt.guard'
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
    summary: 'Riga tenant corrente (JWT)',
    description:
      'Usa `tenantId` nel payload JWT. Legge `admin.tenants` se presente, altrimenti `core.tenants`.',
  })
  me(@Req() req: { user: JwtUser }) {
    return this.tenantService.getTenantRowForJwtTenantId(req.user?.tenantId)
  }

  @Get('punti-vendita')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Punti vendita del tenant (JWT)',
    description:
      'Legge `core.punti_vendita` per `tenantId` nel token (necessario senza sessione Supabase).',
  })
  puntiVendita(@Req() req: { user: JwtUser }) {
    return this.puntiVenditaService.listForJwtTenant(req.user?.tenantId)
  }
}
