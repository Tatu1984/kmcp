import type { Tariff, PassPlan, Pass, VehicleType } from "@/shared/types/domain.types";
import { ZONES } from "./geography";
import { makeRng, daysAgo, daysAhead } from "./rng";

const rng = makeRng(112358);

export const VEHICLE_TYPES: VehicleType[] = [
  { id: "vt_two", code: "TWO_WHEELER", label: "Two Wheeler", isActive: true, sortOrder: 1 },
  { id: "vt_three", code: "THREE_WHEELER", label: "Three Wheeler", isActive: true, sortOrder: 2 },
  { id: "vt_car", code: "CAR", label: "Car", isActive: true, sortOrder: 3 },
  { id: "vt_ev", code: "EV", label: "Electric Vehicle", isActive: true, sortOrder: 4 },
  { id: "vt_comm", code: "COMMERCIAL", label: "Commercial", isActive: true, sortOrder: 5 },
  { id: "vt_bus", code: "BUS", label: "Bus", isActive: true, sortOrder: 6 },
  { id: "vt_truck", code: "TRUCK", label: "Truck", isActive: true, sortOrder: 7 },
  { id: "vt_vip", code: "VIP", label: "VIP", isActive: true, sortOrder: 8 },
  { id: "vt_govt", code: "GOVERNMENT", label: "Government", isActive: true, sortOrder: 9 },
  { id: "vt_acc", code: "ACCESSIBLE", label: "Accessible", isActive: false, sortOrder: 10 },
];

type Seed = {
  name: string;
  zone?: string;
  type: Tariff["vehicleType"];
  base: number;
  baseMin: number;
  inc: number;
  incMin: number;
  cap?: number;
  grace: number;
  published: boolean;
  version: number;
};

const SEEDS: Seed[] = [
  { name: "City Standard — Car", type: "CAR", base: 2000, baseMin: 60, inc: 1500, incMin: 60, cap: 15000, grace: 10, published: true, version: 3 },
  { name: "City Standard — Two Wheeler", type: "TWO_WHEELER", base: 1000, baseMin: 60, inc: 700, incMin: 60, cap: 7000, grace: 10, published: true, version: 3 },
  { name: "City Standard — Three Wheeler", type: "THREE_WHEELER", base: 1500, baseMin: 60, inc: 1000, incMin: 60, cap: 9000, grace: 10, published: true, version: 2 },
  { name: "Commercial Kerb Rate", type: "COMMERCIAL", base: 4000, baseMin: 60, inc: 3000, incMin: 60, cap: 30000, grace: 5, published: true, version: 2 },
  { name: "EV Concession", type: "EV", base: 1500, baseMin: 60, inc: 1000, incMin: 60, cap: 10000, grace: 15, published: true, version: 1 },
  { name: "Park Street Premium — Car", zone: "zn_pks_01", type: "CAR", base: 3000, baseMin: 60, inc: 2500, incMin: 30, cap: 24000, grace: 5, published: true, version: 4 },
  { name: "Gariahat Market — Commercial", zone: "zn_blg_02", type: "COMMERCIAL", base: 5000, baseMin: 60, inc: 4000, incMin: 60, cap: 36000, grace: 5, published: true, version: 2 },
  { name: "Sector V Tech Park — Car", zone: "zn_slv_01", type: "CAR", base: 2500, baseMin: 60, inc: 2000, incMin: 60, cap: 18000, grace: 10, published: true, version: 2 },
  { name: "Burrabazar Freight Rate", zone: "zn_brz_01", type: "TRUCK", base: 8000, baseMin: 60, inc: 6000, incMin: 60, cap: 50000, grace: 0, published: true, version: 1 },
  { name: "Bus Bay Standard", type: "BUS", base: 6000, baseMin: 60, inc: 5000, incMin: 60, cap: 40000, grace: 0, published: true, version: 1 },
  { name: "City Standard — Car (Draft v4)", type: "CAR", base: 2500, baseMin: 60, inc: 2000, incMin: 60, cap: 18000, grace: 10, published: false, version: 4 },
  { name: "Festival Surge — All Vehicles (Draft)", type: "CAR", base: 4000, baseMin: 60, inc: 3500, incMin: 30, cap: 30000, grace: 0, published: false, version: 1 },
];

export const TARIFFS: Tariff[] = SEEDS.map((s, i) => {
  const zone = s.zone ? ZONES.find((z) => z.id === s.zone) : undefined;
  return {
    id: `trf_${String(i + 1).padStart(3, "0")}`,
    name: s.name,
    zoneId: zone?.id,
    zoneName: zone?.name ?? "All zones",
    vehicleType: s.type,
    baseAmount: s.base,
    baseMinutes: s.baseMin,
    incrementAmount: s.inc,
    incrementMinutes: s.incMin,
    dailyCapAmount: s.cap,
    gracePeriodMin: s.grace,
    overstayPenalty: 5000,
    taxPercent: 18,
    effectiveFrom: s.published ? daysAgo(rng.int(20, 200)) : daysAhead(rng.int(3, 21)),
    isPublished: s.published,
    version: s.version,
    createdAt: daysAgo(rng.int(25, 220)),
    rules: [
      {
        id: `rul_${i}_1`,
        type: "PEAK_HOUR",
        dayType: "WEEKDAY",
        timeFrom: "09:00",
        timeTo: "12:00",
        multiplier: 1.5,
        isActive: true,
      },
      {
        id: `rul_${i}_2`,
        type: "PEAK_HOUR",
        dayType: "WEEKDAY",
        timeFrom: "17:00",
        timeTo: "21:00",
        multiplier: 1.5,
        isActive: true,
      },
      {
        id: `rul_${i}_3`,
        type: "WEEKEND",
        dayType: "WEEKEND",
        multiplier: 1.25,
        isActive: true,
      },
      {
        id: `rul_${i}_4`,
        type: "NIGHT",
        dayType: "ALL",
        timeFrom: "22:00",
        timeTo: "06:00",
        multiplier: 0.6,
        isActive: true,
      },
      {
        id: `rul_${i}_5`,
        type: "HOLIDAY",
        dayType: "HOLIDAY",
        multiplier: 1.4,
        isActive: i % 3 !== 0,
      },
    ],
  };
});

