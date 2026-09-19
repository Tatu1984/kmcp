import type { LatLng, Paise } from "./common.types";
import type { Role } from "../constants/roles";

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLACKLISTED";
export type VendorStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "BLOCKED";
export type ZoneStatus = "OPEN" | "CLOSED" | "MAINTENANCE" | "EVENT_CLOSURE";
export type SlotType =
  | "TWO_WHEELER"
  | "CAR"
  | "THREE_WHEELER"
  | "COMMERCIAL"
  | "BUS"
  | "TRUCK"
  | "EV"
  | "VIP"
  | "GOVERNMENT"
  | "ACCESSIBLE";
export type SlotStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "OUT_OF_SERVICE";
export type SessionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "OVERSTAY" | "DISPUTED";
export type SessionSource = "ATTENDANT_APP" | "OFFLINE_SYNC" | "CITIZEN_APP" | "ADMIN_PORTAL";
export type PaymentMode =
  | "CASH"
  | "UPI_QR"
  | "UPI_INTENT"
  | "CARD"
  | "NETBANKING"
  | "WALLET"
  | "PASS"
  | "CORPORATE";
export type PaymentStatus = "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
export type ShiftStatus = "OPEN" | "CLOSED" | "VERIFIED" | "VARIANCE_FLAGGED";
export type SettlementStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "PAID"
  | "FAILED";
export type PassStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING_PAYMENT";
export type IncidentType =
  | "ILLEGAL_PARKING"
  | "ACCIDENT"
  | "VEHICLE_DAMAGE"
  | "PARKING_DISPUTE"
  | "WRONG_VEHICLE"
  | "OTHER";
export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
export type TariffRuleType =
  | "PEAK_HOUR"
  | "WEEKEND"
  | "HOLIDAY"
  | "EVENT"
  | "NIGHT"
  | "VIP"
  | "COMMERCIAL"
  | "SUBSCRIBER";
export type DayType = "ALL" | "WEEKDAY" | "WEEKEND" | "HOLIDAY";
export type ReportStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: Role;
  status: UserStatus;
  avatarUrl?: string;
  lastLoginAt?: string;
  createdAt: string;
  twoFactorEnabled?: boolean;
}

export interface Ward {
  id: string;
  code: string;
  name: string;
  zoneCount: number;
  streetCount?: number;
}

export interface Zone {
  id: string;
  code: string;
  name: string;
  wardId: string;
  wardName: string;
  streetName: string;
  center: LatLng;
  capacity: number;
  occupied: number;
  allowedVehicleTypes: SlotType[];
  openTime: string;
  closeTime: string;
  status: ZoneStatus;
  closureReason?: string;
  closureUntil?: string;
  vendorId?: string;
  vendorName?: string;
  /**
   * Absent until a source of truth exists for it. Zone revenue is computed from
   * captured payments, which arrive with the payments module — rendering ₹0
   * before then would assert "no revenue" rather than "not yet known".
   */
  revenueToday?: Paise;
  revenueMonth?: Paise;
  slotCount?: number;
  boundaryPoints: number;
  createdAt: string;
}

export interface Slot {
  id: string;
  zoneId: string;
  zoneName: string;
  code: string;
  type: SlotType;
  status: SlotStatus;
  isReserved: boolean;
  currentPlate?: string;
}

export interface Vendor {
  id: string;
  orgName: string;
  contactName: string;
  contactPhone: string;
  email: string;
  gstin?: string;
  pan?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  commissionPct: number;
  rating?: number;
  status: VendorStatus;
  zoneCount: number;
  attendantCount: number;
  /** Settlement figures; absent until the settlement module exists. */
  revenueMonth?: Paise;
  pendingSettlement?: Paise;
  kycComplete: boolean;
  documents: {
    id: string;
    type: string;
    fileName: string;
    mediaId?: string;
    verified: boolean;
    uploadedAt: string;
  }[];
  approvedAt?: string;
  createdAt: string;
}

