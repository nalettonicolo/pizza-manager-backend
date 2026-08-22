import { Module } from '@nestjs/common';
import { PublicMenuController } from './public-menu.controller';
import { PublicMenuService } from './public-menu.service';
import { PublicTenantController } from './public-tenant.controller';
import { PublicTenantService } from './public-tenant.service';

@Module({
  controllers: [PublicTenantController, PublicMenuController],
  providers: [PublicTenantService, PublicMenuService],
})
export class PublicTenantModule {}