export const HOLIDAYS = [
  { id: "hol_1", date: "2026-08-15", name: "Independence Day", isEvent: false, multiplier: 1.4 },
  { id: "hol_2", date: "2026-10-02", name: "Gandhi Jayanti", isEvent: false, multiplier: 1.4 },
  { id: "hol_3", date: "2026-10-17", name: "Durga Puja — Saptami", isEvent: true, multiplier: 2.0 },
  { id: "hol_4", date: "2026-10-18", name: "Durga Puja — Ashtami", isEvent: true, multiplier: 2.0 },
  { id: "hol_5", date: "2026-11-08", name: "Kali Puja", isEvent: true, multiplier: 1.8 },
  { id: "hol_6", date: "2026-12-25", name: "Christmas Day", isEvent: false, multiplier: 1.6 },
];

export const DISCOUNTS = [
  { id: "dsc_1", name: "First-time citizen app user", code: "WELCOME", percentOff: 50, flatOff: undefined, validTo: daysAhead(60), maxUses: 5000, usedCount: 1842, isActive: true },
  { id: "dsc_2", name: "EV concession", code: undefined, percentOff: 25, flatOff: undefined, validTo: daysAhead(180), maxUses: undefined, usedCount: 940, isActive: true },
  { id: "dsc_3", name: "Monsoon off-peak", code: "MONSOON26", percentOff: undefined, flatOff: 1000, validTo: daysAhead(14), maxUses: 20000, usedCount: 6621, isActive: true },
  { id: "dsc_4", name: "Senior citizen", code: undefined, percentOff: 20, flatOff: undefined, validTo: daysAhead(365), maxUses: undefined, usedCount: 312, isActive: false },
];

export const PASS_PLANS: PassPlan[] = [
  { id: "pln_1", name: "Monthly — Car (Home Zone)", vehicleType: "CAR", zoneScope: "Single zone", durationDays: 30, price: 2_400_00, isActive: true, activePasses: 486 },
  { id: "pln_2", name: "Monthly — Two Wheeler (Home Zone)", vehicleType: "TWO_WHEELER", zoneScope: "Single zone", durationDays: 30, price: 1_200_00, isActive: true, activePasses: 1_204 },
  { id: "pln_3", name: "Monthly — Car (Ward-wide)", vehicleType: "CAR", zoneScope: "All zones in ward", durationDays: 30, price: 3_600_00, isActive: true, activePasses: 231 },
  { id: "pln_4", name: "Quarterly — Car (City-wide)", vehicleType: "CAR", zoneScope: "All zones", durationDays: 90, price: 12_000_00, isActive: true, activePasses: 88 },
  { id: "pln_5", name: "Monthly — Commercial", vehicleType: "COMMERCIAL", zoneScope: "Single zone", durationDays: 30, price: 6_000_00, isActive: true, activePasses: 64 },
  { id: "pln_6", name: "Season — Festival (14 days)", vehicleType: "CAR", zoneScope: "All zones", durationDays: 14, price: 1_800_00, isActive: false, activePasses: 0 },
];

const HOLDERS = ["Ananya Bose", "Rohit Sharma", "Priya Nandi", "Imtiaz Ali", "Sneha Kar", "Vikram Sinha", "Meghna Roy", "Arjun Pillai", "Farhan Qureshi", "Deepa Iyer", "Suman Ghatak", "Nabanita Sen"];

export const PASSES: Pass[] = Array.from({ length: 42 }).map((_, i) => {
  const plan = rng.pick(PASS_PLANS.filter((p) => p.isActive));
  const daysIn = rng.int(0, plan.durationDays + 12);
  const expired = daysIn > plan.durationDays;
  return {
    id: `pss_${String(i + 1).padStart(3, "0")}`,
    code: `PASS-${rng.int(10000, 99999)}`,
    holderName: rng.pick(HOLDERS),
    holderPhone: `+91 9${rng.int(100000, 999999)}${rng.int(10, 99)}`,
    plateNumber: `WB${String(rng.int(1, 99)).padStart(2, "0")}${["AB", "CD", "EF", "KL", "MN"][rng.int(0, 4)]}${String(rng.int(1000, 9999))}`,
    planName: plan.name,
    validFrom: daysAgo(daysIn),
    validTo: daysAhead(plan.durationDays - daysIn),
    status: expired ? "EXPIRED" : rng.bool(0.05) ? "CANCELLED" : rng.bool(0.04) ? "PENDING_PAYMENT" : "ACTIVE",
    price: plan.price,
  };
});
