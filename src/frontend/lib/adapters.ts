import type { ApiZone } from "@/frontend/api";
import type { ApiSlot, ApiAttendant, ApiUser } from "@/frontend/api/endpoints/master.api";
import type { Zone, Slot, Attendant, User } from "@/shared/types/domain.types";

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
