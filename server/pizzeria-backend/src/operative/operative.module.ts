import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OperativeController } from './operative.controller';
import { OperativeService } from './operative.service';
import { OperativeWritesService } from './operative-writes.service';

@Module({
  imports: [AuthModule],
  controllers: [OperativeController],
  providers: [OperativeService, OperativeWritesService],
})
export class OperativeModule {}
