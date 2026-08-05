import type { Settlement, SettlementLine, ReportJob } from "@/shared/types/domain.types";
import { VENDORS } from "./partners";
import { SESSIONS } from "./operations";
import { makeRng, daysAgo } from "./rng";

const rng = makeRng(909191);

function linesFor(count: number): SettlementLine[] {
  return Array.from({ length: count }).map((_, i) => {
    const s = SESSIONS[(i * 7) % SESSIONS.length];
    const amount = s.payableAmount ?? 20000;
    return {
      id: `stl_line_${i}`,
      sessionCode: s.code,
      plateNumber: s.plateNumber,
      mode: s.paymentMode ?? "CASH",
      amount,
      commission: Math.round(amount * 0.18),
    };
  });
}

const STATUSES: Settlement["status"][] = [
  "PENDING_APPROVAL",
  "PENDING_APPROVAL",
  "APPROVED",
  "PAID",
  "PAID",
  "PAID",
  "DRAFT",
  "REJECTED",
  "FAILED",
];

export const SETTLEMENTS: Settlement[] = Array.from({ length: 24 }).map((_, i) => {
  const vendor = VENDORS[i % 4];
  const status = STATUSES[i % STATUSES.length];
  const gross = rng.int(80_000, 620_000) * 100;
  const cash = Math.round(gross * (0.32 + rng.next() * 0.14));
  const digital = gross - cash;
  const commission = Math.round((gross * vendor.commissionPct) / 100);
  const periodEndDays = i * 7;
  return {
    id: `stl_${String(i + 1).padStart(3, "0")}`,
    reference: `STL/2026/${String(1200 + i)}`,
    vendorId: vendor.id,
    vendorName: vendor.orgName,
    periodStart: daysAgo(periodEndDays + 7),
    periodEnd: daysAgo(periodEndDays),
    grossCollected: gross,
    cashCollected: cash,
    digitalCollected: digital,
    commissionAmount: commission,
    vendorShare: gross - commission,
    governmentShare: commission,
    status,
    approvedBy: ["APPROVED", "PAID"].includes(status) ? "Sudipta Banerjee (Deputy Commissioner)" : undefined,
    approvedAt: ["APPROVED", "PAID"].includes(status) ? daysAgo(periodEndDays - 1) : undefined,
    rejectionReason: status === "REJECTED" ? "Cash deposit variance of ₹3,240 unresolved for 3 shifts." : undefined,
    payoutRef: status === "PAID" ? `pout_R${rng.int(10000000, 99999999)}` : undefined,
    sessionsCount: rng.int(420, 3800),
    lines: linesFor(rng.int(8, 14)),
  };
});

export const REPORT_TYPES = [
  { key: "revenue", label: "Revenue report", description: "Collections by day, zone, vendor and payment mode." },
  { key: "occupancy", label: "Occupancy report", description: "Utilisation, peak hours and turnover per zone." },
  { key: "vendor", label: "Vendor report", description: "Performance, collections and commission per vendor." },
  { key: "user", label: "Citizen report", description: "Registrations, active users, repeat parking behaviour." },
  { key: "duration", label: "Parking duration report", description: "Duration distribution and average stay." },
  { key: "daily-collection", label: "Daily collection", description: "Cash versus digital, shift by shift." },
  { key: "monthly-collection", label: "Monthly collection", description: "Month-end consolidated collection statement." },
  { key: "government-revenue", label: "Government revenue", description: "Municipal share after commission, by period." },
  { key: "settlement", label: "Vendor settlement", description: "Settlement lines, commission and payout status." },
  { key: "tax", label: "Tax report", description: "GST collected and payable, invoice-wise." },
  { key: "audit", label: "Audit report", description: "Complete before/after trail for a period." },
] as const;

export const REPORT_JOBS: ReportJob[] = [
  { id: "rpt_001", type: "Revenue report", paramsLabel: "01 Aug – 05 Aug 2026 · All zones", status: "COMPLETED", requestedBy: "Sudipta Banerjee", format: "xlsx", createdAt: daysAgo(0), completedAt: daysAgo(0), sizeKb: 428 },
  { id: "rpt_002", type: "Vendor settlement", paramsLabel: "July 2026 · Metro Parking", status: "COMPLETED", requestedBy: "Rina Dasgupta", format: "pdf", createdAt: daysAgo(1), completedAt: daysAgo(1), sizeKb: 196 },
  { id: "rpt_003", type: "Occupancy report", paramsLabel: "Last 30 days · Ward 45", status: "RUNNING", requestedBy: "Sudipta Banerjee", format: "csv", createdAt: daysAgo(0) },
  { id: "rpt_004", type: "Tax report", paramsLabel: "Q1 FY 2026-27", status: "QUEUED", requestedBy: "Audit Cell", format: "xlsx", createdAt: daysAgo(0) },
  { id: "rpt_005", type: "Audit report", paramsLabel: "01 Jul – 31 Jul 2026", status: "COMPLETED", requestedBy: "Audit Cell", format: "pdf", createdAt: daysAgo(3), completedAt: daysAgo(3), sizeKb: 1_204 },
  { id: "rpt_006", type: "Government revenue", paramsLabel: "FY 2026-27 to date", status: "FAILED", requestedBy: "Rina Dasgupta", format: "pdf", createdAt: daysAgo(4) },
  { id: "rpt_007", type: "Daily collection", paramsLabel: "04 Aug 2026 · All vendors", status: "COMPLETED", requestedBy: "Sudipta Banerjee", format: "csv", createdAt: daysAgo(1), completedAt: daysAgo(1), sizeKb: 88 },
];

export const SCHEDULED_REPORTS = [
  { id: "sch_1", type: "Daily collection", cadence: "Every day at 06:00", recipients: "commissioner@kmc.gov.in, audit@kmc.gov.in", format: "xlsx", isActive: true },
  { id: "sch_2", type: "Vendor settlement", cadence: "Every Monday at 08:00", recipients: "finance@kmc.gov.in", format: "pdf", isActive: true },
  { id: "sch_3", type: "Occupancy report", cadence: "1st of every month", recipients: "planning@kmc.gov.in", format: "csv", isActive: false },
];
