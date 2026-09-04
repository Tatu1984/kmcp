import {
  Activity,
  BadgeIndianRupee,
  BookOpen,
  Building2,
  CalendarClock,
  CircleParking,
  ClipboardList,
  Coins,
  FileBarChart,
  Gauge,
  IdCard,
  LandPlot,
  ScrollText,
  Settings,
  ShieldAlert,
  SquareStack,
  Ticket,
  PlugZap,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/shared/constants/routes";
import type { PermissionKey } from "@/shared/constants/roles";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  badgeKey?: "pendingSettlements" | "openIncidents" | "varianceShifts" | "pendingVendorApprovals" | "overstayCount";
  keywords?: string[];
  /**
   * What the API demands of the list route this destination opens with.
   *
   * Each one below was read off the `@RequirePermissions` on the controller
   * rather than inferred from the page's name, and three of them are not what
   * the name suggests: incidents and shifts list under `session.read` (their
   * own grants buy the actions on the row, not the sight of it), and citizens
   * list under `session.read` too, because a citizen record is reached through
   * the sessions they parked. Guessing here would have hidden three pages from
   * the Zone Officers and Vendors who use them daily.
   */
  permission?: PermissionKey;
  /**
   * For a screen assembled from two independently guarded lists: holding any
   * one of these is enough to open it, because the halves the account may not
   * read hide themselves. Passes is plans (`tariff.read`) beside issued passes
   * (`session.read`); Settings is configuration (`config.write`) beside
   * accounts and the RBAC matrix (`user.manage`).
   */
  permissions?: PermissionKey[];
};

/**
 * The shape `usePermissions()` already returns, named structurally so this file
 * stays a plain module — the nav table is imported by the sidebar, the palette
 * and the route guard, and none of them should have to agree on a hook.
 */
