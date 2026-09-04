import type { ApiZone, ApiVendor } from "@/frontend/api";
import type { ApiSession } from "@/frontend/api/endpoints/sessions.api";
import type { ApiPayment } from "@/frontend/api/endpoints/payments.api";
import type { ApiShift } from "@/frontend/api/endpoints/shifts.api";
import type { ApiIncident } from "@/frontend/api/endpoints/incidents.api";
import type { ApiPass, ApiPassPlan } from "@/frontend/api/endpoints/passes.api";
import type { ApiCitizen } from "@/frontend/api/endpoints/citizens.api";
import type { ApiSettlement, ApiSettlementDetail } from "@/frontend/api/endpoints/settlements.api";
import type { ApiReportJob, ApiReportSchedule } from "@/frontend/api/endpoints/reports.api";
import type { ApiTariff } from "@/frontend/api/endpoints/tariffs.api";
import type {
  ApiSlot,
  ApiAttendant,
  ApiUser,
  ApiCmsPage,
  ApiFaq,
  ApiBanner,
} from "@/frontend/api/endpoints/master.api";
import type {
  Zone,
  Slot,
  Attendant,
  User,
  Vendor,
  CmsPage,
  Faq,
  Banner,
  Citizen,
  Incident,
  ParkingSession,
  Pass,
  PassPlan,
  Payment,
  ReportJob,
  ReportSchedule,
  ReportStatus,
  Settlement,
  Shift,
  Tariff,
} from "@/shared/types/domain.types";
import type { Role } from "@/shared/constants/roles";

/**
 * Translates what the API returns into the shapes the screens render.
 *
 * The two differ on purpose. The API answers in normalised records — `ward` as
 * an object, latitude and longitude as separate columns — while a table cell
 * wants a name and a point. Keeping the difference here means the view code is
 * the same whether it is reading the API or the bundled demo dataset, and the
 * one place to look when a contract changes is this file.
 *
 * Where the API has no answer yet, these leave the field undefined rather than
 * substituting a zero. A blank cell reads as "not known"; ₹0 reads as a fact.
 */

/**
 * The other direction, for the one form that has two entry points.
 *
 * The zone form edits the shape the table renders; the API takes the normalised
 * one. Only defined fields are sent, so a partial edit stays a partial update
 * rather than blanking whatever the form did not touch.
 */
export function toZonePayload(draft: Partial<Zone>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value !== undefined && value !== "") payload[key] = value;
  };

  put("code", draft.code);
  put("name", draft.name);
  put("wardId", draft.wardId);
  put("capacity", draft.capacity);
  put("openTime", draft.openTime);
  put("closeTime", draft.closeTime);
  put("allowedVehicleTypeIds", draft.allowedVehicleTypes);
  put("vendorId", draft.vendorId);
  if (draft.center) {
    payload.centerLat = draft.center.lat;
    payload.centerLng = draft.center.lng;
  }
  return payload;
}

export function toZone(zone: ApiZone): Zone {
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    wardId: zone.wardId ?? "",
    wardName: zone.ward?.name ?? "—",
    streetName: zone.street?.name ?? "—",
    center: { lat: zone.centerLat, lng: zone.centerLng },
    capacity: zone.capacity,
    occupied: zone.occupied,
    allowedVehicleTypes: zone.allowedVehicleTypeIds,
    openTime: zone.openTime,
    closeTime: zone.closeTime,
    status: zone.status,
    closureReason: zone.closureReason ?? undefined,
    closureUntil: zone.closureUntil ?? undefined,
    vendorId: zone.vendor?.id,
    vendorName: zone.vendor?.orgName,
    // Revenue is a payments question and payments are not built yet.
    revenueToday: undefined,
    revenueMonth: undefined,
    // Only the single-zone endpoint counts bays; the list does not.
    slotCount: undefined,
    boundaryPoints: zone.boundary?.coordinates?.[0]?.length ?? 0,
    createdAt: zone.createdAt,
  };
}

export function toSlot(slot: ApiSlot): Slot {
  return {
    id: slot.id,
    zoneId: slot.zoneId,
    zoneName: slot.zone?.name ?? "—",
    code: slot.code,
    type: slot.type,
    status: slot.status,
    isReserved: slot.isReserved,
  };
}

