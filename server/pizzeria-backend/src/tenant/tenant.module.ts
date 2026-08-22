import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PuntiVenditaService } from './punti-vendita.service';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantController],
  providers: [TenantService, PuntiVenditaService],
})
export class TenantModule {}
