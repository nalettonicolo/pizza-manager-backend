import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const authHeader = request.headers.authorization

    if (!authHeader) {
      throw new UnauthorizedException('Token mancante')
    }

    const token = authHeader.replace('Bearer ', '')

    try {
      const decoded = this.jwtService.verify(token)
      request.user = decoded
      return true
    } catch {
      throw new UnauthorizedException('Token non valido')
    }
  }
}