export interface Attendant {
  id: string;
  name: string;
  employeeCode: string;
  phone: string;
  vendorId: string;
  vendorName: string;
  zoneId?: string;
  zoneName?: string;
  isActive: boolean;
  onShift: boolean;
  /**
   * Whether a handset is currently bound to this account.
   *
   * Definite now, not optional-because-unknown: the roster endpoint carries the
   * live device bindings, so `false` means nobody has signed in on a handset —
   * it no longer means "the list did not say".
   */
  deviceBound: boolean;
  /**
   * The bound handset, when there is one. The newest binding, which is the one
   * in the attendant's hand — an account is meant to hold exactly one.
   */
  boundDevice?: {
    platform: string;
    appVersion?: string;
    lastSeenAt?: string;
  };
  /** Session and collection totals arrive with the sessions and payments work. */
  sessionsToday?: number;
  collectionToday?: Paise;
  rating?: number;
  createdAt: string;
}

export interface Shift {
  id: string;
  attendantId: string;
  attendantName: string;
  vendorName: string;
  zoneName: string;
  startAt: string;
  endAt?: string;
  sessionsCount: number;
  cashExpected: Paise;
  cashDeposited?: Paise;
  digitalTotal: Paise;
  varianceAmount?: Paise;
  status: ShiftStatus;
}

