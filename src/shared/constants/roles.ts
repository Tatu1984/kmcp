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

/** Every permission the RBAC matrix can grant. Grouped for the settings screen. */
export const PERMISSION_GROUPS = [
  {
    key: "operations",
    label: "Operations",
    permissions: [
      { key: "zone.read", label: "View zones" },
      { key: "zone.write", label: "Create & edit zones" },
      { key: "zone.status", label: "Open / close zones" },
      { key: "slot.write", label: "Manage slots" },
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
