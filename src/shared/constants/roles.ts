export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  ZONE_OFFICER: "ZONE_OFFICER",
  AUDITOR: "AUDITOR",
  VENDOR: "VENDOR",
  ATTENDANT: "ATTENDANT",
  CITIZEN: "CITIZEN",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  ZONE_OFFICER: "Zone Officer",
  AUDITOR: "Auditor",
  VENDOR: "Vendor",
  ATTENDANT: "Attendant",
  CITIZEN: "Citizen",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: "Full control including system configuration and the RBAC matrix.",
  ADMIN: "Municipal operations — zones, vendors, tariffs, settlements, reports.",
  ZONE_OFFICER: "Read and operate within assigned zones only.",
  AUDITOR: "Read-only across everything, including audit logs.",
  VENDOR: "Own organisation — zones, attendants, sessions, collections, settlements.",
  ATTENDANT: "Own shift — start/end sessions, collect payment, report incidents.",
  CITIZEN: "Own profile, vehicles, sessions, payments, receipts and passes.",
};

/**
 * Every permission the RBAC matrix can grant, grouped for the settings screen.
 *
 * ⚠ The grouping and the labels here are **not** the authority on themselves.
 * `GET /rbac/matrix` serves `groups` from `src/common/rbac/permissions.ts`,
 * which sits beside the grants the guards actually read, and the settings
 * matrix renders the API's copy whenever there is one — this list is only what
 * it falls back to in demo mode. A label edited here and not there changes what
 * a laptop walkthrough says and nothing about what a deployment enforces.
 *
 * What *is* load-bearing is the set of keys, because `PermissionKey` is derived
 * from it. See `ALL_PERMISSIONS` below.
 */
export const PERMISSION_GROUPS = [
  {
    key: "operations",
    label: "Operations",
    permissions: [
      { key: "zone.read", label: "View zones" },
      { key: "zone.write", label: "Create & edit zones" },
      { key: "zone.status", label: "Open / close zones" },
      { key: "slot.write", label: "Manage slots" },
      { key: "camera.view", label: "View camera streams" },
      { key: "camera.manage", label: "Add & edit cameras" },
      { key: "session.read", label: "View parking sessions" },
      { key: "session.cancel", label: "Cancel a session" },
      { key: "incident.manage", label: "Manage incidents" },
    ],
  },
  {
    key: "partners",
    label: "Partners",
    permissions: [
      { key: "vendor.read", label: "View vendors" },
      { key: "vendor.write", label: "Create & edit vendors" },
      { key: "vendor.approve", label: "Approve / suspend / block vendors" },
      { key: "attendant.write", label: "Manage attendants" },
      { key: "shift.verify", label: "Verify shift deposits" },
    ],
  },
  {
    key: "pricing",
    label: "Pricing",
    permissions: [
      { key: "tariff.read", label: "View tariffs" },
      { key: "tariff.write", label: "Draft tariffs" },
      { key: "tariff.publish", label: "Publish tariffs" },
      { key: "discount.write", label: "Manage discounts" },
      { key: "pass.write", label: "Manage pass plans" },
    ],
  },
  {
    key: "money",
    label: "Money",
    permissions: [
      { key: "payment.read", label: "View payments" },
      { key: "payment.refund", label: "Issue refunds" },
      { key: "settlement.read", label: "View settlements" },
      { key: "settlement.approve", label: "Approve settlements" },
      { key: "settlement.payout", label: "Instruct payouts" },
    ],
  },
  {
    key: "governance",
    label: "Governance",
    permissions: [
      { key: "report.generate", label: "Generate reports" },
      { key: "audit.read", label: "Read audit trail" },
      { key: "user.manage", label: "Manage users" },
      { key: "cms.write", label: "Edit public content" },
      { key: "config.write", label: "Change system configuration" },
    ],
  },
] as const;

export type PermissionKey =
  (typeof PERMISSION_GROUPS)[number]["permissions"][number]["key"];

/**
 * Every permission key, flattened.
 *
 * The grouping above is display metadata for the settings matrix and is also
 * served by `GET /rbac/matrix`, which is the authority on it. This flat list is
 * the portal's own compile-time contract: it is what makes `can("zone.wrte")` a
 * type error rather than a control that silently never renders.
 */
export const ALL_PERMISSIONS: readonly PermissionKey[] = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key),
);
