import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { JwtService } from '@nestjs/jwt'
import * as argon2 from 'argon2'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
      include: { tenant: true },
    })

    if (!user) {
      throw new UnauthorizedException('Credenziali non valide')
    }

    const passwordValid = await argon2.verify(user.password, password)
    if (!passwordValid) {
      throw new UnauthorizedException('Credenziali non valide')
    }

    if (!user.attivo) {
      throw new UnauthorizedException('Utente disattivato')
    }

    if (!user.tenant.attivo) {
      throw new UnauthorizedException('Tenant non attivo')
    }

    // Aggiorna last_login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      ruolo: user.ruolo,
      email: user.email,
    }

    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        ruolo: user.ruolo,
        tenantId: user.tenantId,
        tenantNome: user.tenant.nome,
      },
    }
  }

  async validateUser(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, attivo: true },
      include: { tenant: true },
    })
  }

  async me(payload: { sub?: string }) {
    const userId = payload?.sub
    if (!userId) {
      throw new UnauthorizedException('Token non valido')
    }
    const user = await this.validateUser(userId)
    if (!user) {
      throw new UnauthorizedException('Utente non trovato o non attivo')
    }
    if (!user.tenant.attivo) {
      throw new UnauthorizedException('Tenant non attivo')
    }
    return {
      id: user.id,
      email: user.email,
      nome: user.nome,
      ruolo: user.ruolo,
      tenantId: user.tenantId,
      tenantNome: user.tenant.nome,
    }
  }
}
