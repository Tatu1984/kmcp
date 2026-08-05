import type { Vendor, Attendant, Shift } from "@/shared/types/domain.types";
import { ZONES } from "./geography";
import { makeRng, daysAgo, minutesAgo } from "./rng";

const rng = makeRng(770315);

export const VENDORS: Vendor[] = [
  {
    id: "ven_metro",
    orgName: "Metro Parking Services Pvt Ltd",
    contactName: "Arindam Sen",
    contactPhone: "+91 98300 44120",
    email: "ops@metroparking.in",
    gstin: "19AABCM1234C1ZP",
    pan: "AABCM1234C",
    bankAccountNo: "•••• 4417",
    bankIfsc: "HDFC0000123",
    commissionPct: 18,
    rating: 4.6,
    status: "APPROVED",
    zoneCount: 5,
    attendantCount: 14,
    revenueMonth: 18_42_500_00,
    pendingSettlement: 2_18_400_00,
    kycComplete: true,
    documents: [
      { id: "doc_m1", type: "AGREEMENT", fileName: "metro-agreement-2026.pdf", verified: true, uploadedAt: daysAgo(180) },
      { id: "doc_m2", type: "GST", fileName: "metro-gst-certificate.pdf", verified: true, uploadedAt: daysAgo(180) },
      { id: "doc_m3", type: "PAN", fileName: "metro-pan.pdf", verified: true, uploadedAt: daysAgo(180) },
      { id: "doc_m4", type: "BANK_PROOF", fileName: "metro-cancelled-cheque.jpg", verified: true, uploadedAt: daysAgo(178) },
    ],
    approvedAt: daysAgo(176),
    createdAt: daysAgo(181),
  },
  {
    id: "ven_orbit",
    orgName: "Orbit Kerbside Management",
    contactName: "Rituparna Ghosh",
    contactPhone: "+91 90070 21188",
    email: "hello@orbitkerb.co.in",
    gstin: "19AAGCO7781M1Z4",
    pan: "AAGCO7781M",
    bankAccountNo: "•••• 9902",
    bankIfsc: "ICIC0000456",
    commissionPct: 20,
    rating: 4.2,
    status: "APPROVED",
    zoneCount: 6,
    attendantCount: 18,
    revenueMonth: 14_08_900_00,
    pendingSettlement: 1_64_200_00,
    kycComplete: true,
    documents: [
      { id: "doc_o1", type: "AGREEMENT", fileName: "orbit-agreement.pdf", verified: true, uploadedAt: daysAgo(150) },
      { id: "doc_o2", type: "GST", fileName: "orbit-gst.pdf", verified: true, uploadedAt: daysAgo(150) },
      { id: "doc_o3", type: "PAN", fileName: "orbit-pan.pdf", verified: true, uploadedAt: daysAgo(150) },
      { id: "doc_o4", type: "BANK_PROOF", fileName: "orbit-bank.pdf", verified: true, uploadedAt: daysAgo(149) },
    ],
    approvedAt: daysAgo(147),
    createdAt: daysAgo(152),
  },
  {
    id: "ven_civic",
    orgName: "Civic Mobility Partners",
    contactName: "Debasish Roy",
    contactPhone: "+91 98311 77650",
    email: "contracts@civicmobility.in",
    gstin: "19AAECC5512R1ZH",
    pan: "AAECC5512R",
    bankAccountNo: "•••• 1120",
    bankIfsc: "SBIN0001234",
    commissionPct: 17.5,
    rating: 4.4,
    status: "APPROVED",
    zoneCount: 5,
    attendantCount: 11,
    revenueMonth: 11_76_300_00,
    pendingSettlement: 96_800_00,
    kycComplete: true,
    documents: [
      { id: "doc_c1", type: "AGREEMENT", fileName: "civic-agreement.pdf", verified: true, uploadedAt: daysAgo(96) },
      { id: "doc_c2", type: "GST", fileName: "civic-gst.pdf", verified: true, uploadedAt: daysAgo(96) },
      { id: "doc_c3", type: "PAN", fileName: "civic-pan.pdf", verified: true, uploadedAt: daysAgo(96) },
      { id: "doc_c4", type: "BANK_PROOF", fileName: "civic-bank.pdf", verified: false, uploadedAt: daysAgo(12) },
    ],
    approvedAt: daysAgo(92),
    createdAt: daysAgo(99),
  },
  {
    id: "ven_shakti",
    orgName: "Shakti Parking Contractors",
    contactName: "Md. Imran Khan",
    contactPhone: "+91 91630 55401",
    email: "shakti.parking@gmail.com",
    gstin: "19AAFFS9012K1ZB",
    pan: "AAFFS9012K",
    bankAccountNo: "•••• 3388",
    bankIfsc: "PUNB0002345",
    commissionPct: 22,
    rating: 3.4,
    status: "SUSPENDED",
    zoneCount: 3,
    attendantCount: 9,
    revenueMonth: 6_21_700_00,
    pendingSettlement: 3_44_100_00,
    kycComplete: true,
    documents: [
      { id: "doc_s1", type: "AGREEMENT", fileName: "shakti-agreement.pdf", verified: true, uploadedAt: daysAgo(240) },
      { id: "doc_s2", type: "GST", fileName: "shakti-gst.pdf", verified: true, uploadedAt: daysAgo(240) },
      { id: "doc_s3", type: "PAN", fileName: "shakti-pan.pdf", verified: true, uploadedAt: daysAgo(240) },
    ],
    approvedAt: daysAgo(236),
    createdAt: daysAgo(242),
  },
  {
    id: "ven_uday",
    orgName: "Uday Kerb Solutions LLP",
    contactName: "Sohini Mitra",
    contactPhone: "+91 89100 33027",
    email: "sohini@udaykerb.in",
    commissionPct: 19,
    status: "PENDING",
    zoneCount: 0,
    attendantCount: 0,
    revenueMonth: 0,
    pendingSettlement: 0,
    kycComplete: false,
    documents: [
      { id: "doc_u1", type: "AGREEMENT", fileName: "uday-draft-agreement.pdf", verified: false, uploadedAt: daysAgo(4) },
      { id: "doc_u2", type: "PAN", fileName: "uday-pan.pdf", verified: false, uploadedAt: daysAgo(4) },
    ],
    createdAt: daysAgo(6),
  },
  {
    id: "ven_paribahan",
    orgName: "Paribahan Street Services",
    contactName: "Kaushik Dutta",
    contactPhone: "+91 90514 88231",
    email: "kaushik@paribahan.co.in",
    gstin: "19AAJCP3344Q1ZL",
    pan: "AAJCP3344Q",
    commissionPct: 21,
    rating: 2.8,
    status: "BLOCKED",
    zoneCount: 0,
    attendantCount: 0,
    revenueMonth: 0,
    pendingSettlement: 0,
    kycComplete: true,
    documents: [
      { id: "doc_p1", type: "AGREEMENT", fileName: "paribahan-agreement.pdf", verified: true, uploadedAt: daysAgo(400) },
    ],
    approvedAt: daysAgo(396),
    createdAt: daysAgo(402),
  },
];