export type PermissionCheck = {
  can: (permission: PermissionKey) => boolean;
  canAny: (...permissions: PermissionKey[]) => boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: ROUTES.dashboard,
        permission: "session.read",
        icon: Gauge,
        description: "Live occupancy, revenue and activity",
        keywords: ["home", "overview", "live", "kpi"],
      },
      {
        label: "Live sessions",
        href: ROUTES.sessions,
        permission: "session.read",
        icon: Activity,
        description: "Every parking event, live and historic",
        badgeKey: "overstayCount",
        keywords: ["parking", "vehicles", "plate", "active"],
      },
    ],
  },
  {
    label: "Kerbside",
    items: [
      {
        label: "Zones",
        href: ROUTES.zones,
        permission: "zone.read",
        icon: LandPlot,
        description: "Geo-fenced parking areas and capacity",
        keywords: ["street", "ward", "geofence", "boundary"],
      },
      {
        label: "Slots",
        href: ROUTES.slots,
        permission: "zone.read",
        icon: SquareStack,
        description: "Individual bays, types and status",
        keywords: ["bay", "ev", "accessible", "reserved"],
      },
      {
        label: "Incidents",
        href: ROUTES.incidents,
        permission: "session.read",
        icon: ShieldAlert,
        description: "Illegal parking, damage and disputes",
        badgeKey: "openIncidents",
        keywords: ["dispute", "damage", "accident", "complaint"],
      },
    ],
  },
  {
    label: "Partners",
    items: [
      {
        label: "Vendors",
        href: ROUTES.vendors,
        permission: "vendor.read",
        icon: Building2,
        description: "Operators, KYC, zones and commission",
        badgeKey: "pendingVendorApprovals",
        keywords: ["operator", "contractor", "kyc", "agreement"],
      },
      {
        label: "Attendants",
        href: ROUTES.attendants,
        permission: "vendor.read",
        icon: Users,
        description: "Field staff, devices and performance",
        keywords: ["staff", "field", "device", "gps"],
      },
      {
        label: "Shifts",
        href: ROUTES.shifts,
        permission: "session.read",
        icon: CalendarClock,
        description: "Attendance and cash reconciliation",
        badgeKey: "varianceShifts",
        keywords: ["attendance", "cash", "deposit", "variance"],
      },
    ],
  },
  {
    label: "Pricing",
    items: [
      {
        label: "Tariffs",
        href: ROUTES.tariffs,
        permission: "tariff.read",
        icon: BadgeIndianRupee,
        description: "Approved rate cards and pricing rules",
        keywords: ["rate", "price", "peak", "holiday", "slab"],
      },
      {
        label: "Passes",
        href: ROUTES.passes,
        permissions: ["tariff.read", "session.read"],
        icon: Ticket,
        description: "Monthly and season pass programmes",
        keywords: ["monthly", "season", "subscription"],
      },
    ],
  },
  {
    label: "Money",
    items: [
      {
        label: "Payments",
        href: ROUTES.payments,
        permission: "payment.read",
        icon: Wallet,
        description: "Collections, refunds and receipts",
        keywords: ["upi", "cash", "card", "refund", "receipt"],
      },
      {
        label: "Settlements",
        href: ROUTES.settlements,
        permission: "settlement.read",
        icon: Coins,
        description: "Vendor payouts and government share",
        badgeKey: "pendingSettlements",
        keywords: ["payout", "commission", "ledger"],
      },
      {
        label: "Revenue",
        href: ROUTES.revenue,
        permission: "payment.read",
        icon: CircleParking,
        description: "Revenue analytics across the network",
        keywords: ["analytics", "chart", "trend"],
      },
      {
        label: "Reports",
        href: ROUTES.reports,
        permission: "report.generate",
        icon: FileBarChart,
        description: "Generate, schedule and export reports",
        keywords: ["export", "pdf", "excel", "csv", "tax"],
      },
    ],
  },
  {
    label: "Governance",
    items: [
      {
        label: "Citizens",
        href: ROUTES.citizens,
        permission: "session.read",
        icon: IdCard,
        description: "Registered vehicle owners and history",
        keywords: ["user", "owner", "vehicle", "blacklist"],
      },
      {
        label: "Audit trail",
        href: ROUTES.audit,
        permission: "audit.read",
        icon: ScrollText,
        description: "Every change, login, device and sync",
        keywords: ["log", "compliance", "history", "trail"],
      },
      {
        label: "Content",
        href: ROUTES.cms,
        permission: "cms.write",
        icon: BookOpen,
        description: "Public pages, FAQs and announcements",
        keywords: ["cms", "faq", "banner", "terms", "privacy"],
      },
      {
        label: "Settings",
        href: ROUTES.settings,
        permissions: ["config.write", "user.manage"],
        icon: Settings,
        description: "Taxes, gateways, roles and backups",
        keywords: ["config", "rbac", "gst", "gateway", "backup"],
      },
      {
        // Deliberately ungated, and the only entry that is. Every check it runs
        // is either a public endpoint or a /auth/me it expects to be refused —
        // it holds no data of its own. It is also the page somebody opens when
        // the portal cannot reach the API at all, which is exactly the moment a
        // permission set has not resolved and a gate would lock the door on the
        // engineer holding the key.
        label: "API connection",
        href: ROUTES.connection,
        icon: PlugZap,
        description: "Check the portal can reach the backend",
        keywords: ["api", "backend", "cors", "env", "health", "connect"],
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Whether this account may open a destination at all. */
export function mayOpen(item: NavItem, perms: PermissionCheck): boolean {
  if (item.permissions?.length) return perms.canAny(...item.permissions);
  return item.permission ? perms.can(item.permission) : true;
}

/**
 * The nav, minus what this account cannot open. A group whose every item went
 * is dropped with it — a heading left standing over nothing reads as a section
 * that failed to load rather than one that was never theirs.
 *
 * `can()` denies while the principal is loading, so callers must decide what to
 * show for that moment rather than rendering the empty result this returns.
 */
export function visibleNavGroups(perms: PermissionCheck): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => mayOpen(item, perms)),
  })).filter((group) => group.items.length > 0);
}

/**
 * The nav entry a URL belongs to, detail pages included: /zones/cm3x is the
 * Zones entry, so one map answers both "which link is active" and "may this
 * account be here". Longest href first, or /settings would answer for
 * /settings/connection and gate the one page that must never be gated.
 */
const NAV_ITEMS_BY_SPECIFICITY = [...ALL_NAV_ITEMS].sort((a, b) => b.href.length - a.href.length);

export function navItemForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS_BY_SPECIFICITY.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

/**
 * Palette shortcuts. These are writes, so they carry the write grant rather
 * than the read one behind the page they lead to: offering "Register a vendor"
 * to an Auditor who may look at the vendor register but not touch it is the
 * dead-end the permission work exists to remove.
 */
export const QUICK_ACTIONS: {
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
  permission: PermissionKey;
}[] = [
  {
    label: "Create a parking zone",
    href: ROUTES.zones,
    icon: LandPlot,
    hint: "Kerbside",
    permission: "zone.write",
  },
  {
    label: "Register a vendor",
    href: ROUTES.vendors,
    icon: Building2,
    hint: "Partners",
    permission: "vendor.write",
  },
  {
    label: "Draft a tariff",
    href: ROUTES.tariffs,
    icon: BadgeIndianRupee,
    hint: "Pricing",
    permission: "tariff.write",
  },
  {
    label: "Generate a report",
    href: ROUTES.reports,
    icon: ClipboardList,
    hint: "Money",
    permission: "report.generate",
  },
];
