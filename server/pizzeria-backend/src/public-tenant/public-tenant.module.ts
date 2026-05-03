import { Module } from '@nestjs/common'
import { PublicTenantController } from './public-tenant.controller'
import { PublicTenantService } from './public-tenant.service'

@Module({
  controllers: [PublicTenantController],
  providers: [PublicTenantService],
})
export class PublicTenantModule {}
