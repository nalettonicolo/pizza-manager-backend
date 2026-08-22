import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    tenantId: string;
    userId?: string;
    azione: string;
    entita: string;
    entitaId?: string;
    meta?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        azione: params.azione,
        entita: params.entita,
        entitaId: params.entitaId,
        meta: (params.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
