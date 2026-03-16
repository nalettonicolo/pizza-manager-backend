import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * Decorator per ottenere il tenantId dal JWT (request.user.tenantId).
 * Usare su tutte le route protette per iniettare il tenant nelle query.
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    const tenantId = request.user?.tenantId
    if (!tenantId) {
      throw new Error('tenantId non presente nel token (middleware tenant mancante)')
    }
    return tenantId
  },
)
