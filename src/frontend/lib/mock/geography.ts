import type { Ward, Zone, Slot, SlotType, ZoneStatus } from "@/shared/types/domain.types";
import { makeRng, daysAgo, daysAhead } from "./rng";

const rng = makeRng(20260805);

export const WARDS: Ward[] = [
  { id: "wd_63", code: "W-63", name: "Ballygunge", zoneCount: 4 },
  { id: "wd_70", code: "W-70", name: "Alipore", zoneCount: 3 },
  { id: "wd_45", code: "W-45", name: "Park Street", zoneCount: 4 },
  { id: "wd_22", code: "W-22", name: "Burrabazar", zoneCount: 3 },
  { id: "wd_88", code: "W-88", name: "Behala", zoneCount: 2 },
  { id: "wd_101", code: "W-101", name: "Salt Lake Sector V", zoneCount: 4 },
];

type ZoneSeed = {
  code: string;
  name: string;
  street: string;
  ward: string;
  capacity: number;
  occupied: number;
  status: ZoneStatus;
  vendor?: string;
  types: SlotType[];
  open: string;
  close: string;
  closureReason?: string;
};

const ZONE_SEEDS: ZoneSeed[] = [
  { code: "PKS-01", name: "Park Street North", street: "Park Street", ward: "wd_45", capacity: 120, occupied: 114, status: "OPEN", vendor: "ven_metro", types: ["CAR", "TWO_WHEELER", "EV"], open: "06:00", close: "23:00" },
  { code: "PKS-02", name: "Park Street South", street: "Park Street", ward: "wd_45", capacity: 96, occupied: 71, status: "OPEN", vendor: "ven_metro", types: ["CAR", "TWO_WHEELER"], open: "06:00", close: "23:00" },
  { code: "PKS-03", name: "Camac Street", street: "Camac Street", ward: "wd_45", capacity: 84, occupied: 80, status: "OPEN", vendor: "ven_metro", types: ["CAR", "TWO_WHEELER", "VIP"], open: "07:00", close: "22:00" },
  { code: "PKS-04", name: "Russell Street", street: "Russell Street", ward: "wd_45", capacity: 62, occupied: 24, status: "MAINTENANCE", vendor: "ven_metro", types: ["CAR", "TWO_WHEELER"], open: "07:00", close: "22:00", closureReason: "Road resurfacing by PWD" },
  { code: "BLG-01", name: "Ballygunge Phari", street: "Gariahat Road", ward: "wd_63", capacity: 110, occupied: 78, status: "OPEN", vendor: "ven_orbit", types: ["CAR", "TWO_WHEELER", "THREE_WHEELER"], open: "06:00", close: "23:00" },
  { code: "BLG-02", name: "Gariahat Market", street: "Gariahat Road", ward: "wd_63", capacity: 140, occupied: 136, status: "OPEN", vendor: "ven_orbit", types: ["CAR", "TWO_WHEELER", "COMMERCIAL"], open: "06:00", close: "22:00" },
  { code: "BLG-03", name: "Hindustan Park", street: "Hindustan Park", ward: "wd_63", capacity: 48, occupied: 19, status: "OPEN", vendor: "ven_orbit", types: ["CAR", "TWO_WHEELER"], open: "07:00", close: "21:00" },
  { code: "BLG-04", name: "Deshapriya Park", street: "Rashbehari Avenue", ward: "wd_63", capacity: 72, occupied: 0, status: "EVENT_CLOSURE", vendor: "ven_orbit", types: ["CAR", "TWO_WHEELER"], open: "06:00", close: "23:00", closureReason: "Community festival — closed to parking" },
  { code: "ALP-01", name: "Alipore Court", street: "Judges Court Road", ward: "wd_70", capacity: 90, occupied: 61, status: "OPEN", vendor: "ven_civic", types: ["CAR", "GOVERNMENT", "VIP"], open: "08:00", close: "20:00" },
  { code: "ALP-02", name: "Zoo Road", street: "Alipore Road", ward: "wd_70", capacity: 130, occupied: 118, status: "OPEN", vendor: "ven_civic", types: ["CAR", "TWO_WHEELER", "BUS"], open: "07:00", close: "21:00" },
  { code: "ALP-03", name: "New Alipore Block K", street: "Sahapur Road", ward: "wd_70", capacity: 54, occupied: 22, status: "OPEN", vendor: "ven_civic", types: ["CAR", "TWO_WHEELER"], open: "06:00", close: "22:00" },
  { code: "BRZ-01", name: "Burrabazar Wholesale", street: "Rabindra Sarani", ward: "wd_22", capacity: 160, occupied: 155, status: "OPEN", vendor: "ven_shakti", types: ["COMMERCIAL", "TRUCK", "THREE_WHEELER"], open: "05:00", close: "22:00" },
  { code: "BRZ-02", name: "Canning Street", street: "Canning Street", ward: "wd_22", capacity: 88, occupied: 84, status: "OPEN", vendor: "ven_shakti", types: ["COMMERCIAL", "TWO_WHEELER"], open: "05:00", close: "21:00" },
  { code: "BRZ-03", name: "Brabourne Road", street: "Brabourne Road", ward: "wd_22", capacity: 66, occupied: 31, status: "CLOSED", vendor: "ven_shakti", types: ["COMMERCIAL", "TRUCK"], open: "06:00", close: "20:00", closureReason: "Contract under review" },
  { code: "BHL-01", name: "Behala Chowrasta", street: "Diamond Harbour Road", ward: "wd_88", capacity: 76, occupied: 44, status: "OPEN", vendor: "ven_orbit", types: ["CAR", "TWO_WHEELER", "THREE_WHEELER"], open: "06:00", close: "22:00" },
  { code: "BHL-02", name: "Behala Tram Depot", street: "Diamond Harbour Road", ward: "wd_88", capacity: 58, occupied: 17, status: "OPEN", vendor: "ven_orbit", types: ["CAR", "TWO_WHEELER"], open: "06:00", close: "22:00" },
  { code: "SLV-01", name: "Sector V Tech Park", street: "Major Arterial Road", ward: "wd_101", capacity: 180, occupied: 168, status: "OPEN", vendor: "ven_metro", types: ["CAR", "TWO_WHEELER", "EV"], open: "07:00", close: "23:00" },
  { code: "SLV-02", name: "College More", street: "Major Arterial Road", ward: "wd_101", capacity: 94, occupied: 52, status: "OPEN", vendor: "ven_metro", types: ["CAR", "TWO_WHEELER"], open: "07:00", close: "23:00" },
  { code: "SLV-03", name: "Karunamoyee", street: "Central Park Road", ward: "wd_101", capacity: 112, occupied: 79, status: "OPEN", vendor: "ven_civic", types: ["CAR", "TWO_WHEELER", "BUS"], open: "06:00", close: "22:00" },
  { code: "SLV-04", name: "Nicco Park Gate", street: "Central Park Road", ward: "wd_101", capacity: 68, occupied: 9, status: "OPEN", vendor: "ven_civic", types: ["CAR", "TWO_WHEELER", "ACCESSIBLE"], open: "09:00", close: "21:00" },
];