const FIRST = ["Subhash", "Rakesh", "Anwar", "Pintu", "Sujoy", "Bikash", "Tapas", "Jamal", "Nirmal", "Prasenjit", "Rahul", "Kartik", "Sanjay", "Faizal", "Amit", "Dipankar", "Sujata", "Mamoni", "Rehana", "Kalpana"];
const LAST = ["Das", "Mondal", "Sheikh", "Ghosh", "Naskar", "Halder", "Pal", "Ansari", "Sardar", "Biswas", "Roy", "Dutta", "Mistry", "Khatun", "Bose"];

export const ATTENDANTS: Attendant[] = Array.from({ length: 34 }).map((_, i) => {
  const vendor = rng.pick(VENDORS.filter((v) => v.status === "APPROVED" || v.status === "SUSPENDED"));
  const zone = rng.pick(ZONES.filter((z) => z.vendorId === vendor.id)) ?? ZONES[0];
  const active = rng.bool(0.88);
  const onShift = active && rng.bool(0.55);
  return {
    id: `att_${String(i + 1).padStart(3, "0")}`,
    name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
    employeeCode: `${vendor.id.slice(4, 8).toUpperCase()}-${String(i + 101)}`,
    phone: `+91 9${rng.int(1000000, 9999999)}${rng.int(10, 99)}`,
    vendorId: vendor.id,
    vendorName: vendor.orgName,
    zoneId: zone?.id,
    zoneName: zone?.name,
    isActive: active,
    onShift,
    deviceBound: rng.bool(0.92),
    sessionsToday: onShift ? rng.int(8, 74) : rng.int(0, 12),
    collectionToday: onShift ? rng.int(400, 6200) * 100 : rng.int(0, 900) * 100,
    rating: Number((3 + rng.next() * 2).toFixed(1)),
    createdAt: daysAgo(rng.int(20, 300)),
  };
});

export const SHIFTS: Shift[] = Array.from({ length: 28 }).map((_, i) => {
  const attendant = ATTENDANTS[i % ATTENDANTS.length];
  const open = i < 6;
  const cashExpected = rng.int(600, 5800) * 100;
  const digital = rng.int(900, 8200) * 100;
  const deposited = open ? undefined : rng.bool(0.82) ? cashExpected : cashExpected - rng.int(20, 260) * 100;
  const variance = deposited === undefined ? undefined : deposited - cashExpected;
  const status = open
    ? ("OPEN" as const)
    : variance && variance !== 0
      ? ("VARIANCE_FLAGGED" as const)
      : rng.bool(0.7)
        ? ("VERIFIED" as const)
        : ("CLOSED" as const);
  return {
    id: `shf_${String(i + 1).padStart(3, "0")}`,
    attendantId: attendant.id,
    attendantName: attendant.name,
    vendorName: attendant.vendorName,
    zoneName: attendant.zoneName ?? "—",
    startAt: minutesAgo(open ? rng.int(60, 420) : rng.int(600, 8000)),
    endAt: open ? undefined : minutesAgo(rng.int(30, 600)),
    sessionsCount: rng.int(14, 96),
    cashExpected,
    cashDeposited: deposited,
    digitalTotal: digital,
    varianceAmount: variance,
    status,
  };
});
