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
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/shared/constants/routes";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  badgeKey?: "pendingSettlements" | "openIncidents" | "varianceShifts" | "pendingVendorApprovals" | "overstayCount";
  keywords?: string[];
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
        icon: Gauge,
        description: "Live occupancy, revenue and activity",
        keywords: ["home", "overview", "live", "kpi"],
      },
      {
        label: "Live sessions",
        href: ROUTES.sessions,
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
        icon: LandPlot,
        description: "Geo-fenced parking areas and capacity",
        keywords: ["street", "ward", "geofence", "boundary"],
      },
      {
        label: "Slots",
        href: ROUTES.slots,
        icon: SquareStack,
        description: "Individual bays, types and status",
        keywords: ["bay", "ev", "accessible", "reserved"],
      },
      {
        label: "Incidents",
        href: ROUTES.incidents,
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
        icon: Building2,
        description: "Operators, KYC, zones and commission",
        badgeKey: "pendingVendorApprovals",
        keywords: ["operator", "contractor", "kyc", "agreement"],
      },
      {
        label: "Attendants",
        href: ROUTES.attendants,
        icon: Users,
        description: "Field staff, devices and performance",
        keywords: ["staff", "field", "device", "gps"],
      },
      {
        label: "Shifts",
        href: ROUTES.shifts,
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
        icon: BadgeIndianRupee,
        description: "Approved rate cards and pricing rules",
        keywords: ["rate", "price", "peak", "holiday", "slab"],
      },
      {
        label: "Passes",
        href: ROUTES.passes,
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
        icon: Wallet,
        description: "Collections, refunds and receipts",
        keywords: ["upi", "cash", "card", "refund", "receipt"],
      },
      {
        label: "Settlements",
        href: ROUTES.settlements,
        icon: Coins,
        description: "Vendor payouts and government share",
        badgeKey: "pendingSettlements",
        keywords: ["payout", "commission", "ledger"],
      },
      {
        label: "Revenue",
        href: ROUTES.revenue,
        icon: CircleParking,
        description: "Revenue analytics across the network",
        keywords: ["analytics", "chart", "trend"],
      },
      {
        label: "Reports",
        href: ROUTES.reports,
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
        icon: IdCard,
        description: "Registered vehicle owners and history",
        keywords: ["user", "owner", "vehicle", "blacklist"],
      },
      {
        label: "Audit trail",
        href: ROUTES.audit,
        icon: ScrollText,
        description: "Every change, login, device and sync",
        keywords: ["log", "compliance", "history", "trail"],
      },
      {
        label: "Content",
        href: ROUTES.cms,
        icon: BookOpen,
        description: "Public pages, FAQs and announcements",
        keywords: ["cms", "faq", "banner", "terms", "privacy"],
      },
      {
        label: "Settings",
        href: ROUTES.settings,
        icon: Settings,
        description: "Taxes, gateways, roles and backups",
        keywords: ["config", "rbac", "gst", "gateway", "backup"],
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const QUICK_ACTIONS = [
  { label: "Create a parking zone", href: ROUTES.zones, icon: LandPlot, hint: "Kerbside" },
  { label: "Register a vendor", href: ROUTES.vendors, icon: Building2, hint: "Partners" },
  { label: "Draft a tariff", href: ROUTES.tariffs, icon: BadgeIndianRupee, hint: "Pricing" },
  { label: "Generate a report", href: ROUTES.reports, icon: ClipboardList, hint: "Money" },
];