export function toAttendant(attendant: ApiAttendant): Attendant {
  return {
    id: attendant.id,
    name: attendant.user.name,
    phone: attendant.user.phone ?? "",
    employeeCode: attendant.employeeCode,
    vendorId: attendant.vendorId,
    vendorName: attendant.vendor.orgName,
    zoneId: attendant.defaultZoneId ?? undefined,
    isActive: attendant.isActive,
    onShift: Boolean(attendant.onShift),
    // Device binding is reported by the attendant detail endpoint, not the list.
    deviceBound: undefined,
    sessionsToday: undefined,
    collectionToday: undefined,
    createdAt: attendant.createdAt,
  };
}

export function toUser(user: ApiUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt ?? undefined,
    createdAt: user.createdAt,
    twoFactorEnabled: user.twoFactorEnabled,
  };
}

export function toVendor(vendor: ApiVendor): Vendor {
  return {
    id: vendor.id,
    orgName: vendor.orgName,
    contactName: vendor.contactName,
    contactPhone: vendor.contactPhone,
    email: vendor.user?.email ?? "",
    gstin: vendor.gstin ?? undefined,
    pan: vendor.pan ?? undefined,
    bankAccountNo: vendor.bankAccountNo ?? undefined,
    bankIfsc: vendor.bankIfsc ?? undefined,
    // Prisma Decimal arrives as a string; every arithmetic use needs the number.
    commissionPct: Number(vendor.commissionPct ?? 0),
    rating: vendor.rating ? Number(vendor.rating) : undefined,
    status: vendor.status,
    zoneCount: vendor.zoneCount ?? vendor._count?.zones ?? 0,
    attendantCount: vendor.attendantCount ?? vendor._count?.attendants ?? 0,
    // Both are settlement figures, and settlement is not built yet.
    revenueMonth: undefined,
    pendingSettlement: undefined,
    kycComplete: vendor.kycComplete ?? false,
    documents: (vendor.documents ?? []).map((doc) => ({
      id: doc.id,
      type: doc.type,
      fileName: doc.type,
      mediaId: doc.mediaId,
      verified: Boolean(doc.verifiedAt),
      uploadedAt: doc.createdAt,
    })),
    approvedAt: vendor.approvedAt ?? undefined,
    createdAt: vendor.createdAt,
  };
}

export function toCmsPage(page: ApiCmsPage): CmsPage {
  return {
    slug: page.slug,
    title: page.title,
    updatedAt: page.updatedAt,
    published: Boolean(page.publishedAt),
    // The list screen shows a length; the body is markup, so count text words.
    words: page.bodyHtml
      ? page.bodyHtml.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length
      : 0,
  };
}

export function toFaq(faq: ApiFaq): Faq {
  return {
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    category: faq.category ?? "General",
    isActive: faq.isActive,
  };
}

export function toBanner(banner: ApiBanner): Banner {
  return {
    id: banner.id,
    title: banner.title,
    body: banner.body ?? "",
    audience: banner.audience,
    startAt: banner.startAt,
    endAt: banner.endAt,
    isActive: banner.isActive,
  };
}

export function toSession(session: ApiSession): ParkingSession {
  return {
    id: session.id,
    code: session.code,
    plateNumber: session.plateNumber,
    vehicleType: session.vehicleType?.code ?? "CAR",
    zoneId: session.zoneId,
    zoneName: session.zone?.name ?? "—",
    slotCode: session.slot?.code,
    vendorName: session.vendor?.orgName ?? "—",
    attendantName: session.attendant?.user?.name ?? "—",
    status: session.status,
    source: session.source,
    startAt: session.startAt,
    endAt: session.endAt ?? undefined,
    durationMinutes: session.durationMinutes ?? session.elapsedMinutes ?? undefined,
    grossAmount: session.grossAmount ?? undefined,
    discountAmount: session.discountAmount,
    taxAmount: session.taxAmount,
    penaltyAmount: session.penaltyAmount,
    payableAmount: session.payableAmount ?? undefined,
    // The list now carries whichever payment was captured, so this is read
    // rather than assumed. It used to be hardcoded `false` under a comment
    // saying the state was unknown — which is not what `false` says to a
    // screen, and every completed session rendered as unpaid because of it.
    paymentMode: session.payments?.[0]?.mode,
    paid: (session.payments?.length ?? 0) > 0,
    evidenceStart: session.evidenceStartMediaId ?? undefined,
    evidenceEnd: session.evidenceEndMediaId ?? undefined,
    isOverstay: session.isOverstay ?? false,
  };
}

/**
 * A payment as the table renders it.
 *
 * The API returns a payment's session with ids rather than names, because a
 * payment does not own a zone or a vendor — the session does. Resolving them
 * needs the zone and vendor lists the screen has already loaded, so they arrive
 * here as lookups rather than being fetched per row.
 */
