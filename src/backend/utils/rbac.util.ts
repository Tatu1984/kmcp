import { ROLES, type Role, type PermissionKey } from "@/shared/constants/roles";

/**
 * The single source of truth for who may do what. Middleware pre-checks it and
 * every scoped service method re-asserts it — defence in depth, not decoration.
 */
export const ROLE_PERMISSIONS: Record<Role, PermissionKey[] | "*"> = {
  [ROLES.SUPER_ADMIN]: "*",
  [ROLES.ADMIN]: [
    "zone.read", "zone.write", "zone.status", "slot.write",
    "session.read", "session.cancel", "incident.manage",
    "vendor.read", "vendor.write", "vendor.approve", "attendant.write", "shift.verify",
    "tariff.read", "tariff.write", "tariff.publish", "discount.write", "pass.write",
    "payment.read", "payment.refund", "settlement.read", "settlement.approve", "settlement.payout",
    "report.generate", "audit.read", "user.manage", "cms.write",
  ],
  [ROLES.ZONE_OFFICER]: [
    "zone.read", "zone.status", "session.read", "incident.manage",
    "vendor.read", "tariff.read", "report.generate",
  ],
  [ROLES.AUDITOR]: [
    "zone.read", "session.read", "vendor.read", "tariff.read",
    "payment.read", "settlement.read", "report.generate", "audit.read",
  ],
  [ROLES.VENDOR]: ["zone.read", "session.read", "attendant.write", "payment.read", "settlement.read"],
  [ROLES.ATTENDANT]: ["zone.read", "session.read"],
  [ROLES.CITIZEN]: [],
};

export function can(role: Role, permission: PermissionKey): boolean {
  const grants = ROLE_PERMISSIONS[role];
  return grants === "*" || grants.includes(permission);
}

export function assertCan(role: Role, permission: PermissionKey): void {
  if (!can(role, permission)) {
    throw new Error(`FORBIDDEN: ${role} lacks ${permission}`);
  }
}

/** Roles whose reads must always be narrowed to their assigned zones. */
export const ZONE_SCOPED_ROLES: Role[] = [ROLES.ZONE_OFFICER, ROLES.VENDOR, ROLES.ATTENDANT];

export function isZoneScoped(role: Role): boolean {
  return ZONE_SCOPED_ROLES.includes(role);
}
