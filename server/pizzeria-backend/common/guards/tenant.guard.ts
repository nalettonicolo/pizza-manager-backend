import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common'

/**
 * Guard che verifica la presenza di tenantId nel JWT (dopo JwtAuthGuard).
 * Blocca l'accesso se il token non contiene tenantId (es. login non completato con selezione tenant).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const tenantId = request.user?.tenantId

    if (!tenantId) {
      throw new ForbiddenException(
        'Contesto tenant mancante. Esegui prima la selezione tenant.',
      )
    }

    return true
  }
}