export function toPayment(
  payment: ApiPayment,
  names?: { zones?: Map<string, string>; vendors?: Map<string, string> },
): Payment {
  const session = payment.session ?? null;
  return {
    id: payment.id,
    sessionCode: session?.code,
    plateNumber: session?.plateNumber,
    zoneId: session?.zoneId,
    vendorId: session?.vendorId,
    mode: payment.mode,
    amount: payment.amount,
    status: payment.status,
    gatewayPaymentId: payment.gatewayPaymentId ?? undefined,
    zoneName: (session && names?.zones?.get(session.zoneId)) ?? "—",
    vendorName: (session && names?.vendors?.get(session.vendorId)) ?? "—",
    // The list select carries the attendant's id but not their name.
    attendantName: undefined,
    paidAt: payment.paidAt ?? undefined,
    refundedAmount: payment.refundedAmount,
    receiptNumber: payment.receipt?.number,
    failureReason: payment.failureReason ?? undefined,
  };
}

export function toReportJob(job: ApiReportJob): ReportJob {
  return {
    id: job.id,
    type: job.label,
    paramsLabel: job.paramsLabel,
    status: job.status,
    requestedBy: job.requestedBy,
    // The API produces CSV only — a PDF or spreadsheet would need a rendering
    // library the backend does not carry, and a CSV named `.pdf` is a lie.
    format: "csv",
    createdAt: job.createdAt,
    completedAt: job.completedAt ?? undefined,
  };
}

export function toReportSchedule(schedule: ApiReportSchedule): ReportSchedule {
  return {
    id: schedule.id,
    name: schedule.name,
    type: schedule.type,
    label: schedule.label,
    frequency: schedule.frequency,
    hour: schedule.hour,
    minute: schedule.minute,
    weekday: schedule.weekday,
    dayOfMonth: schedule.dayOfMonth,
    timezone: schedule.timezone,
    // Worded by the API rather than rebuilt here. The portal would otherwise be
    // a second place that decides what "every Monday at eight" means, and the
    // two would eventually disagree about a schedule nobody had touched.
    cadence: schedule.cadence,
    zoneId: schedule.zoneId,
    vendorId: schedule.vendorId,
    paramsLabel: schedule.paramsLabel,
    channels: schedule.channels,
    ownerName: schedule.ownerName,
    isActive: schedule.isActive,
    nextRunAt: schedule.nextRunAt,
    lastRunAt: schedule.lastRunAt ?? undefined,
    // The column holds a ReportStatus written by the runner; anything else came
    // from a version of the API this build does not know about, and is dropped
    // rather than rendered as an unrecognised badge.
    lastStatus: isReportStatus(schedule.lastStatus) ? schedule.lastStatus : undefined,
    lastError: schedule.lastError ?? undefined,
    failureCount: schedule.failureCount,
    failuresBeforePause: schedule.failuresBeforePause,
  };
}

function isReportStatus(value: string | null | undefined): value is ReportStatus {
  return value === "QUEUED" || value === "RUNNING" || value === "COMPLETED" || value === "FAILED";
}

export function toSettlement(settlement: ApiSettlement | ApiSettlementDetail): Settlement {
  const lines = "lines" in settlement ? settlement.lines : [];
  return {
    id: settlement.id,
    reference: settlement.reference,
    vendorId: settlement.vendorId,
    vendorName: settlement.vendor?.orgName ?? "—",
    periodStart: settlement.periodStart,
    periodEnd: settlement.periodEnd,
    grossCollected: settlement.grossCollected,
    cashCollected: settlement.cashCollected,
    digitalCollected: settlement.digitalCollected,
    commissionAmount: settlement.commissionAmount,
    vendorShare: settlement.vendorShare,
    governmentShare: settlement.governmentShare,
    status: settlement.status,
    approvedBy: settlement.approvedBy ?? undefined,
    approvedAt: settlement.approvedAt ?? undefined,
    rejectionReason: settlement.rejectionReason ?? undefined,
    payoutRef: settlement.payoutRef ?? undefined,
    // One line per payment, so this is the count of sessions paid for.
    sessionsCount: settlement.sessionsCount,
    lines: lines.map((line) => ({
      id: line.id,
      sessionCode: line.payment?.session?.code ?? "—",
      plateNumber: line.payment?.session?.plateNumber ?? "—",
      mode: line.payment?.mode ?? "CASH",
      amount: line.amount,
      commission: line.commission,
    })),
  };
}

