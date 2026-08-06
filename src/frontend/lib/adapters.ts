import type { ApiZone, ApiVendor } from "@/frontend/api";
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
} from "@/shared/types/domain.types";

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
