import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

type JwtLike = { tenantId?: string; ruolo?: string };

/**
 * Tenant effettivo per la richiesta.
 * Super Admin in Sala QA passa `?tenantId=` (override supporto): consentito.
 * Altri ruoli: query deve coincidere col JWT (o assente).
 */
export function resolveTenantIdForRequest(
  user: JwtLike | undefined,
  queryTenant?: string,
): string {
  const ruolo = String(user?.ruolo ?? '').toUpperCase();
  const isSa = ruolo === 'SUPERADMIN';
  const q =
    queryTenant && String(queryTenant).trim()
      ? String(queryTenant).trim()
      : undefined;

  if (isSa && q) return q;

  if (!user?.tenantId) {
    throw new UnauthorizedException('Tenant non nel token');
  }
  if (q && q !== user.tenantId) {
    throw new ForbiddenException('tenantId non coerente col token');
  }
  return user.tenantId;
}
