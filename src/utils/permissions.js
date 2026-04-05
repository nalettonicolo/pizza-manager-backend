import { ADMIN_TENANT_HOME } from "@/constants/adminTenantHome"

// ===============================
// ROLE → HOME ROUTE
// ===============================

export function getHomeByRole(role) {
  switch (role) {
    case "superadmin":
      return "/superadmin/dashboard"

    case "admin":
      return ADMIN_TENANT_HOME

    case "operatore":
      return "/operative/dashboard"

    default:
      return "/"
  }
}

// ===============================
// PERMESSI RUOLO PRINCIPALE
// ===============================

export function getRolePermissions(role) {
  const basePermissions = {
    superadmin: {
      manageTenants: true,
      manageLicenses: true,
      manageUsers: true,
      viewReports: true,
    },
    admin: {
      manageTenants: false,
      manageLicenses: false,
      manageUsers: true,
      viewReports: true,
    },
    operatore: {
      manageTenants: false,
      manageLicenses: false,
      manageUsers: false,
      viewReports: false,
    },
  }

  return basePermissions[role] || {}
}

// ===============================
// OPERATIVE PERMISSIONS
// ===============================
// (ruoli interni alla pizzeria)

export const operativeRoles = {
  cassa: true,
  cucina: true,
  bancone: true,
  pizzaiolo: true,
  delivery: true,
  pony: true,
}

export function hasOperativePermission(userOperativeRoles, key) {
  if (!userOperativeRoles) return false
  return userOperativeRoles.includes(key)
}
