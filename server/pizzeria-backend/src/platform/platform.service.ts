import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PlatformService {
  constructor(private prisma: PrismaService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenziali non valide');
    }

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Credenziali non valide');
    }

    return {
      id: user.id,
      email: user.email,
    };
  }

  async getUserWithRole(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        deletedAt: null,
      },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      tenant: user.tenant.nome,
      role: user.ruolo,
    };
  }
}
