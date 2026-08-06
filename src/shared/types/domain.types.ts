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
  revenueMonth: Paise;
  pendingSettlement: Paise;
  kycComplete: boolean;
  documents: { id: string; type: string; fileName: string; verified: boolean; uploadedAt: string }[];
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
  /** Reported by the attendant detail endpoint, not the list. */
  deviceBound?: boolean;
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

export interface ParkingSession {
  id: string;
  code: string;
  plateNumber: string;
  vehicleType: SlotType;
  zoneId: string;
  zoneName: string;
  slotCode?: string;
  vendorName: string;
  attendantName: string;
  status: SessionStatus;
  source: SessionSource;
  startAt: string;
  endAt?: string;
  durationMinutes?: number;
  grossAmount?: Paise;
  discountAmount: Paise;
  taxAmount: Paise;
  penaltyAmount: Paise;
  payableAmount?: Paise;
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
  lastSeenAt: string;
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
  assignedTo?: string;
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
