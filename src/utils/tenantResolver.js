/**
 * Centralized Tenant ID Resolver for SaaS Multi-Tenant Isolation.
 *
 * RULE:
 *  - Super Admin (tenantId=1) → sees ONLY their own HQ data (tenantId=1)
 *    UNLESS they explicitly pass ?tenantId=X to drill into a specific tenant.
 *  - Everyone else → always filtered by their own req.user.tenantId.
 *
 * Usage in any controller:
 *   import { resolveTenantId } from '../utils/tenantResolver.js';
 *   const tenantId = resolveTenantId(req);
 */
export const resolveTenantId = (req) => {
  const isSuperAdmin = req.user?.role?.name === 'SUPER_ADMIN';
  const isAdmin = req.user?.role?.name === 'ADMIN';

  if (isSuperAdmin || isAdmin) {
    // If Super Admin explicitly passes ?tenantId=X, use that (for tenant drill-down)
    if (req.query?.tenantId) {
      return Number(req.query.tenantId);
    }
    // Otherwise, default to their own HQ tenant
    return req.user?.tenantId || 1;
  }

  // All other roles: strictly their own tenant
  return req.user?.tenantId || 1;
};

/**
 * Special resolver for SaaS management endpoints where Super Admin
 * NEEDS to see all tenants (e.g., SaaS Clients list, Subscriptions, Plans).
 * Returns null to skip tenant filtering.
 */
export const resolveTenantIdForSaasManagement = (req) => {
  const isSuperAdmin = req.user?.role?.name === 'SUPER_ADMIN';

  if (isSuperAdmin) {
    // If explicitly filtering by tenant, use that
    if (req.query?.tenantId) {
      return Number(req.query.tenantId);
    }
    // null = no filter = see all tenants (only for SaaS management)
    return null;
  }

  return req.user?.tenantId || 1;
};

/**
 * Special resolver for operational endpoints (Deliveries, Missions, Orders).
 * Allows ZaneZion central operational staff to see/manage data across ALL tenants.
 */
export const resolveTenantIdForOperations = (req) => {
  const roleName = req.user?.role?.name?.toUpperCase();
  const isOperationalStaff = ['LOGISTICS', 'OPERATIONS', 'STAFF', 'FIELD_STAFF', 'CONCIERGE', 'SECURITY', 'DRIVER'].includes(roleName);
  
  if (isOperationalStaff) {
    return null; // Cross-tenant visibility
  }

  // Fallback to standard tenant resolution
  return resolveTenantId(req);
};