const VENDOR_NAMES: Record<string, string> = {
  ven_metro: "Metro Parking Services Pvt Ltd",
  ven_orbit: "Orbit Kerbside Management",
  ven_civic: "Civic Mobility Partners",
  ven_shakti: "Shakti Parking Contractors",
};

export const ZONES: Zone[] = ZONE_SEEDS.map((z, i) => {
  const ward = WARDS.find((w) => w.id === z.ward)!;
  return {
    id: `zn_${z.code.toLowerCase().replace("-", "_")}`,
    code: z.code,
    name: z.name,
    wardId: ward.id,
    wardName: ward.name,
    streetName: z.street,
    center: {
      lat: Number((22.52 + rng.next() * 0.12).toFixed(6)),
      lng: Number((88.32 + rng.next() * 0.12).toFixed(6)),
    },
    capacity: z.capacity,
    occupied: z.occupied,
    allowedVehicleTypes: z.types,
    openTime: z.open,
    closeTime: z.close,
    status: z.status,
    closureReason: z.closureReason,
    closureUntil: z.closureReason ? daysAhead(rng.int(1, 9)) : undefined,
    vendorId: z.vendor,
    vendorName: z.vendor ? VENDOR_NAMES[z.vendor] : undefined,
    revenueToday: rng.int(180, 940) * 100 * (z.occupied > 60 ? 3 : 1),
    revenueMonth: rng.int(9_000, 42_000) * 100,
    slotCount: z.capacity,
    boundaryPoints: rng.int(6, 14),
    createdAt: daysAgo(120 + i * 3),
  };
});

const SLOT_PREFIX: Record<SlotType, string> = {
  CAR: "C",
  TWO_WHEELER: "T",
  THREE_WHEELER: "A",
  COMMERCIAL: "M",
  BUS: "B",
  TRUCK: "K",
  EV: "E",
  VIP: "V",
  GOVERNMENT: "G",
  ACCESSIBLE: "D",
};

const PLATE_POOL = [
  "WB02AB1234", "WB06AH8891", "WB20CD4417", "WB74EF2205", "WB08XY7712",
  "WB12KL3390", "WB26MN5521", "WB04PQ8834", "WB19RS1176", "WB38TU6640",
  "JH05AA2213", "OD02BB9987", "BR01CC4432", "AS01DD7765", "WB07ZZ0091",
];

export const SLOTS: Slot[] = ZONES.flatMap((zone) => {
  const perZone = Math.min(24, Math.max(8, Math.round(zone.capacity / 6)));
  return Array.from({ length: perZone }).map((_, i) => {
    const type = zone.allowedVehicleTypes[i % zone.allowedVehicleTypes.length];
    const occupiedRatio = zone.capacity ? zone.occupied / zone.capacity : 0;
    const status = rng.weighted<Slot["status"]>([
      ["OCCUPIED", occupiedRatio * 100],
      ["AVAILABLE", (1 - occupiedRatio) * 100],
      ["RESERVED", 6],
      ["OUT_OF_SERVICE", 3],
    ]);
    return {
      id: `sl_${zone.code}_${i + 1}`.toLowerCase(),
      zoneId: zone.id,
      zoneName: zone.name,
      code: `${SLOT_PREFIX[type]}${String(i + 1).padStart(2, "0")}`,
      type,
      status,
      isReserved: status === "RESERVED",
      currentPlate: status === "OCCUPIED" ? rng.pick(PLATE_POOL) : undefined,
    };
  });
});

export const OPEN_ZONES = ZONES.filter((z) => z.status === "OPEN");
export const TOTAL_CAPACITY = ZONES.reduce((s, z) => s + z.capacity, 0);
export const TOTAL_OCCUPIED = ZONES.reduce((s, z) => s + z.occupied, 0);
