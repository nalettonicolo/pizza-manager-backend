import { Controller, Get, Param } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { PublicTenantService } from './public-tenant.service'

/**
 * Endpoint pubblici (senza JWT) per la vetrina verso stacco Supabase.
 * Espongono solo campi non sensibili; rate limit consigliato a livello di reverse proxy.
 */
@ApiTags('public')
@Controller('public/tenants')
export class PublicTenantController {
  constructor(private readonly publicTenant: PublicTenantService) {}

  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Tenant attivo per slug (vetrina SaaS)' })
  bySlug(@Param('slug') slug: string) {
    return this.publicTenant.bySlug(slug)
  }

  @Get('by-id/:id')
  @ApiOperation({ summary: 'Tenant attivo per UUID' })
  byId(@Param('id') id: string) {
    return this.publicTenant.byId(id)
  }
}