export interface VehicleType {
  id: string;
  code: SlotType;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

export interface TariffRule {
  id: string;
  type: TariffRuleType;
  dayType: DayType;
  timeFrom?: string;
  timeTo?: string;
  multiplier?: number;
  flatAmount?: Paise;
  isActive: boolean;
}

export interface Tariff {
  id: string;
  name: string;
  zoneId?: string;
  zoneName: string;
  vehicleType: SlotType;
  baseAmount: Paise;
  baseMinutes: number;
  incrementAmount: Paise;
  incrementMinutes: number;
  dailyCapAmount?: Paise;
  gracePeriodMin: number;
  overstayPenalty?: Paise;
  taxPercent: number;
  effectiveFrom: string;
  effectiveTo?: string;
  isPublished: boolean;
  version: number;
  rules: TariffRule[];
  createdAt: string;
}

/** One line of a fare. Amounts are integer paise, like every other figure. */
export interface QuoteLine {
  label: string;
  code: string;
  amount: Paise;
}

/**
 * A priced parking fare, and the arithmetic behind it.
 *
 * Declared here rather than beside the endpoint that returns it, because two
 * different things in this system are this shape: what `POST /tariffs/preview`
 * answers with, and the `fareBreakdown` a session stores when it ends. They are
 * the same object — the server writes down the quote it charged — so there is
 * one type for both, and `Quote` in the API layer is this.
 *
 * Mirrors the `Quote` interface in the backend's
 * `src/modules/tariffs/quote.service.ts`. Nothing in this portal ever computes
 * one: the server is the single authority on price, which is why the portal,
 * the attendant app and the citizen app can never disagree about what is owed.
 */
export interface Quote {
  tariffId: string;
  tariffName: string;
  /**
   * Not the tariff's `version`, despite the name: the server fills this from
   * `tariff.priority` (`quote.service.ts:195`). Carried so the shape matches
   * what is actually stored, and deliberately not rendered anywhere — a number
   * captioned "version 3" that is really a tie-break rank is worse than no
   * number at all. Read `Tariff.version` if a version is what is wanted.
   */
  tariffVersion: number;
  /** Wall-clock minutes between arrival and exit. */
  durationMinutes: number;
  /** What was actually billed for, once the grace period came off. */
  chargeableMinutes: number;
  gracePeriodMin: number;
  lines: QuoteLine[];
  grossAmount: Paise;
  discountAmount: Paise;
  penaltyAmount: Paise;
  taxAmount: Paise;
  /**
   * The real percentage this fare was taxed at. Read it — never assume 18. The
   * Fare tab hardcoded "GST (18%)" for months while the figure beside it had
   * been computed from whatever the rate card said.
   */
  taxPercent: number;
  payableAmount: Paise;
  cappedByDailyLimit: boolean;
  waivedByPass: boolean;
  passId?: string;
}

export interface ParkingSession {
  id: string;
  code: string;
  plateNumber: string;
  vehicleType: SlotType;
  zoneId: string;
  zoneName: string;
  /**
   * The bay this session is parked in, as an id and as the code on the kerb.
   *
   * `slotId` is what joins a session to a bay, which is the bay board's whole
   * job; `slotCode` is what a table cell renders. Both are carried because a
   * code is not unique across zones and an id is not readable. Either can be
   * absent: a zone may legitimately have no numbered bays recorded, and a
   * session started without one is not an error.
   */
  slotId?: string;
  slotCode?: string;
  vendorName: string;
  attendantName: string;
  /**
   * The ids behind the two display names above. Carried so a screen can filter
   * or link by vendor and attendant without matching on a name that two
   * operators could share.
   */
  vendorId?: string;
  attendantId?: string;
  status: SessionStatus;
  source: SessionSource;
  startAt: string;
  endAt?: string;
  /**
   * The final duration of a closed session. Deliberately separate from
   * `elapsedMinutes`: a screen that ticks has to know which of the two it is
   * holding, or it renders a frozen figure that looks live.
   */
  durationMinutes?: number;
  /**
   * The server's own elapsed-time figure.
   *
   * Minutes since arrival while a session is running, and the final duration
   * once it has ended — the API computes it as
   * `endAt === null ? now - startAt : durationMinutes`. So it does *not* by
   * itself say whether a vehicle is still there; `status` does, and every
   * screen that ticks branches on that.
   *
   * Carried because it is the figure a client-side clock counts on from, and
   * the one a screen shows before its first tick rather than rendering a blank.
   */
  elapsedMinutes?: number;
  grossAmount?: Paise;
  discountAmount: Paise;
  taxAmount: Paise;
  penaltyAmount: Paise;
  payableAmount?: Paise;
  /**
   * How the total was arrived at — every line, the grace period, the tax rate
   * actually applied. The four flat totals above are what a table cell needs;
   * this is what a citizen disputing a charge needs, and the server has always
   * stored it.
   *
   * Absent for a running session, which has not been priced, and for any row
   * whose stored breakdown does not parse as a fare — see `toSession`.
   */
  fareBreakdown?: Quote;
  paymentMode?: PaymentMode;
  paid: boolean;
  evidenceStart?: string;
  evidenceEnd?: string;
  citizenName?: string;
  citizenPhone?: string;
  isOverstay: boolean;
}

export interface Payment {
  id: string;
  sessionCode?: string;
  plateNumber?: string;
  /** Carried so a screen can resolve the display name from a list it already has. */
  zoneId?: string;
  vendorId?: string;
  mode: PaymentMode;
  amount: Paise;
  status: PaymentStatus;
  gatewayPaymentId?: string;
  vendorName: string;
  attendantName?: string;
  zoneName: string;
  paidAt?: string;
  refundedAmount: Paise;
  receiptNumber?: string;
  failureReason?: string;
}

export interface SettlementLine {
  id: string;
  sessionCode: string;
  plateNumber: string;
  mode: PaymentMode;
  amount: Paise;
  commission: Paise;
}

export interface Settlement {
  id: string;
  reference: string;
  vendorId: string;
  vendorName: string;
  periodStart: string;
  periodEnd: string;
  grossCollected: Paise;
  cashCollected: Paise;
  digitalCollected: Paise;
  commissionAmount: Paise;
  vendorShare: Paise;
  governmentShare: Paise;
  status: SettlementStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  payoutRef?: string;
  sessionsCount: number;
  lines: SettlementLine[];
}

export interface PassPlan {
  id: string;
  name: string;
  vehicleType: SlotType;
  zoneScope: string;
  durationDays: number;
  price: Paise;
  isActive: boolean;
  activePasses: number;
}

export interface Pass {
  id: string;
  code: string;
  holderName: string;
  holderPhone: string;
  plateNumber: string;
  planName: string;
  validFrom: string;
  validTo: string;
  status: PassStatus;
  price: Paise;
}

export interface Citizen {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicleCount: number;
  sessionsCount: number;
  totalSpent: Paise;
  status: UserStatus;
  hasActivePass: boolean;
  joinedAt: string;
  /**
   * Absent when the citizen has never signed in.
   *
   * Deliberately optional rather than defaulted: the adapter used to fall back
   * to the join date, which rendered as activity that never happened — an
   * account created and never used showed "last active" on the day it was
   * created. A missing value is the honest answer and the screen says so.
   */
  lastSeenAt?: string;
}

export interface Incident {
  id: string;
  reference: string;
  type: IncidentType;
  zoneName: string;
  sessionCode?: string;
  plateNumber?: string;
  reportedBy: string;
  reporterRole: Role;
  description: string;
  photoCount: number;
  status: IncidentStatus;
  /** Display name of the assignee; `assignedToId` is what a write sends back. */
  assignedTo?: string;
  assignedToId?: string;
  resolutionNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface AuditEntry {
  id: string;
  actorName: string;
  actorRole: Role;
  action: string;
  entity: string;
  entityLabel: string;
  ip: string;
  device: string;
  createdAt: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface LoginEntry {
  id: string;
  identifier: string;
  role: Role;
  success: boolean;
  reason?: string;
  ip: string;
  device: string;
  createdAt: string;
}

export interface DeviceEntry {
  id: string;
  ownerName: string;
  role: Role;
  platform: string;
  fingerprint: string;
  appVersion: string;
  boundTo?: string;
  lastSeenAt: string;
  isActive: boolean;
}

export interface SyncEntry {
  id: string;
  attendantName: string;
  device: string;
  eventCount: number;
  acceptedCount: number;
  conflictCount: number;
  createdAt: string;
}

export interface ReportJob {
  id: string;
  type: string;
  paramsLabel: string;
  status: ReportStatus;
  requestedBy: string;
  format: "pdf" | "xlsx" | "csv";
  createdAt: string;
  completedAt?: string;
  sizeKb?: number;
}

/** Daily, weekly or monthly. Not a cron expression — see the API's own note. */
export type ReportFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

/**
 * A standing instruction to run a report again and again.
 *
 * The clock fields are a *local* wall time in `timezone`, not a UTC instant.
 * That distinction is the whole feature: every timestamp in the platform is UTC
 * and every screen renders Asia/Kolkata, so a schedule that carried only an
 * instant would honour "Monday at eight" five and a half hours late. `nextRunAt`
 * is the instant the intent resolves to and is computed by the API, never here.
 */
export interface ReportSchedule {
  id: string;
  name: string;
  /** The catalogue key, e.g. `revenue`. */
  type: string;
  /** The catalogue's own label for that key. */
  label: string;
  frequency: ReportFrequency;
  hour: number;
  minute: number;
  /** ISO weekday, 1 = Monday … 7 = Sunday. Weekly schedules only. */
  weekday: number | null;
  /** 1–31, clamped to the last day of a short month. Monthly schedules only. */
  dayOfMonth: number | null;
  timezone: string;
  /** "Every Monday at 08:00 (Asia/Kolkata)", worded by the API. */
  cadence: string;
  zoneId: string | null;
  vendorId: string | null;
  /** "The previous 7 days · Alipore Road". */
  paramsLabel: string;
  channels: string[];
  ownerName: string;
  isActive: boolean;
  nextRunAt: string;
  lastRunAt?: string;
  lastStatus?: ReportStatus;
  lastError?: string;
  failureCount: number;
  /** How many consecutive failures the API allows before it pauses a schedule. */
  failuresBeforePause: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  kind: "alert" | "info" | "success" | "warning";
  href?: string;
  createdAt: string;
  read: boolean;
}

export interface ActivityItem {
  id: string;
  kind: "session_start" | "session_end" | "payment" | "incident" | "shift" | "settlement";
  label: string;
  detail: string;
  zoneName: string;
  amount?: Paise;
  at: string;
}

export interface CmsPage {
  slug: string;
  title: string;
  updatedAt: string;
  published: boolean;
  words: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  isActive: boolean;
}

export interface Banner {
  id: string;
  title: string;
  body: string;
  audience: "CITIZEN" | "VENDOR" | "ALL";
  startAt: string;
  endAt: string;
  isActive: boolean;
}
