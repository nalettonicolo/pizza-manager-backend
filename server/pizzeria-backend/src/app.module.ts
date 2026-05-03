import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { TenantModule } from './tenant/tenant.module'
import { OperativeModule } from './operative/operative.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [PrismaModule, AuthModule, TenantModule, OperativeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}