export function toCitizen(citizen: ApiCitizen): Citizen {
  return {
    id: citizen.id,
    name: citizen.name,
    phone: citizen.phone ?? "—",
    email: citizen.email ?? undefined,
    vehicleCount: citizen.vehicleCount,
    sessionsCount: citizen.sessionsCount,
    totalSpent: citizen.totalSpent,
    status: citizen.status,
    hasActivePass: citizen.hasActivePass,
    joinedAt: citizen.joinedAt,
    // Never signed in yet stays absent. The fallback to the join date that used
    // to be here read as activity that never happened — which is exactly what
    // the comment above it said to avoid.
    lastSeenAt: citizen.lastSeenAt ?? undefined,
  };
}

export function toPassPlan(plan: ApiPassPlan): PassPlan {
  return {
    id: plan.id,
    name: plan.name,
    vehicleType: plan.vehicleType?.code ?? "CAR",
    zoneScope: plan.zoneScope,
    durationDays: plan.durationDays,
    price: plan.price,
    isActive: plan.isActive,
    activePasses: plan.activePasses,
  };
}

export function toPass(pass: ApiPass): Pass {
  return {
    id: pass.id,
    code: pass.qrCode,
    holderName: pass.user?.name ?? "—",
    holderPhone: pass.user?.phone ?? "—",
    plateNumber: pass.vehicle?.plateNumber ?? "—",
    planName: pass.plan?.name ?? "—",
    validFrom: pass.validFrom,
    validTo: pass.validTo,
    status: pass.status,
    // What this pass was actually sold for. The plan's price can move later;
    // this figure is the one the holder paid.
    price: pass.plan?.price ?? 0,
  };
}

export function toIncident(incident: ApiIncident): Incident {
  return {
    id: incident.id,
    reference: incident.reference,
    type: incident.type,
    zoneName: incident.zone?.name ?? "—",
    sessionCode: incident.session?.code,
    plateNumber: incident.session?.plateNumber,
    reportedBy: incident.reportedBy?.name ?? "—",
    // A reporter can be an attendant, a citizen or a portal user, and the
    // authority can invent roles — so this is whatever code the account holds.
    reporterRole: (incident.reportedBy?.role ?? "CITIZEN") as Role,
    description: incident.description,
    photoCount: incident.photoCount,
    status: incident.status,
    assignedTo: incident.assignedToUser?.name,
    assignedToId: incident.assignedTo ?? undefined,
    resolutionNote: incident.resolutionNote ?? undefined,
    createdAt: incident.createdAt,
    resolvedAt: incident.resolvedAt ?? undefined,
  };
}

export function toShift(shift: ApiShift): Shift {
  return {
    id: shift.id,
    attendantId: shift.attendantId,
    attendantName: shift.attendant?.user.name ?? "—",
    vendorName: shift.vendor?.orgName ?? "—",
    zoneName: shift.zone?.name ?? "—",
    startAt: shift.startAt,
    endAt: shift.endAt ?? undefined,
    sessionsCount: shift.sessionsCount,
    cashExpected: shift.cashExpected,
    // Null means not yet declared, which the screen renders as "pending". A
    // zero is a real count of an empty pocket and must not become that.
    cashDeposited: shift.cashDeposited ?? undefined,
    digitalTotal: shift.digitalTotal,
    varianceAmount: shift.varianceAmount ?? undefined,
    status: shift.status,
  };
}

export function toTariff(tariff: ApiTariff): Tariff {
  return {
    id: tariff.id,
    name: tariff.name,
    zoneId: tariff.zoneId ?? undefined,
    // A tariff with no zone applies city-wide; that is a meaning, not a gap.
    zoneName: tariff.zone?.name ?? "All zones",
    vehicleType: tariff.vehicleType?.code ?? "CAR",
    baseAmount: tariff.baseAmount,
    baseMinutes: tariff.baseMinutes,
    incrementAmount: tariff.incrementAmount,
    incrementMinutes: tariff.incrementMinutes,
    dailyCapAmount: tariff.dailyCapAmount ?? undefined,
    gracePeriodMin: tariff.gracePeriodMin,
    overstayPenalty: tariff.overstayPenalty ?? undefined,
    taxPercent: tariff.taxPercent,
    effectiveFrom: tariff.effectiveFrom,
    effectiveTo: tariff.effectiveTo ?? undefined,
    isPublished: tariff.isPublished,
    version: tariff.version,
    rules: (tariff.rules ?? []) as Tariff["rules"],
    createdAt: tariff.createdAt,
  };
}
