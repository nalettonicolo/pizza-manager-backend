import { Module } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PlatformService],
  exports: [PlatformService], // 👈 QUESTO È FONDAMENTALE
})
export class PlatformModule {}
